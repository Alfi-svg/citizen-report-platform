import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonorAvailability,
    ResponseStatus,
    BloodRequest,
    BloodDonorProfile,
    BloodRequestResponse,
)

logger = logging.getLogger("seed_demo_blood")

# Clearly identifiable synthetic demo domain
DEMO_EMAIL_DOMAIN = "@nirapotta.local"

DEMO_DONORS_DATA = [
    {
        "username": "demo_donor_opos_savar",
        "email": f"demo_donor_opos_savar{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor O-Pos (Savar)",
        "blood_group": BloodGroup.O_POS,
        "district": "Dhaka",
        "area": "Savar",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 120,  # Eligible (>90d)
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Consent verified, regularly available near Savar.",
    },
    {
        "username": "demo_donor_opos_mirpur",
        "email": f"demo_donor_opos_mirpur{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor O-Pos (Mirpur)",
        "blood_group": BloodGroup.O_POS,
        "district": "Dhaka",
        "area": "Mirpur",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 25,  # Ineligible (<90d clinical freshness interval)
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Recently donated 25 days ago; ineligible until 90-day cooldown.",
    },
    {
        "username": "demo_donor_opos_dhanmondi",
        "email": f"demo_donor_opos_dhanmondi{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor O-Pos (Dhanmondi)",
        "blood_group": BloodGroup.O_POS,
        "district": "Dhaka",
        "area": "Dhanmondi",
        "availability_status": DonorAvailability.NOT_AVAILABLE,  # Unavailable status
        "days_since_last_donation": 210,
        "preferred_contact_method": "PHONE",
        "notes": "Synthetic demo record: Currently unavailable due to travel.",
    },
    {
        "username": "demo_donor_oneg_uttara",
        "email": f"demo_donor_oneg_uttara{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor O-Neg (Uttara)",
        "blood_group": BloodGroup.O_NEG,
        "district": "Dhaka",
        "area": "Uttara",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 160,  # Eligible
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Universal red blood cell donor, verified in Uttara.",
    },
    {
        "username": "demo_donor_apos_dhanmondi",
        "email": f"demo_donor_apos_dhanmondi{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor A-Pos (Dhanmondi)",
        "blood_group": BloodGroup.A_POS,
        "district": "Dhaka",
        "area": "Dhanmondi",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 105,  # Eligible
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Verified A+ donor near Dhanmondi medical cluster.",
    },
    {
        "username": "demo_donor_aneg_mohakhali",
        "email": f"demo_donor_aneg_mohakhali{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor A-Neg (Mohakhali)",
        "blood_group": BloodGroup.A_NEG,
        "district": "Dhaka",
        "area": "Mohakhali",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 140,  # Eligible
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Verified A- rare donor in Mohakhali.",
    },
    {
        "username": "demo_donor_bpos_savar",
        "email": f"demo_donor_bpos_savar{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor B-Pos (Savar)",
        "blood_group": BloodGroup.B_POS,
        "district": "Dhaka",
        "area": "Savar",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 95,  # Eligible
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Verified B+ donor in Savar.",
    },
    {
        "username": "demo_donor_bpos_agrabad",
        "email": f"demo_donor_bpos_agrabad{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor B-Pos (Agrabad)",
        "blood_group": BloodGroup.B_POS,
        "district": "Chattogram",
        "area": "Agrabad",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 110,  # Eligible
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Active B+ donor in Chattogram.",
    },
    {
        "username": "demo_donor_bneg_gec",
        "email": f"demo_donor_bneg_gec{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor B-Neg (GEC)",
        "blood_group": BloodGroup.B_NEG,
        "district": "Chattogram",
        "area": "GEC",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 150,  # Eligible
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Rare B- donor in Chattogram.",
    },
    {
        "username": "demo_donor_abpos_zindabazar",
        "email": f"demo_donor_abpos_zindabazar{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor AB-Pos (Zindabazar)",
        "blood_group": BloodGroup.AB_POS,
        "district": "Sylhet",
        "area": "Zindabazar",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 180,  # Eligible
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: AB+ donor in Sylhet.",
    },
    {
        "username": "demo_donor_abneg_panthapath",
        "email": f"demo_donor_abneg_panthapath{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor AB-Neg (Panthapath)",
        "blood_group": BloodGroup.AB_NEG,
        "district": "Dhaka",
        "area": "Panthapath",
        "availability_status": DonorAvailability.AVAILABLE,
        "days_since_last_donation": 130,  # Eligible
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Very rare AB- donor near Panthapath.",
    },
    {
        "username": "demo_donor_abneg_rajshahi",
        "email": f"demo_donor_abneg_rajshahi{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Donor AB-Neg (Rajshahi)",
        "blood_group": BloodGroup.AB_NEG,
        "district": "Rajshahi",
        "area": "Shaheb Bazar",
        "availability_status": DonorAvailability.NOT_AVAILABLE,  # Unavailable and recent donation
        "days_since_last_donation": 40,
        "preferred_contact_method": "IN_APP",
        "notes": "Synthetic demo record: Currently unavailable.",
    },
]

DEMO_REQUESTERS_DATA = [
    {
        "username": "demo_requester_savar",
        "email": f"demo_requester_savar{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Requester (Enam Hospital, Savar)",
    },
    {
        "username": "demo_requester_dmc",
        "email": f"demo_requester_dmc{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Requester (Dhaka Medical)",
    },
    {
        "username": "demo_requester_ctg",
        "email": f"demo_requester_ctg{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Requester (Chittagong Medical)",
    },
]


async def seed_demo_blood_data(db: AsyncSession) -> Dict[str, Any]:
    """
    Populates the database with realistic synthetic demo donors and blood requests.
    Guaranteed safe: refuses execution in production environment.
    Idempotent: cleanses previous synthetic demo records before re-inserting.
    """
    if settings.ENVIRONMENT.lower() == "production":
        raise RuntimeError("Safety Check Blocked: Refusing to seed demo blood data in a production environment!")

    now = datetime.now(timezone.utc)
    hashed_pwd = get_password_hash("demo_password_12345")

    logger.info("Starting synthetic demo blood data seeding...")

    # 1. Clean up existing demo users and related records to ensure idempotency
    existing_demo_users_stmt = select(User.id).where(User.email.like(f"%{DEMO_EMAIL_DOMAIN}"))
    existing_user_ids = (await db.execute(existing_demo_users_stmt)).scalars().all()

    if existing_user_ids:
        # Cascade or delete profiles, requests, responses
        await db.execute(delete(BloodDonorProfile).where(BloodDonorProfile.user_id.in_(existing_user_ids)))
        await db.execute(delete(BloodRequestResponse).where(BloodRequestResponse.donor_user_id.in_(existing_user_ids)))
        await db.execute(delete(BloodRequest).where(BloodRequest.user_id.in_(existing_user_ids)))
        await db.execute(delete(User).where(User.id.in_(existing_user_ids)))
        await db.commit()
        logger.info(f"Cleaned up {len(existing_user_ids)} prior synthetic demo users.")

    # 2. Seed Requesters
    requesters: Dict[str, User] = {}
    for r_data in DEMO_REQUESTERS_DATA:
        user = User(
            id=uuid.uuid4(),
            email=r_data["email"],
            username=r_data["username"],
            full_name=r_data["full_name"],
            hashed_password=hashed_pwd,
            role=UserRole.USER,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        requesters[r_data["username"]] = user

    # 3. Seed Donors and Donor Profiles
    donors: Dict[str, User] = {}
    donor_profiles: List[BloodDonorProfile] = []
    for d_data in DEMO_DONORS_DATA:
        donor_user = User(
            id=uuid.uuid4(),
            email=d_data["email"],
            username=d_data["username"],
            full_name=d_data["full_name"],
            hashed_password=hashed_pwd,
            role=UserRole.USER,
            is_active=True,
            is_verified=True,
        )
        db.add(donor_user)
        donors[d_data["username"]] = donor_user

        last_don_date = now - timedelta(days=d_data["days_since_last_donation"])
        profile = BloodDonorProfile(
            id=uuid.uuid4(),
            user_id=donor_user.id,
            blood_group=d_data["blood_group"],
            district=d_data["district"],
            area=d_data["area"],
            availability_status=d_data["availability_status"],
            last_donation_date=last_don_date,
            preferred_contact_method=d_data["preferred_contact_method"],
            contact_phone="01700000000",  # Synthetic masked safe contact
            additional_notes=d_data["notes"],
        )
        db.add(profile)
        donor_profiles.append(profile)

    await db.commit()

    # 4. Seed Blood Requests
    req1 = BloodRequest(
        id=uuid.uuid4(),
        user_id=requesters["demo_requester_savar"].id,
        blood_group=BloodGroup.O_POS,
        units_required=2,
        hospital_name="Enam Medical College Hospital",
        hospital_area="Savar",
        district="Dhaka",
        required_date=now + timedelta(days=1),
        required_time="10:00 AM",
        urgency=BloodUrgency.EMERGENCY,
        contact_name="Demo Enam Coordinator",
        contact_phone="01711111111",
        contact_method="PHONE",
        additional_information="Emergency surgery scheduled. Needs 2 bags of O+ blood.",
        status=BloodRequestStatus.OPEN,
        is_active=True,
    )
    db.add(req1)

    req2 = BloodRequest(
        id=uuid.uuid4(),
        user_id=requesters["demo_requester_dmc"].id,
        blood_group=BloodGroup.B_POS,
        units_required=1,
        hospital_name="Dhaka Medical College Hospital",
        hospital_area="Shahbagh",
        district="Dhaka",
        required_date=now + timedelta(days=2),
        required_time="02:00 PM",
        urgency=BloodUrgency.URGENT,
        contact_name="Demo DMC Requester",
        contact_phone="01722222222",
        contact_method="IN_APP",
        additional_information="Dengue patient platelet support. Urgent B+ blood required.",
        status=BloodRequestStatus.RESPONDED,
        is_active=True,
    )
    db.add(req2)

    req3 = BloodRequest(
        id=uuid.uuid4(),
        user_id=requesters["demo_requester_ctg"].id,
        blood_group=BloodGroup.A_NEG,
        units_required=2,
        hospital_name="Chittagong Medical College Hospital",
        hospital_area="Panchlaish",
        district="Chattogram",
        required_date=now + timedelta(days=1),
        required_time="11:30 AM",
        urgency=BloodUrgency.EMERGENCY,
        contact_name="Demo CMCH Nurse",
        contact_phone="01733333333",
        contact_method="PHONE",
        additional_information="Maternity emergency. Rare A- blood required urgently.",
        status=BloodRequestStatus.OPEN,
        is_active=True,
    )
    db.add(req3)

    req4 = BloodRequest(
        id=uuid.uuid4(),
        user_id=requesters["demo_requester_dmc"].id,
        blood_group=BloodGroup.AB_POS,
        units_required=1,
        hospital_name="Sylhet MAG Osmani Medical College",
        hospital_area="Subidbazar",
        district="Sylhet",
        required_date=now - timedelta(days=3),
        required_time="09:00 AM",
        urgency=BloodUrgency.NORMAL,
        contact_name="Demo Sylhet Attendant",
        contact_phone="01744444444",
        contact_method="PHONE",
        additional_information="Routine procedure; successfully fulfilled.",
        status=BloodRequestStatus.FULFILLED,
        is_active=True,
    )
    db.add(req4)

    req5 = BloodRequest(
        id=uuid.uuid4(),
        user_id=requesters["demo_requester_savar"].id,
        blood_group=BloodGroup.O_NEG,
        units_required=3,
        hospital_name="Square Hospital",
        hospital_area="Panthapath",
        district="Dhaka",
        required_date=now + timedelta(days=2),
        required_time="04:00 PM",
        urgency=BloodUrgency.EMERGENCY,
        contact_name="Demo Square Hospital Desk",
        contact_phone="01755555555",
        contact_method="PHONE",
        additional_information="Accident victim in ICU. Universal donor O- urgently needed.",
        status=BloodRequestStatus.OPEN,
        is_active=True,
    )
    db.add(req5)

    await db.commit()

    # 5. Seed Donor Responses on REQ 2 (B+ at Dhaka Medical)
    resp1 = BloodRequestResponse(
        id=uuid.uuid4(),
        request_id=req2.id,
        donor_user_id=donors["demo_donor_bpos_savar"].id,
        message="I am available to donate B+ blood at DMC tomorrow afternoon.",
        contact_phone="01700000007",
        status=ResponseStatus.ACCEPTED,
    )
    db.add(resp1)

    resp2 = BloodRequestResponse(
        id=uuid.uuid4(),
        request_id=req2.id,
        donor_user_id=donors["demo_donor_opos_savar"].id,
        message="O+ universal red cell donor; ready to assist if B+ is insufficient.",
        contact_phone="01700000001",
        status=ResponseStatus.PENDING,
    )
    db.add(resp2)

    await db.commit()

    logger.info("Synthetic demo blood data seeding completed successfully.")

    return {
        "status": "success",
        "seeded_donors_count": len(DEMO_DONORS_DATA),
        "seeded_requesters_count": len(DEMO_REQUESTERS_DATA),
        "seeded_requests_count": 5,
        "seeded_responses_count": 2,
        "requests": {
            "req_enam_savar_opos": str(req1.id),
            "req_dmc_bpos": str(req2.id),
            "req_cmch_aneg": str(req3.id),
            "req_osmani_abpos_fulfilled": str(req4.id),
            "req_square_oneg": str(req5.id),
        },
    }
