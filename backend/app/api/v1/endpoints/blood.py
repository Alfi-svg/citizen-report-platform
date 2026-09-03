import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
)
from app.schemas.blood import (
    BloodRequestCreate,
    BloodRequestUpdate,
    PublicBloodRequest,
    BloodRequestPagination,
    DonorProfileCreate,
    DonorProfileUpdate,
    DonorProfileResponse,
    BloodRespondCreate,
    BloodResponseItem,
    BloodFlagCreate,
)
from app.services import blood as blood_service

router = APIRouter()


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
