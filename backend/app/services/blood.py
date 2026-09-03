import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonorAvailability,
    ResponseStatus,
    BloodFlagStatus,
    BloodRequest,
    BloodDonorProfile,
    BloodRequestResponse,
    BloodRequestFlag,
)
from app.models.user import User
from app.models.notification import Notification, NotificationType
from app.schemas.blood import (
    BloodRequestCreate,
    BloodRequestUpdate,
    DonorProfileCreate,
    DonorProfileUpdate,
    BloodRespondCreate,
    BloodFlagCreate,
)

# Recipient group -> Compatible donor groups
BLOOD_COMPATIBILITY: dict[BloodGroup, list[BloodGroup]] = {
    BloodGroup.A_POS: [BloodGroup.A_POS, BloodGroup.A_NEG, BloodGroup.O_POS, BloodGroup.O_NEG],
    BloodGroup.A_NEG: [BloodGroup.A_NEG, BloodGroup.O_NEG],
    BloodGroup.B_POS: [BloodGroup.B_POS, BloodGroup.B_NEG, BloodGroup.O_POS, BloodGroup.O_NEG],
    BloodGroup.B_NEG: [BloodGroup.B_NEG, BloodGroup.O_NEG],
    BloodGroup.AB_POS: [
        BloodGroup.A_POS, BloodGroup.A_NEG, BloodGroup.B_POS, BloodGroup.B_NEG,
        BloodGroup.AB_POS, BloodGroup.AB_NEG, BloodGroup.O_POS, BloodGroup.O_NEG,
    ],
    BloodGroup.AB_NEG: [BloodGroup.A_NEG, BloodGroup.B_NEG, BloodGroup.AB_NEG, BloodGroup.O_NEG],
    BloodGroup.O_POS: [BloodGroup.O_POS, BloodGroup.O_NEG],
    BloodGroup.O_NEG: [BloodGroup.O_NEG],
}

# Donor group -> Groups who can receive
DONOR_CAN_GIVE_TO: dict[BloodGroup, list[BloodGroup]] = {
    BloodGroup.O_NEG: [
        BloodGroup.A_POS, BloodGroup.A_NEG, BloodGroup.B_POS, BloodGroup.B_NEG,
        BloodGroup.AB_POS, BloodGroup.AB_NEG, BloodGroup.O_POS, BloodGroup.O_NEG,
    ],
    BloodGroup.O_POS: [BloodGroup.A_POS, BloodGroup.B_POS, BloodGroup.AB_POS, BloodGroup.O_POS],
    BloodGroup.A_NEG: [BloodGroup.A_POS, BloodGroup.A_NEG, BloodGroup.AB_POS, BloodGroup.AB_NEG],
    BloodGroup.A_POS: [BloodGroup.A_POS, BloodGroup.AB_POS],
    BloodGroup.B_NEG: [BloodGroup.B_POS, BloodGroup.B_NEG, BloodGroup.AB_POS, BloodGroup.AB_NEG],
    BloodGroup.B_POS: [BloodGroup.B_POS, BloodGroup.AB_POS],
    BloodGroup.AB_NEG: [BloodGroup.AB_POS, BloodGroup.AB_NEG],
    BloodGroup.AB_POS: [BloodGroup.AB_POS],
}


async def create_blood_request(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: BloodRequestCreate,
) -> BloodRequest:
    request = BloodRequest(
        user_id=user_id,
        blood_group=data.blood_group,
        units_required=data.units_required,
        hospital_name=data.hospital_name.strip(),
        hospital_area=data.hospital_area.strip(),
        district=data.district.strip(),
        required_date=data.required_date,
        required_time=data.required_time.strip() if data.required_time else None,
        urgency=data.urgency,
        contact_name=data.contact_name.strip() if data.contact_name else None,
        contact_phone=data.contact_phone.strip() if data.contact_phone else None,
        contact_method=data.contact_method.strip(),
        additional_information=data.additional_information.strip() if data.additional_information else None,
        status=BloodRequestStatus.OPEN,
        is_active=True,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    # Auto-notify nearby compatible donors in the same district (capped at 20 to prevent notification spam)
    try:
        compatible_groups = BLOOD_COMPATIBILITY.get(request.blood_group, [request.blood_group])
        stmt = (
            select(BloodDonorProfile.user_id)
            .where(
                BloodDonorProfile.district.ilike(request.district),
                BloodDonorProfile.availability_status == DonorAvailability.AVAILABLE,
                BloodDonorProfile.blood_group.in_(compatible_groups),
                BloodDonorProfile.user_id != user_id,
            )
            .limit(20)
        )
        matching_donor_ids = (await db.execute(stmt)).scalars().all()
        for d_id in matching_donor_ids:
            notif = Notification(
                user_id=d_id,
                type=NotificationType.BLOOD_REQUEST_MATCH,
                title=f"Community Blood Needed: {request.blood_group.value} in {request.district}",
                message=f"{request.units_required} unit(s) of {request.blood_group.value} needed at {request.hospital_name} ({request.hospital_area}, {request.district}).",
            )
            db.add(notif)
        if matching_donor_ids:
            await db.commit()
    except Exception:
        pass  # Non-blocking notification dispatch

    return request


async def get_blood_requests(
    db: AsyncSession,
    blood_group: Optional[BloodGroup] = None,
    district: Optional[str] = None,
    urgency: Optional[BloodUrgency] = None,
    status: Optional[BloodRequestStatus] = None,
    donor_group_for_matching: Optional[BloodGroup] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[List[BloodRequest], int]:
    # Expire outdated requests past 48 hours past required_date
    now = datetime.now(timezone.utc)
    
    conditions = [BloodRequest.is_active == True]

    if status:
        conditions.append(BloodRequest.status == status)
    else:
        # By default show OPEN and RESPONDED active requests
        conditions.append(BloodRequest.status.in_([BloodRequestStatus.OPEN, BloodRequestStatus.RESPONDED]))

    if blood_group:
        conditions.append(BloodRequest.blood_group == blood_group)

    if district:
        conditions.append(BloodRequest.district.ilike(f"%{district.strip()}%"))

    if urgency:
        conditions.append(BloodRequest.urgency == urgency)

    if donor_group_for_matching:
        # Recipient groups this donor can give to
        receivable_groups = DONOR_CAN_GIVE_TO.get(donor_group_for_matching, [donor_group_for_matching])
        conditions.append(BloodRequest.blood_group.in_(receivable_groups))

    count_stmt = select(func.count(BloodRequest.id)).where(and_(*conditions))
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        select(BloodRequest)
        .where(and_(*conditions))
        .order_by(
            # Order by urgency (EMERGENCY, URGENT, NORMAL) and required_date
            case(
                (BloodRequest.urgency == BloodUrgency.EMERGENCY, 1),
                (BloodRequest.urgency == BloodUrgency.URGENT, 2),
                else_=3,
            ),
            BloodRequest.required_date.asc(),
            BloodRequest.created_at.desc(),
        )
        .limit(limit)
        .offset(offset)
    )
    items = (await db.execute(stmt)).scalars().all()
    return list(items), total


async def get_blood_request_by_id(
    db: AsyncSession,
    request_id: uuid.UUID,
) -> Optional[BloodRequest]:
    stmt = select(BloodRequest).where(BloodRequest.id == request_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def update_blood_request(
    db: AsyncSession,
    request: BloodRequest,
    data: BloodRequestUpdate,
) -> BloodRequest:
    prev_status = request.status
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request, field, value)

    await db.commit()
    await db.refresh(request)

    # If marked FULFILLED, notify responding donors
    if data.status == BloodRequestStatus.FULFILLED and prev_status != BloodRequestStatus.FULFILLED:
        try:
            r_stmt = (
                select(BloodRequestResponse.donor_user_id)
                .where(BloodRequestResponse.request_id == request.id)
                .distinct()
            )
            donor_ids = (await db.execute(r_stmt)).scalars().all()
            for d_id in donor_ids:
                notif = Notification(
                    user_id=d_id,
                    type=NotificationType.BLOOD_REQUEST_FULFILLED,
                    title="Blood Request Fulfilled",
                    message=f"The blood request for {request.blood_group.value} at {request.hospital_name} has been marked fulfilled. Thank you for your support!",
                )
                db.add(notif)
            if donor_ids:
                await db.commit()
        except Exception:
            pass

    return request


async def create_request_response(
    db: AsyncSession,
    request: BloodRequest,
    donor_user_id: uuid.UUID,
    data: BloodRespondCreate,
) -> BloodRequestResponse:
    response = BloodRequestResponse(
        request_id=request.id,
        donor_user_id=donor_user_id,
        message=data.message.strip() if data.message else None,
        contact_phone=data.contact_phone.strip() if data.contact_phone else None,
        status=ResponseStatus.PENDING,
    )
    db.add(response)

    # Transition status to RESPONDED if still OPEN
    if request.status == BloodRequestStatus.OPEN:
        request.status = BloodRequestStatus.RESPONDED

    await db.commit()
    await db.refresh(response)

    # Notify request owner
    try:
        notif = Notification(
            user_id=request.user_id,
            type=NotificationType.BLOOD_REQUEST_RESPONSE,
            title=f"Donor Responded: {request.blood_group.value} Request",
            message=f"A volunteer donor responded to your blood request for {request.hospital_name}. Check your request details to view their response.",
        )
        db.add(notif)
        await db.commit()
    except Exception:
        pass

    return response


async def get_donor_profile_by_user_id(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> Optional[BloodDonorProfile]:
    stmt = select(BloodDonorProfile).where(BloodDonorProfile.user_id == user_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def save_donor_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: DonorProfileCreate,
) -> BloodDonorProfile:
    profile = await get_donor_profile_by_user_id(db, user_id)
    if not profile:
        profile = BloodDonorProfile(
            user_id=user_id,
            blood_group=data.blood_group,
            district=data.district.strip(),
            area=data.area.strip(),
            availability_status=data.availability_status,
            last_donation_date=data.last_donation_date,
            preferred_contact_method=data.preferred_contact_method.strip(),
            contact_phone=data.contact_phone.strip() if data.contact_phone else None,
            additional_notes=data.additional_notes.strip() if data.additional_notes else None,
        )
        db.add(profile)
    else:
        profile.blood_group = data.blood_group
        profile.district = data.district.strip()
        profile.area = data.area.strip()
        profile.availability_status = data.availability_status
        profile.last_donation_date = data.last_donation_date
        profile.preferred_contact_method = data.preferred_contact_method.strip()
        if data.contact_phone is not None:
            profile.contact_phone = data.contact_phone.strip() if data.contact_phone else None
        profile.additional_notes = data.additional_notes.strip() if data.additional_notes else None

    await db.commit()
    await db.refresh(profile)
    return profile


async def update_donor_profile(
    db: AsyncSession,
    profile: BloodDonorProfile,
    data: DonorProfileUpdate,
) -> BloodDonorProfile:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile


async def create_request_flag(
    db: AsyncSession,
    request_id: uuid.UUID,
    reporter_user_id: uuid.UUID,
    data: BloodFlagCreate,
) -> BloodRequestFlag:
    flag = BloodRequestFlag(
        request_id=request_id,
        reporter_user_id=reporter_user_id,
        reason=data.reason.strip(),
        details=data.details.strip() if data.details else None,
        status=BloodFlagStatus.PENDING,
    )
    db.add(flag)
    await db.commit()
    await db.refresh(flag)
    return flag
