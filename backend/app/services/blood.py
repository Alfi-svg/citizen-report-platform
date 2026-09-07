import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonorAvailability,
    ResponseStatus,
    BloodFlagStatus,
    DonationStatus,
    BloodRequest,
    BloodDonorProfile,
    BloodRequestResponse,
    BloodRequestFlag,
    BloodDonationRecord,
)
from app.services.reputation import (
    award_impact_points,
    adjust_trust_score,
    increment_contribution_count,
    record_donor_rating,
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


async def get_donation_by_id(
    db: AsyncSession,
    donation_id: uuid.UUID,
) -> Optional[BloodDonationRecord]:
    stmt = select(BloodDonationRecord).where(BloodDonationRecord.id == donation_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def claim_blood_donation(
    db: AsyncSession,
    request_id: uuid.UUID,
    donor_user: User,
    response_id: Optional[uuid.UUID] = None,
) -> BloodDonationRecord:
    """
    Register a donor's claim that they provided blood.
    Requires recipient confirmation before points are awarded.
    """
    req_stmt = select(BloodRequest).where(BloodRequest.id == request_id)
    req_res = await db.execute(req_stmt)
    req = req_res.scalar_one_or_none()

    if not req or not req.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blood request not found")

    if req.user_id == donor_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot claim a blood donation for your own request",
        )

    # Check for existing claim
    existing_stmt = select(BloodDonationRecord).where(
        BloodDonationRecord.request_id == request_id,
        BloodDonationRecord.donor_id == donor_user.id,
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        if existing.status == DonationStatus.PENDING_CONFIRMATION:
            return existing
        elif existing.status == DonationStatus.VERIFIED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your blood donation for this request has already been verified",
            )

    donation = BloodDonationRecord(
        request_id=request_id,
        donor_id=donor_user.id,
        recipient_id=req.user_id,
        response_id=response_id,
        status=DonationStatus.PENDING_CONFIRMATION,
        claimed_at=datetime.now(timezone.utc),
        impact_points_awarded=False,
    )
    db.add(donation)

    # Notify recipient to confirm or dispute
    donor_display = donor_user.full_name or donor_user.username
    notif = Notification(
        user_id=req.user_id,
        type=NotificationType.BLOOD_DONATION_CLAIMED,
        title="রক্তদান নিশ্চিতকরণ অনুরোধ (Confirm Blood Donation)",
        message=f"স্বেচ্ছাসেবী রক্তদাতা '{donor_display}' আপনার '{req.hospital_name}' অনুরোধে রক্তদান করেছেন বলে জানিয়েছেন। অনুগ্রহ করে নিশ্চিত করুন।",
    )
    db.add(notif)

    await db.commit()
    await db.refresh(donation)
    return donation


async def confirm_blood_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
) -> BloodDonationRecord:
    """
    Recipient confirms blood was received.
    Awards +50 Impact Points, updates Trust Score, and increments verified donation count.
    """
    donation = await get_donation_by_id(db, donation_id)
    if not donation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation record not found")

    if donation.recipient_id != recipient_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the recipient of this blood request can confirm the donation",
        )

    if donation.status == DonationStatus.VERIFIED:
        return donation

    if donation.status != DonationStatus.PENDING_CONFIRMATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm donation with status '{donation.status.value}'",
        )

    donation.status = DonationStatus.VERIFIED
    donation.confirmed_at = datetime.now(timezone.utc)

    # Award points safely & idempotently
    if not donation.impact_points_awarded:
        await award_impact_points(
            db=db,
            user_id=donation.donor_id,
            points=50,
            action_type="BLOOD_DONATION_VERIFIED",
            description=f"Verified blood donation for request at {donation.request.hospital_name}",
            reference_type="BLOOD_DONATION",
            reference_id=donation.id,
        )
        await adjust_trust_score(
            db=db,
            user_id=donation.donor_id,
            delta=5,
            reason="Verified community blood donation",
            reference_type="BLOOD_DONATION",
            reference_id=donation.id,
        )
        await increment_contribution_count(
            db=db,
            user_id=donation.donor_id,
            contribution_type="BLOOD",
            count=1,
        )
        donation.impact_points_awarded = True

    # Notify donor
    donor_notif = Notification(
        user_id=donation.donor_id,
        type=NotificationType.BLOOD_DONATION_VERIFIED,
        title="রক্তদান সফলভাবে যাচাইকৃত (+৫০ পয়েন্ট)",
        message=f"আপনার রক্তদান গ্রহণকারী দ্বারা নিশ্চিত করা হয়েছে! +৫০ ইমপ্যাক্ট পয়েন্ট আপনার প্রোফাইলে যুক্ত হয়েছে।",
    )
    db.add(donor_notif)

    await db.commit()
    await db.refresh(donation)
    return donation


async def dispute_blood_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
    dispute_reason: str,
) -> BloodDonationRecord:
    """
    Recipient disputes donation. Sets status to DISPUTED for Admin verification.
    No points awarded.
    """
    donation = await get_donation_by_id(db, donation_id)
    if not donation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation record not found")

    if donation.recipient_id != recipient_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the recipient can dispute this donation claim",
        )

    if donation.status != DonationStatus.PENDING_CONFIRMATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot dispute donation with status '{donation.status.value}'",
        )

    donation.status = DonationStatus.DISPUTED
    donation.disputed_at = datetime.now(timezone.utc)
    donation.dispute_reason = dispute_reason.strip()

    # Notify donor about dispute
    donor_notif = Notification(
        user_id=donation.donor_id,
        type=NotificationType.BLOOD_DONATION_DISPUTED,
        title="রক্তদানের দাবি পর্যালোচনায় রয়েছে (Under Review)",
        message="আপনার রক্তদানের দাবিটি গ্রহণকারী বিতর্ক করেছেন। অ্যাডমিন মডারেশন টিম এটি খতিয়ে দেখছে।",
    )
    db.add(donor_notif)

    await db.commit()
    await db.refresh(donation)
    return donation


async def rate_blood_donor(
    db: AsyncSession,
    donation_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
    rating: int,
    review: Optional[str] = None,
) -> BloodDonationRecord:
    """
    Recipient rates donor (1-5 stars) after donation is VERIFIED.
    """
    donation = await get_donation_by_id(db, donation_id)
    if not donation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation record not found")

    if donation.recipient_id != recipient_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only recipient can rate this donor")

    if donation.status != DonationStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating is only allowed after the blood donation is verified",
        )

    if donation.donor_rating is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a rating for this donation",
        )

    clamped_rating = max(1, min(5, rating))
    donation.donor_rating = clamped_rating
    donation.donor_review = review.strip() if review else None
    donation.rated_at = datetime.now(timezone.utc)

    await record_donor_rating(db, donation.donor_id, clamped_rating)

    # Notify donor
    notif = Notification(
        user_id=donation.donor_id,
        type=NotificationType.BLOOD_DONATION_RATED,
        title="নতুন রেটিং পেয়েছেন (New Donor Rating)",
        message=f"আপনার সাম্প্রতিক রক্তদানের জন্য {clamped_rating}/৫ রেটিং পেয়েছেন।",
    )
    db.add(notif)

    await db.commit()
    await db.refresh(donation)
    return donation


async def moderate_blood_donation(
    db: AsyncSession,
    donation_id: uuid.UUID,
    admin_user_id: uuid.UUID,
    action: str,
    admin_notes: Optional[str] = None,
) -> BloodDonationRecord:
    """
    Admin resolves blood donation disputes (VERIFY, REJECT, KEEP_DISPUTED).
    """
    donation = await get_donation_by_id(db, donation_id)
    if not donation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation record not found")

    if action == "VERIFY":
        donation.status = DonationStatus.VERIFIED
        donation.admin_notes = admin_notes
        if not donation.confirmed_at:
            donation.confirmed_at = datetime.now(timezone.utc)

        if not donation.impact_points_awarded:
            await award_impact_points(
                db=db,
                user_id=donation.donor_id,
                points=50,
                action_type="BLOOD_DONATION_VERIFIED",
                description=f"Admin verified blood donation for request {donation.request.hospital_name}",
                reference_type="BLOOD_DONATION",
                reference_id=donation.id,
            )
            await adjust_trust_score(
                db=db,
                user_id=donation.donor_id,
                delta=5,
                reason="Admin-verified blood donation",
                reference_type="BLOOD_DONATION",
                reference_id=donation.id,
            )
            await increment_contribution_count(
                db=db,
                user_id=donation.donor_id,
                contribution_type="BLOOD",
                count=1,
            )
            donation.impact_points_awarded = True

        notif = Notification(
            user_id=donation.donor_id,
            type=NotificationType.BLOOD_DONATION_VERIFIED,
            title="রক্তদান অ্যাডমিন দ্বারা যাচাইকৃত (+৫০ পয়েন্ট)",
            message="অ্যাডমিন পর্যালোচনায় আপনার রক্তদান যাচাই ও অনুমোদিত হয়েছে। +৫০ পয়েন্ট যুক্ত হয়েছে।",
        )
        db.add(notif)

    elif action == "REJECT":
        donation.status = DonationStatus.REJECTED
        donation.admin_notes = admin_notes

        # Penalize fraudulent claim
        await adjust_trust_score(
            db=db,
            user_id=donation.donor_id,
            delta=-10,
            reason="Rejected false blood donation claim",
            reference_type="BLOOD_DONATION",
            reference_id=donation.id,
        )

        notif = Notification(
            user_id=donation.donor_id,
            type=NotificationType.BLOOD_DONATION_DISPUTED,
            title="রক্তদানের দাবি প্রত্যাখ্যাত হয়েছে",
            message="অ্যাডমিন পর্যালোচনায় আপনার রক্তদানের দাবিটি অসত্য বা অসম্পূর্ণ হিসেবে প্রত্যাখ্যাত হয়েছে।",
        )
        db.add(notif)

    elif action == "KEEP_DISPUTED":
        donation.status = DonationStatus.DISPUTED
        donation.admin_notes = admin_notes

    await db.commit()
    await db.refresh(donation)
    return donation

