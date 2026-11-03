import re
import uuid
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.category import Category
from app.schemas.ai_features import (
    ChatMessage,
    EmergencyAssistantRequest,
    EmergencyAssistantResponse,
    DraftReportPreview,
)
from app.services.ai_client import call_ai_json
from app.services.action_planner import generate_emergency_action_plan

# Comprehensive keyword-to-category mapping for Bangladesh context
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "public-safety": [
        "accident", "crash", "collision", "overturn", "hit and run", "fire",
        "explosion", "hazard", "pothole", "wire", "gas leak", "collapse",
        "সড়ক", "দুর্ঘটনা", "আগুন", "বিস্ফোরণ", "ধ্বস", "বিপদ", "গাড়ি দুর্ঘটনা",
    ],
    "violence": [
        "fight", "clash", "assault", "attack", "beaten", "mob", "stab", "shooting",
        "মারামারি", "হামলা", "সংঘর্ষ", "মারধর", "মারপিট", "গুলি",
    ],
    "murder": [
        "murder", "killing", "dead body", "homicide", "slain",
        "খুন", "হত্যা", "লাশ", "মৃতদেহ",
    ],
    "abuse": [
        "harassment", "eve-teasing", "stalking", "domestic abuse", "child abuse",
        "উত্ত্যক্ত", "হয়রানি", "ইভটিজিং", "নির্যাতন",
    ],
    "crime": [
        "theft", "robbery", "mugging", "pickpocket", "snatching", "burglary",
        "চুরি", "ডাকাতি", "ছিনতাই", "পকেটমার",
    ],
    "missing-person": [
        "missing", "lost person", "kidnap", "abducted", "runaway", "child lost",
        "নিখোঁজ", "হারিয়ে গেছে", "অপহরণ",
    ],
    "corruption": [
        "bribe", "graft", "extortion", "misconduct", "kickback",
        "ঘুষ", "দুর্নীতি", "চাঁদাবাজি",
    ],
    "fraud": [
        "fraud", "scam", "forgery", "fake", "cheated",
        "প্রতারণা", "প্রতারক", "জালিয়াতি",
    ],
    "public-service-issue": [
        "water supply", "electricity cut", "sewerage", "broken pipe", "garbage",
        "বিদ্যুৎ", "পানি নেই", "ড্রেন", "ময়লা",
    ],
    "environmental-issue": [
        "river pollution", "tree cutting", "waste dumping", "smoke",
        "নদী দূষণ", "গাছ কাটা", "বর্জ্য",
    ],
}


def _match_category_heuristically(text: str, categories: List[Category]) -> Tuple[Optional[Category], float]:
    """Matches text against existing active database categories."""
    text_lower = text.lower()
    for cat in categories:
        slug = cat.slug.lower()
        keywords = CATEGORY_KEYWORDS.get(slug, [cat.name.lower()])
        for kw in keywords:
            if kw in text_lower:
                return cat, 1.0

    # Default to public-safety if any general emergency word matches
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
        # filter out common stopwords
        if loc.lower() not in ("the hospital", "the scene", "danger", "now", "today", "yesterday"):
            return loc

    # Pattern for Bangla: "... এর কাছে", "... এ", "... রোডে", "... মোড়ে"
    m_bn = re.search(r"([\u0980-\u09FF\w\s\-]{2,30})\s*(?:এর কাছে|এ|তে|রোডে|মোড়ে|বাজারে|সামনে)", text)
    if m_bn:
        return m_bn.group(1).strip()

    return None


async def process_emergency_assistant_chat(
    db: AsyncSession,
    request: EmergencyAssistantRequest,
) -> EmergencyAssistantResponse:
    """
    Orchestrates the conversational AI Emergency Assistant.
    Extracts structured fields, requests missing details, provides action plans,
    and constructs a draft report for user review.
    """
    conversation_id = request.conversation_id or str(uuid.uuid4())
    is_bn = (request.lang == "bn")

    # Fetch active categories from DB
    cat_stmt = select(Category).where(Category.is_active == True)
    cat_res = await db.execute(cat_stmt)
    all_categories = list(cat_res.scalars().all())

    # Compile entire conversation history into text
    full_text = request.message
    if request.history:
        for msg in request.history:
            if msg.role == "user":
                full_text += f"\n{msg.content}"

    # Prepare category choices for AI
    cat_options = [f"{c.slug} ({c.name})" for c in all_categories]

    system_prompt = f"""You are Nirapotta's AI Emergency Reporting Assistant for Bangladesh.
Your goal is to extract structured emergency incident report fields from citizen messages in Bangla or English.
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
- "follow_up_question": A polite, helpful single follow-up question in the user's language ({'Bangla' if is_bn else 'English'}) asking for the missing info, or null if all essential info is present.
- "reply_message": A reassuring, helpful message to the user acknowledging what was recorded.
"""

    user_prompt = f"""Citizen's latest input: "{request.message}"
Full Context:
{full_text}
User Coordinates: {f'Lat: {request.current_latitude}, Lng: {request.current_longitude}' if request.current_latitude else 'Not provided'}
Location Text hint: {request.current_location_text or 'None'}
"""

    ai_data = await call_ai_json(prompt=user_prompt, system_prompt=system_prompt, timeout_seconds=10.0)

    # Heuristic fallback if AI is unavailable or fails to return structured JSON
    if not ai_data or not isinstance(ai_data, dict):
        matched_cat, _ = _match_category_heuristically(full_text, all_categories)
        matched_loc = request.current_location_text or _extract_location_heuristically(full_text)
        has_injuries = any(w in full_text.lower() for w in ["injured", "hurt", "bleeding", "wound", "আহত", "রক্ত"])

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
        cat_id = str(matched_cat.id) if matched_cat else None

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
            "description": full_text.strip(),
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

    # Validate essential fields for readiness
    loc_text = (ai_data.get("location_text") or request.current_location_text or "").strip()
    desc_text = (ai_data.get("description") or full_text).strip()
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

    # Generate immediate action plan summary
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

    return EmergencyAssistantResponse(
        reply=reply_msg,
        follow_up_question=follow_up_q,
        missing_fields=missing_fields,
        is_ready_for_review=is_ready,
        draft_report=draft,
        action_plan_summary=action_plan_summary,
        emergency_notice=emergency_notice,
        conversation_id=conversation_id,
    )
