# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 7 — Comments, Reactions & Community Interaction`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence (photos, videos, documents). Reports undergo administrative moderation and verification before publication to the public news feed with interactive citizen discussion and endorsements.

### Core Architectural Principles
- **Strict Public Visibility Policy:** Public feeds, comments, reactions, and APIs display **ONLY** reports in `APPROVED` status. Unapproved reports (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `REJECTED`, `ARCHIVED`) return `404 Not Found` across all public endpoints.
- **Privacy by Design:** Supports anonymous reporting where reporter identity is masked on public interfaces while retaining internal audit links. Commenter and reporter identities are strictly decoupled.
- **Secure Community Interaction:** Plain-text moderated comments and toggleable citizen endorsements (`SUPPORT` / `IMPORTANT`) with database-level uniqueness and spam prevention.
- **Cloud-Compatible Object Storage:** PostgreSQL stores **only file metadata**; all binary evidence files reside in dedicated object storage via a provider-agnostic abstraction layer.
- **Multi-Stage Moderation Lifecycle:** Full administrative review pipeline with immutable audit history.

---

## 2. Community Interaction Architecture (Step 7)

```
[Authenticated Citizen]
         |
         +---> (1) Toggle Reaction: POST /api/v1/reports/{id}/reactions
         |         (SUPPORT / IMPORTANT — Unique per user+report+type)
         |
         +---> (2) Post Comment: POST /api/v1/reports/{id}/comments
                   (Rate-limited, 1000 char max, Anti-spam verification)
                           |
                           v
+---------------------------------------------------------------+
|                      FastAPI Backend                          |
|                                                               |
|  * Verifies parent report is in APPROVED status               |
|  * Enforces plain-text validation & sanitization              |
|  * Prevents duplicate rapid submissions                       |
|  * Admin Moderation Controls (VISIBLE / HIDDEN / REMOVED)     |
+---------------+-------------------------------+---------------+
                |                               |
                v                               v
+-------------------------------+ +-----------------------------+
|         comments Table        | |       reactions Table       |
|                               | |                             |
| * id (UUID PK)                | | * id (UUID PK)              |
| * report_id (FK CASCADE)      | | * report_id (FK CASCADE)    |
| * user_id (FK CASCADE)        | | * user_id (FK CASCADE)      |
| * body (Text, 1-1000 chars)   | | * reaction_type (Enum)      |
| * status (VISIBLE / HIDDEN)   | | * UNIQUE(report,user,type)  |
| * created_at, updated_at      | | * created_at                |
+-------------------------------+ +-----------------------------+
```

---

## 3. Community Interaction Endpoints

### Public Discussion & Endorsements
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/public/reports/{id}/comments` | Public | Paginated list of visible comments on an `APPROVED` report |
| `GET` | `/api/v1/public/reports/{id}/reactions` | Public / Auth | Aggregated reaction counts (`SUPPORT`, `IMPORTANT`) and user reaction states |

### Authenticated Interaction
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reports/{id}/comments` | Authenticated | Post a comment on an `APPROVED` report |
| `DELETE` | `/api/v1/comments/{comment_id}` | Owner / Admin | Delete own comment or remove comment as administrator |
| `POST` | `/api/v1/reports/{id}/reactions` | Authenticated | Toggle reaction (`SUPPORT` or `IMPORTANT`) on an `APPROVED` report |
| `DELETE` | `/api/v1/reports/{id}/reactions/{type}` | Authenticated | Remove a specific reaction |

### Admin Moderation Endpoints (`role = ADMIN` Required)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/comments` | List comments across reports with status filters (`VISIBLE`, `HIDDEN`, `REMOVED`) |
| `PATCH` | `/api/v1/admin/comments/{id}/status` | Update moderation status (`VISIBLE`, `HIDDEN`, `REMOVED`) |
| `GET` | `/api/v1/admin/dashboard` | Aggregated platform metrics from database |
| `GET` | `/api/v1/admin/reports` | Paginated moderation queue with status and search filters |
| `GET` | `/api/v1/admin/reports/{id}` | Detailed moderation console with evidence inspection and comment management |
| `POST` | `/api/v1/admin/reports/{id}/review` | Transitions report to `UNDER_REVIEW` |
| `POST` | `/api/v1/admin/reports/{id}/approve` | Transitions report to `APPROVED` |
| `POST` | `/api/v1/admin/reports/{id}/reject` | Transitions report to `REJECTED` |
| `POST` | `/api/v1/admin/reports/{id}/request-information` | Transitions report to `NEEDS_MORE_INFORMATION` |

---

## 4. Public News Feed & Discovery Endpoints

| Method | Endpoint | Query Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/public/reports` | `sort`, `category_id`, `location`, `q`, `limit`, `offset` | Paginated feed of `APPROVED` reports |
| `GET` | `/api/v1/public/reports/{id}` | — | Single public report article |
| `GET` | `/api/v1/public/categories` | — | Active categories with verified report counts |
| `GET` | `/api/v1/public/reports/{id}/media/{media_id}` | — | Public streaming of evidence attached to `APPROVED` reports |

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
