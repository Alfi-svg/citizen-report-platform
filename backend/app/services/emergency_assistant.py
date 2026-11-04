import re
import uuid
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.category import Category
from app.models.blood import BloodGroup, BloodUrgency
from app.schemas.ai_features import (
    ChatMessage,
    EmergencyAssistantRequest,
    EmergencyAssistantResponse,
    DraftReportPreview,
    DraftBloodRequestPreview,
    EmergencyType,
)
from app.services.ai_client import call_ai_json
from app.services.action_planner import generate_emergency_action_plan

# ---------------------------------------------------------------------------
# Category Keywords Mapping for Incident Reports
# ---------------------------------------------------------------------------
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "public-safety": [
        "accident", "crash", "collision", "overturn", "hit and run", "fire",
        "explosion", "hazard", "pothole", "wire", "gas leak", "collapse",
        "সড়ক", "দুর্ঘটনা", "আগুন", "বিস্ফোরণ", "ধ্বস", "বিপদ", "গাড়ি দুর্ঘটনা",
        "shorok", "durghotona", "aagun", "bipod", "gari",
    ],
    "violence": [
        "fight", "clash", "assault", "attack", "beaten", "mob", "stab", "shooting",
        "মারামারি", "হামলা", "সংঘর্ষ", "মারধর", "মারপিট", "গুলি",
        "maramari", "hamla", "songhorsho", "guli",
    ],
    "murder": [
        "murder", "killing", "dead body", "homicide", "slain",
        "খুন", "হত্যা", "লাশ", "মৃতদেহ", "khun", "hotta", "lash",
    ],
    "abuse": [
        "harassment", "eve-teasing", "stalking", "domestic abuse", "child abuse",
        "উত্ত্যক্ত", "হয়রানি", "ইভটিজিং", "নির্যাতন", "hoyrani",
    ],
    "crime": [
        "theft", "robbery", "mugging", "pickpocket", "snatching", "burglary",
        "চুরি", "ডাকাতি", "ছিনতাই", "পকেটমার", "churi", "dakati", "chintai",
    ],
    "missing-person": [
        "missing", "lost person", "kidnap", "abducted", "runaway", "child lost",
        "নিখোঁজ", "হারিয়ে গেছে", "অপহরণ", "nikhoj", "harie gese",
    ],
    "corruption": [
        "bribe", "graft", "extortion", "misconduct", "kickback",
        "ঘুষ", "দুর্নীতি", "চাঁদাবাজি", "ghush", "durniti", "chadabazi",
    ],
    "fraud": [
        "fraud", "scam", "forgery", "fake", "cheated",
        "প্রতারণা", "প্রতারক", "জালিয়াতি", "protarona", "dhoka",
    ],
    "public-service-issue": [
        "water supply", "electricity cut", "sewerage", "broken pipe", "garbage",
        "বিদ্যুৎ", "পানি নেই", "ড্রেন", "ময়লা", "biddut", "pani nai",
    ],
    "environmental-issue": [
        "river pollution", "tree cutting", "waste dumping", "smoke",
        "নদী দূষণ", "গাছ কাটা", "বর্জ্য",
    ],
}

# ---------------------------------------------------------------------------
# Blood Keyword & Pattern Detection
# ---------------------------------------------------------------------------
BLOOD_TRIGGER_KEYWORDS = [
    "blood", "rokto", "roktw", "donor", "donar", "bag", "bags", "packet", "packets",
    "platelet", "platelets", "transfusion", "hemoglobin",
    "রক্ত", "ব্লাড", "ডোনার", "ব্যাগ", "প্যাকেট", "প্লাটিলেট",
]

BLOOD_GROUP_PATTERNS: Dict[str, List[str]] = {
    "O+": [r"\bo\s*(?:pos|\+|\+ve|positive)\b", r"ও\s*পজিটিভ", r"ও\s*\+", r"\bo\+"],
    "O-": [r"\bo\s*(?:neg|\-|\-ve|negative)\b", r"ও\s*নেগেটিভ", r"ও\s*\-", r"\bo\-"],
    "A+": [r"\ba\s*(?:pos|\+|\+ve|positive)\b", r"এ\s*পজিটিভ", r"এ\s*\+", r"\ba\+"],
    "A-": [r"\ba\s*(?:neg|\-|\-ve|negative)\b", r"এ\s*নেগেটিভ", r"এ\s*\-", r"\ba\-"],
    "B+": [r"\bb\s*(?:pos|\+|\+ve|positive)\b", r"বি\s*পজিটিভ", r"বি\s*\+", r"\bb\+"],
    "B-": [r"\bb\s*(?:neg|\-|\-ve|negative)\b", r"বি\s*নেগেটিভ", r"বি\s*\-", r"\bb\-"],
    "AB+": [r"\bab\s*(?:pos|\+|\+ve|positive)\b", r"এবি\s*পজিটিভ", r"এবি\s*\+", r"\bab\+"],
    "AB-": [r"\bab\s*(?:neg|\-|\-ve|negative)\b", r"এবি\s*নেগেটিভ", r"এবি\s*\-", r"\bab\-"],
}

BD_DISTRICTS = [
    "Dhaka", "Chattogram", "Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Barisal",
    "Rangpur", "Mymensingh", "Gazipur", "Narayanganj", "Cumilla", "Comilla", "Bogura", "Bogra",
    "Cox's Bazar", "Feni", "Noakhali", "Brahmanbaria", "Tangail", "Faridpur", "Jessore", "Jashore",
    "Kushtia", "Pabna", "Dinajpur", "Jamalpur", "Sirajganj",
]

KNOWN_HOSPITALS = [
    ("Dhaka Medical College Hospital", ["dhaka medical", "dmch", "ঢাকা মেডিকেল", "ঢামেক", "dhaka med"]),
    ("Sir Salimullah Medical College (Mitford)", ["mitford", "salimullah", "মিটফোর্ড", "সলিমুল্লাহ"]),
    ("Bangabandhu Sheikh Mujib Medical University (BSMMU / PG)", ["bsmmu", "pg hospital", "বঙ্গবন্ধু", "পিজি"]),
    ("National Institute of Cardiovascular Diseases (NICVD)", ["nicvd", "cardiovascular", "হৃদরোগ ইনস্টিটিউট"]),
    ("Square Hospital", ["square hospital", "square", "স্কয়ার"]),
    ("United Hospital", ["united hospital", "united", "ইউনাইটেড"]),
    ("Evercare Hospital", ["evercare", "apollo", "এভারকেয়ার", "অ্যাপোলো"]),
    ("Labaid Specialized Hospital", ["labaid", "ল্যাবএইড"]),
    ("Ibn Sina Hospital", ["ibn sina", "ইবনে সিনা"]),
    ("BIRDEM General Hospital", ["birdem", "বারডেম"]),
    ("Kurmitola General Hospital", ["kurmitola", "কুর্মিটোলা"]),
    ("Combined Military Hospital (CMH)", ["cmh", "military hospital", "সিএমএইচ"]),
    ("Mugda Medical College Hospital", ["mugda", "মুগদা"]),
    ("Shaheed Suhrawardy Medical College Hospital", ["suhrawardy", "সোহরাওয়ার্দী"]),
    ("Chittagong Medical College Hospital", ["chittagong medical", "cmch", "চমেক", "চট্টগ্রাম মেডিকেল"]),
    ("Sylhet MAG Osmani Medical College Hospital", ["osmani", "sylhet medical", "ওসমানী"]),
    ("Rajshahi Medical College Hospital", ["rajshahi medical", "rmch", "রামেক"]),
]

BN_TO_EN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def _normalize_bangla_digits(text: str) -> str:
    return text.translate(BN_TO_EN_DIGITS)


def _detect_emergency_type(text: str) -> EmergencyType:
    """Classifies whether the user is requesting blood or reporting an incident."""
    t = text.lower()
    for kw in BLOOD_TRIGGER_KEYWORDS:
        if kw in t:
            return EmergencyType.BLOOD_REQUEST

    # Check for blood group mentions combined with lagbe/need/urgent
    for bg_patterns in BLOOD_GROUP_PATTERNS.values():
        for pat in bg_patterns:
            if re.search(pat, t, re.IGNORECASE):
                if any(w in t for w in ["need", "require", "urgent", "help", "lagbe", "chai", "dorkar", "লাগবে", "দরকার", "চাই", "জরুরি", "জরুরী"]):
                    return EmergencyType.BLOOD_REQUEST

    return EmergencyType.INCIDENT


# ---------------------------------------------------------------------------
# Heuristic Extractors
# ---------------------------------------------------------------------------
def _extract_blood_group(text: str) -> Optional[str]:
    t = text.lower()
    # Check AB groups first to prevent false match on A or B
    for bg in ["AB+", "AB-", "O+", "O-", "A+", "A-", "B+", "B-"]:
        for pat in BLOOD_GROUP_PATTERNS[bg]:
            if re.search(pat, t, re.IGNORECASE):
                return bg
    return None


def _extract_blood_quantity(text: str) -> int:
    norm = _normalize_bangla_digits(text.lower())
    # Regex e.g. "2 bags", "2 bag", "২ ব্যাগ", "2 units"
    m = re.search(r"\b(\d+)\s*(?:bag|bags|unit|units|packet|packets|ব্যাগ|ইউনিট|প্যাকেট)\b", norm)
    if m:
        try:
            val = int(m.group(1))
            if 1 <= val <= 20:
                return val
        except ValueError:
            pass

    # Word matches
    word_map = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5,
        "ek": 1, "dui": 2, "tin": 3, "char": 4, "pach": 5,
    }
    for word, qty in word_map.items():
        if re.search(rf"\b{word}\s*(?:bag|bags|unit|ব্যাগ|ইউনিট)\b", norm):
            return qty

    return 1


def _extract_phone_number(text: str) -> Optional[str]:
    norm = _normalize_bangla_digits(text)
    m = re.search(r"(?:\+?8801|01)[3-9]\d{8}\b", norm)
    if m:
        return m.group(0)
    return None


def _extract_hospital_and_location(text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Returns (hospital_name, hospital_area, district)."""
    t = text.lower()
    hospital_name = None
    hospital_area = None
    district = None

    # 1. Match known hospitals
    for official_name, aliases in KNOWN_HOSPITALS:
        for alias in aliases:
            if alias in t:
                hospital_name = official_name
                break
        if hospital_name:
            break

    # If no specific known hospital matched, check generic regex
    if not hospital_name:
        m_hosp = re.search(r"([A-Za-z0-9\s,\.\-]{3,30}\s+(?:Hospital|Medical|Clinic|হাসপাতাল|মেডিকেল|ক্লিনিক))", text, re.IGNORECASE)
        if m_hosp:
            h = m_hosp.group(1).strip()
            if len(h) > 5 and h.lower() not in ("the hospital", "a hospital", "hospital in", "হাসপাতালে"):
                hospital_name = h

    # 2. Match district
    for d in BD_DISTRICTS:
        if d.lower() in t:
            district = d
            break
    if not district:
        bn_dist = {
            "ঢাকা": "Dhaka", "চট্টগ্রাম": "Chattogram", "সিলেট": "Sylhet",
            "রাজশাহী": "Rajshahi", "খুলনা": "Khulna", "বরিশাল": "Barishal",
            "রংপুর": "Rangpur", "ময়মনসিংহ": "Mymensingh", "কুমিল্লা": "Cumilla",
            "গাজীপুর": "Gazipur", "নারায়ণগঞ্জ": "Narayanganj", "বগুড়া": "Bogura",
        }
        for bn_name, en_dist in bn_dist.items():
            if bn_name in text:
                district = en_dist
                break

    # 3. Match area / neighborhood
    areas = [
        "Dhanmondi", "Mirpur", "Uttara", "Mohakhali", "Gulshan", "Banani", "Shahbagh",
        "Motijheel", "Badda", "Rampura", "Mohammadpur", "Old Dhaka", "Farmgate", "Bashundhara",
        "ধানমন্ডি", "মিরপুর", "উত্তরা", "মহাখালী", "গুলশান", "বনানী", "শাহবাগ", "ফার্মগেট",
    ]
    for a in areas:
        if a.lower() in t:
            hospital_area = a
            if not district:
                district = "Dhaka"
            break

    # If hospital name has Dhaka but district is not set
    if hospital_name and "dhaka" in hospital_name.lower() and not district:
        district = "Dhaka"

    # If district is found but no specific area
    if district and not hospital_area:
        hospital_area = district

    return hospital_name, hospital_area, district


def _extract_urgency(text: str) -> str:
    t = text.lower()
    if any(w in t for w in ["immediate", "emergency", "life threatening", "এখনই", "জরুরি", "জরুরী", "এখনই লাগবে", "critical"]):
        return "EMERGENCY"
    if any(w in t for w in ["tonight", "today", "urgent", "আজকে", "আজ রাতের মধ্যে", "তাড়াতাড়ি", "asap"]):
        return "URGENT"
    return "URGENT"


def _match_category_heuristically(text: str, categories: List[Category]) -> Tuple[Optional[Category], float]:
    """Matches text against existing active database categories."""
    text_lower = text.lower()
    for cat in categories:
        slug = cat.slug.lower()
        keywords = CATEGORY_KEYWORDS.get(slug, [cat.name.lower()])
        for kw in keywords:
            if kw in text_lower:
                return cat, 1.0

    for cat in categories:
        if cat.slug in ("public-safety", "other"):
            return cat, 0.5
    return (categories[0] if categories else None), 0.1


def _extract_location_heuristically(text: str) -> Optional[str]:
    """Extracts common Bangladesh location phrases from text."""
    # Pattern for English: "near X", "at X", "in X", "on X Road"
    m_en = re.search(r"(?:near|at|in|around|on)\s+([A-Z0-9][A-Za-z0-9\s,\.\-]{2,35})", text)
    if m_en:
        loc = m_en.group(1).strip().rstrip(".,")
        if loc.lower() not in ("the hospital", "the scene", "danger", "now", "today", "yesterday"):
            return loc

    # Pattern for Bangla: "... এর কাছে", "... এ", "... রোডে", "... মোড়ে"
    m_bn = re.search(r"([\u0980-\u09FF\w\s\-]{2,30})\s*(?:এর কাছে|এ|তে|রোডে|মোড়ে|বাজারে|সামনে)", text)
    if m_bn:
        return m_bn.group(1).strip()

    return None


# ---------------------------------------------------------------------------
# Core Service: Process Emergency Assistant Chat
# ---------------------------------------------------------------------------
async def process_emergency_assistant_chat(
    db: AsyncSession,
    request: EmergencyAssistantRequest,
) -> EmergencyAssistantResponse:
    """
    Orchestrates the multi-turn conversational AI Emergency Assistant.
    Supports both Emergency Blood Requests and Citizen Incident Reports in Bangla,
    English, and Banglish.
    Preserves context across history turns, asks focused clarification questions,
    and returns a structured draft preview ready for explicit user confirmation.
    """
    conversation_id = request.conversation_id or str(uuid.uuid4())
    is_bn = (request.lang == "bn")

    # Fetch active categories from DB
    cat_stmt = select(Category).where(Category.is_active == True)
    cat_res = await db.execute(cat_stmt)
    all_categories = list(cat_res.scalars().all())

    # Build full conversational history text
    user_turns: List[str] = []
    if request.history:
        for msg in request.history:
            if msg.role == "user" and msg.content.strip():
                user_turns.append(msg.content.strip())
    if request.message.strip():
        user_turns.append(request.message.strip())

    full_conversation_text = "\n".join(user_turns)
    latest_message = request.message.strip()

    # Detect emergency type across whole conversation
    emergency_type = _detect_emergency_type(full_conversation_text)

    # -----------------------------------------------------------------------
    # Branch 1: Emergency Blood Request Workflow
    # -----------------------------------------------------------------------
    if emergency_type == EmergencyType.BLOOD_REQUEST:
        # 1. Deterministic Multi-Turn Extraction across turns
        extracted_bg = _extract_blood_group(full_conversation_text)
        extracted_qty = _extract_blood_quantity(full_conversation_text)
        extracted_hosp, extracted_area, extracted_dist = _extract_hospital_and_location(full_conversation_text)
        extracted_phone = _extract_phone_number(full_conversation_text)
        extracted_urgency = _extract_urgency(full_conversation_text)

        # 2. Try LLM extraction for higher fidelity if configured
        system_prompt = (
            "You are Nirapotta's AI Emergency Blood Request Parser for Bangladesh. "
            "Extract structured blood request fields from user messages in Bengali, English, or Banglish.\n"
            "Return valid JSON with keys:\n"
            "- 'blood_group': Exact blood group ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') or null.\n"
            "- 'units_required': Integer number of bags (default 1).\n"
            "- 'hospital_name': Hospital or clinic name (e.g. 'Dhaka Medical College Hospital') or null.\n"
            "- 'hospital_area': Area or neighborhood (e.g. 'Dhanmondi', 'Mirpur') or null.\n"
            "- 'district': District name (e.g. 'Dhaka') or null.\n"
            "- 'urgency': 'NORMAL', 'URGENT', or 'EMERGENCY'.\n"
            "- 'contact_phone': Phone number or null.\n"
            "- 'contact_name': Contact person's name or null.\n"
            "- 'additional_information': Summary of situation (patient condition, deadline, etc.).\n"
            "- 'missing_fields': List of critical missing fields required to submit (e.g. ['hospital_name', 'contact_phone']).\n"
            "- 'follow_up_question': A polite, concise follow-up question in user's language asking for missing fields, or null if complete.\n"
            "- 'reply_message': A reassuring confirmation of what has been noted."
        )

        user_prompt = (
            f"User latest message: \"{latest_message}\"\n"
            f"Full conversation context:\n{full_conversation_text}\n"
            f"Language: {'Bangla' if is_bn else 'English'}"
        )

        ai_data = await call_ai_json(prompt=user_prompt, system_prompt=system_prompt, timeout_seconds=8.0)

        # Merge AI data with deterministic data
        if ai_data and isinstance(ai_data, dict):
            if not extracted_bg and ai_data.get("blood_group"):
                extracted_bg = _extract_blood_group(str(ai_data.get("blood_group")))
            if ai_data.get("units_required") and isinstance(ai_data.get("units_required"), int):
                extracted_qty = max(1, min(20, ai_data.get("units_required")))
            if not extracted_hosp and ai_data.get("hospital_name"):
                extracted_hosp = str(ai_data.get("hospital_name")).strip()
            if not extracted_area and ai_data.get("hospital_area"):
                extracted_area = str(ai_data.get("hospital_area")).strip()
            if not extracted_dist and ai_data.get("district"):
                extracted_dist = str(ai_data.get("district")).strip()
            if not extracted_phone and ai_data.get("contact_phone"):
                extracted_phone = _extract_phone_number(str(ai_data.get("contact_phone")))
            if ai_data.get("urgency") in ("NORMAL", "URGENT", "EMERGENCY"):
                extracted_urgency = ai_data.get("urgency")

        # Fallback hospital & district defaults if area was mentioned
        if not extracted_dist:
            extracted_dist = "Dhaka" if (extracted_hosp and "dhaka" in extracted_hosp.lower()) else "Dhaka"
        if not extracted_area:
            extracted_area = extracted_dist

        # Identify missing fields
        missing_fields: List[str] = []
        if not extracted_bg:
            missing_fields.append("blood_group")
        if not extracted_hosp or extracted_hosp.lower() in ("a hospital", "the hospital", "হাসপাতাল"):
            missing_fields.append("hospital_name")
        if not extracted_phone:
            missing_fields.append("contact_phone")

        is_ready = (len(missing_fields) == 0)

        # Construct follow-up question
        follow_up_q = None
        if not is_ready:
            questions_bn = []
            questions_en = []
            if "blood_group" in missing_fields:
                questions_bn.append("কোন রক্তের গ্রুপ প্রয়োজন?")
                questions_en.append("What blood group is required?")
            if "hospital_name" in missing_fields:
                questions_bn.append("রোগী কোন নির্দিষ্ট হাসপাতালে ভর্তি আছেন?")
                questions_en.append("Which hospital is the patient admitted to?")
            if "contact_phone" in missing_fields:
                questions_bn.append("ডোনারদের যোগাযোগের জন্য একটি মোবাইল নম্বর প্রদান করবেন কি?")
                questions_en.append("Could you provide a contact phone number for donors to reach you?")

            follow_up_q = " ".join(questions_bn) if is_bn else " ".join(questions_en)

        # Construct reply message
        if is_ready:
            reply_msg = (
                f"আপনার {extracted_bg} রক্তের ({extracted_qty} ব্যাগ) রিকুয়েস্টের খসড়া প্রস্তুত হয়েছে। অনুগ্রহ করে নিচের বিবরণ যাচাই করে কনফার্ম করুন।"
                if is_bn else
                f"I have prepared your emergency blood request for {extracted_qty} bag(s) of {extracted_bg} blood. Please review the details below and confirm."
            )
        else:
            noted_parts = []
            if extracted_bg:
                noted_parts.append(f"গ্রুপ: {extracted_bg}" if is_bn else f"Group: {extracted_bg}")
            if extracted_qty:
                noted_parts.append(f"পরিমাণ: {extracted_qty} ব্যাগ" if is_bn else f"Quantity: {extracted_qty} bag(s)")
            if extracted_hosp:
                noted_parts.append(f"হাসপাতাল: {extracted_hosp}" if is_bn else f"Hospital: {extracted_hosp}")

            noted_str = ", ".join(noted_parts) if noted_parts else ("তথ্য গ্রহণ করা হয়েছে" if is_bn else "Details noted")
            reply_msg = (
                f"আপনার রক্তের প্রয়োজনীয়তার তথ্য ({noted_str}) রেকর্ড করা হয়েছে। রিকুয়েস্টটি সম্পূর্ণ করতে কিছু অতিরিক্ত তথ্য প্রয়োজন।"
                if is_bn else
                f"I have noted your request details ({noted_str}). A few more details are needed to complete the blood request."
            )

        # Construct draft blood request preview
        draft_blood: Optional[DraftBloodRequestPreview] = None
        if extracted_bg:
            draft_blood = DraftBloodRequestPreview(
                blood_group=extracted_bg,
                units_required=extracted_qty,
                hospital_name=extracted_hosp or "Hospital to be specified",
                hospital_area=extracted_area or extracted_dist or "Dhaka",
                district=extracted_dist or "Dhaka",
                required_date="Tonight / Within 24 hours",
                required_time="Immediate",
                urgency=extracted_urgency,
                contact_name=None,
                contact_phone=extracted_phone,
                contact_method="PHONE",
                additional_information=full_conversation_text[:500],
            )

        confirmation_token = str(uuid.uuid4()) if is_ready else None

        emergency_notice = (
            "জরুরি বিজ্ঞপ্তি: জীবনের তাৎক্ষণিক ঝুঁকিতে অথবা জরুরি রক্তের প্রয়োজনে সরাসরি হাসপাতালের ব্লাড ব্যাংকে যোগাযোগ করুন বা ৯৯৯ নম্বরে ডায়াল করুন।"
            if is_bn else
            "Emergency Notice: For immediate life-saving blood needs, contact the hospital blood bank directly or dial National Emergency 999."
        )

        extracted_fields = {
            "blood_group": extracted_bg,
            "units_required": extracted_qty,
            "hospital_name": extracted_hosp,
            "hospital_area": extracted_area,
            "district": extracted_dist,
            "urgency": extracted_urgency,
            "contact_phone": extracted_phone,
        }

        return EmergencyAssistantResponse(
            reply=reply_msg,
            follow_up_question=follow_up_q,
            missing_fields=missing_fields,
            is_ready_for_review=is_ready,
            emergency_type=EmergencyType.BLOOD_REQUEST,
            extracted_fields=extracted_fields,
            draft_report=None,
            draft_blood_request=draft_blood,
            action_plan_summary=[
                "Keep patient details and hospital admission slip ready",
                "Contact registered community donors with matching blood group",
                "Coordinate with the attending doctor and hospital transfusion unit",
            ],
            emergency_notice=emergency_notice,
            conversation_id=conversation_id,
            confirmation_token=confirmation_token,
        )

    # -----------------------------------------------------------------------
    # Branch 2: Citizen Incident Report Workflow
    # -----------------------------------------------------------------------
    cat_options = [f"{c.slug} ({c.name})" for c in all_categories]

    system_prompt = f"""You are Nirapotta's AI Emergency Reporting Assistant for Bangladesh.
Your goal is to extract structured emergency incident report fields from citizen messages in Bangla, English, or Banglish.
Available Database Categories: {', '.join(cat_options)}.

Extract and return strictly valid JSON with these keys:
- "title": A concise, clear headline (max 10 words, e.g. "Motorcycle and Rickshaw Collision at Dhanmondi 27").
- "category_slug": One of [{', '.join(c.slug for c in all_categories)}].
- "location_text": Specific area, street, or landmark (or null if unknown).
- "incident_date_time": Extracted time/date or "Just now".
- "description": Comprehensive, objective description of what happened.
- "injuries_reported": Summary of any injuries/casualties or null.
- "severity": "Low", "Medium", "High", or "Critical".
- "missing_fields": List of missing critical fields needed to submit (e.g. ["location_text"]). Essential fields are: category_slug, location_text, description.
- "follow_up_question": A polite, helpful single follow-up question in the user's language asking for the missing info, or null if all essential info is present.
- "reply_message": A reassuring, helpful message to the user acknowledging what was recorded.
"""

    user_prompt = f"""Citizen's latest input: "{latest_message}"
Full Context:
{full_conversation_text}
User Coordinates: {f'Lat: {request.current_latitude}, Lng: {request.current_longitude}' if request.current_latitude else 'Not provided'}
Location Text hint: {request.current_location_text or 'None'}
"""

    ai_data = await call_ai_json(prompt=user_prompt, system_prompt=system_prompt, timeout_seconds=10.0)

    # Fallback heuristic extraction if AI is unavailable
    if not ai_data or not isinstance(ai_data, dict):
        matched_cat, _ = _match_category_heuristically(full_conversation_text, all_categories)
        matched_loc = request.current_location_text or _extract_location_heuristically(full_conversation_text)
        has_injuries = any(w in full_conversation_text.lower() for w in [
            "injured", "hurt", "bleeding", "wound", "casualty", "dead",
            "আহত", "রক্ত", "ক্ষতিগ্রস্ত", "নিহত", "aahoto", "rokto"
        ])

        missing: List[str] = []
        if not matched_loc:
            missing.append("location_text")

        follow_up = None
        if "location_text" in missing:
            follow_up = (
                "ঘটনাটি কোন এলাকায় বা কোন সড়কের কাছাকাছি ঘটেছে তা অনুগ্রহ করে জানাবেন কি?"
                if is_bn else
                "Could you please specify the exact location, road, or nearby landmark where this occurred?"
            )

        cat_slug = matched_cat.slug if matched_cat else "public-safety"
        cat_name = matched_cat.name if matched_cat else "Public Safety"

        title = (
            f"{cat_name} Report" + (f" near {matched_loc}" if matched_loc else "")
        )
        reply = (
            f"আপনার প্রদত্ত তথ্য গ্রহণ করা হয়েছে। এটি '{cat_name}' বিভাগের অন্তর্ভুক্ত।"
            if is_bn else
            f"I have recorded your report under '{cat_name}'."
        )

        ai_data = {
            "title": title,
            "category_slug": cat_slug,
            "location_text": matched_loc or (request.current_location_text or ""),
            "incident_date_time": "Just now",
            "description": full_conversation_text.strip(),
            "injuries_reported": "Injuries reported by witness" if has_injuries else None,
            "severity": "High" if has_injuries else "Medium",
            "missing_fields": missing,
            "follow_up_question": follow_up,
            "reply_message": reply,
        }

    # Match extracted category_slug to real DB Category object
    target_slug = (ai_data.get("category_slug") or "public-safety").lower().strip()
    selected_cat = next((c for c in all_categories if c.slug.lower() == target_slug), None)
    if not selected_cat and all_categories:
        selected_cat = all_categories[0]

    # Validate essential fields for readiness across all turns
    loc_text = (ai_data.get("location_text") or request.current_location_text or _extract_location_heuristically(full_conversation_text) or "").strip()
    desc_text = (ai_data.get("description") or full_conversation_text).strip()
    title_text = (ai_data.get("title") or f"{selected_cat.name if selected_cat else 'Emergency'} Incident").strip()

    missing_fields: List[str] = []
    if not loc_text:
        missing_fields.append("location_text")
    if len(desc_text) < 10:
        missing_fields.append("description")

    is_ready = (len(missing_fields) == 0)

    draft: Optional[DraftReportPreview] = None
    if is_ready or len(desc_text) >= 10:
        draft = DraftReportPreview(
            title=title_text,
            category_id=str(selected_cat.id) if selected_cat else None,
            category_name=selected_cat.name if selected_cat else "General Emergency",
            category_slug=selected_cat.slug if selected_cat else "public-safety",
            description=desc_text,
            location_text=loc_text or "Location to be confirmed",
            latitude=request.current_latitude,
            longitude=request.current_longitude,
            incident_date=ai_data.get("incident_date_time"),
            injuries_reported=ai_data.get("injuries_reported"),
            severity=ai_data.get("severity") or "Standard",
            is_anonymous=False,
        )

    # Immediate action plan summary
    action_plan_summary = None
    if selected_cat:
        plan_resp = await generate_emergency_action_plan(
            emergency_type=selected_cat.slug,
            details=desc_text,
            lang=request.lang,
        )
        action_plan_summary = plan_resp.immediate_steps[:3]

    reply_msg = ai_data.get("reply_message") or (
        "আপনার দেওয়া তথ্যসমূহ দিয়ে রিপোর্টের খসড়া তৈরি করা হয়েছে। অনুগ্রহ করে যাচাই করুন।"
        if is_bn else
        "I have drafted your incident report based on the details provided. Please review it below."
    )

    follow_up_q = ai_data.get("follow_up_question") if not is_ready else None

    emergency_notice = (
        "জরুরি বিজ্ঞপ্তি: জীবনের তাৎক্ষণিক ঝুঁকিতে চ্যাটবটের অপেক্ষা না করে সরাসরি ৯৯৯ নম্বরে কল করুন।"
        if is_bn else
        "Emergency Notice: In any life-threatening situation, dial National Emergency 999 directly."
    )

    confirmation_token = str(uuid.uuid4()) if is_ready else None

    extracted_fields = {
        "title": title_text,
        "category_slug": selected_cat.slug if selected_cat else "public-safety",
        "location_text": loc_text,
        "injuries_reported": ai_data.get("injuries_reported"),
        "severity": ai_data.get("severity") or "Standard",
    }

    return EmergencyAssistantResponse(
        reply=reply_msg,
        follow_up_question=follow_up_q,
        missing_fields=missing_fields,
        is_ready_for_review=is_ready,
        emergency_type=EmergencyType.INCIDENT,
        extracted_fields=extracted_fields,
        draft_report=draft,
        draft_blood_request=None,
        action_plan_summary=action_plan_summary,
        emergency_notice=emergency_notice,
        conversation_id=conversation_id,
        confirmation_token=confirmation_token,
    )
