# Phase A: AI Emergency Assistant Documentation

**Nirapotta — Bangladesh Citizen Safety & Road Safety Intelligence Platform**  
**Component:** AI Emergency Assistant (Natural Language Emergency Intake & Confirmation)  
**Status:** Completed & Verified  

---

## 1. Executive Summary

Phase A transforms Nirapotta's emergency intake into an intuitive, multi-turn AI-assisted workflow. Citizens can report emergencies or urgent blood requirements in their own natural language—supporting **Bengali (বাংলা)**, **English**, and **Banglish**.

### Core Guarantees
- **Explicit User Confirmation:** Under no circumstances does the AI write directly to the database or create records during conversational chat turns. A database record is only instantiated when an authenticated citizen explicitly reviews the draft preview and submits via the confirmation endpoint.
- **Dual Emergency Intake Support:** Discovers and handles both **Citizen Incident Reports** (accidents, hazards, crimes, fires, etc.) and **Emergency Blood Requests** (blood group, quantity/units, hospital, contact information).
- **Multi-Turn Context Preservation:** Retains previously provided information across multiple turns, preventing repetitive clarification requests.
- **Provider Resilience:** Supports primary model execution, automatic fallback model retry, and seamless fallback to a local deterministic regex/token engine without service interruption or data loss.
- **Zero-Emoji Production UI:** Compliant with civic UI standards using strictly Lucide React vector icons.

---

## 2. System Architecture & Workflow

```
                                +---------------------------+
                                |  Citizen Natural Input    |
                                | (Bangla/English/Banglish) |
                                +-------------+-------------+
                                              |
                                              v
                              +-------------------------------+
                              | POST /reports/ai-assistant/   |
                              |             chat              |
                              +---------------+---------------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
                     v                                                 v
        +-------------------------+                       +-------------------------+
        | OpenRouter AI Client    |                       | Deterministic Engine    |
        | - Primary: Llama 3.3 70B|                       | (Offline / Fallback)    |
        | - Fallback: Gemini 2.0  |                       | - Exact BloodGroup      |
        +------------+------------+                       | - Known BD Hospitals    |
                     |                                    | - Phone / District      |
                     +------------------------+-----------+-------------------------+
                                              |
                                              v
                             +---------------------------------+
                             | Multi-Turn State Consolidation  |
                             | - Merges with History Turns     |
                             | - Validates Required Fields     |
                             +----------------+----------------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
            (Fields Incomplete)                               (Fields Complete)
                     v                                                 v
       +----------------------------+                   +-----------------------------+
       | Status: NEEDS_CLARIFICATION|                   | Status: READY_FOR_PREVIEW   |
       | - Missing fields listed    |                   | - Structured Draft Card     |
       | - Concise follow-up prompt |                   | - Confirmation Token Issued |
       +----------------------------+                   +--------------+--------------+
                                                                       |
                                                                       v
                                                        +-----------------------------+
                                                        | Explicit User Action:       |
                                                        | "Confirm & Submit Request"  |
                                                        +--------------+--------------+
                                                                       |
                                                                       v
                                                        +-----------------------------+
                                                        | POST /reports/ai-assistant/ |
                                                        |           confirm           |
                                                        | - Auth (JWT Bearer)         |
                                                        | - Duplicate Token Check     |
                                                        | - Pydantic Model Validation |
                                                        | - Atomic DB Transaction     |
                                                        +--------------+--------------+
                                                                       |
                                                                       v
                                                        +-----------------------------+
                                                        | Record Created (ID Issued)  |
                                                        | - Status: SUBMITTED / OPEN  |
                                                        | - Direct Link Provided      |
                                                        +-----------------------------+
```

---

## 3. Configuration & Environment Variables

All AI provider settings are isolated to the backend and never exposed to client-side bundles.

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | string (optional) | `None` | OpenRouter API Key. If empty, system runs deterministically. |
| `OPENROUTER_BASE_URL` | string | `https://openrouter.ai/api/v1` | OpenRouter base API URL. |
| `OPENROUTER_MODEL` | string | `meta-llama/llama-3.3-70b-instruct:free` | Primary model for natural language extraction. |
| `OPENROUTER_FALLBACK_MODEL` | string | `google/gemini-2.0-flash-001` | Secondary model invoked if primary times out or returns HTTP error. |
| `AI_REQUEST_TIMEOUT_SECONDS`| float | `12.0` | Timeout threshold per request before attempting fallback. |
| `AI_FALLBACK_DETERMINISTIC` | bool | `True` | Fallback to deterministic regex/token parser when LLMs fail. |

---

## 4. API Specification

### 4.1. Conversational Chat Endpoint
`POST /api/v1/reports/ai-assistant/chat`

**Request Payload:**
```json
{
  "message": "আমার বাবার B+ blood লাগবে। ঢাকা মেডিকেলে ভর্তি। আজ রাতের মধ্যে ২ ব্যাগ লাগবে। ফোন 01712345678",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "conversation_id": "optional-uuid-string",
  "current_latitude": 23.7461,
  "current_longitude": 90.3742,
  "current_location_text": "Dhanmondi, Dhaka",
  "lang": "bn"
}
```

**Response Payload (`EmergencyAssistantResponse`):**
```json
{
  "reply": "আপনার B+ রক্তের (২ ব্যাগ) রিকুয়েস্টের খসড়া প্রস্তুত হয়েছে। অনুগ্রহ করে নিচের বিবরণ যাচাই করে কনফার্ম করুন।",
  "follow_up_question": null,
  "missing_fields": [],
  "is_ready_for_review": true,
  "emergency_type": "BLOOD_REQUEST",
  "extracted_fields": {
    "blood_group": "B+",
    "units_required": 2,
    "hospital_name": "Dhaka Medical College Hospital",
    "hospital_area": "Dhaka",
    "district": "Dhaka",
    "urgency": "URGENT",
    "contact_phone": "01712345678"
  },
  "draft_report": null,
  "draft_blood_request": {
    "blood_group": "B+",
    "units_required": 2,
    "hospital_name": "Dhaka Medical College Hospital",
    "hospital_area": "Dhaka",
    "district": "Dhaka",
    "required_date": "Tonight / Within 24 hours",
    "required_time": "Immediate",
    "urgency": "URGENT",
    "contact_name": null,
    "contact_phone": "01712345678",
    "contact_method": "PHONE",
    "additional_information": "ICU admission slip..."
  },
  "action_plan_summary": [
    "Keep patient details and hospital admission slip ready",
    "Contact registered community donors with matching blood group",
    "Coordinate with the attending doctor and hospital transfusion unit"
  ],
  "emergency_notice": "জরুরি বিজ্ঞপ্তি: জীবনের তাৎক্ষণিক ঝুঁকিতে অথবা জরুরি রক্তের প্রয়োজনে সরাসরি হাসপাতালের ব্লাড ব্যাংকে যোগাযোগ করুন বা ৯৯৯ নম্বরে ডায়াল করুন।",
  "conversation_id": "8deec845-e6b8-452e-af0c-b81287e57ac0",
  "confirmation_token": "a2444391-76c2-475a-a6ea-85d898516d3f"
}
```

---

### 4.2. Explicit Confirmation Endpoint
`POST /api/v1/reports/ai-assistant/confirm`

Requires authenticated citizen JWT token (`Authorization: Bearer <token>`).

**Request Payload (`EmergencyConfirmationRequest`):**
```json
{
  "conversation_id": "8deec845-e6b8-452e-af0c-b81287e57ac0",
  "emergency_type": "BLOOD_REQUEST",
  "confirmation_token": "a2444391-76c2-475a-a6ea-85d898516d3f",
  "draft_blood_request": {
    "blood_group": "B+",
    "units_required": 2,
    "hospital_name": "Dhaka Medical College Hospital",
    "hospital_area": "Bakshibazar",
    "district": "Dhaka",
    "urgency": "URGENT",
    "contact_phone": "01712345678"
  }
}
```

**Response Payload (`EmergencyConfirmationResponse`):**
```json
{
  "status": "CONFIRMED",
  "emergency_type": "BLOOD_REQUEST",
  "record_id": "92f701c4-1be2-4467-bc5b-4890d234ba44",
  "request_status": "OPEN",
  "redirect_url": "/blood-help",
  "message": "Your emergency blood request has been published to registered community donors."
}
```

---

## 5. Safety & Medical Boundaries

1. **Not a Dispatch Service:** The assistant is a civic reporting and community coordination tool, not a certified emergency medical dispatcher.
2. **National Hotline Escalation:** Prominently displays the 999 hotline in banner and headers at all stages.
3. **No Clinical Diagnosis or Guarantees:** The assistant does not guarantee donor matching, immediate response, or hospital acceptance.
4. **Blood Compatibility Verification:** Compatibility is enforced backend-side strictly using certified medical cross-match mappings; AI does not speculate on clinical eligibility.

---

## 6. Test Verification & Results

### Backend Automated Test Suite
- **Command:** `cd backend && .venv/bin/pytest`
- **Result:** **156 passed in 53.93s** (100% pass rate)
- **New Tests Added (Phase A):**
  - `test_emergency_assistant_bengali_blood_request` (Benchmark Bengali test from prompt)
  - `test_emergency_assistant_english_blood_request_complete` (Benchmark English test from prompt)
  - `test_emergency_assistant_banglish_blood_request` (Benchmark Banglish test from prompt)
  - `test_emergency_assistant_multiturn_clarification` (Multi-turn state consolidation across turns)
  - `test_emergency_confirmation_unauthorized` (Enforces 401 Unauthorized check)
  - `test_emergency_confirmation_incident_success` (Verified DB creation of Report record)
  - `test_emergency_confirmation_blood_success` (Verified DB creation of BloodRequest record)
  - `test_emergency_confirmation_duplicate_protection` (Prevents duplicate submissions using idempotency token)
  - `test_emergency_confirmation_validation_failure` (Strict Pydantic 422 rejection on invalid blood group)
  - `test_ai_client_json_extraction_variations` (Markdown fence stripping, embedded JSON blocks)
  - `test_emergency_assistant_provider_failure_graceful_degradation` (Graceful fallback when OpenRouter is unreachable)

### Frontend Verification
- **Type Check:** `npm run type-check` (0 errors)
- **Production Webpack Build:** `npm run build` (All 45 pages compiled successfully)
