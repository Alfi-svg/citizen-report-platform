# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 3 — Report Creation & Submission System`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence. Reports undergo administrative moderation and verification before public publication.

### Core Architectural Principles
- **Privacy by Design:** Supports anonymous reporting where reporter identity is protected from the public view while retaining internal links for moderation and abuse prevention.
- **Secure Authentication & RBAC:** JWT Bearer tokens with bcrypt password hashing and backend-enforced Role-Based Access Control (`USER`, `ADMIN`, `MODERATOR`).
- **Controlled Report Lifecycle:** State-enforced transitions (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED` / `NEEDS_MORE_INFORMATION` → `ARCHIVED`). Submitted reports never auto-publish.
- **Extensible Modular Monolith:** Clean separation into domain models, schemas, database access, dependencies, and API routers.
- **Resilient & Async:** Modern async database session lifecycle using SQLAlchemy 2.0 and Alembic migrations.

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
|           Modular Monolith (api, core, db, models)          |
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

## 3. Report Creation & Submission Workflow (Step 3)

```
+-------------------+
| Authenticated     |
| Citizen User      |
+---------+---------+
          |
          v
+-------------------+
| Fill Incident     |
| Information       |  (Title, Category, Location, Date/Time, Description, Privacy Mode)
+---------+---------+
          |
    +-----+-----+
    |           |
    v           v
[Save Draft] [Submit Report]
    |           |
    v           v
+---------+ +-------------+
|  DRAFT  | |  SUBMITTED  |
+----+----+ +------+------+
     |             |
     | [Submit]    | (Locked from further user modification)
     +------>------+
                   v
            +--------------+
            | Admin Review |  (Awaiting Step 4 moderation)
            +--------------+
```

### Report Status Transitions
1. **`DRAFT`:** Editable by the owner. Not visible to the public. Not queued for moderation.
2. **`SUBMITTED`:** Formally submitted by the citizen with `submitted_at` timestamp. Locked from modifications by ordinary users.
3. **`UNDER_REVIEW`:** Currently being investigated/moderated by administrators.
4. **`APPROVED`:** Verified and approved by administrators for public display.
5. **`NEEDS_MORE_INFORMATION`:** Returned to the citizen for clarification. The owner can edit and re-submit.
6. **`REJECTED`:** Rejected by moderation for policy violations or unverifiable information.
7. **`ARCHIVED`:** Closed historical record.

### Anonymous Reporting Privacy Guarantee
- When `is_anonymous = True`:
  - Public response schemas (`ReportPublicResponse`) sanitize the reporter's username and full name.
  - The internal database retains `user_id` for accountability, abuse prevention, and administrative audit.
  - Anonymous means **anonymous to the public**, not anonymous from administrators.

---

## 4. API Endpoints

### Categories
| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories` | Public / Auth | List all active incident categories |

### Authentication
| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | Registers a new citizen account (`USER` role) |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials and returns JWT bearer token |
| `POST` | `/api/v1/auth/logout` | Authenticated | Invalidates client session |
| `GET` | `/api/v1/auth/me` | Authenticated | Returns current authenticated user profile |
| `GET` | `/api/v1/auth/admin-check` | Admin (`ADMIN`) | Backend-enforced administrative authorization check |

### Reports
| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reports` | Authenticated | Creates a new report as `DRAFT` or `SUBMITTED` |
| `GET` | `/api/v1/reports/mine` | Authenticated | Lists all reports owned by the authenticated citizen |
| `GET` | `/api/v1/reports/{id}` | Owner / Admin | Retrieves report details (enforces ownership) |
| `PATCH` | `/api/v1/reports/{id}` | Owner / Admin | Updates editable report (`DRAFT` / `NEEDS_MORE_INFORMATION`) |
| `POST` | `/api/v1/reports/{id}/submit` | Owner / Admin | Submits a draft report for moderation review |

---

## 5. Frontend Pages & Routes

- **Home Page (`/`):** Platform landing page with dynamic authentication state and quick links.
- **Sign In (`/login`):** Authentication page with input validation and error feedback.
- **Register (`/register`):** Citizen registration page with auto-login.
- **Dashboard (`/dashboard`):** Citizen dashboard with submission metrics and quick action links.
- **Create Report (`/reports/create`):**
  - Dynamic category selector from database.
  - Title, description, location, incident occurrence time.
  - Explicit privacy selector: **Public Identity** vs **Anonymous Whistleblower Mode**.
  - Interactive two-step Review & Confirmation screen.
  - Dedicated **Save Draft** and **Submit for Moderation** actions.
- **My Reports (`/reports/mine`):**
  - List of user's incident reports with status filter tabs (All, Draft, Submitted, Under Review, Approved).
  - Status badges, category labels, location, and privacy indicators.
  - Empty states and quick access to report creation.
- **Report Detail (`/reports/[id]`):**
  - Complete incident overview and metadata timeline.
  - Inline draft editing mode with live updates for `DRAFT` and `NEEDS_MORE_INFORMATION` reports.
  - Submission action for unsubmitted drafts.
- **Admin Console (`/admin`):** Protected administrative verification dashboard.

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
