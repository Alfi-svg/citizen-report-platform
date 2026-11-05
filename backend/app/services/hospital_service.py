import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
import httpx
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hospital import (
    Hospital,
    BloodInventory,
    BloodInventoryStatus,
    HospitalInventoryAudit,
)
from app.models.emergency_service import VerificationStatus
from app.models.blood import BloodGroup
from app.models.user import User
from app.schemas.hospital import (
    HospitalSummary,
    BloodInventoryItem,
    HospitalDetailResponse,
    AdminHospitalCreate,
    AdminHospitalUpdate,
    AdminInventoryUpdateRequest,
)
from app.core.geo import calculate_haversine_distance, BD_DISTRICT_COORDS
from app.core.config import settings
from app.services.google_places import search_google_places_hospitals

logger = logging.getLogger("hospital_service")

ALL_BLOOD_GROUPS = [
    BloodGroup.A_POS,
    BloodGroup.A_NEG,
    BloodGroup.B_POS,
    BloodGroup.B_NEG,
    BloodGroup.AB_POS,
    BloodGroup.AB_NEG,
    BloodGroup.O_POS,
    BloodGroup.O_NEG,
]

DISTRICT_ALIASES = {
    "chittagong": "Chattogram",
    "chattogram": "Chittagong",
    "comilla": "Cumilla",
    "cumilla": "Comilla",
    "bogra": "Bogura",
    "bogura": "Bogra",
    "jessore": "Jashore",
    "jashore": "Jessore",
    "barisal": "Barishal",
    "barishal": "Barisal",
}


def _serialize_inventory_item(inv: BloodInventory) -> BloodInventoryItem:
    updater_name = None
    is_staff_verified = False
    last_staff_update = None
    source_label = "Baseline Demo Stock (Awaiting Staff Verification)"

    if inv.updated_by is not None:
        is_staff_verified = True
        last_staff_update = inv.last_updated
        source_label = "Staff Verified Stock"
        if inv.updater:
            updater_name = inv.updater.full_name or inv.updater.username
        else:
            updater_name = "Authorized Hospital Staff"

    return BloodInventoryItem(
        blood_group=inv.blood_group.value if hasattr(inv.blood_group, "value") else str(inv.blood_group),
        available_units=inv.available_units,
        availability_status=inv.availability_status.value if hasattr(inv.availability_status, "value") else str(inv.availability_status),
        is_verified=is_staff_verified,
        is_baseline_demo=not is_staff_verified,
        stock_source_label=source_label,
        last_updated=inv.last_updated,
        last_staff_update=last_staff_update,
        updated_by_name=updater_name,
    )


def _serialize_hospital_summary(
    hospital: Hospital,
    distance_km: Optional[float] = None,
    road_distance_km: Optional[float] = None,
    estimated_travel_minutes: Optional[float] = None,
    distance_type: Optional[str] = "STRAIGHT_LINE",
    filter_group: Optional[str] = None,
    origin_lat: Optional[float] = None,
    origin_lng: Optional[float] = None,
) -> HospitalSummary:
    raw_inventories = {_serialize_inventory_item(inv).blood_group: _serialize_inventory_item(inv) for inv in hospital.blood_inventories}

    # Guarantee all 8 blood groups are represented without fabrication
    all_8_items: List[BloodInventoryItem] = []
    available_groups: List[str] = []
    last_update = hospital.updated_at
    matching_inv = None

    for bg in ALL_BLOOD_GROUPS:
        bg_val = bg.value
        if bg_val in raw_inventories:
            item = raw_inventories[bg_val]
        else:
            # Mark unverified / missing inventory explicitly
            item = BloodInventoryItem(
                blood_group=bg_val,
                available_units=0,
                availability_status="UNKNOWN",
                is_verified=False,
                is_baseline_demo=False,
                stock_source_label="Blood stock information unavailable",
                last_updated=None,
                last_staff_update=None,
                updated_by_name=None,
            )

        all_8_items.append(item)

        if item.availability_status in ("AVAILABLE", "LOW_STOCK") and item.available_units > 0:
            available_groups.append(item.blood_group)

        if filter_group and item.blood_group.upper().replace(" ", "") == filter_group.upper().replace(" ", ""):
            matching_inv = item

        if item.last_updated and (last_update is None or item.last_updated > last_update):
            last_update = item.last_updated

    verification_label = "Verified Hospital" if hospital.verification_status == VerificationStatus.VERIFIED else "Unverified Hospital"

    # Build navigation link
    if hospital.latitude is not None and hospital.longitude is not None:
        if origin_lat is not None and origin_lng is not None:
            google_maps_url = f"https://www.google.com/maps/dir/?api=1&origin={origin_lat:.6f},{origin_lng:.6f}&destination={hospital.latitude:.6f},{hospital.longitude:.6f}"
        else:
            google_maps_url = f"https://www.google.com/maps/search/?api=1&query={hospital.latitude:.6f},{hospital.longitude:.6f}"
    else:
        google_maps_url = f"https://www.google.com/maps/search/?api=1&query={hospital.name},+{hospital.district}"

    return HospitalSummary(
        id=hospital.id,
        name=hospital.name,
        name_bn=hospital.name_bn,
        blood_bank_name=hospital.blood_bank_name,
        district=hospital.district,
        area=hospital.area,
        address=hospital.address,
        address_bn=hospital.address_bn,
        latitude=hospital.latitude,
        longitude=hospital.longitude,
        emergency_phone=hospital.emergency_phone,
        alternate_phone=hospital.alternate_phone,
        verification_status=hospital.verification_status.value if hasattr(hospital.verification_status, "value") else str(hospital.verification_status),
        has_blood_bank=hospital.has_blood_bank,
        distance_km=distance_km,
        road_distance_km=road_distance_km,
        estimated_travel_minutes=estimated_travel_minutes,
        distance_type=distance_type,
        hospital_type="General & Specialized Hospital",
        emergency_department="24/7 Emergency & Trauma",
        google_maps_url=google_maps_url,
        matching_inventory=matching_inv,
        available_groups=available_groups,
        all_inventories=all_8_items,
        last_inventory_update=last_update,
        verification_label=verification_label,
        available_actions=[
            "Call Hospital",
            "View Location",
            "View Blood Availability",
            "Open Hospital Details",
        ],
    )


async def _fetch_osrm_table(
    origin_lat: float,
    origin_lng: float,
    destinations: List[Tuple[float, float]],
) -> Dict[int, Tuple[float, float]]:
    """
    Batches travel distances and driving durations using OSRM Table Service.
    Returns mapping of index -> (road_distance_km, travel_minutes).
    """
    if not destinations:
        return {}

    # OSRM coordinate sequence: origin, dest_0, dest_1, ...
    coords = [f"{origin_lng:.6f},{origin_lat:.6f}"]
    for d_lat, d_lng in destinations:
        coords.append(f"{d_lng:.6f},{d_lat:.6f}")

    url = f"{settings.OSRM_BASE_URL.rstrip('/')}/table/v1/driving/{';'.join(coords)}?sources=0&annotations=distance,duration"

    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok":
                    distances = data.get("distances", [[]])[0]
                    durations = data.get("durations", [[]])[0]
                    result = {}
                    for i in range(len(destinations)):
                        dist_val = distances[i + 1] if (i + 1 < len(distances) and distances[i + 1] is not None) else None
                        dur_val = durations[i + 1] if (i + 1 < len(durations) and durations[i + 1] is not None) else None
                        if dist_val is not None and dur_val is not None:
                            result[i] = (round(dist_val / 1000.0, 1), round(dur_val / 60.0, 1))
                    return result
    except Exception as e:
        logger.debug("OSRM table lookup failed/timed out: %s; falling back to Haversine distance", e)

    return {}


async def get_nearby_hospitals(
    db: AsyncSession,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 30.0,
    district: Optional[str] = None,
    blood_group: Optional[str] = None,
    query: Optional[str] = None,
    verified_only: bool = False,
    sort_by: Optional[str] = "distance",
    limit: int = 20,
) -> List[HospitalSummary]:
    """
    Retrieves and ranks hospitals by distance, district, blood group match, and verified stock.
    Calculates road distance and travel time when coordinates are present.
    """
    conditions = [Hospital.is_active == True]

    if verified_only:
        conditions.append(Hospital.verification_status == VerificationStatus.VERIFIED)

    if district and district.lower() not in ("all", "all districts"):
        d_lower = district.lower().strip()
        alias = DISTRICT_ALIASES.get(d_lower)
        if alias:
            conditions.append(or_(func.lower(Hospital.district) == d_lower, func.lower(Hospital.district) == alias.lower()))
        else:
            conditions.append(func.lower(Hospital.district) == d_lower)

    if query:
        q = f"%{query.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Hospital.name).like(q),
                func.lower(Hospital.blood_bank_name).like(q),
                func.lower(Hospital.area).like(q),
                func.lower(Hospital.address).like(q),
            )
        )

    stmt = select(Hospital).where(and_(*conditions))
    res = await db.execute(stmt)
    hospitals = list(res.scalars().all())

    # Resolve target coordinates for distance estimation
    target_lat = latitude
    target_lng = longitude
    is_gps_origin = (latitude is not None and longitude is not None)

    if (target_lat is None or target_lng is None) and district:
        dist_key = district.lower().strip()
        if dist_key in BD_DISTRICT_COORDS:
            target_lat, target_lng = BD_DISTRICT_COORDS[dist_key]

    # Precompute straight-line distances
    filtered_hospitals: List[Tuple[Hospital, Optional[float]]] = []
    for h in hospitals:
        dist: Optional[float] = None
        if target_lat is not None and target_lng is not None and h.latitude is not None and h.longitude is not None:
            dist = round(calculate_haversine_distance(target_lat, target_lng, h.latitude, h.longitude), 1)
            # If explicit GPS coordinates filter was passed and distance exceeds radius, skip
            if is_gps_origin and dist > radius_km:
                continue
        filtered_hospitals.append((h, dist))

    # Sort initially by straight-line distance to take the most relevant for OSRM table
    filtered_hospitals.sort(key=lambda x: (x[1] if x[1] is not None else 9999.0))
    candidate_batch = filtered_hospitals[:min(len(filtered_hospitals), max(limit * 2, 25))]

    # If GPS origin is available, query OSRM table for actual road distance and driving duration
    osrm_metrics: Dict[int, Tuple[float, float]] = {}
    if is_gps_origin and target_lat is not None and target_lng is not None:
        valid_destinations = []
        dest_index_map = []
        for idx, (h, _) in enumerate(candidate_batch):
            if h.latitude is not None and h.longitude is not None:
                valid_destinations.append((h.latitude, h.longitude))
                dest_index_map.append(idx)

        if valid_destinations:
            osrm_raw = await _fetch_osrm_table(target_lat, target_lng, valid_destinations)
            for sub_idx, metrics in osrm_raw.items():
                parent_idx = dest_index_map[sub_idx]
                osrm_metrics[parent_idx] = metrics

    summaries: List[HospitalSummary] = []
    for idx, (h, straight_dist) in enumerate(candidate_batch):
        road_dist = None
        travel_min = None
        dist_type = "STRAIGHT_LINE" if straight_dist is not None else "UNAVAILABLE"

        if idx in osrm_metrics:
            road_dist, travel_min = osrm_metrics[idx]
            dist_type = "ROAD"

        summary = _serialize_hospital_summary(
            hospital=h,
            distance_km=straight_dist,
            road_distance_km=road_dist,
            estimated_travel_minutes=travel_min,
            distance_type=dist_type,
            filter_group=blood_group,
            origin_lat=target_lat,
            origin_lng=target_lng,
        )
        summaries.append(summary)

    # Sort results according to sort_by preference
    def sort_key(s: HospitalSummary):
        # 1. Matching stock priority (if blood group requested)
        stock_priority = 0
        if s.matching_inventory:
            if s.matching_inventory.availability_status == "AVAILABLE":
                stock_priority = -3
            elif s.matching_inventory.availability_status == "LOW_STOCK":
                stock_priority = -2
            elif s.matching_inventory.availability_status == "UNKNOWN":
                stock_priority = -1

        # 2. Distance value
        effective_dist = s.road_distance_km if s.road_distance_km is not None else (s.distance_km if s.distance_km is not None else 9999.0)
        effective_travel = s.estimated_travel_minutes if s.estimated_travel_minutes is not None else (effective_dist * 2.5)
        is_verified = -1 if s.verification_status == "VERIFIED" else 0

        if sort_by == "travel_time":
            return (effective_travel, stock_priority, is_verified)
        elif sort_by == "stock":
            units = -(s.matching_inventory.available_units if s.matching_inventory else 0)
            return (stock_priority, units, effective_dist)
        elif sort_by == "verified":
            return (is_verified, stock_priority, effective_dist)
        else:  # default "distance"
            return (stock_priority, effective_dist, is_verified)

    summaries.sort(key=sort_key)
    return summaries[:limit]


async def search_hospitals(
    db: AsyncSession,
    query: Optional[str] = None,
    district: Optional[str] = None,
    blood_group: Optional[str] = None,
    limit: int = 20,
) -> List[HospitalSummary]:
    """Search hospitals by textual query or district."""
    return await get_nearby_hospitals(
        db=db,
        district=district,
        blood_group=blood_group,
        query=query,
        limit=limit,
    )


async def get_hospital_details(
    db: AsyncSession,
    hospital_id: uuid.UUID,
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
) -> Optional[HospitalDetailResponse]:
    """
    Retrieves complete hospital profile, all 8 blood groups inventory, and inventory audit trail.
    """
    stmt = select(Hospital).where(Hospital.id == hospital_id)
    res = await db.execute(stmt)
    hospital = res.scalar_one_or_none()
    if not hospital:
        return None

    straight_dist = None
    road_dist = None
    travel_min = None
    dist_type = "UNAVAILABLE"

    if user_lat is not None and user_lng is not None and hospital.latitude and hospital.longitude:
        straight_dist = round(calculate_haversine_distance(user_lat, user_lng, hospital.latitude, hospital.longitude), 1)
        dist_type = "STRAIGHT_LINE"
        osrm_data = await _fetch_osrm_table(user_lat, user_lng, [(hospital.latitude, hospital.longitude)])
        if 0 in osrm_data:
            road_dist, travel_min = osrm_data[0]
            dist_type = "ROAD"

    summary = _serialize_hospital_summary(
        hospital=hospital,
        distance_km=straight_dist,
        road_distance_km=road_dist,
        estimated_travel_minutes=travel_min,
        distance_type=dist_type,
        origin_lat=user_lat,
        origin_lng=user_lng,
    )

    # Audits
    stmt_audits = (
        select(HospitalInventoryAudit)
        .where(HospitalInventoryAudit.hospital_id == hospital_id)
        .order_by(HospitalInventoryAudit.created_at.desc())
        .limit(20)
    )
    res_audits = await db.execute(stmt_audits)
    audits = res_audits.scalars().all()

    audit_items = []
    for a in audits:
        audit_items.append({
            "blood_group": a.blood_group.value if hasattr(a.blood_group, "value") else str(a.blood_group),
            "previous_units": a.previous_units,
            "new_units": a.new_units,
            "previous_status": a.previous_status.value if a.previous_status and hasattr(a.previous_status, "value") else str(a.previous_status) if a.previous_status else None,
            "new_status": a.new_status.value if hasattr(a.new_status, "value") else str(a.new_status),
            "updated_by_id": str(a.updated_by_id) if a.updated_by_id else None,
            "notes": a.notes,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return HospitalDetailResponse(
        hospital=summary,
        inventories=summary.all_inventories,
        audit_history=audit_items,
    )


async def admin_update_hospital_inventory(
    db: AsyncSession,
    hospital_id: uuid.UUID,
    update_data: AdminInventoryUpdateRequest,
    current_user: Optional[User] = None,
) -> BloodInventoryItem:
    """
    Updates hospital blood inventory, records audit log, and validates blood group.
    Only authorized admins or staff can call this.
    """
    # 1. Validate Blood Group
    norm_bg = update_data.blood_group.upper().replace(" ", "").strip()
    try:
        bg_enum = BloodGroup(norm_bg)
    except ValueError:
        raise ValueError(f"Invalid blood group '{update_data.blood_group}'. Allowed: A+, A-, B+, B-, AB+, AB-, O+, O-")

    # 2. Validate Available Units
    if update_data.available_units < 0:
        raise ValueError("Available units cannot be negative.")

    # 3. Determine status automatically if not provided
    if update_data.availability_status:
        try:
            status_enum = BloodInventoryStatus(update_data.availability_status.upper().strip())
        except ValueError:
            raise ValueError(f"Invalid availability status '{update_data.availability_status}'.")
    else:
        if update_data.available_units == 0:
            status_enum = BloodInventoryStatus.OUT_OF_STOCK
        elif update_data.available_units <= 3:
            status_enum = BloodInventoryStatus.LOW_STOCK
        else:
            status_enum = BloodInventoryStatus.AVAILABLE

    # 4. Check if inventory record exists
    stmt = select(BloodInventory).where(
        and_(
            BloodInventory.hospital_id == hospital_id,
            BloodInventory.blood_group == bg_enum,
        )
    )
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    prev_units: Optional[int] = None
    prev_status: Optional[BloodInventoryStatus] = None

    if inv is None:
        inv = BloodInventory(
            hospital_id=hospital_id,
            blood_group=bg_enum,
            available_units=update_data.available_units,
            availability_status=status_enum,
            is_verified=update_data.is_verified,
            last_updated=now,
            updated_by=current_user.id if current_user else None,
        )
        db.add(inv)
    else:
        prev_units = inv.available_units
        prev_status = inv.availability_status
        inv.available_units = update_data.available_units
        inv.availability_status = status_enum
        inv.is_verified = update_data.is_verified
        inv.last_updated = now
        inv.updated_by = current_user.id if current_user else None

    # 5. Create Audit Log
    audit = HospitalInventoryAudit(
        hospital_id=hospital_id,
        blood_group=bg_enum,
        previous_units=prev_units,
        new_units=update_data.available_units,
        previous_status=prev_status,
        new_status=status_enum,
        updated_by_id=current_user.id if current_user else None,
        notes=update_data.notes,
        created_at=now,
    )
    db.add(audit)

    await db.commit()
    await db.refresh(inv)
    return _serialize_inventory_item(inv)


# Alias for backward compatibility
update_hospital_inventory = admin_update_hospital_inventory


async def admin_create_hospital(
    db: AsyncSession,
    data: AdminHospitalCreate,
    current_user: Optional[User] = None,
) -> HospitalDetailResponse:
    """Creates a new hospital and initializes all 8 blood groups in inventory."""
    try:
        v_status = VerificationStatus(data.verification_status) if data.verification_status else VerificationStatus.VERIFIED
    except ValueError:
        v_status = VerificationStatus.VERIFIED

    hospital = Hospital(
        name=data.name.strip(),
        name_bn=data.name_bn.strip() if data.name_bn else None,
        blood_bank_name=data.blood_bank_name.strip() if data.blood_bank_name else None,
        district=data.district.strip(),
        area=data.area.strip(),
        address=data.address.strip(),
        address_bn=data.address_bn.strip() if data.address_bn else None,
        latitude=data.latitude,
        longitude=data.longitude,
        emergency_phone=data.emergency_phone.strip(),
        alternate_phone=data.alternate_phone.strip() if data.alternate_phone else None,
        verification_status=v_status,
        has_blood_bank=data.has_blood_bank,
        is_active=True,
    )
    db.add(hospital)
    await db.flush()

    # Initialize all 8 blood groups with UNKNOWN / 0 units
    now = datetime.now(timezone.utc)
    for bg in ALL_BLOOD_GROUPS:
        inv = BloodInventory(
            hospital_id=hospital.id,
            blood_group=bg,
            available_units=0,
            availability_status=BloodInventoryStatus.UNKNOWN,
            is_verified=False,
            last_updated=now,
            updated_by=current_user.id if current_user else None,
        )
        db.add(inv)

    await db.commit()
    await db.refresh(hospital)
    return await get_hospital_details(db, hospital.id)
