from typing import List, Optional, Dict, Any
from app.schemas.ai_features import EmergencyActionPlanResponse
from app.services.ai_client import call_ai_json


# Predefined, safety-reviewed standard emergency action protocols for Bangladesh
STANDARD_ACTION_PLANS: Dict[str, Dict[str, Any]] = {
    "road_accident": {
        "title_en": "Road Traffic Accident Action Plan",
        "title_bn": "সড়ক দুর্ঘটনা সংক্রান্ত তাৎক্ষণিক করণীয়",
        "immediate_en": [
            "Ensure your own safety first — pull over or move off active traffic lanes.",
            "Call 999 immediately for Police and Emergency Ambulance dispatch.",
            "Do NOT move heavily injured individuals unless there is imminent danger of vehicle fire or explosion.",
            "Turn on hazard warning lights to alert oncoming vehicles and prevent multi-vehicle collisions.",
        ],
        "immediate_bn": [
            "প্রথমে নিজের নিরাপত্তা নিশ্চিত করুন — চলন্ত ট্রাফিক লেন থেকে নিরাপদে পাশে সরে দাঁড়ান।",
            "পুলিশ ও অ্যাম্বুলেন্স সহায়তার জন্য অবিলম্বে ৯৯৯ নম্বরে কল করুন।",
            "যানবাহনে আগুন বা বিস্ফোরণের তাৎক্ষণিক ঝুঁকি না থাকলে গুরুতর আহত ব্যক্তিকে নড়াচড়া করবেন না।",
            "পেছনের গাড়িকে সতর্ক করতে হ্যাজার্ড লাইট অন করুন বা সতর্ক সংকেত দিন।",
        ],
        "precautions_en": [
            "Do not crowd closely around unconscious victims; ensure fresh airflow.",
            "Do not administer liquids or food to an unconscious or bleeding person.",
            "Avoid physical altercations or aggressive confrontations at the crash site.",
        ],
        "precautions_bn": [
            "অচেতন ব্যক্তির চারপাশে ভিড় জমাবেন না; পর্যাপ্ত আলো-বাতাসের সুযোগ দিন।",
            "অচেতন বা রক্তক্ষরণ হওয়া ব্যক্তিকে কোনো তরল বা খাবার খাওয়াবেন না।",
            "ঘটনাস্থলে কোনো ধরনের বাকবিতণ্ডা বা বিশৃঙ্খলায় জড়াবেন না।",
        ],
        "follow_up_en": [
            "Note the registration number, vehicle type, and exact landmark/intersection.",
            "Submit a verified incident report on Nirapotta with location coordinates.",
            "If blood is urgently needed at the hospital, launch an urgent Nirapotta Blood Request.",
        ],
        "follow_up_bn": [
            "গাড়ির রেজিস্ট্রেশন নম্বর, ধরন এবং সুনির্দিষ্ট ল্যান্ডমার্ক/মোড় লিখে রাখুন।",
            "লোকেশন কোঅর্ডিনেট সহ নিরাপত্তা অ্যাপে একটি সত্যায়িত রিপোর্ট জমা দিন।",
            "হাসপাতালে রক্তের জরুরি প্রয়োজন হলে নিরাপত্তা ব্লাড হেল্পে দ্রুত রিকোয়েস্ট পোস্ট করুন।",
        ],
        "relevant_features": ["999 Direct Call", "Nirapotta Incident Report", "Emergency Blood Help"],
    },
    "fire": {
        "title_en": "Fire & Electrical Hazard Action Plan",
        "title_bn": "অগ্নিদুর্ঘটনা ও বৈদ্যুতিক বিপদ সংক্রান্ত করণীয়",
        "immediate_en": [
            "Evacuate immediately — do NOT use elevators under any circumstances.",
            "Call 999 Fire Service hotline and state the building address, floor, and nearest landmark.",
            "Shout 'Fire! Fire!' ('আগুন! আগুন!') to alert all building occupants and neighbors.",
            "If safe to do so, switch off the main electrical circuit breaker and gas line.",
        ],
        "immediate_bn": [
            "অবিলম্বে নিরাপদ স্থানে নেমে আসুন — কোনো অবস্থাতেই লিফট ব্যবহার করবেন না।",
            "৯৯৯ ফায়ার সার্ভিস হটলাইনে কল করে ভবনের ঠিকানা, তলা এবং নিকটস্থ ল্যান্ডমার্ক জানান।",
            "'আগুন! আগুন!' বলে চিৎকার করে আশেপাশের সবাইকে সতর্ক করুন।",
            "নিরাপদ হলে ভবনের মেইন বৈদ্যুতিক সুইচ ও গ্যাস লাইন বন্ধ করে দিন।",
        ],
        "precautions_en": [
            "Never use water on electrical or grease/oil fires (use dry chemical extinguisher or sand).",
            "Do not re-enter a burning building to retrieve personal belongings.",
            "If trapped by smoke, stay low to the floor where air is cleaner.",
        ],
        "precautions_bn": [
            "বৈদ্যুতিক বা তেলজনিত আগুনে কখনো পানি ব্যবহার করবেন না (বালি বা ড্রাই কেমিক্যাল ব্যবহার করুন)।",
            "মালামাল উদ্ধারের জন্য জ্বলন্ত ভবনে পুনরায় প্রবেশ করবেন না।",
            "ধোঁয়া থাকলে মেঝে ঘেঁষে নিচু হয়ে শ্বাস নিন ও বের হওয়ার চেষ্টা করুন।",
        ],
        "follow_up_en": [
            "Assist elderly citizens, children, and persons with disabilities to safety.",
            "Keep the approach road clear for Fire Service water tenders and rescue trucks.",
        ],
        "follow_up_bn": [
            "বৃদ্ধ, শিশু এবং বিশেষ চাহিদাসম্পন্ন ব্যক্তিদের নিরাপদে সরিয়ে নিতে সহায়তা করুন।",
            "ফায়ার সার্ভিসের গাড়ি প্রবেশের জন্য রাস্তা উন্মুক্ত রাখুন।",
        ],
        "relevant_features": ["999 Fire Service", "Nirapotta Incident Report", "Safety Map Alert"],
    },
    "medical_emergency": {
        "title_en": "Medical Emergency & Trauma Action Plan",
        "title_bn": "চিকিৎসা সংক্রান্ত জরুরি অবস্থা ও ট্রমা করণীয়",
        "immediate_en": [
            "Call 999 immediately to request an emergency ambulance.",
            "Check responsiveness and normal breathing. Keep the patient's airway clear.",
            "If severe bleeding is present, apply firm, direct pressure with a clean cloth.",
            "Keep the patient lying down, warm, and comfortable.",
        ],
        "immediate_bn": [
            "জরুরি অ্যাম্বুলেন্স সার্ভিসের জন্য অবিলম্বে ৯৯৯ নম্বরে কল করুন।",
            "রোগীর জ্ঞান ও স্বাভাবিক শ্বাস-প্রশ্বাস পরীক্ষা করুন। শ্বাসপথ উন্মুক্ত রাখুন।",
            "গুরুতর রক্তক্ষরণ হলে পরিষ্কার কাপড় দিয়ে ক্ষতস্থানে দৃঢ়ভাবে চেপে ধরুন।",
            "রোগীকে সমতল স্থানে শুইয়ে রাখুন এবং শান্ত রাখুন।",
        ],
        "precautions_en": [
            "Do not provide unauthorized medications or oral fluids to an unresponsive patient.",
            "Do not attempt dangerous medical procedures without professional training.",
        ],
        "precautions_bn": [
            "চিকিৎসকের পরামর্শ ছাড়া কোনো ওষুধ বা তরল খাওয়াবেন না।",
            "প্রশিক্ষণ ছাড়া কোনো ঝুঁকিপূর্ণ চিকিৎসা পদ্ধতি প্রয়োগ করবেন না।",
        ],
        "follow_up_en": [
            "Gather patient's medical history, current prescriptions, and National ID if available.",
            "If blood is needed, use Nirapotta AI Blood Assistant to find verified donors.",
        ],
        "follow_up_bn": [
            "রোগীর পূর্বের প্রেসক্রিপশন ও পরিচয়পত্র সঙ্গে রাখুন।",
            "রক্তের প্রয়োজন হলে নিরাপত্তা এআই ব্লাড অ্যাসিস্ট্যান্ট ব্যবহার করে রক্তদাতা খুঁজুন।",
        ],
        "relevant_features": ["999 Ambulance", "Blood Help Network", "Emergency Guard"],
    },
    "missing_person": {
        "title_en": "Missing Person Emergency Search Protocol",
        "title_bn": "নিখোঁজ ব্যক্তি সংক্রান্ত জরুরি অনুসন্ধান প্রটোকল",
        "immediate_en": [
            "Search immediate vicinity, neighborhood CCTV cameras, and recent travel paths.",
            "Contact your local Thana (Police Station) to lodge an official General Diary (GD).",
            "Publish a verified Missing Person Alert on Nirapotta with recent photos.",
        ],
        "immediate_bn": [
            "অবিলম্বে আশেপাশের এলাকা, সিসিটিভি ক্যামেরা ও সর্বশেষ গমনপথ পরীক্ষা করুন।",
            "নিকটস্থ থানায় যোগাযোগ করে দ্রুত সাধারণ ডায়েরি (জিডি) দায়ের করুন।",
            "সাম্প্রতিক ছবি সহ নিরাপত্তা প্ল্যাটফর্মে একটি নিখোঁজ অ্যালার্ট পোস্ট করুন।",
        ],
        "precautions_en": [
            "Do not publish sensitive home addresses or bank details in public social posts.",
            "Beware of ransom extortion calls; verify all sightings through official authorities.",
        ],
        "precautions_bn": [
            "জনসাধারণের পোস্টে ব্যক্তিগত ব্যাংক বা স্পর্শকাতর তথ্য শেয়ার করবেন না।",
            "প্রতারণামূলক মুক্তিপণ কল থেকে সতর্ক থাকুন এবং পুলিশের সহায়তায় যাচাই করুন।",
        ],
        "follow_up_en": [
            "Notify local community coordinators and volunteers through Nirapotta.",
            "Check nearest hospitals, shelters, and government rescue centers.",
        ],
        "follow_up_bn": [
            "নিরাপত্তা প্ল্যাটফর্মের মাধ্যমে স্থানীয় কমিউনিটি ও স্বেচ্ছাসেবকদের অবগত করুন।",
            "নিকটস্থ হাসপাতাল ও আশ্রয়কেন্দ্রসমূহে খোঁজ নিন।",
        ],
        "relevant_features": ["Nirapotta Missing Person Network", "Nearest Police Directory", "Community Sightings"],
    },
    "blood_requirement": {
        "title_en": "Urgent Blood Requirement Protocol",
        "title_bn": "জরুরি রক্ত সংগ্রহ সংক্রান্ত প্রটোকল",
        "immediate_en": [
            "Confirm the exact required blood group and number of bags with the attending doctor.",
            "Search registered, available donors using Nirapotta AI Blood Assistant.",
            "Post an urgent Blood Request on Nirapotta to alert local volunteer donors.",
        ],
        "immediate_bn": [
            "কর্তব্যরত চিকিৎসকের সাথে রোগীর সুনির্দিষ্ট রক্তের গ্রুপ ও প্রয়োজনীয় ব্যাগের সংখ্যা নিশ্চিত করুন।",
            "নিরাপত্তা এআই ব্লাড অ্যাসিস্ট্যান্ট ব্যবহার করে প্রস্তুত রক্তদাতা খুঁজুন।",
            "স্বেচ্ছাসেবী রক্তদাতাদের অ্যালার্ট পাঠাতে নিরাপত্তা প্ল্যাটফর্মে রিকোয়েস্ট তৈরি করুন।",
        ],
        "precautions_en": [
            "Do not pay commercial blood brokers; voluntary donation is safe and lawful.",
            "Ensure cross-matching and mandatory screening tests (HIV, Hep B/C, Malaria, Syphilis) are completed.",
        ],
        "precautions_bn": [
            "কোনো রক্ত দালালের সাথে লেনদেন করবেন না; নিরাপদ রক্ত পরিসঞ্চালনের নিয়ম মেনে চলুন।",
            "হাসপাতালে বাধ্যতামূলক ক্রস-ম্যাচিং ও স্ক্রিনিং টেস্ট নিশ্চিত করুন।",
        ],
        "follow_up_en": [
            "Keep in touch with confirmed volunteer donors regarding donation schedule and hospital location.",
            "Mark the request as FULFILLED once blood is successfully received to avoid donor fatigue.",
        ],
        "follow_up_bn": [
            "নিশ্চিত রক্তদাতার সাথে সময় ও হাসপাতালের সঠিক অবস্থান জানিয়ে যোগাযোগ রাখুন।",
            "রক্ত পাওয়ার পর রিকোয়েস্টটি সম্পন্ন (FULFILLED) হিসেবে চিহ্নিত করুন।",
        ],
        "relevant_features": ["AI Blood Assistant", "Blood Map", "Donor Verification"],
    },
}


def _normalize_category_key(category_name_or_slug: str) -> str:
    """Maps arbitrary input terms to standard action plan keys."""
    term = (category_name_or_slug or "").lower()
    if any(k in term for k in ["accident", "road", "crash", "collision", "vehicle", "traffic", "সড়ক", "দুর্ঘটনা"]):
        return "road_accident"
    if any(k in term for k in ["fire", "electrical", "burn", "explosion", "আগুন", "অগ্নি", "বিস্ফোরণ"]):
        return "fire"
    if any(k in term for k in ["medical", "health", "injured", "heart", "stroke", "trauma", "অসুস্থ", "চিকিৎসা", "আহত"]):
        return "medical_emergency"
    if any(k in term for k in ["missing", "lost", "kidnap", "abduct", "নিখোঁজ", "হারিয়ে"]):
        return "missing_person"
    if any(k in term for k in ["blood", "donor", "plasma", "রক্ত", "ডোনার"]):
        return "blood_requirement"
    return "road_accident"


async def generate_emergency_action_plan(
    emergency_type: str,
    details: Optional[str] = None,
    lang: str = "en",
) -> EmergencyActionPlanResponse:
    """
    Produces a safe, authoritative emergency action plan.
    Uses verified Bangladesh emergency SOPs with contextual AI enhancement if available.
    """
    key = _normalize_category_key(emergency_type)
    plan_data = STANDARD_ACTION_PLANS.get(key, STANDARD_ACTION_PLANS["road_accident"])
    is_bn = (lang == "bn")

    title = plan_data["title_bn"] if is_bn else plan_data["title_en"]
    immediate_steps = plan_data["immediate_bn"] if is_bn else plan_data["immediate_en"]
    precautions = plan_data["precautions_bn"] if is_bn else plan_data["precautions_en"]
    follow_up = plan_data["follow_up_bn"] if is_bn else plan_data["follow_up_en"]
    relevant = plan_data["relevant_features"]

    # If contextual incident details were provided and AI is available, attempt tailored enrichment
    if details and len(details.strip()) > 10:
        system_prompt = (
            "You are Nirapotta's Emergency Action Planner. Provide 1 to 2 tailored, strictly non-medical "
            "practical safety precautions based on the user's specific emergency context. Do NOT give medical "
            "prescriptions or diagnose conditions. Return JSON: {'tailored_precautions': ['...']}"
        )
        ai_resp = await call_ai_json(
            prompt=f"Emergency Type: {key}\nDetails: {details}\nLanguage: {'Bangla' if is_bn else 'English'}",
            system_prompt=system_prompt,
            timeout_seconds=6.0,
        )
        if ai_resp and isinstance(ai_resp.get("tailored_precautions"), list):
            for extra in ai_resp["tailored_precautions"]:
                if isinstance(extra, str) and len(extra.strip()) > 5:
                    precautions.append(extra.strip())

    disclaimer = (
        "জরুরি নির্দেশিকা: এআই নির্দেশনাবলী কেবল তাৎক্ষণিক প্রাথমিক তথ্য সহায়তার জন্য। জীবনের ঝুঁকিপূর্ণ জরুরি অবস্থায় সর্বদা জাতীয় জরুরি সেবা ৯৯৯ নম্বরে কল করুন।"
        if is_bn else
        "Disclaimer: Action plans are advisory safety instructions. In any life-threatening situation, immediately contact National Emergency Service 999."
    )

    return EmergencyActionPlanResponse(
        emergency_type=key,
        title=title,
        emergency_hotline="999",
        immediate_steps=immediate_steps,
        precautions_to_avoid=precautions,
        follow_up_steps=follow_up,
        relevant_features=relevant,
        disclaimer=disclaimer,
    )
