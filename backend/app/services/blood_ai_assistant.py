import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.blood import (
    BloodGroup,
    DonorAvailability,
    BloodDonorProfile,
)
from app.schemas.ai_features import (
    BloodAssistantQueryRequest,
    BloodDonorResultItem,
    BloodAssistantResponse,
)
from app.services.ai_client import call_ai_json

# Bangladesh blood group regex patterns (English + Bengali)
BLOOD_GROUP_PATTERNS: Dict[BloodGroup, List[str]] = {
    BloodGroup.O_POS: [r"\bo\s*(?:pos|\+|\+ve|positive)\b", r"ও\s*পজিটিভ", r"ও\s*\+", r"\bo\+"],
    BloodGroup.O_NEG: [r"\bo\s*(?:neg|\-|\-ve|negative)\b", r"ও\s*নেগেটিভ", r"ও\s*\-", r"\bo\-"],
    BloodGroup.A_POS: [r"\ba\s*(?:pos|\+|\+ve|positive)\b", r"এ\s*পজিটিভ", r"এ\s*\+", r"\ba\+"],
    BloodGroup.A_NEG: [r"\ba\s*(?:neg|\-|\-ve|negative)\b", r"এ\s*নেগেটিভ", r"এ\s*\-", r"\ba\-"],
    BloodGroup.B_POS: [r"\bb\s*(?:pos|\+|\+ve|positive)\b", r"বি\s*পজিটিভ", r"বি\s*\+", r"\bb\+"],
    BloodGroup.B_NEG: [r"\bb\s*(?:neg|\-|\-ve|negative)\b", r"বি\s*নেগেটিভ", r"বি\s*\-", r"\bb\-"],
    BloodGroup.AB_POS: [r"\bab\s*(?:pos|\+|\+ve|positive)\b", r"এবি\s*পজিটিভ", r"এবি\s*\+", r"\bab\+"],
    BloodGroup.AB_NEG: [r"\bab\s*(?:neg|\-|\-ve|negative)\b", r"এবি\s*নেগেটিভ", r"এবি\s*\-", r"\bab\-"],
}

# Major Bangladesh Districts
BD_DISTRICTS = [
    "Dhaka", "Chattogram", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur",
    "Mymensingh", "Gazipur", "Narayanganj", "Cumilla", "Comilla", "Bogura", "Bogra", "Cox's Bazar",
    "Feni", "Noakhali", "Brahmanbaria", "Tangail", "Faridpur", "Jessore", "Jashore", "Kushtia",
    "Pabna", "Dinajpur", "Jamalpur", "Sirajganj",
]


def extract_blood_group_heuristically(text: str) -> Optional[BloodGroup]:
    """Detects exact blood group from text using English and Bengali expressions."""
    t = text.lower()
    # Check AB first before A or B
    for bg in [BloodGroup.AB_POS, BloodGroup.AB_NEG, BloodGroup.O_POS, BloodGroup.O_NEG,
               BloodGroup.A_POS, BloodGroup.A_NEG, BloodGroup.B_POS, BloodGroup.B_NEG]:
        patterns = BLOOD_GROUP_PATTERNS[bg]
        for pat in patterns:
            if re.search(pat, t, re.IGNORECASE):
                return bg
    return None


def extract_district_heuristically(text: str) -> Optional[str]:
    """Detects mentioned Bangladesh district from text."""
    t = text.lower()
    for d in BD_DISTRICTS:
        if d.lower() in t:
            return d
    # Bangla district matches
    bn_map = {
        "ঢাকা": "Dhaka", "চট্টগ্রাম": "Chattogram", "সিলেট": "Sylhet",
        "রাজশাহী": "Rajshahi", "খুলনা": "Khulna", "বরিশাল": "Barishal",
        "রংপুর": "Rangpur", "ময়মনসিংহ": "Mymensingh", "কুমিল্লা": "Cumilla",
        "গাজীপুর": "Gazipur", "নারায়ণগঞ্জ": "Narayanganj", "বগুড়া": "Bogura",
        "মিরপুর": "Dhaka", "ধানমন্ডি": "Dhaka", "উত্তরা": "Dhaka", "বনানী": "Dhaka",
    }
    for bn_word, eng_dist in bn_map.items():
        if bn_word in text:
            return eng_dist
    return None


async def search_blood_donors_ai(
    db: AsyncSession,
    request: BloodAssistantQueryRequest,
    current_user: Optional[User] = None,
    limit: int = 15,
) -> BloodAssistantResponse:
    """
    Parses natural-language blood requests, queries actual database donor profiles,
    enforces strict medical compatibility/exact group rules, and generates grounded explanations.
    """
    is_bn = (request.lang == "bn")
    query_text = request.query.strip()

    # 1. Attempt AI extraction first
    system_prompt = (
        "You are Nirapotta's AI Blood Requirement Parser. Extract donor search parameters from natural language. "
        "Strictly identify the exact requested Blood Group as one of: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']. "
        "Do NOT invent or assume a blood group if not mentioned. "
        "Return valid JSON with keys: "
        "'blood_group' (str or null), 'district' (str or null), 'area' (str or null), 'urgency' ('NORMAL', 'URGENT', 'EMERGENCY'), "
        "'is_clarification_needed' (boolean: true if blood group is absent or ambiguous), "
        "'clarification_question' (polite question in requested language asking for blood group, or null)."
    )
    user_prompt = f"User Request: '{query_text}'\nPreferred Language: {'Bangla' if is_bn else 'English'}"

    ai_data = await call_ai_json(prompt=user_prompt, system_prompt=system_prompt, timeout_seconds=8.0)

    # 2. Heuristic fallback / verification
    parsed_bg_str = ai_data.get("blood_group") if ai_data else None
    parsed_district = ai_data.get("district") if ai_data else None
    parsed_area = ai_data.get("area") if ai_data else None
    parsed_urgency = ai_data.get("urgency") if ai_data else "URGENT"

    # Verify or fallback blood group
    target_bg: Optional[BloodGroup] = None
    if parsed_bg_str:
        norm = parsed_bg_str.replace(" ", "+").upper().strip()
        try:
            target_bg = BloodGroup(norm)
        except ValueError:
            target_bg = None

    if not target_bg:
        target_bg = extract_blood_group_heuristically(query_text)

    # Fallback district if not extracted
    if not parsed_district:
        parsed_district = request.district or extract_district_heuristically(query_text)

    # If blood group is missing or unclear, ask follow-up question
    if not target_bg:
        clarification_msg = (
            "কোন রক্তের গ্রুপ প্রয়োজন? অনুগ্রহ করে নির্দিষ্ট রক্তের গ্রুপ উল্লেখ করুন (যেমন: O+, A+, B-, AB+ ইত্যাদি)।"
            if is_bn else
            "Which blood group is required? Please specify the exact blood group (e.g., O+, A+, B-, AB+, etc.)."
        )
        return BloodAssistantResponse(
            parsed_blood_group=None,
            parsed_district=parsed_district,
            parsed_area=parsed_area,
            parsed_urgency=parsed_urgency,
            is_clarification_needed=True,
            clarification_question=clarification_msg,
            donors=[],
            total_donors_found=0,
            explanation=clarification_msg,
            disclaimer="Notice: Blood matching must be verified by attending clinical medical personnel.",
            create_request_url="/blood-help/request",
        )

    # 3. Query PostgreSQL / Database for REAL Donors
    conditions = [
        BloodDonorProfile.blood_group == target_bg,
        BloodDonorProfile.availability_status == DonorAvailability.AVAILABLE,
    ]
    if parsed_district:
        conditions.append(func.lower(BloodDonorProfile.district) == parsed_district.lower().strip())

    stmt = (
        select(BloodDonorProfile)
        .where(and_(*conditions))
        .order_by(BloodDonorProfile.updated_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    donor_records = list(res.scalars().all())

    # If no donors in exact district, check other areas for the same blood group
    if len(donor_records) == 0 and parsed_district:
        stmt_fallback = (
            select(BloodDonorProfile)
            .where(
                and_(
                    BloodDonorProfile.blood_group == target_bg,
                    BloodDonorProfile.availability_status == DonorAvailability.AVAILABLE,
                )
            )
            .limit(limit)
        )
        res_fb = await db.execute(stmt_fallback)
        donor_records = list(res_fb.scalars().all())

    # 4. Serialize Donors with Privacy Rules
    donor_items: List[BloodDonorResultItem] = []
    now = datetime.now(timezone.utc)

    for p in donor_records:
        user_name = (p.user.full_name or p.user.username) if p.user else "Volunteer Donor"

        # Check eligibility (must be > 90 days since last donation)
        eligible = True
        if p.last_donation_date:
            dt = p.last_donation_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            days_since = (now - dt).total_seconds() / 86400.0
            if days_since < 90.0:
                eligible = False

        # Privacy rule: Contact phone only exposed to authenticated users
        can_view_phone = bool(current_user is not None) and bool(p.contact_phone)
        safe_phone = p.contact_phone if can_view_phone else (
            "Login to view contact number" if p.contact_phone else "In-app request only"
        )

        donor_items.append(
            BloodDonorResultItem(
                donor_id=str(p.id),
                display_name=user_name,
                blood_group=p.blood_group.value,
                district=p.district,
                area=p.area,
                availability_status=p.availability_status.value,
                last_donation_date=p.last_donation_date,
                eligible_to_donate=eligible,
                contact_phone=safe_phone,
                preferred_contact_method=p.preferred_contact_method,
                distance_km=None,
            )
        )

    # 5. Grounded AI Explanation
    total_found = len(donor_items)
    if is_bn:
        if total_found > 0:
            explanation = (
                f"ডেটাবেসে {target_bg.value} রক্তের মোট {total_found} জন প্রস্তুত ও সক্রিয় রক্তদাতা পাওয়া গেছে"
                + (f" ({parsed_district} এলাকা)" if parsed_district else "")
                + "। সকল রক্তদাতার বর্তমান সক্রিয়তা স্ট্যাটাস যাচাই করা হয়েছে।"
            )
        else:
            explanation = (
                f"দুঃখিত, বর্তমানে {target_bg.value} গ্রুপের কোনো নিবন্ধিত রক্তদাতা পাওয়া যায়নি"
                + (f" ({parsed_district} এলাকায়)" if parsed_district else "")
                + "। অনুগ্রহ করে সরাসরি একটি রক্ত রিকোয়েস্ট পোস্ট করুন যেন রক্তদাতারা নোটিফিকেশন পান।"
            )
    else:
        if total_found > 0:
            explanation = (
                f"Found {total_found} registered volunteer donor(s) matching blood group {target_bg.value}"
                + (f" in {parsed_district}" if parsed_district else "")
                + ". All returned donors have active availability listed in Nirapotta."
            )
        else:
            explanation = (
                f"No registered {target_bg.value} donors currently available in the database"
                + (f" for {parsed_district}" if parsed_district else "")
                + ". We recommend posting an urgent blood request to notify volunteer donors."
            )

    disclaimer = (
        "সতর্কতা: রক্ত পরিসঞ্চালনের পূর্বে হাসপাতালে ক্রস-ম্যাচিং ও স্ক্রিনিং পরীক্ষা নিশ্চিত করা আবশ্যক। এআই কেবল সন্ধান সহায়তা প্রদান করে।"
        if is_bn else
        "Medical Disclaimer: Transfusion safety and compatibility must always be confirmed through hospital cross-matching. AI acts as an informational donor discovery assistant only."
    )

    return BloodAssistantResponse(
        parsed_blood_group=target_bg.value,
        parsed_district=parsed_district,
        parsed_area=parsed_area,
        parsed_urgency=parsed_urgency,
        is_clarification_needed=False,
        clarification_question=None,
        donors=donor_items,
        total_donors_found=total_found,
        explanation=explanation,
        disclaimer=disclaimer,
        create_request_url="/blood-help/request",
    )
