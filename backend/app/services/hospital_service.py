import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
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
    filter_group: Optional[str] = None,
) -> HospitalSummary:
    inventories = [_serialize_inventory_item(inv) for inv in hospital.blood_inventories]

    # Find matching inventory if group requested
    matching_inv = None
    available_groups = []
    last_update = hospital.updated_at

    for item in inventories:
        if item.availability_status in ("AVAILABLE", "LOW_STOCK") and item.available_units > 0:
            available_groups.append(item.blood_group)
        if filter_group and item.blood_group.upper().replace(" ", "") == filter_group.upper().replace(" ", ""):
            matching_inv = item
        if item.last_updated and (last_update is None or item.last_updated > last_update):
            last_update = item.last_updated

    verification_label = "Verified Hospital"
    if hospital.verification_status != VerificationStatus.VERIFIED:
        verification_label = "Unverified Hospital"

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
        matching_inventory=matching_inv,
        available_groups=available_groups,
        all_inventories=inventories,
        last_inventory_update=last_update,
        verification_label=verification_label,
        available_actions=[
            "Call Hospital",
            "View Location",
            "View Blood Availability",
            "Open Hospital Details",
        ],
    )


async def get_nearby_hospitals(
    db: AsyncSession,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 30.0,
    district: Optional[str] = None,
    blood_group: Optional[str] = None,
    query: Optional[str] = None,
    verified_only: bool = False,
    limit: int = 20,
) -> List[HospitalSummary]:
    """
    Retrieves and ranks hospitals by distance, district, or blood group match.
    Grounded in real database records with reliable status calculation.
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

    # If coordinates are missing, but district is specified, check district center for distance estimation
    target_lat = latitude
    target_lng = longitude
    if (target_lat is None or target_lng is None) and district:
        dist_key = district.lower().strip()
        if dist_key in BD_DISTRICT_COORDS:
            target_lat, target_lng = BD_DISTRICT_COORDS[dist_key]

    summaries: List[HospitalSummary] = []
    for h in hospitals:
        dist: Optional[float] = None
        if target_lat is not None and target_lng is not None and h.latitude is not None and h.longitude is not None:
            dist = calculate_haversine_distance(target_lat, target_lng, h.latitude, h.longitude)
            # If explicit coordinates filter was passed and distance exceeds radius, skip
            if latitude is not None and longitude is not None and dist > radius_km:
                continue

        summary = _serialize_hospital_summary(h, distance_km=dist, filter_group=blood_group)

        # If a specific blood group was requested, optionally boost hospitals with confirmed stock
        summaries.append(summary)

    # Sort results
    def sort_key(s: HospitalSummary):
        # 1. Matching stock priority
        has_match_stock = 0
        if s.matching_inventory:
            if s.matching_inventory.availability_status == "AVAILABLE":
                has_match_stock = -3
            elif s.matching_inventory.availability_status == "LOW_STOCK":
                has_match_stock = -2
            elif s.matching_inventory.availability_status == "UNKNOWN":
                has_match_stock = -1

        # 2. Distance priority
        dist_val = s.distance_km if s.distance_km is not None else 9999.0

        # 3. Verified priority
        is_verified = -1 if s.verification_status == "VERIFIED" else 0

        return (has_match_stock, dist_val, is_verified)

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
) -> Optional[HospitalDetailResponse]:
    """Retrieve hospital by ID with all 8 blood groups inventory and update history."""
    stmt = select(Hospital).where(Hospital.id == hospital_id)
    res = await db.execute(stmt)
    hospital = res.scalar_one_or_none()
    if not hospital:
        return None

    summary = _serialize_hospital_summary(hospital)
    inventories = [_serialize_inventory_item(inv) for inv in hospital.blood_inventories]

    # Audit history
    audits_stmt = (
        select(HospitalInventoryAudit)
        .where(HospitalInventoryAudit.hospital_id == hospital_id)
        .order_by(HospitalInventoryAudit.created_at.desc())
        .limit(20)
    )
    audits_res = await db.execute(audits_stmt)
    audits = audits_res.scalars().all()

    audit_items = []
    for a in audits:
        updater_str = (a.updater.full_name or a.updater.username) if a.updater else "System"
        audit_items.append({
            "id": str(a.id),
            "blood_group": a.blood_group.value if hasattr(a.blood_group, "value") else str(a.blood_group),
            "previous_units": a.previous_units,
            "new_units": a.new_units,
            "previous_status": a.previous_status.value if a.previous_status and hasattr(a.previous_status, "value") else a.previous_status,
            "new_status": a.new_status.value if hasattr(a.new_status, "value") else str(a.new_status),
            "updated_by": updater_str,
            "notes": a.notes,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return HospitalDetailResponse(
        hospital=summary,
        inventories=inventories,
        audit_history=audit_items,
    )


async def update_hospital_inventory(
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
