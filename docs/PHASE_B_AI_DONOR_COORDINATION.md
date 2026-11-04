# Phase B: AI Donor Coordination Assistant Documentation
## Database-Connected Agentic Donor Coordination (Addendum Included)

**Project:** Nirapotta — Bangladesh Citizen Safety & Road Safety Intelligence Platform  
**Component:** Phase B — AI Donor Coordination Assistant & Database-Connected Agent  
**Status:** Completed & Fully Verified (175 Backend Tests Passing, Frontend Type-Check Clean, Production Build Succeeded)  

---

## 1. Repository Audit Summary

### 1.1. Existing Blood Models & Services (`backend/app/models/blood.py`, `backend/app/services/blood.py`)
- **`BloodRequest` Model:**
  - Fields: `id`, `user_id`, `blood_group`, `units_required`, `hospital_name`, `hospital_area`, `district`, `required_date`, `required_time`, `urgency`, `contact_name`, `contact_phone`, `contact_method`, `additional_information`, `status` (`OPEN`, `RESPONDED`, `FULFILLED`, `CANCELLED`, `EXPIRED`), `is_active`.
  - Relationships: `user`, `responses` (`BloodRequestResponse`), `donations` (`BloodDonationRecord`), `flags` (`BloodRequestFlag`).
- **`BloodDonorProfile` Model:**
  - Fields: `id`, `user_id`, `blood_group`, `district`, `area`, `availability_status` (`AVAILABLE`, `NOT_AVAILABLE`), `last_donation_date`, `preferred_contact_method`, `contact_phone`, `additional_notes`.
- **`BloodRequestResponse` Model:**
  - Tracks volunteer donor expressions of interest ("I Can Help").
  - Statuses: `PENDING`, `ACCEPTED`, `DECLINED`, `COMPLETED`.
- **Compatibility Matrix (`BLOOD_COMPATIBILITY` & `DONOR_CAN_GIVE_TO`):**
  - Authoritative medical cross-compatibility strictly defined in `backend/app/services/blood.py`.
  - Under no circumstances will AI re-calculate or override these rules.

### 1.2. Matching & Donor Discovery
- Deterministic query filters query active donors (`availability_status == AVAILABLE`) matching `blood_group` and `district`.
- Clinical Freshness Policy: $\ge 90$ days since `last_donation_date` enforced for whole blood eligibility.
- Privacy filtering: Contact phone numbers of donors are strictly shielded and never exposed in AI generated conversational text or search cards.

### 1.3. Outreach & Notification Infrastructure (`backend/app/services/notification.py`)
- Notifications are created transactionally via `create_notification` with `NotificationType.BLOOD_REQUEST_MATCH`, `BLOOD_REQUEST_RESPONSE`, etc.
- Push notifications are delivered asynchronously via Firebase Cloud Messaging (`push_notification.py`).
- Outreach rate limits & deduplication:
  - Outreach is limited to verified compatible active donors in the request's district.
  - Donors who have already responded or received an outreach notification are deduplicated.
  - Outreach requires explicit user confirmation by the request owner or administrator.

---

## 2. Dedicated Test/Demo Database & Repeatable Seeding

- **Safety Guarantee:** Seeding refuses execution if `settings.ENVIRONMENT == "production"`.
- **Repeatable Seed Module:** [`backend/app/db/seed_demo_blood.py`](file:///Users/alfi/report%20box/citizen-report-platform/backend/app/db/seed_demo_blood.py)
- **CLI Utility:** [`backend/scripts/seed_demo_blood.py`](file:///Users/alfi/report%20box/citizen-report-platform/backend/scripts/seed_demo_blood.py)
  - Allows targeting custom SQLite or Postgres databases: `python scripts/seed_demo_blood.py --db-url "sqlite+aiosqlite:///demo.db" --init-tables`
- **Seeded Synthetic Records:**
  - Clearly identifiable synthetic domain: `@nirapotta.local`.
  - 12 Blood Donor Profiles covering all 8 blood groups (`O+`, `A+`, `B+`, `AB+`, `O-`, `A-`, `B-`, `AB-`).
  - Varying availability: `AVAILABLE` vs `NOT_AVAILABLE`.
  - Clinical freshness: Donors with $>90$ days cooldown vs $<90$ days cooldown (e.g., 25 days ago).
  - Geographical distribution: Savar, Mirpur, Dhanmondi, Uttara, Mohakhali, Panthapath (Dhaka); Agrabad, GEC (Chattogram); Zindabazar (Sylhet); Shaheb Bazar (Rajshahi).
  - 5 Blood Requests covering `OPEN`, `RESPONDED`, `FULFILLED` across `EMERGENCY`, `URGENT`, and `NORMAL` urgencies.
  - Existing volunteer donor responses (`ACCEPTED` and `PENDING`).

---

## 3. Agent Tool System (Controlled Backend Tools)

The agent interacts with the database exclusively through 6 typed, controlled backend tools:

1. **`search_blood_donors`**:
   - Schema: `SearchBloodDonorsInput` -> `SearchBloodDonorsOutput`
   - Bounded SQLAlchemy query on `BloodDonorProfile` joined with `User`.
   - Filters: blood group, district, area, availability, eligibility cooldown.
   - Computes approximate distance and location with privacy micro-jitter.
2. **`get_blood_request`**:
   - Schema: `GetBloodRequestInput` -> `GetBloodRequestOutput`
   - Retrieves blood request by UUID with permission-aware field filtering.
3. **`get_donor_matches`**:
   - Schema: `GetDonorMatchesInput` -> `GetDonorMatchesOutput`
   - Queries medically compatible active donors using `BLOOD_COMPATIBILITY`.
4. **`get_donor_response_summary`**:
   - Schema: `GetDonorResponseSummaryInput` -> `GetDonorResponseSummaryOutput`
   - Strictly enforces request owner or admin authorization. Returns response counts and masked volunteer info.
5. **`explain_matching_results`**:
   - Schema: `ExplainMatchingResultsInput` -> `ExplainMatchingResultsOutput`
   - Returns grounded medical explanation of ABO/Rh compatibility and clinical intervals.
6. **`prepare_outreach_preview`**:
   - Schema: `PrepareOutreachPreviewInput` -> `PrepareOutreachPreviewOutput`
   - Enforces owner authorization, queries eligible count, and issues an ephemeral confirmation token. Never mutates database during tool call.

---

## 4. Natural Language Donor Search

Supported intents:
- `SEARCH_BLOOD_DONORS`: Natural language queries such as:
  - `"Find O+ donors."`
  - `"Amar O+ blood lagbe, available donor dekhao."`
  - `"Show available O positive donors near Savar."`
  - `"Find B- donors in Chattogram"`
- `CLARIFY_REQUEST`: When blood group or request ID is missing, asks:
  - *"Which blood group do you need? (e.g., O+, A+, B+, AB+)"* / *"রক্তদাতা খুঁজতে রক্তের গ্রুপ উল্লেখ করুন (যেমন: O+, A+, B+, AB+)।"*
- `FIND_MATCHING_DONORS`: Queries matching donors for an active blood request.
- `VIEW_DONOR_RESPONSES`: Details volunteer responses for request owner.
- `REQUEST_OUTREACH`: Proposes community notification broadcast.
- `EXPRESS_DONOR_INTEREST`: Proposes volunteer donor response.

---

## 5. UI/UX Search Results Experience

- Component: [`frontend/src/components/AIDonorCoordinationModal.tsx`](file:///Users/alfi/report%20box/citizen-report-platform/frontend/src/components/AIDonorCoordinationModal.tsx)
- Features:
  - Verified Database Donors list cards displaying donor display name, blood group badge, availability pill, approximate location, distance in km, clinical freshness eligibility, and match explanation.
  - Zero-emoji rule enforced: 100% Lucide React icons (`Users`, `Droplets`, `MapPin`, `Clock`, `ShieldCheck`, `CheckCircle2`, `Heart`, `Bell`, `Search`).
  - Action preview card with single-use confirmation token.
  - Dual support: Contextual blood request coordination + General natural language donor search.

---

## 6. Verification & Test Suite

- **Total Backend Tests:** **175 passed** (0 failed, 1 warning) in 61.90s.
- **Dedicated Phase B Addendum Suite:** 11 tests in [`backend/tests/test_donor_coordination_agent.py`](file:///Users/alfi/report%20box/citizen-report-platform/backend/tests/test_donor_coordination_agent.py) covering:
  - O+ donor search (English & Bengali)
  - Other blood groups (`A+`, `B+`, `AB+`, `O-`, `A-`, `B-`, `AB-`)
  - Area-based filtering (Savar)
  - No matching records (zero hallucination verification)
  - Unavailable donor filtering (`NOT_AVAILABLE`)
  - Consent and freshness filtering (90-day cooldown)
  - Unauthorized request access (owner isolation)
  - Invalid tool argument validation
  - AI hallucination prevention (verifies DB identity)
  - Clarification on missing blood group
  - Action confirmation workflow (token consumption and duplicate prevention)
- **Frontend Quality:**
  - `npm run type-check`: 0 errors.
  - `npm run build`: Production build succeeded across all 45 routes.
