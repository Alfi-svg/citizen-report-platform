import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    DonorAvailability,
    BloodDonorProfile,
    BloodRequest,
    BloodRequestStatus,
)
from app.models.hospital import (
    Hospital,
    BloodInventory,
    BloodInventoryStatus,
)
from app.models.emergency_service import VerificationStatus
from app.schemas.ai_features import (
    BloodAssistantQueryRequest,
    BloodDonorResultItem,
    BloodAssistantResponse,
)
from app.schemas.hospital import (
    BloodAIChatRequest,
    BloodAIChatResponse,
    HospitalSummary,
    BloodInventoryItem,
)
from app.services.ai_client import call_ai_json
from app.services.hospital_service import (
    get_nearby_hospitals,
    _serialize_hospital_summary,
)
from app.core.geo import calculate_haversine_distance, BD_DISTRICT_COORDS

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

# Bengali District & Area name mappings
BN_AREA_MAP = {
    "ঢাকা": "Dhaka", "চট্টগ্রাম": "Chattogram", "সিলেট": "Sylhet",
    "রাজশাহী": "Rajshahi", "খুলনা": "Khulna", "বরিশাল": "Barishal",
    "রংপুর": "Rangpur", "ময়মনসিংহ": "Mymensingh", "কুমিল্লা": "Cumilla",
    "গাজীপুর": "Gazipur", "নারায়ণগঞ্জ": "Narayanganj", "বগুড়া": "Bogura",
    "মিরপুর": "Mirpur", "ধানমন্ডি": "Dhanmondi", "উত্তরা": "Uttara",
    "বনানী": "Banani", "মোহাম্মদপুর": "Mohammadpur", "শাহবাগ": "Shahbag",
    "বকশিবাজার": "Bakshibazar", "পান্থপথ": "Panthapath", "শান্তিনগর": "Shantinagar",
}

# Hospital name abbreviations & aliases
HOSPITAL_ALIASES = {
    "dmch": "Dhaka Medical College Hospital",
    "dhaka medical": "Dhaka Medical College Hospital",
    "ঢাকা মেডিকেল": "Dhaka Medical College Hospital",
    "bsmmu": "Bangabandhu Sheikh Mujib Medical University",
    "pg hospital": "Bangabandhu Sheikh Mujib Medical University",
    "পিজি": "Bangabandhu Sheikh Mujib Medical University",
    "nicvd": "National Institute of Cardiovascular Diseases",
    "হৃদরোগ": "National Institute of Cardiovascular Diseases",
    "red crescent": "Bangladesh Red Crescent Society Central Blood Bank",
    "রেড ক্রিসেন্ট": "Bangladesh Red Crescent Society Central Blood Bank",
    "quantum": "Quantum Foundation Blood Lab",
    "কোয়ান্টাম": "Quantum Foundation Blood Lab",
    "square": "Square Hospital Blood Bank",
    "স্কয়ার": "Square Hospital Blood Bank",
    "kurmitola": "Kurmitola General Hospital",
    "কুর্মিটোলা": "Kurmitola General Hospital",
    "cmch": "Chittagong Medical College Hospital",
    "chittagong medical": "Chittagong Medical College Hospital",
    "চট্টগ্রাম মেডিকেল": "Chittagong Medical College Hospital",
    "osmani": "Sylhet MAG Osmani Medical College Hospital",
    "ওসমানী": "Sylhet MAG Osmani Medical College Hospital",
    "rmch": "Rajshahi Medical College Hospital",
    "রাজশাহী মেডিকেল": "Rajshahi Medical College Hospital",
    "kmch": "Khulna Medical College Hospital",
    "খুলনা মেডিকেল": "Khulna Medical College Hospital",
    "mmch": "Mymensingh Medical College Hospital",
    "ময়মনসিংহ মেডিকেল": "Mymensingh Medical College Hospital",
}


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
    """Detects mentioned Bangladesh district or area from text."""
    t = text.lower()
    for d in BD_DISTRICTS:
        if d.lower() in t:
            return d
    for bn_word, eng_dist in BN_AREA_MAP.items():
        if bn_word in text:
            if eng_dist in ["Mirpur", "Dhanmondi", "Uttara", "Banani", "Mohammadpur", "Shahbag", "Bakshibazar", "Panthapath", "Shantinagar"]:
                return "Dhaka"
            return eng_dist
    return None


def extract_hospital_alias(text: str) -> Optional[str]:
    """Detects specific hospital mentioned in query."""
    t = text.lower()
    for alias, full_name in HOSPITAL_ALIASES.items():
        if alias in t:
            return full_name
    return None


def extract_quantity_heuristically(text: str) -> Optional[int]:
    """Detects requested number of bags or units."""
    t = text.lower()
    m = re.search(r"(\d+)\s*(?:bag|bags|unit|units|ব্যাগ|প্যাকেট|ইউনিট)", t)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return None
    bn_digits = {"১": 1, "২": 2, "৩": 3, "৪": 4, "৫": 5, "৬": 6, "৭": 7, "৮": 8, "৯": 9}
    for bnd, val in bn_digits.items():
        if f"{bnd} ব্যাগ" in t or f"{bnd} ইউনিট" in t:
            return val
    return None


# ---------------------------------------------------------------------------
# Existing Legacy Helper: search_blood_donors_ai
# ---------------------------------------------------------------------------

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

    parsed_bg_str = ai_data.get("blood_group") if ai_data else None
    parsed_district = ai_data.get("district") if ai_data else None
    parsed_area = ai_data.get("area") if ai_data else None
    parsed_urgency = ai_data.get("urgency") if ai_data else "URGENT"

    target_bg: Optional[BloodGroup] = None
    if parsed_bg_str:
        norm = parsed_bg_str.replace(" ", "+").upper().strip()
        try:
            target_bg = BloodGroup(norm)
        except ValueError:
            target_bg = None

    if not target_bg:
        target_bg = extract_blood_group_heuristically(query_text)

    if not parsed_district:
        parsed_district = request.district or extract_district_heuristically(query_text)

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

    donor_items: List[BloodDonorResultItem] = []
    now = datetime.now(timezone.utc)

    for p in donor_records:
        user_name = (p.user.full_name or p.user.username) if p.user else "Volunteer Donor"
        eligible = True
        if p.last_donation_date:
            dt = p.last_donation_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            days_since = (now - dt).total_seconds() / 86400.0
            if days_since < 90.0:
                eligible = False

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


# ---------------------------------------------------------------------------
# New Feature: Blood AI — Emergency Blood & Nearby Hospital Assistant
# ---------------------------------------------------------------------------

async def chat_blood_ai(
    db: AsyncSession,
    request: BloodAIChatRequest,
    current_user: Optional[User] = None,
) -> BloodAIChatResponse:
    """
    Agentic natural-language Blood AI assistant:
    1. Extracts intent, blood group, quantity, location, urgency, and hospital preference.
    2. Identifies missing information and prompts follow-up only when strictly necessary.
    3. Executes database tools to query verified hospitals, live inventory, and registered donors.
    4. Explains hospital recommendations grounded in actual verified database facts.
    """
    is_bn = (request.lang == "bn")
    msg = request.message.strip()
    conv_id = request.conversation_id or str(uuid.uuid4())

    # --- Step 1: AI Parameter & Intent Extraction ---
    system_prompt = (
        "You are Nirapotta AI's Blood & Hospital Assistant for Bangladesh emergency services. "
        "Analyze the user's natural language request (in Bangla or English). "
        "Extract the following structured parameters as JSON:\n"
        "- 'intent': one of ['FIND_HOSPITALS', 'CHECK_INVENTORY', 'GET_CONTACT', 'GET_LOCATION', 'FIND_DONORS', 'REQUEST_ASSISTANCE', 'GENERAL_INQUIRY']\n"
        "- 'blood_group': one of ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] or null\n"
        "- 'quantity_units': integer or null\n"
        "- 'location_district': mentioned Bangladesh district (e.g. 'Dhaka', 'Chattogram') or null\n"
        "- 'location_area': specific neighborhood (e.g. 'Dhanmondi', 'Mirpur', 'Shahbag') or null\n"
        "- 'hospital_name': mentioned hospital name or alias (e.g. 'Dhaka Medical', 'BSMMU', 'Square') or null\n"
        "- 'urgency': 'NORMAL', 'URGENT', or 'EMERGENCY'\n"
        "- 'needs_clarification': boolean (true ONLY if user urgently asks for blood inventory/stock and blood group is missing)\n"
        "- 'clarification_question': polite question in user's language if needs_clarification is true, else null"
    )

    user_prompt = (
        f"User message: '{msg}'\n"
        f"Language preference: {'Bangla' if is_bn else 'English'}\n"
        f"Provided user context - Lat: {request.user_latitude}, Lng: {request.user_longitude}, "
        f"District: {request.user_district}, Preference Blood Group: {request.blood_group_preference}"
    )

    ai_data = await call_ai_json(prompt=user_prompt, system_prompt=system_prompt, timeout_seconds=8.0)

    # --- Step 2: Fallback & Heuristic Extraction ---
    intent = ai_data.get("intent") if ai_data else None
    extracted_bg_str = ai_data.get("blood_group") if ai_data else None
    extracted_district = ai_data.get("location_district") if ai_data else None
    extracted_area = ai_data.get("location_area") if ai_data else None
    extracted_hospital = ai_data.get("hospital_name") if ai_data else None
    extracted_quantity = ai_data.get("quantity_units") if ai_data else None
    urgency = ai_data.get("urgency") if ai_data else "URGENT"

    target_bg: Optional[BloodGroup] = None
    if extracted_bg_str:
        norm = extracted_bg_str.replace(" ", "+").upper().strip()
        try:
            target_bg = BloodGroup(norm)
        except ValueError:
            target_bg = None

    if not target_bg:
        target_bg = extract_blood_group_heuristically(msg)
    if not target_bg and request.blood_group_preference:
        try:
            target_bg = BloodGroup(request.blood_group_preference.replace(" ", "+").upper().strip())
        except ValueError:
            pass

    if not extracted_district:
        extracted_district = request.user_district or extract_district_heuristically(msg)

    if not extracted_hospital:
        extracted_hospital = extract_hospital_alias(msg)

    if not extracted_quantity:
        extracted_quantity = extract_quantity_heuristically(msg)

    # Detect intent heuristics
    msg_lower = msg.lower()
    if not intent:
        if any(w in msg_lower for w in ["রক্ত লাগবে", "রক্ত প্রয়োজন", "রক্ত প্রয়োজন", "need blood", "blood needed", "blood required", "blood availability", "রক্তের সন্ধান", "blood lagbe"]):
            intent = "CHECK_INVENTORY"
        elif any(w in msg_lower for w in ["phone", "number", "contact", "কল", "ফোন", "নাম্বার"]):
            intent = "GET_CONTACT"
        elif any(w in msg_lower for w in ["location", "address", "কোথায়", "ঠিকানা", "কই", "ম্যাপ", "map"]):
            intent = "GET_LOCATION"
        elif any(w in msg_lower for w in ["donor", "volunteer", "দাতা", "রক্তদাতা"]):
            intent = "FIND_DONORS"
        elif any(w in msg_lower for w in ["hospital", "blood bank", "হাসপাতাল", "ব্লাড ব্যাংক"]):
            intent = "FIND_HOSPITALS"
        elif target_bg:
            intent = "CHECK_INVENTORY"
        else:
            intent = "GENERAL_INQUIRY"

    # --- Step 3: Handle Clarification / Missing Info ---
    # Blood group is required when the user specifically asks for blood availability or stock
    # BUT not required if the user simply asks for emergency hospital phone numbers or nearby hospital locations!
    if not target_bg and intent in ("CHECK_INVENTORY", "FIND_DONORS"):
        clarification_question = (
            "কোন রক্তের গ্রুপ প্রয়োজন? অনুগ্রহ করে রক্তের গ্রুপ উল্লেখ করুন (যেমন: O+, A+, B+, AB+ ইত্যাদি)।"
            if is_bn else
            "Which blood group do you need? Please specify the blood group (e.g. O+, A+, B+, AB+, etc.)."
        )
        return BloodAIChatResponse(
            reply=clarification_question,
            conversation_id=conv_id,
            intent=intent,
            extracted_params={
                "blood_group": None,
                "quantity": extracted_quantity,
                "district": extracted_district,
                "area": extracted_area,
                "hospital": extracted_hospital,
                "urgency": urgency,
            },
            is_clarification_needed=True,
            follow_up_question=clarification_question,
            hospitals=[],
            donors=[],
            total_hospitals_found=0,
            tools_called=[],
            suggested_actions=["Select Blood Group"],
            disclaimer="Notice: Blood matching must be verified by attending clinical medical personnel.",
        )

    # --- Step 4: Execute Controlled Backend Tools ---
    tools_called: List[str] = []
    hospitals_found: List[HospitalSummary] = []
    donors_found: List[Dict[str, Any]] = []

    bg_filter_str = target_bg.value if target_bg else None
    tools_called.append("search_nearby_hospitals")
    if target_bg:
        tools_called.append("search_blood_inventory")

    hospitals_found = await get_nearby_hospitals(
        db=db,
        latitude=request.user_latitude,
        longitude=request.user_longitude,
        district=extracted_district,
        blood_group=bg_filter_str,
        query=extracted_hospital,
        radius_km=35.0,
        limit=10,
    )

    if intent == "GET_CONTACT":
        tools_called.append("get_hospital_contact")
    if intent == "GET_LOCATION":
        tools_called.append("get_hospital_location")

    should_search_donors = (intent == "FIND_DONORS") or (
        target_bg is not None and any(
            h.matching_inventory and h.matching_inventory.availability_status in ("OUT_OF_STOCK", "LOW_STOCK")
            for h in hospitals_found
        )
    )

    if should_search_donors and target_bg:
        tools_called.append("search_available_donors")
        conditions_donor = [
            BloodDonorProfile.blood_group == target_bg,
            BloodDonorProfile.availability_status == DonorAvailability.AVAILABLE,
        ]
        if extracted_district:
            conditions_donor.append(func.lower(BloodDonorProfile.district) == extracted_district.lower().strip())

        stmt_d = (
            select(BloodDonorProfile)
            .where(and_(*conditions_donor))
            .order_by(BloodDonorProfile.updated_at.desc())
            .limit(5)
        )
        res_d = await db.execute(stmt_d)
        donor_records = list(res_d.scalars().all())

        can_view_phone = bool(current_user is not None)
        for d in donor_records:
            d_name = (d.user.full_name or d.user.username) if d.user else "Volunteer Donor"
            donors_found.append({
                "donor_id": str(d.id),
                "name": d_name,
                "blood_group": d.blood_group.value,
                "district": d.district,
                "area": d.area,
                "phone": d.contact_phone if can_view_phone else "Login to view contact",
                "availability": d.availability_status.value,
            })

    # --- Step 5: Synthesize Grounded AI Response ---
    total_h = len(hospitals_found)
    total_d = len(donors_found)

    reply_parts: List[str] = []

    if is_bn:
        if total_h > 0:
            top_h = hospitals_found[0]
            dist_str = f" ({top_h.distance_km} কিমি দূরে)" if top_h.distance_km is not None else ""
            reply_parts.append(
                f"আপনার কাছাকাছি মোট {total_h}টি হাসপাতাল ও ব্লাড ব্যাংক রেকর্ড পাওয়া গেছে। "
                f"নিকটস্থ প্রতিষ্ঠান: **{top_h.name}**{dist_str}।"
            )
            if target_bg and top_h.matching_inventory:
                st = top_h.matching_inventory.availability_status
                units = top_h.matching_inventory.available_units
                if st == "AVAILABLE":
                    reply_parts.append(
                        f"হাসপাতালে {target_bg.value} গ্রুপের রক্তের আনুমানিক {units} ব্যাগ সংরক্ষিত আছে (স্ট্যাটাস: পর্যাপ্ত/Available)।"
                    )
                elif st == "LOW_STOCK":
                    reply_parts.append(
                        f"হাসপাতালে {target_bg.value} গ্রুপের রক্তের স্টক সীমিত ({units} ব্যাগ অবশিষ্ট)।"
                    )
                elif st == "OUT_OF_STOCK":
                    reply_parts.append(
                        f"হাসপাতালের বর্তমান ডেটাবেসে {target_bg.value} রক্তের স্টক খালি (Out of Stock)।"
                    )
                else:
                    reply_parts.append(
                        f"হাসপাতালে {target_bg.value} রক্তের মজুদ সরাসরি যাচাই করা সম্ভব হয়নি।"
                    )
            reply_parts.append(f"জরুরি প্রয়োজনে সরাসরি কল করুন: {top_h.emergency_phone}")
        else:
            reply_parts.append(
                f"দুঃখিত, {extracted_district or 'নির্দিষ্ট'} এলাকায় কোনো সক্রিয় হাসপাতালের রেকর্ড পাওয়া যায়নি।"
            )

        if total_d > 0:
            reply_parts.append(
                f"বিকল্প হিসেবে আপনার এলাকায় {total_d} জন নিবন্ধিত সক্রিয় {target_bg.value if target_bg else ''} রক্তদাতা পাওয়া গেছে।"
            )
        elif target_bg and total_h == 0:
            reply_parts.append(
                "আপনি প্ল্যাটফর্মে জরুরি রক্ত রিকোয়েস্ট তৈরি করতে পারেন যেন রক্তদাতারা তাৎক্ষণিক নোটিফিকেশন পান।"
            )
    else:
        if total_h > 0:
            top_h = hospitals_found[0]
            dist_str = f" ({top_h.distance_km} km away)" if top_h.distance_km is not None else ""
            reply_parts.append(
                f"Found {total_h} hospital(s) and blood bank(s) matching your location. "
                f"Closest verified facility: **{top_h.name}**{dist_str}."
            )
            if target_bg and top_h.matching_inventory:
                st = top_h.matching_inventory.availability_status
                units = top_h.matching_inventory.available_units
                if st == "AVAILABLE":
                    reply_parts.append(
                        f"Verified inventory lists ~{units} unit(s) of {target_bg.value} blood (Status: Available)."
                    )
                elif st == "LOW_STOCK":
                    reply_parts.append(
                        f"{target_bg.value} blood stock is limited at this location ({units} unit(s) remaining)."
                    )
                elif st == "OUT_OF_STOCK":
                    reply_parts.append(
                        f"Currently out of stock for {target_bg.value} blood at this hospital."
                    )
                else:
                    reply_parts.append(
                        f"{target_bg.value} blood availability has not been verified for this facility."
                    )
            reply_parts.append(f"Emergency Phone: {top_h.emergency_phone}")
        else:
            reply_parts.append(
                f"No verified hospitals found matching '{extracted_district or extracted_hospital or 'your criteria'}'."
            )

        if total_d > 0:
            reply_parts.append(
                f"Additionally, found {total_d} registered volunteer donor(s) in Nirapotta's verified donor network."
            )
        elif target_bg and total_h == 0:
            reply_parts.append(
                "We recommend posting an emergency blood request in Nirapotta to alert volunteer donors immediately."
            )

    disclaimer = (
        "জরুরি সতর্কতা: রক্ত পরিসঞ্চালনের পূর্বে হাসপাতালে ক্রস-ম্যাচিং ও স্ক্রিনিং পরীক্ষা নিশ্চিত করা আবশ্যক। হাসপাতালে যাওয়ার পূর্বে ফোনে স্টক নিশ্চিত করে নেওয়ার পরামর্শ দেওয়া হচ্ছে।"
        if is_bn else
        "Emergency Disclaimer: Blood inventory fluctuates dynamically. Always call the hospital blood bank to confirm availability before traveling. Clinical cross-matching is strictly required."
    )

    suggested_actions = ["Call Hospital", "View Location", "View Blood Availability"]
    if target_bg:
        suggested_actions.append("Post Blood Request")

    return BloodAIChatResponse(
        reply=" ".join(reply_parts),
        conversation_id=conv_id,
        intent=intent,
        extracted_params={
            "blood_group": target_bg.value if target_bg else None,
            "quantity": extracted_quantity,
            "district": extracted_district,
            "area": extracted_area,
            "hospital": extracted_hospital,
            "urgency": urgency,
        },
        is_clarification_needed=False,
        follow_up_question=None,
        hospitals=hospitals_found,
        donors=donors_found,
        total_hospitals_found=total_h,
        tools_called=tools_called,
        suggested_actions=suggested_actions,
        disclaimer=disclaimer,
    )
