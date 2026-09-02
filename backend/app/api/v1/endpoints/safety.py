import math
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.session import get_db
from app.models.emergency_service import EmergencyService, ServiceType, VerificationStatus
from app.schemas.emergency_service import (
    NearbyEmergencyServicesResult,
    NearbyServiceResponse,
    AreaReference,
    PublicEmergencyServiceResponse,
)

router = APIRouter()

EARTH_RADIUS_KM = 6371.0

PRECONFIGURED_AREAS: List[AreaReference] = [
    AreaReference(id="dhaka_dhanmondi", name="Dhanmondi", name_bn="ধানমন্ডি", district="Dhaka", district_bn="ঢাকা", latitude=23.7461, longitude=90.3742),
    AreaReference(id="dhaka_shahbagh", name="Shahbagh / DU", name_bn="শাহবাগ / ঢাবি", district="Dhaka", district_bn="ঢাকা", latitude=23.7383, longitude=90.3957),
    AreaReference(id="dhaka_ramna", name="Ramna / Kakrail", name_bn="রমনা / কাকরাইল", district="Dhaka", district_bn="ঢাকা", latitude=23.7431, longitude=90.4079),
    AreaReference(id="dhaka_gulshan", name="Gulshan", name_bn="গুলশান", district="Dhaka", district_bn="ঢাকা", latitude=23.7925, longitude=90.4152),
    AreaReference(id="dhaka_banani", name="Banani", name_bn="বনানী", district="Dhaka", district_bn="ঢাকা", latitude=23.7937, longitude=90.4046),
    AreaReference(id="dhaka_mirpur", name="Mirpur", name_bn="মিরপুর", district="Dhaka", district_bn="ঢাকা", latitude=23.8055, longitude=90.3639),
    AreaReference(id="dhaka_uttara", name="Uttara", name_bn="উত্তরা", district="Dhaka", district_bn="ঢাকা", latitude=23.8681, longitude=90.3995),
    AreaReference(id="dhaka_mohammadpur", name="Mohammadpur", name_bn="মোহাম্মদপুর", district="Dhaka", district_bn="ঢাকা", latitude=23.7658, longitude=90.3627),
    AreaReference(id="dhaka_tejgaon", name="Tejgaon / Farmgate", name_bn="তেজগাঁও / ফার্মগেট", district="Dhaka", district_bn="ঢাকা", latitude=23.7597, longitude=90.3912),
    AreaReference(id="dhaka_old_dhaka", name="Old Dhaka / Kotwali", name_bn="পুরান ঢাকা / কোতোয়ালী", district="Dhaka", district_bn="ঢাকা", latitude=23.7099, longitude=90.4116),
    AreaReference(id="ctg_kotwali", name="Chittagong GEC / Kotwali", name_bn="চট্টগ্রাম জিইসি / কোতোয়ালী", district="Chittagong", district_bn="চট্টগ্রাম", latitude=22.3364, longitude=91.8340),
    AreaReference(id="syl_kotwali", name="Sylhet Bandar Bazar", name_bn="সিলেট বন্দর বাজার", district="Sylhet", district_bn="সিলেট", latitude=24.8917, longitude=91.8710),
    AreaReference(id="raj_boalia", name="Rajshahi Zero Point", name_bn="রাজশাহী জিরো পয়েন্ট", district="Rajshahi", district_bn="রাজশাহী", latitude=24.3685, longitude=88.6042),
    AreaReference(id="khu_sadar", name="Khulna Dakbangla", name_bn="খুলনা ডাকবাংলা", district="Khulna", district_bn="খুলনা", latitude=22.8122, longitude=89.5644),
]


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def format_distance(distance_km: float) -> str:
    """Formats distance in a human-friendly approximate format."""
    if distance_km < 1.0:
        meters = int(round(distance_km * 1000, -1))
        if meters < 50:
            return "Nearby (<50 m)"
        return f"{meters} m"
    return f"{distance_km:.1f} km"


def build_directions_url(dest_lat: Optional[float], dest_lng: Optional[float], origin_lat: Optional[float] = None, origin_lng: Optional[float] = None) -> str:
    """Constructs Google Maps directions URL without exposing private user location unnecessarily."""
    if dest_lat is None or dest_lng is None:
        return ""
    if origin_lat is not None and origin_lng is not None:
        return f"https://www.google.com/maps/dir/?api=1&origin={origin_lat:.6f},{origin_lng:.6f}&destination={dest_lat:.6f},{dest_lng:.6f}"
    return f"https://www.google.com/maps/dir/?api=1&destination={dest_lat:.6f},{dest_lng:.6f}"


def check_is_fresh(last_verified_at: Optional[datetime]) -> bool:
    if not last_verified_at:
        return False
    now = datetime.now(timezone.utc)
    # Handle both naive and aware datetimes safely
    if last_verified_at.tzinfo is None:
        from datetime import timezone as tz
        last_verified_at = last_verified_at.replace(tzinfo=tz.utc)
    delta_days = (now - last_verified_at).days
    return delta_days <= settings.SAFETY_DIRECTORY_FRESHNESS_DAYS


@router.get(
    "/services/areas",
    response_model=List[AreaReference],
    status_code=status.HTTP_200_OK,
    summary="Get preconfigured Bangladesh areas for manual location selection",
)
async def get_preconfigured_areas() -> List[AreaReference]:
    """Returns official area coordinates for users who choose to select their location manually."""
    return PRECONFIGURED_AREAS


@router.get(
    "/services",
    response_model=List[PublicEmergencyServiceResponse],
    status_code=status.HTTP_200_OK,
    summary="Public directory browse for active emergency services",
)
async def list_public_emergency_services(
    division: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    service_type: Optional[ServiceType] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> List[PublicEmergencyServiceResponse]:
    """Returns active emergency services filtered by administrative area."""
    conditions = [
        EmergencyService.is_active == True,
        EmergencyService.verification_status != VerificationStatus.INACTIVE,
    ]
    if division:
        conditions.append(EmergencyService.division.ilike(f"%{division.strip()}%"))
    if district:
        conditions.append(EmergencyService.district.ilike(f"%{district.strip()}%"))
    if service_type:
        conditions.append(EmergencyService.service_type == service_type)

    stmt = (
        select(EmergencyService)
        .where(and_(*conditions))
        .order_by(
            # Verified services ranked first
            (EmergencyService.verification_status == VerificationStatus.VERIFIED).desc(),
            EmergencyService.name.asc()
        )
        .limit(100)
    )
    result = await db.execute(stmt)
    services = result.scalars().all()

    return [
        PublicEmergencyServiceResponse(
            id=s.id,
            name=s.name,
            name_bn=s.name_bn,
            service_type=s.service_type,
            division=s.division,
            district=s.district,
            area=s.area,
            address=s.address,
            address_bn=s.address_bn,
            phone=s.phone,
            alternate_phone=s.alternate_phone,
            latitude=s.latitude,
            longitude=s.longitude,
            source=s.source,
            source_url=s.source_url,
            verification_status=s.verification_status,
            last_verified_at=s.last_verified_at,
            is_fresh=check_is_fresh(s.last_verified_at),
        )
        for s in services
    ]


@router.get(
    "/services/nearby",
    response_model=NearbyEmergencyServicesResult,
    status_code=status.HTTP_200_OK,
    summary="Find nearest emergency services by GPS coordinates",
)
async def get_nearby_emergency_services(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="User latitude (WGS84)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="User longitude (WGS84)"),
    radius_km: float = Query(25.0, ge=1.0, le=100.0, description="Search radius in km"),
    service_type: Optional[ServiceType] = Query(None, description="Optional service type filter"),
    limit: int = Query(15, ge=1, le=50, description="Max nearby results"),
    db: AsyncSession = Depends(get_db),
) -> NearbyEmergencyServicesResult:
    """
    Computes distance to active official emergency services and returns:
    - 999 National Emergency Service
    - Nearest Police Station (prioritizing verified units)
    - Nearest Police Box (prioritizing verified units)
    - List of other nearby emergency services sorted with verified units prioritized
    """
    conditions = [
        EmergencyService.is_active == True,
        EmergencyService.verification_status != VerificationStatus.INACTIVE,
        EmergencyService.latitude.isnot(None),
        EmergencyService.longitude.isnot(None),
    ]
    if service_type:
        conditions.append(EmergencyService.service_type == service_type)

    stmt = select(EmergencyService).where(and_(*conditions))
    result = await db.execute(stmt)
    all_services = result.scalars().all()

    # Calculate distance for services with valid coordinates
    scored_services = []
    for service in all_services:
        if service.latitude is None or service.longitude is None:
            continue
        dist = calculate_haversine_distance(latitude, longitude, service.latitude, service.longitude)
        if dist <= radius_km:
            # Ranking key: (tier, dist)
            # tier 0: VERIFIED, tier 1: UNVERIFIED / NEEDS_REVIEW / OUTDATED
            tier = 0 if service.verification_status == VerificationStatus.VERIFIED else 1
            scored_services.append((tier, dist, service))

    # Sort primarily by tier (verified first), secondarily by distance ascending
    scored_services.sort(key=lambda x: (x[0], x[1]))

    nearest_ps: Optional[NearbyServiceResponse] = None
    nearest_pb: Optional[NearbyServiceResponse] = None
    nearby_list: List[NearbyServiceResponse] = []
    has_verified = False

    for tier, dist, service in scored_services:
        is_fresh = check_is_fresh(service.last_verified_at)
        if service.verification_status == VerificationStatus.VERIFIED:
            has_verified = True

        item = NearbyServiceResponse(
            id=service.id,
            name=service.name,
            name_bn=service.name_bn,
            service_type=service.service_type,
            division=service.division,
            district=service.district,
            area=service.area,
            address=service.address,
            address_bn=service.address_bn,
            phone=service.phone,
            alternate_phone=service.alternate_phone,
            latitude=service.latitude,
            longitude=service.longitude,
            source=service.source,
            source_url=service.source_url,
            verification_status=service.verification_status,
            last_verified_at=service.last_verified_at,
            is_fresh=is_fresh,
            distance_km=round(dist, 2),
            distance_formatted=format_distance(dist),
            directions_url=build_directions_url(service.latitude, service.longitude, latitude, longitude),
        )

        # Nearest Police Station (picks closest in highest available tier)
        if service.service_type == ServiceType.POLICE_STATION and nearest_ps is None:
            nearest_ps = item
        elif service.service_type == ServiceType.POLICE_BOX and nearest_pb is None:
            nearest_pb = item

        if len(nearby_list) < limit:
            nearby_list.append(item)

    # Fallback if no police station in radius: search entire active directory
    if nearest_ps is None:
        ps_candidates = []
        for s in all_services:
            if s.service_type == ServiceType.POLICE_STATION and s.latitude is not None and s.longitude is not None:
                dist = calculate_haversine_distance(latitude, longitude, s.latitude, s.longitude)
                tier = 0 if s.verification_status == VerificationStatus.VERIFIED else 1
                ps_candidates.append((tier, dist, s))
        if ps_candidates:
            ps_candidates.sort(key=lambda x: (x[0], x[1]))
            _, best_dist, best_s = ps_candidates[0]
            nearest_ps = NearbyServiceResponse(
                id=best_s.id,
                name=best_s.name,
                name_bn=best_s.name_bn,
                service_type=best_s.service_type,
                division=best_s.division,
                district=best_s.district,
                area=best_s.area,
                address=best_s.address,
                address_bn=best_s.address_bn,
                phone=best_s.phone,
                alternate_phone=best_s.alternate_phone,
                latitude=best_s.latitude,
                longitude=best_s.longitude,
                source=best_s.source,
                source_url=best_s.source_url,
                verification_status=best_s.verification_status,
                last_verified_at=best_s.last_verified_at,
                is_fresh=check_is_fresh(best_s.last_verified_at),
                distance_km=round(best_dist, 2),
                distance_formatted=format_distance(best_dist),
                directions_url=build_directions_url(best_s.latitude, best_s.longitude, latitude, longitude),
            )

    warning = None
    if scored_services and not has_verified:
        warning = "Contact information may require verification."

    return NearbyEmergencyServicesResult(
        nearest_police_station=nearest_ps,
        nearest_police_box=nearest_pb,
        nearby_services=nearby_list,
        search_location={"latitude": latitude, "longitude": longitude},
        total_found=len(scored_services),
        warning_message=warning,
    )
