import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonorAvailability,
    BloodRequest,
    BloodDonorProfile,
    BloodRequestResponse,
    DonationStatus,
    BloodDonationRecord,
)
from app.schemas.blood import (
    BloodRequestCreate,
    BloodRequestUpdate,
    PublicBloodRequest,
    BloodRequestPagination,
    PublicBloodMapPoint,
    PublicBloodMapResponse,
    DonorProfileCreate,
    DonorProfileUpdate,
    DonorProfileResponse,
    BloodRespondCreate,
    BloodResponseItem,
    BloodFlagCreate,
    BloodDonationClaimCreate,
    BloodDonationDisputeRequest,
    BloodDonationRateRequest,
    BloodDonationResponse,
)
from app.services import blood as blood_service

router = APIRouter()

# Bangladesh District Center Coordinates
BD_DISTRICT_COORDS: Dict[str, Tuple[float, float]] = {
    "dhaka": (23.8103, 90.4125),
    "chattogram": (22.3569, 91.7832),
    "chittagong": (22.3569, 91.7832),
    "sylhet": (24.8949, 91.8687),
    "rajshahi": (24.3745, 88.6042),
    "khulna": (22.8122, 89.5644),
    "barishal": (22.7010, 90.3535),
    "barisal": (22.7010, 90.3535),
    "rangpur": (25.7439, 89.2752),
    "mymensingh": (24.7471, 90.4203),
    "gazipur": (23.9999, 90.4203),
    "narayanganj": (23.6238, 90.5000),
    "cumilla": (23.4682, 91.1788),
    "comilla": (23.4682, 91.1788),
    "bogura": (24.8465, 89.3777),
    "bogra": (24.8465, 89.3777),
    "cox's bazar": (21.4272, 92.0058),
    "coxsbazar": (21.4272, 92.0058),
    "noakhali": (22.8696, 91.0998),
    "feni": (23.0159, 91.3976),
    "brahmanbaria": (23.9571, 91.1119),
    "jessore": (23.1664, 89.2081),
    "jashore": (23.1664, 89.2081),
    "kushtia": (23.9013, 89.1205),
    "pabna": (24.0064, 89.2372),
    "dinajpur": (25.6217, 88.6355),
    "tangail": (24.2513, 89.9167),
    "faridpur": (23.6071, 89.8429),
    "jamalpur": (24.9375, 89.9378),
    "bagerhat": (22.6516, 89.7859),
    "bandarban": (22.1953, 92.2184),
    "barguna": (22.0953, 90.0768),
    "bhola": (22.6859, 90.6482),
    "chandpur": (23.2321, 90.6631),
    "chapainawabganj": (24.5965, 88.2775),
    "chuadanga": (23.6402, 88.8418),
    "gaibandha": (25.3288, 89.5430),
    "gopalganj": (23.0051, 89.8266),
    "habiganj": (24.3749, 91.4155),
    "jhalokathi": (22.6406, 90.1987),
    "jhenaidah": (23.5448, 89.1539),
    "joypurhat": (25.1015, 89.0267),
    "khagrachhari": (23.1193, 91.9847),
    "kishoreganj": (24.4449, 90.7766),
    "kurigram": (25.8054, 89.6362),
    "lakshmipur": (22.9425, 90.8412),
    "lalmonirhat": (25.9923, 89.2847),
    "madaripur": (23.1641, 90.1897),
    "magura": (23.4873, 89.4198),
    "manikganj": (23.8644, 90.0047),
    "meherpur": (23.7622, 88.6318),
    "moulvibazar": (24.4829, 91.7774),
    "munshiganj": (23.5422, 90.5305),
    "naogaon": (24.7936, 88.9318),
    "narail": (23.1725, 89.5127),
    "narsingdi": (23.9193, 90.7202),
    "natore": (24.4206, 88.9324),
    "netrokona": (24.8709, 90.7279),
    "nilphamari": (25.9318, 88.8560),
    "panchagarh": (26.3411, 88.5542),
    "patuakhali": (22.3596, 90.3299),
    "pirojpur": (22.5841, 89.9720),
    "rajbari": (23.7574, 89.6445),
    "rangamati": (22.6533, 92.1753),
    "satkhira": (22.7185, 89.0705),
    "shariatpur": (23.2423, 90.4348),
    "sherpur": (25.0205, 90.0153),
    "sirajganj": (24.4534, 89.7008),
    "sunamganj": (25.0658, 91.3950),
    "thakurgaon": (26.0337, 88.4617),
}

# Major Hospital and Medical Hub Reference Coordinates
BD_HOSPITAL_AREAS: Dict[str, Tuple[float, float]] = {
    "dhanmondi": (23.7461, 90.3742),
    "shahbagh": (23.7383, 90.3957),
    "panthapath": (23.7516, 90.3872),
    "mirpur": (23.8055, 90.3639),
    "uttara": (23.8681, 90.3995),
    "gulshan": (23.7925, 90.4152),
    "banani": (23.7937, 90.4046),
    "mohammadpur": (23.7658, 90.3627),
    "farmgate": (23.7597, 90.3912),
    "tejgaon": (23.7597, 90.3912),
    "bakshibazar": (23.7225, 90.3980),
    "old dhaka": (23.7199, 90.3980),
    "kotwali": (23.7150, 90.4070),
    "badda": (23.7700, 90.4240),
    "rampura": (23.7610, 90.4220),
    "motijheel": (23.7330, 90.4172),
    "jatrabari": (23.7104, 90.4349),
    "shyamoli": (23.7725, 90.3644),
    "kalyanpur": (23.7800, 90.3600),
    "kurmitola": (23.8290, 90.4050),
    "cantonment": (23.8200, 90.3950),
    "agrabad": (22.3256, 91.8123),
    "gec": (22.3569, 91.8210),
    "panchlaish": (22.3683, 91.8310),
    "chawkbazar": (22.3580, 91.8400),
    "zindabazar": (24.8980, 91.8710),
    "subidbazar": (24.9080, 91.8600),
    "amberkhana": (24.9020, 91.8680),
}


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def resolve_request_coordinates(
    district: str,
    hospital_area: str,
    hospital_name: str,
    request_id: uuid.UUID,
) -> Tuple[float, float]:
    area_clean = hospital_area.lower().strip()
    dist_clean = district.lower().strip()
    hosp_clean = hospital_name.lower().strip()

    base_lat = None
    base_lng = None

    # 1. Match specific known hospital area
    for key, coords in BD_HOSPITAL_AREAS.items():
        if key in area_clean or key in hosp_clean:
            base_lat, base_lng = coords
            break

    # 2. Fallback to district reference center
    if base_lat is None or base_lng is None:
        for key, coords in BD_DISTRICT_COORDS.items():
            if key in dist_clean or dist_clean in key:
                base_lat, base_lng = coords
                break

    # 3. National fallback (Dhaka center)
    if base_lat is None or base_lng is None:
        base_lat, base_lng = (23.8103, 90.4125)

    # 4. Deterministic micro-jitter based on request UUID hash
    # Separates multiple requests within the same hospital/area (~100m - 250m)
    # while preserving ~110m 3-decimal truncation privacy standard
    h = hash(str(request_id))
    jitter_lat = ((h % 11) - 5) * 0.0018
    jitter_lng = (((h >> 4) % 11) - 5) * 0.0018

    fuzzed_lat = round(base_lat + jitter_lat, 3)
    fuzzed_lng = round(base_lng + jitter_lng, 3)

    return fuzzed_lat, fuzzed_lng


def _to_public_request(
    req: BloodRequest,
    current_user: Optional[User] = None,
) -> PublicBloodRequest:
    is_owner = bool(current_user and current_user.id == req.user_id)
    is_admin = bool(current_user and current_user.role == UserRole.ADMIN)

    # Check if current user is one of the donors who responded
    has_responded = False
    if current_user:
        has_responded = any(r.donor_user_id == current_user.id for r in req.responses)

    can_view_contact = is_owner or is_admin or has_responded

    return PublicBloodRequest(
        id=req.id,
        user_id=req.user_id,
        blood_group=req.blood_group,
        units_required=req.units_required,
        hospital_name=req.hospital_name,
        hospital_area=req.hospital_area,
        district=req.district,
        required_date=req.required_date,
        required_time=req.required_time,
        urgency=req.urgency,
        status=req.status,
        additional_information=req.additional_information,
        created_at=req.created_at,
        updated_at=req.updated_at,
        is_own_request=is_owner,
        contact_name=req.contact_name if can_view_contact else None,
        contact_phone=req.contact_phone if can_view_contact else None,
        contact_method=req.contact_method,
        response_count=len(req.responses) if req.responses else 0,
    )


@router.get(
    "/map",
    response_model=PublicBloodMapResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve eligible public blood requests with privacy-safe approximate coordinates for the Blood Help Map",
)
async def get_public_blood_map(
    blood_group: Optional[str] = Query(None, description="Filter by recipient blood group"),
    district: Optional[str] = Query(None, description="Filter by district"),
    urgency: Optional[BloodUrgency] = Query(None, description="Filter by urgency level"),
    nearby_lat: Optional[float] = Query(None, description="Optional user latitude for distance sorting"),
    nearby_lng: Optional[float] = Query(None, description="Optional user longitude for distance sorting"),
    radius_km: Optional[float] = Query(50.0, ge=1.0, le=500.0, description="Radius in km when filtering nearby"),
    limit: int = Query(150, ge=1, le=300),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    now = datetime.now(timezone.utc)
    expiration_cutoff = now - timedelta(hours=48)

    # 1. Base query: Strictly active, non-moderated, open/responded, unexpired
    conditions = [
        BloodRequest.is_active == True,
        BloodRequest.status.in_([BloodRequestStatus.OPEN, BloodRequestStatus.RESPONDED]),
        BloodRequest.required_date >= expiration_cutoff,
    ]

    if blood_group and blood_group != "ALL":
        norm_bg = blood_group.replace(" ", "+").strip()
        try:
            parsed_bg = BloodGroup(norm_bg)
            conditions.append(BloodRequest.blood_group == parsed_bg)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid blood group: {blood_group}")

    if district and district.strip() and district != "All Districts":
        conditions.append(BloodRequest.district.ilike(f"%{district.strip()}%"))

    if urgency:
        conditions.append(BloodRequest.urgency == urgency)

    stmt = (
        select(BloodRequest)
        .where(and_(*conditions))
        .order_by(
            case(
                (BloodRequest.urgency == BloodUrgency.EMERGENCY, 1),
                (BloodRequest.urgency == BloodUrgency.URGENT, 2),
                else_=3,
            ),
            BloodRequest.required_date.asc(),
            BloodRequest.created_at.desc(),
        )
        .limit(limit)
    )

    result = await db.execute(stmt)
    records = list(result.scalars().all())

    # 2. Geocode coordinates, apply privacy rules, calculate distance
    points: List[PublicBloodMapPoint] = []
    is_admin = bool(current_user and current_user.role == UserRole.ADMIN)

    for req in records:
        lat, lng = resolve_request_coordinates(
            district=req.district,
            hospital_area=req.hospital_area,
            hospital_name=req.hospital_name,
            request_id=req.id,
        )

        dist_km = None
        if nearby_lat is not None and nearby_lng is not None:
            dist_km = round(calculate_haversine_distance(nearby_lat, nearby_lng, lat, lng), 1)
            if radius_km is not None and dist_km > radius_km:
                continue

        is_owner = bool(current_user and current_user.id == req.user_id)
        has_responded = False
        if current_user and req.responses:
            has_responded = any(r.donor_user_id == current_user.id for r in req.responses)

        can_view_contact = is_owner or is_admin or has_responded

        points.append(
            PublicBloodMapPoint(
                id=req.id,
                user_id=req.user_id,
                blood_group=req.blood_group,
                units_required=req.units_required,
                hospital_name=req.hospital_name,
                hospital_area=req.hospital_area,
                district=req.district,
                approximate_latitude=lat,
                approximate_longitude=lng,
                required_date=req.required_date,
                required_time=req.required_time,
                urgency=req.urgency,
                status=req.status,
                created_at=req.created_at,
                is_own_request=is_owner,
                contact_name=req.contact_name if can_view_contact else None,
                contact_phone=req.contact_phone if can_view_contact else None,
                contact_method=req.contact_method,
                response_count=len(req.responses) if req.responses else 0,
                distance_km=dist_km,
            )
        )

    # Sort by distance if user coordinates were provided
    if nearby_lat is not None and nearby_lng is not None:
        points.sort(key=lambda p: (p.distance_km if p.distance_km is not None else float("inf")))

    return PublicBloodMapResponse(
        requests=points,
        total=len(points),
    )


@router.get("/requests", response_model=BloodRequestPagination)
async def list_blood_requests(
    blood_group: Optional[str] = Query(None, description="Exact recipient blood group"),
    district: Optional[str] = Query(None, description="Filter by district"),
    urgency: Optional[BloodUrgency] = Query(None, description="Filter by urgency level"),
    status: Optional[BloodRequestStatus] = Query(None, description="Filter by status (default OPEN and RESPONDED)"),
    compatible_with: Optional[str] = Query(None, description="Donor blood group to find receivable requests"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Public listing of active community blood requests with filters.
    """
    parsed_blood_group: Optional[BloodGroup] = None
    if blood_group:
        norm = blood_group.replace(" ", "+").strip()
        try:
            parsed_blood_group = BloodGroup(norm)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid blood group: {blood_group}")

    parsed_compatible: Optional[BloodGroup] = None
    if compatible_with:
        norm_c = compatible_with.replace(" ", "+").strip()
        try:
            parsed_compatible = BloodGroup(norm_c)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid blood group: {compatible_with}")

    requests, total = await blood_service.get_blood_requests(
        db=db,
        blood_group=parsed_blood_group,
        district=district,
        urgency=urgency,
        status=status,
        donor_group_for_matching=parsed_compatible,
        limit=limit,
        offset=offset,
    )
    items = [_to_public_request(r, current_user) for r in requests]
    return BloodRequestPagination(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/requests", response_model=PublicBloodRequest, status_code=status.HTTP_201_CREATED)
async def create_blood_request(
    data: BloodRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Publish an urgent community blood request (requires authentication).
    """
    req = await blood_service.create_blood_request(db=db, user_id=current_user.id, data=data)
    return _to_public_request(req, current_user)


@router.get("/requests/{request_id}", response_model=PublicBloodRequest)
async def get_blood_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Get detailed information about a specific blood request with privacy-safe contact exposure.
    """
    req = await blood_service.get_blood_request_by_id(db, request_id)
    if not req or not req.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blood request not found")
    return _to_public_request(req, current_user)


@router.patch("/requests/{request_id}", response_model=PublicBloodRequest)
async def update_blood_request(
    request_id: uuid.UUID,
    data: BloodRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update request details or mark as FULFILLED / CANCELLED (owner or admin only).
    """
    req = await blood_service.get_blood_request_by_id(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blood request not found")

    if req.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this request")

    updated = await blood_service.update_blood_request(db, req, data)
    return _to_public_request(updated, current_user)


@router.post("/requests/{request_id}/respond", response_model=BloodResponseItem, status_code=status.HTTP_201_CREATED)
async def respond_to_request(
    request_id: uuid.UUID,
    data: BloodRespondCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Register a volunteer donor response ("I Can Help") and notify the requester.
    """
    req = await blood_service.get_blood_request_by_id(db, request_id)
    if not req or not req.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blood request not found")

    if req.user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot respond to your own blood request")

    if req.status in [BloodRequestStatus.FULFILLED, BloodRequestStatus.CANCELLED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Request is already {req.status.value.lower()}")

    resp = await blood_service.create_request_response(
        db=db,
        request=req,
        donor_user_id=current_user.id,
        data=data,
    )

    donor_name = current_user.full_name or current_user.username
    return BloodResponseItem(
        id=resp.id,
        request_id=resp.request_id,
        donor_user_id=resp.donor_user_id,
        donor_display_name=donor_name,
        message=resp.message,
        contact_phone=resp.contact_phone,
        status=resp.status,
        created_at=resp.created_at,
    )


@router.get("/requests/{request_id}/responses", response_model=List[BloodResponseItem])
async def list_request_responses(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List donor responses for a blood request (only request owner or admin).
    """
    req = await blood_service.get_blood_request_by_id(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blood request not found")

    if req.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view responses for this request")

    items = []
    for r in req.responses:
        d_name = (r.donor.full_name or r.donor.username) if r.donor else "Community Donor"
        items.append(
            BloodResponseItem(
                id=r.id,
                request_id=r.request_id,
                donor_user_id=r.donor_user_id,
                donor_display_name=d_name,
                message=r.message,
                contact_phone=r.contact_phone,
                status=r.status,
                created_at=r.created_at,
            )
        )
    return items


@router.post("/requests/{request_id}/flag", status_code=status.HTTP_201_CREATED)
async def flag_blood_request(
    request_id: uuid.UUID,
    data: BloodFlagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Flag a suspicious or abusive blood request for administrative review.
    """
    req = await blood_service.get_blood_request_by_id(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blood request not found")

    await blood_service.create_request_flag(
        db=db,
        request_id=request_id,
        reporter_user_id=current_user.id,
        data=data,
    )
    return {"status": "ok", "message": "Report submitted for administrative review."}


@router.get("/donor-profile", response_model=Optional[DonorProfileResponse])
async def get_my_donor_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the authenticated user's registered blood donor profile.
    """
    profile = await blood_service.get_donor_profile_by_user_id(db, current_user.id)
    return profile


@router.post("/donor-profile", response_model=DonorProfileResponse, status_code=status.HTTP_201_CREATED)
async def register_or_update_donor_profile(
    data: DonorProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create or update volunteer blood donor profile.
    """
    profile = await blood_service.save_donor_profile(db=db, user_id=current_user.id, data=data)
    return profile


@router.patch("/donor-profile", response_model=DonorProfileResponse)
async def patch_donor_profile(
    data: DonorProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Quickly toggle availability status or update donor details.
    """
    profile = await blood_service.get_donor_profile_by_user_id(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donor profile not found. Please register first.")

    updated = await blood_service.update_donor_profile(db=db, profile=profile, data=data)
    return updated


@router.get("/matches", response_model=List[PublicBloodRequest])
async def get_donor_matches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Discover active blood requests matching the authenticated donor's blood group and district.
    """
    profile = await blood_service.get_donor_profile_by_user_id(db, current_user.id)
    if not profile:
        return []

    requests, _ = await blood_service.get_blood_requests(
        db=db,
        district=profile.district,
        donor_group_for_matching=profile.blood_group,
        limit=20,
        offset=0,
    )
    return [_to_public_request(r, current_user) for r in requests]


def _to_donation_response(donation: BloodDonationRecord) -> BloodDonationResponse:
    donor_name = (donation.donor.full_name or donation.donor.username) if donation.donor else "Volunteer Donor"
    recipient_name = (donation.recipient.full_name or donation.recipient.username) if donation.recipient else "Requester"
    hosp = donation.request.hospital_name if donation.request else "Hospital"
    dist = donation.request.district if donation.request else "District"
    bg = donation.request.blood_group.value if donation.request else "N/A"
    return BloodDonationResponse(
        id=donation.id,
        request_id=donation.request_id,
        donor_id=donation.donor_id,
        donor_name=donor_name,
        recipient_id=donation.recipient_id,
        recipient_name=recipient_name,
        status=donation.status,
        claimed_at=donation.claimed_at,
        confirmed_at=donation.confirmed_at,
        disputed_at=donation.disputed_at,
        dispute_reason=donation.dispute_reason,
        admin_notes=donation.admin_notes,
        impact_points_awarded=donation.impact_points_awarded,
        donor_rating=donation.donor_rating,
        donor_review=donation.donor_review,
        rated_at=donation.rated_at,
        hospital_name=hosp,
        district=dist,
        blood_group=bg,
    )


@router.post("/requests/{request_id}/claim-donation", response_model=BloodDonationResponse, status_code=status.HTTP_201_CREATED)
async def claim_blood_donation_endpoint(
    request_id: uuid.UUID,
    data: BloodDonationClaimCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Donor marks that they provided blood for this request.
    Creates a pending verification record; points are only awarded after recipient confirmation.
    """
    donation = await blood_service.claim_blood_donation(
        db=db,
        request_id=request_id,
        donor_user=current_user,
        response_id=data.response_id,
    )
    return _to_donation_response(donation)


@router.post("/donations/{donation_id}/confirm", response_model=BloodDonationResponse)
async def confirm_blood_donation_endpoint(
    donation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recipient confirms that blood was received. Awards +50 Impact Points and increments verified donation count.
    """
    donation = await blood_service.confirm_blood_donation(
        db=db,
        donation_id=donation_id,
        recipient_user_id=current_user.id,
    )
    return _to_donation_response(donation)


@router.post("/donations/{donation_id}/dispute", response_model=BloodDonationResponse)
async def dispute_blood_donation_endpoint(
    donation_id: uuid.UUID,
    data: BloodDonationDisputeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recipient disputes donation claim. Flags for administrative oversight without awarding points.
    """
    donation = await blood_service.dispute_blood_donation(
        db=db,
        donation_id=donation_id,
        recipient_user_id=current_user.id,
        dispute_reason=data.dispute_reason,
    )
    return _to_donation_response(donation)


@router.post("/donations/{donation_id}/rate", response_model=BloodDonationResponse)
async def rate_blood_donor_endpoint(
    donation_id: uuid.UUID,
    data: BloodDonationRateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recipient rates the donor (1-5 stars) after a donation is confirmed as VERIFIED.
    """
    donation = await blood_service.rate_blood_donor(
        db=db,
        donation_id=donation_id,
        recipient_user_id=current_user.id,
        rating=data.rating,
        review=data.review,
    )
    return _to_donation_response(donation)


@router.get("/requests/{request_id}/donations", response_model=List[BloodDonationResponse])
async def list_request_donations(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List donation claims for a specific blood request.
    Only accessible by the requester, the claiming donor, or an admin.
    """
    req = await blood_service.get_blood_request_by_id(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blood request not found")

    stmt = select(BloodDonationRecord).where(BloodDonationRecord.request_id == request_id)
    res = await db.execute(stmt)
    donations = list(res.scalars().all())

    # Authorization check
    if req.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        # Filter only the donations created by the current user
        donations = [d for d in donations if d.donor_id == current_user.id]

    return [_to_donation_response(d) for d in donations]


@router.get("/donations/my", response_model=List[BloodDonationResponse])
async def list_my_donations(
    role: str = Query("all", pattern="^(all|donor|recipient)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List blood donation records involving the authenticated user (as donor or as recipient).
    """
    conditions = []
    if role == "donor":
        conditions.append(BloodDonationRecord.donor_id == current_user.id)
    elif role == "recipient":
        conditions.append(BloodDonationRecord.recipient_id == current_user.id)
    else:
        conditions.append(or_(BloodDonationRecord.donor_id == current_user.id, BloodDonationRecord.recipient_id == current_user.id))

    stmt = select(BloodDonationRecord).where(and_(*conditions)).order_by(BloodDonationRecord.created_at.desc())
    res = await db.execute(stmt)
    donations = list(res.scalars().all())
    return [_to_donation_response(d) for d in donations]

