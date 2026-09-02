# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 10 — Full System Testing, Security Hardening & Quality Assurance`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a production-hardened citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence (photos, videos, documents). Reports undergo administrative moderation and verification before publication to the public news feed with interactive citizen discussion, endorsements, safety controls, and real-time in-app activity notifications.

### Core Architectural Guarantees & Hardening
- **Strict Public Visibility Policy:** Public feeds, comments, reactions, and APIs display **ONLY** reports in `APPROVED` status. Unapproved reports (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `REJECTED`, `ARCHIVED`) return `404 Not Found` across all public endpoints.
- **HTTP Security Headers & Global Exception Safety:** All API responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`. Unhandled exceptions are masked behind standardized JSON error bodies to prevent stack trace or path disclosure.
- **Database-Backed In-App Notifications:** Lightweight, transactional notification system alerting citizens whenever their incident reports are submitted, placed under review, approved, rejected, or updated by administrators.
- **Safety Flags as Review Signals:** A flag submitted by a citizen is an allegation/request for moderation review. A flag **never automatically marks content as false, illegal, or malicious**; human administrators make final moderation determinations.
- **Privacy by Design:** Supports anonymous reporting where reporter identity is masked on public interfaces. Notifications, flagger identities, and private moderation notes are **strictly confidential** and isolated per user.
- **Cloud-Compatible Object Storage:** PostgreSQL stores **only file metadata**; all binary evidence files reside in dedicated object storage via a provider-agnostic abstraction layer with MIME-type and magic-byte validation.

---

## 2. System Architecture

```
[Citizen Client / Public Browser]
        |
        |  (JSON API / JWT Bearer)
        v
+---------------------------------------------------------------+
|                       FastAPI Backend                         |
|  - HTTP Security Headers Middleware                           |
|  - Strict Role-Based Access Control (USER vs ADMIN)           |
|  - Rate & Spam Throttling Guards                              |
|  - Anonymous Reporter Masking Logic                           |
|  - Global Safe Exception Handler                              |
+---------------+-------------------------------+---------------+
                |                               |
                v                               v
+-------------------------------+ +-----------------------------+
|    PostgreSQL Relational DB   | |    Cloud Object Storage     |
|  * Users & Auth               | |  * Encrypted file store     |
|  * Categories                 | |  * Images / Docs / Videos   |
|  * Incident Reports           | |  * Magic-byte validated     |
|  * Moderation Records         | |  * Sanitized storage paths  |
|  * Comments & Reactions       | +-----------------------------+
|  * Safety Flags               |
|  * In-App Notifications       |
+-------------------------------+
```

---

## 3. End-to-End User & Moderation Workflow

1. **Citizen Registration & Authentication:** Citizen registers via `/auth/register` (strictly assigned `USER` role) and authenticates via `/auth/login` to receive JWT access tokens.
2. **Incident Creation & Evidence Attachment:** Citizen drafts report (`POST /reports`) and uploads images/documents (`POST /reports/{id}/media`).
3. **Submission for Review:** Citizen submits draft (`POST /reports/{id}/submit`), triggering a `REPORT_SUBMITTED` notification.
4. **Administrative Moderation:** Admin inspects queue (`GET /admin/reports`), begins review (`POST /admin/reports/{id}/review`), and approves (`POST /admin/reports/{id}/approve`), triggering `REPORT_APPROVED` notification.
5. **Public Verification & Discussion:** Report is published to public news feed (`GET /public/reports`). Community members endorse with reactions and post constructive comments.
6. **Safety & Content Flagging:** Community members flag suspicious or duplicate entries. Admins resolve flags in the moderation queue (`PATCH /admin/flags/{id}`).
7. **In-App Activity Notifications:** Citizen tracks real-time status changes via the Navbar bell dropdown and dedicated `/notifications` activity center.

---

## 4. Local Setup & Verification Commands

### Backend Verification (73 Automated Pytest Scenarios)
```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Frontend Type-Check, Lint & Production Build
```bash
cd frontend
npm run type-check
npm run lint
npm run build
```

### Running the Full Stack Locally
```bash
# Backend (FastAPI on Port 8000)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (Next.js 16 on Port 3000)
cd frontend && npm run dev
```

---

## 5. Security Checklist Verified
- [x] Passwords securely hashed with bcrypt.
- [x] JWT access token issuance and signature verification.
- [x] IDOR protection on Reports, Comments, Reactions, Flags, Evidence, and Notifications.
- [x] Public endpoints strictly restricted to `APPROVED` reports.
- [x] Anonymous reporting privacy guaranteed on all public APIs.
- [x] Binary files stored strictly in object storage (outside PostgreSQL).
- [x] MIME-type, extension, and magic-byte upload validation enforced.
- [x] Standard HTTP security response headers configured.
- [x] Global safe exception handler active (no traceback or path leakage).
- [x] All 73 backend tests passing.
- [x] TypeScript type-check, ESLint, and Next.js production build passing.
