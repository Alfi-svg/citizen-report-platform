# Phase C: Agentic Incident Intelligence & Report Analysis

**Project:** Nirapotta — Bangladesh Citizen Safety & Road Safety Intelligence Platform  
**Component:** Phase C — Incident Intelligence Agent & Database-Grounded Report Analysis  
**Status:** Completed & Fully Verified (185 Backend Tests Passing, Frontend Type-Check Clean, Production Build Succeeded)  

---

## 1. System Overview

Phase C introduces an agentic **Incident Intelligence & Report Analysis** system to the Nirapotta platform. The assistant enables citizens and safety moderators to query, analyze, and understand real incident reports through natural language in Bangla, English, or Banglish.

The AI operates strictly as an orchestrator and analyzer over verified database facts:
- **Zero Hallucination:** All searches, counts, and facts are queried directly from authenticated database tables. If the database has 0 matching reports, it reports 0 records and never invents incidents.
- **Strict Role-Based Access Control:**
  - **Citizens & Public:** Access is restricted to `APPROVED` reports or reports authored by the requesting user.
  - **Moderators & Administrators:** Full access to `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `REJECTED`, and internal moderation notes.
- **Field-Level Privacy:** Anonymous reports automatically shield the reporter's identity (`"Anonymous Citizen"`).
- **Separation of Facts from Interpretation:** Verified database facts (locations, timestamps, categories, media) are strictly delineated from AI interpretations, safety risk ratings, and suggested follow-ups.
- **Advisory & Read-Only:** Duplicate candidate detection and moderation review previews are purely advisory and never mutate, merge, or delete records.

---

## 2. Dedicated Test/Demo Database & Repeatable Seeding

- **Seed Module:** [`backend/app/db/seed_demo_incidents.py`](file:///Users/alfi/report%20box/citizen-report-platform/backend/app/db/seed_demo_incidents.py)
- **CLI Utility:** [`backend/scripts/seed_demo_incidents.py`](file:///Users/alfi/report%20box/citizen-report-platform/backend/scripts/seed_demo_incidents.py)
  - Usage: `python scripts/seed_demo_incidents.py [--db-url SQLALCHEMY_URL] [--reset] [--init-tables]`
- **Seeded Synthetic Records:**
  - Clearly marked synthetic domain: `@nirapotta.local` and title tag `[DEMO]`.
  - Realistic multi-district distribution: Savar, Mirpur, Dhanmondi (Dhaka); Agrabad (Chattogram); Zindabazar (Sylhet).
  - Multi-status coverage: `APPROVED`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`.
  - Intentional duplicate pair:
    - `[DEMO] Armed Robbery and Harassment near Savar Bus Stand` (`APPROVED`, Crime, Savar)
    - `[DEMO] Mugging with sharp knife near Savar Bus Stand` (`SUBMITTED`, Crime, Savar)
  - Synthetic Moderation records with confidential internal notes to verify privacy safeguards.

---

## 3. The 6 Controlled Backend Tools

The agent interacts with the PostgreSQL/SQLite database exclusively through 6 typed tools implemented in [`backend/app/services/incident_intelligence.py`](file:///Users/alfi/report%20box/citizen-report-platform/backend/app/services/incident_intelligence.py):

| Tool Name | Purpose | Access Control & Privacy | Output Characteristics |
|---|---|---|---|
| `search_incident_reports` | Filter reports by category, district, area, status, date range, or text search | Public only sees `APPROVED` or own reports; anonymous users masked | Bounded pagination (max 50 items); applied criteria metadata |
| `get_incident_report` | Retrieve complete details for a single report ID | Unapproved reports restricted to owner/admin; moderation notes strictly shielded from citizens | Detailed report item, media URLs, reaction/comment counts |
| `get_incident_summary` | Aggregate factual report statistics from the DB | Public counts only approved/own reports; admin counts all | Total reports, category breakdown, verified vs in-review counts, factual summary |
| `analyze_incident_report` | Dissect report completeness and civic risk | Authorized report viewers only | Ground truth verified facts, missing/incomplete info, safety concerns, AI interpretation, confidence score |
| `find_possible_duplicate_reports` | Multi-factor similarity search across candidates | Read-only; no auto-merge or deletion | Similarity score (0.0–1.0), specific matching reasons (category, proximity, time, keywords), advisory notice |
| `prepare_report_review` | Moderation checklist & decision preview | **Restricted strictly to MODERATOR and ADMIN** | 4-point verification checklist, suggested action (`APPROVE`, `REQUEST_MORE_INFO`, `REJECT`), priority, AI rationale |

---

## 4. Natural-Language Multi-Lingual Orchestration

The assistant routes queries across Bangla, English, and Banglish:

1. **Category Synonyms:**
   - Bangla: অপরাধ, ছিনতাই, ডাকাতি, চুরি, সহিংসতা, মারামারি, জননিরাপত্তা, ম্যানহোল, আগুন, নদী দূষণ, প্রতারণা, চাঁদাবাজি, হয়রানি, দুর্নীতি, নিখোঁজ, ইত্যাদি।
   - English/Banglish: crime, mugging, chintai, assault, maramari, public safety, hazard, fraud, scam, harassment, corruption, missing.
2. **Geographic Parsing:**
   - Integrated with [`app/core/geo.py`](file:///Users/alfi/report%20box/citizen-report-platform/backend/app/core/geo.py) for all 64 Bangladesh districts and major urban areas (Savar, Mirpur, Dhanmondi, Agrabad, Zindabazar, etc.).
3. **Clarification Trigger:**
   - Overly ambiguous queries (e.g., "tell me reports", "help") trigger `IncidentIntelligenceIntent.CLARIFY_QUERY`, prompting the user with helpful district and category suggestions rather than executing an arbitrary query.

---

## 5. API Endpoints

- **`POST /api/v1/reports/ai-assistant/incident-intelligence`**
  - **Request Body:**
    ```json
    {
      "message": "Show crime reports in Savar",
      "conversation_id": "optional-uuid",
      "report_id": "optional-context-report-uuid",
      "history": [],
      "lang": "en"
    }
    ```
  - **Response Body:**
    ```json
    {
      "reply": "Found 2 report(s) in the database...",
      "intent": "SEARCH_INCIDENTS",
      "tool_executed": "search_incident_reports",
      "search_results": { ... },
      "report_details": null,
      "summary": null,
      "analysis": null,
      "duplicate_candidates": null,
      "review_preview": null,
      "follow_up_question": null,
      "is_clarification_needed": false,
      "conversation_id": "conv-inc-...",
      "disclaimer": "Factual incident data is retrieved directly from Nirapotta's verified database..."
    }
    ```

---

## 6. Frontend UI Component & Integration

- **Component:** [`frontend/src/components/AIIncidentIntelligenceModal.tsx`](file:///Users/alfi/report%20box/citizen-report-platform/frontend/src/components/AIIncidentIntelligenceModal.tsx)
  - **Zero Emoji Rule:** 100% compliant; uses Lucide React icons exclusively (`Sparkles`, `Bot`, `Search`, `FileText`, `CheckCircle2`, `AlertTriangle`, `ShieldAlert`, `MapPin`, `Calendar`, `User`, `CopyCheck`, `BarChart3`, `HelpCircle`, `RefreshCw`, `Loader2`, `Shield`).
  - **Responsive Glassmorphism:** Dark theme dialog with conversational thread, suggestion chips, and dynamic card views for each tool execution.
  - **Interactive Action Buttons:**
    - "Analyze Facts": Triggers deep report breakdown.
    - "Check Duplicates": Finds overlapping reports with similarity score and reasons.
- **Entry Points:**
  - **Community Reports Page (`/reports`):** "AI Incident Intelligence" launcher button next to "Submit a Report".
  - **Single Report Details Page (`/reports/[id]`):** "AI Fact Analysis" action button in the social/actions bar.

---

## 7. Verification Results

- **Backend Pytest Suite:** **185 passed** out of 185 tests in 64.34s.
  - Dedicated Phase C tests in [`backend/tests/test_incident_intelligence.py`](file:///Users/alfi/report%20box/citizen-report-platform/backend/tests/test_incident_intelligence.py): 10 passed.
  - Access control, privacy masking, zero hallucination, duplicate detection, review preparation, and full HTTP endpoint verified.
- **Frontend Type-Check:** `npm run type-check` completed with **0 errors**.
- **Frontend Production Build:** `npm run build` compiled all **45/45 static and dynamic routes** cleanly.
