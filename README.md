# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 4 — Admin Moderation & Approval Workflow`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence. Reports undergo administrative moderation and verification before public publication.

### Core Architectural Principles
- **Privacy by Design:** Supports anonymous reporting where reporter identity is protected from the public view while retaining internal links for moderation and abuse prevention.
- **Secure Authentication & RBAC:** JWT Bearer tokens with bcrypt password hashing and backend-enforced Role-Based Access Control (`USER`, `ADMIN`, `MODERATOR`).
- **Comprehensive Moderation Lifecycle:** Multi-stage moderation workflow (`SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED` / `NEEDS_MORE_INFORMATION`).
- **Moderation History & Audit Trail:** Immutable audit records tracking moderation actions, timestamps, administrator IDs, user-facing explanations, and private internal notes.
- **Strict Separation of Public vs Internal Data:** User-facing requests are surfaced to reporters, while internal investigation remarks remain strictly confidential to administrators.

---

## 2. Architecture & Tech Stack

```
+-------------------------------------------------------------+
|                      Frontend (Client)                      |
|             Next.js (App Router) + TypeScript               |
|                       Tailwind CSS                          |
+------------------------------+------------------------------+
                               |
                        REST API (HTTP)
                               |
+------------------------------v------------------------------+
|                      Backend (Server)                       |
|                       FastAPI + Python                      |
|      Modular Monolith (api, core, db, models, schemas)      |
+------------------------------+------------------------------+
                               |
        +----------------------+----------------------+
        |                                             |
+-------v---------------+                     +-------v---------------+
|       Database        |                     |     Object Storage    |
|      PostgreSQL       |                     |  Cloud-compatible S3  |
|  (SQLAlchemy+Alembic) |                     |  (Metadata in DB)     |
+-----------------------+                     +-----------------------+
```

### Stack Details
- **Frontend:** Next.js 16 (React 19, App Router), TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python 3.12+, Uvicorn, Pydantic v2
- **Security & Auth:** `pyjwt` (HS256 JWT tokens), `bcrypt` (12 rounds password hashing)
- **Database:** PostgreSQL (SQLAlchemy 2.0 Async + `asyncpg`, with `psycopg2` fallback)
- **Migrations:** Alembic (Async & offline transactional DDL)
- **Testing:** `pytest`, `pytest-asyncio`, `httpx`, in-memory `aiosqlite` test engine

---

## 3. Moderation Architecture & Workflow (Step 4)

```
[Citizen Submits Report]
          |
          v
    (SUBMITTED)
          |
    +-----+-----+
    |           |
    | [Start Review]
    |           |
    |           v
    |    (UNDER_REVIEW)
    |           |
    +-----+-----+-----+
          |           |
          v           v
      [Approve]   [Reject]   [Request More Info]
          |           |               |
          v           v               v
     (APPROVED)  (REJECTED) (NEEDS_MORE_INFORMATION)
                                      |
                             [Citizen Edits Draft]
                                      |
                                      v
                                 (SUBMITTED)
```

### Status Lifecycle
1. **`DRAFT`:** Citizen draft in progress. Not queued for moderation.
2. **`SUBMITTED`:** Enters the moderation queue. Ordinary user cannot edit.
3. **`UNDER_REVIEW`:** Administrator has claimed or started active review.
4. **`APPROVED`:** Platform-reviewed and verified by administrators (eligible for future public feeds).
5. **`REJECTED`:** Marked ineligible or violating terms. Rejection reason logged.
6. **`NEEDS_MORE_INFORMATION`:** Returned to the citizen with official feedback. Unlocks user editing to provide required details and re-submit.
7. **`ARCHIVED`:** Closed historical record.

### Moderation Notes & Audit Trail
- **`moderation_records` Table:**
  - `id`: GUID Primary Key
  - `report_id`: Foreign Key to `reports.id` (on delete cascade)
  - `admin_id`: Foreign Key to `users.id` (attributed automatically from authenticated JWT token)
  - `action`: `STARTED_REVIEW`, `APPROVED`, `REJECTED`, `REQUESTED_INFORMATION`, `ARCHIVED`
  - `user_message`: Official message visible to the reporter on their dashboard
  - `internal_notes`: Confidential notes visible exclusively to administrators

---

## 4. API Endpoints

### Administrative Endpoints (`role = ADMIN` Required)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard` | Aggregated platform and moderation statistics from real DB data |
| `GET` | `/api/v1/admin/reports` | Paginated moderation queue with status, category, search, and anonymous filters |
| `GET` | `/api/v1/admin/reports/{id}` | Detailed moderation view including reporter profile and audit history |
| `POST` | `/api/v1/admin/reports/{id}/review` | Transitions report to `UNDER_REVIEW` |
| `POST` | `/api/v1/admin/reports/{id}/approve` | Transitions report to `APPROVED` |
| `POST` | `/api/v1/admin/reports/{id}/reject` | Transitions report to `REJECTED` with user message & internal notes |
| `POST` | `/api/v1/admin/reports/{id}/request-information` | Transitions report to `NEEDS_MORE_INFORMATION` with required user message |

### Citizen Report Endpoints
| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories` | Public / Auth | Lists active incident categories |
| `POST` | `/api/v1/reports` | Authenticated | Creates report (`DRAFT` or `SUBMITTED`) |
| `GET` | `/api/v1/reports/mine` | Authenticated | Lists citizen's own reports |
| `GET` | `/api/v1/reports/{id}` | Owner / Admin | Gets report details + user-facing moderation feedback |
| `PATCH` | `/api/v1/reports/{id}` | Owner / Admin | Updates editable report (`DRAFT` / `NEEDS_MORE_INFORMATION`) |
| `POST` | `/api/v1/reports/{id}/submit` | Owner / Admin | Submits report for moderation |

### Authentication Endpoints
| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | Registers a new citizen account (`USER` role) |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials and returns JWT token |
| `POST` | `/api/v1/auth/logout` | Authenticated | Invalidates client session |
| `GET` | `/api/v1/auth/me` | Authenticated | Returns current authenticated user profile |
| `GET` | `/api/v1/auth/admin-check` | Admin (`ADMIN`) | Backend-enforced administrative check |

---

## 5. Frontend Pages & Routes

- **Home Page (`/`):** Platform landing page with dynamic authentication state and quick links.
- **Sign In (`/login`):** Authentication page with input validation and error feedback.
- **Register (`/register`):** Citizen registration page with auto-login.
- **Dashboard (`/dashboard`):** Citizen dashboard with submission metrics and quick action links.
- **Create Report (`/reports/create`):** Report creation form with dynamic categories and anonymous whistleblowing option.
- **My Reports (`/reports/mine`):** Citizen's report list with status filters and progress tracking.
- **Report Detail (`/reports/[id]`):** Incident breakdown, official moderator feedback callout, and draft re-submission.
- **Admin Console (`/admin`):** Operations dashboard displaying real-time metrics and pending queues.
- **Admin Moderation Queue (`/admin/reports`):** Paginated moderation table with status tabs, category filter, and search.
- **Admin Report Console (`/admin/reports/[id]`):** Moderation decision interface (Start Review, Approve, Reject, Request More Info), reporter inspection card, and audit history timeline.

---

## 6. Local Setup & Commands

### Database Setup (PostgreSQL)

1. Start your local PostgreSQL server:
   ```bash
   brew services start postgresql@16
   ```
2. Create the platform database:
   ```bash
   createdb citizen_report_db
   ```
3. Run Alembic migrations:
   ```bash
   cd backend
   source .venv/bin/activate
   alembic upgrade head
   ```
4. Seed initial incident categories:
   ```bash
   python -m app.db.seed
   ```
5. Bootstrap development administrator:
   ```bash
   python -m app.db.create_admin --email admin@citizenreport.gov.bd --username admin --password "Admin@Secure2026!"
   ```

---

### Running the Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Interactive API Documentation:** [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- **Health Check Endpoint:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### Running Backend Tests

```bash
cd backend
source .venv/bin/activate
pytest -v
```

---

### Running Frontend

```bash
cd frontend
npm run dev
```
Access the application at [http://localhost:3000](http://localhost:3000).
