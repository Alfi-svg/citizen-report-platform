# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 8 — Report Flags, Content Moderation & Safety Controls`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence (photos, videos, documents). Reports undergo administrative moderation and verification before publication to the public news feed with interactive citizen discussion, endorsements, and safety controls.

### Core Architectural Principles
- **Strict Public Visibility Policy:** Public feeds, comments, reactions, and APIs display **ONLY** reports in `APPROVED` status. Unapproved reports (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `REJECTED`, `ARCHIVED`) return `404 Not Found` across all public endpoints.
- **Safety Flags as Review Signals:** A flag submitted by a citizen is an allegation/request for moderation review. A flag **never automatically marks content as false, illegal, or malicious**; human administrators make final moderation determinations.
- **Privacy by Design:** Supports anonymous reporting where reporter identity is masked on public interfaces. Flagger identities, reason selections, and private explanations are **strictly confidential** and never exposed publicly.
- **Community Interaction & Controls:** Moderated comments and toggleable endorsements (`SUPPORT` / `IMPORTANT`) paired with safety flagging for both public reports and comments.
- **Cloud-Compatible Object Storage:** PostgreSQL stores **only file metadata**; all binary evidence files reside in dedicated object storage via a provider-agnostic abstraction layer.

---

## 2. Safety & Content Flagging Architecture (Step 8)

```
[Authenticated Citizen]
         |
         +---> (1) Flag Approved Report: POST /api/v1/reports/{id}/flags
         |         (Reason + Optional Private Explanation up to 500 chars)
         |
         +---> (2) Flag Public Comment: POST /api/v1/comments/{id}/flags
         |         (Reason + Optional Private Explanation up to 500 chars)
         |
         v
+---------------------------------------------------------------+
|                      FastAPI Backend                          |
|                                                               |
|  * Verifies target report/comment is APPROVED & VISIBLE       |
|  * Enforces DB-level duplicate flag prevention per reason     |
|  * Preserves flagger privacy (never leaks flag counts/details)|
+-------------------------------+-------------------------------+
                                |
                                v
                +-------------------------------+
                |      content_flags Table      |
                |                               |
                | * id (UUID PK)                |
                | * user_id (FK CASCADE)        |
                | * target_type (REPORT/COMMENT)|
                | * report_id (FK CASCADE)      |
                | * comment_id (FK CASCADE)     |
                | * reason (String)             |
                | * details (Private Text)      |
                | * status (PENDING / REVIEWED  |
                |   / DISMISSED / ACTION_TAKEN) |
                | * reviewed_by, reviewed_at    |
                | * admin_notes (Internal Text) |
                +---------------+---------------+
                                |
                                v
+---------------------------------------------------------------+
|                    Admin Safety Queue                         |
|  * List & Filter Flags (by target type and moderation status) |
|  * Inspect Target Report or Moderate Comment                  |
|  * Mark Reviewed, Dismiss, or Record Action Taken             |
+---------------------------------------------------------------+
```

---

## 3. Flag Reasons & Lifecycle

### Supported Report Flag Reasons
- `FALSE_OR_MISLEADING`: Factual inaccuracies, fabrications, or manipulated media.
- `SPAM`: Commercial promotional content or irrelevant advertising.
- `DUPLICATE`: Repeated incident report already existing on the platform.
- `PRIVACY_CONCERN`: Non-consensual personal information or sensitive document leaks.
- `HARASSMENT_OR_ABUSE`: Unsubstantiated personal attacks or defamatory statements.
- `INAPPROPRIATE_CONTENT`: Excessively graphic violence or vulgar content.
- `OTHER`: Other civic safety concerns requiring administrative review.

### Supported Comment Flag Reasons
- `SPAM`: Promotional links or repetitive text.
- `HARASSMENT_OR_ABUSE`: Targeted bullying, threats, or abuse.
- `HATEFUL_OR_OFFENSIVE`: Attacks on identity, religion, or community.
- `PERSONAL_INFORMATION`: Doxxing or private contact information leaks.
- `THREATENING_CONTENT`: Threats of physical violence.
- `INAPPROPRIATE_CONTENT`: Explicit or inappropriate commentary.
- `OTHER`: Other moderation concerns.

### Flag Statuses
- `PENDING`: Newly submitted, awaiting administrative inspection.
- `REVIEWED`: Inspected by administrator; no policy violation found.
- `DISMISSED`: Rejected as invalid or frivolous flag.
- `ACTION_TAKEN`: Content edited, hidden, rejected, or updated by moderation team.

---

## 4. API Endpoints

### Safety & Flagging Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reports/{id}/flags` | Authenticated | Submit safety/content flag for an `APPROVED` report |
| `POST` | `/api/v1/comments/{id}/flags` | Authenticated | Submit safety/content flag for a visible comment |
| `GET` | `/api/v1/admin/flags` | Admin | List paginated flag queue with target type and status filters |
| `PATCH` | `/api/v1/admin/flags/{id}` | Admin | Update flag status (`REVIEWED`, `DISMISSED`, `ACTION_TAKEN`) and record admin notes |

### Community Interaction Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/public/reports/{id}/comments` | Public | Paginated list of visible comments on an `APPROVED` report |
| `GET` | `/api/v1/public/reports/{id}/reactions` | Public / Auth | Aggregated reaction counts (`SUPPORT`, `IMPORTANT`) |
| `POST` | `/api/v1/reports/{id}/comments` | Authenticated | Post a comment on an `APPROVED` report |
| `DELETE` | `/api/v1/comments/{comment_id}` | Owner / Admin | Delete own comment or remove comment as administrator |
| `POST` | `/api/v1/reports/{id}/reactions` | Authenticated | Toggle reaction (`SUPPORT` or `IMPORTANT`) on an `APPROVED` report |
| `DELETE` | `/api/v1/reports/{id}/reactions/{type}` | Authenticated | Remove a specific reaction |

---

## 5. Local Setup & Verification Commands

### Backend Tests
```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Frontend Type-Check, Lint & Build
```bash
cd frontend
npm run type-check
npm run lint
npm run build
```

### Running Locally
```bash
# Backend (Port 8000)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (Port 3000)
cd frontend && npm run dev
```
