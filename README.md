# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 2 — Authentication & Authorization`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence. Reports undergo administrative moderation and verification before public publication.

### Core Architectural Principles
- **Privacy by Design:** Supports anonymous reporting where reporter identity is protected from the public view while retaining internal links for moderation and abuse prevention.
- **Secure Authentication & RBAC:** JWT Bearer tokens with bcrypt password hashing and backend-enforced Role-Based Access Control (`USER`, `ADMIN`, `MODERATOR`).
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

## 3. Authentication & Authorization (Step 2)

### Authentication Flow
1. **Registration (`POST /api/v1/auth/register`):**
   - Validates username format, email format, and password length (minimum 8 characters).
   - Validates that email and username are globally unique.
   - Automatically hashes plaintext passwords with bcrypt.
   - Unconditionally assigns the `USER` role (no public admin registration).
2. **Login (`POST /api/v1/auth/login`):**
   - Authenticates against either email address or username.
   - Verifies bcrypt password hash in constant-time.
   - Generates a signed JWT bearer token containing `sub` (user UUID) and `role`.
   - Returns token and safe user profile (passwords and hashes are never exposed).
3. **Current User Profile (`GET /api/v1/auth/me`):**
   - Requires valid `Bearer <access_token>`.
   - Returns authenticated user details.
4. **Logout (`POST /api/v1/auth/logout`):**
   - Invalidates client session state.
5. **Admin Access Verification (`GET /api/v1/auth/admin-check`):**
   - Requires valid token from a user with the `ADMIN` role.
   - Non-admin authenticated users receive `HTTP 403 Forbidden`.

### Role-Based Authorization Dependencies
- `get_current_user`: Injects the authenticated `User` model, verifying token signature, expiration, and active status.
- `get_current_active_admin`: Enforces `current_user.role == UserRole.ADMIN` on the backend.

---

## 4. Database Schema Foundation

### Core Entities

```
+------------------------+          +------------------------+
|         users          |          |       categories       |
+------------------------+          +------------------------+
| id (UUID, PK)          |          | id (UUID, PK)          |
| email (VARCHAR, UQ)    |          | name (VARCHAR, UQ)     |
| username (VARCHAR, UQ) |          | slug (VARCHAR, UQ)     |
| full_name (VARCHAR)    |          | description (TEXT)     |
| hashed_password (STR)  |          | is_active (BOOL)       |
| role (USER|ADMIN)      |          | created_at (TIMESTAMP) |
| is_active (BOOL)       |          | updated_at (TIMESTAMP) |
| is_verified (BOOL)     |          +-----------+------------+
| created_at (TIMESTAMP) |                      |
| updated_at (TIMESTAMP) |                      | 1:N
+-----------+------------+                      |
            | 1:N                               |
            +-------------------+   +-----------+
                                |   |
                             +--v---v-----------------+
                             |        reports         |
                             +------------------------+
                             | id (UUID, PK)          |
                             | user_id (UUID, FK, N)  |
                             | category_id (UUID, FK) |
                             | title (VARCHAR)        |
                             | description (TEXT)     |
                             | location_text (STR)    |
                             | latitude (FLOAT, N)    |
                             | longitude (FLOAT, N)   |
                             | incident_date (TS, N)  |
                             | is_anonymous (BOOL)    |
                             | status (ENUM)          |
                             | submitted_at (TS, N)   |
                             | created_at (TIMESTAMP) |
                             | updated_at (TIMESTAMP) |
                             +-----------+------------+
                                         | 1:N
                             +-----------v------------+
                             |      report_media      |
                             +------------------------+
                             | id (UUID, PK)          |
                             | report_id (UUID, FK)   |
                             | file_name (VARCHAR)    |
                             | mime_type (VARCHAR)    |
                             | file_size (BIGINT)     |
                             | storage_path (VARCHAR) |
                             | caption (VARCHAR, N)   |
                             | created_at (TIMESTAMP) |
                             +------------------------+
```

---

## 5. Project Structure

```
citizen-report-platform/
├── frontend/                     # Next.js frontend application
│   ├── src/
│   │   ├── app/                  # App router pages
│   │   │   ├── admin/page.tsx    # Protected Admin Console (/admin)
│   │   │   ├── dashboard/page.tsx# Protected Citizen Dashboard (/dashboard)
│   │   │   ├── login/page.tsx    # Citizen Sign-In (/login)
│   │   │   ├── register/page.tsx # Citizen Registration (/register)
│   │   │   ├── layout.tsx        # App layout with AuthProvider & Navbar
│   │   │   ├── page.tsx          # Landing page
│   │   │   └── globals.css       # Global styling
│   │   ├── components/
│   │   │   └── Navbar.tsx        # Global navigation with auth state
│   │   ├── context/
│   │   │   └── AuthContext.tsx   # React Auth Provider & useAuth hook
│   │   └── lib/
│   │       ├── api.ts            # Typed apiFetch client
│   │       └── types.ts          # TypeScript domain interfaces
│   ├── package.json              # Frontend dependencies
│   └── tsconfig.json             # TypeScript config
│
├── backend/                      # FastAPI backend application
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py           # get_current_user, get_current_active_admin
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── auth.py   # Register, Login, Logout, /me, /admin-check
│   │   │       │   └── health.py # Health check & DB probe endpoint
│   │   │       └── api.py        # v1 router aggregator
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic Settings
│   │   │   └── security.py       # Password hashing & JWT token handling
│   │   ├── db/
│   │   │   ├── base.py           # Model metadata registry
│   │   │   ├── session.py        # Async engine & session management
│   │   │   ├── seed.py           # Initial category bootstrap seeder
│   │   │   ├── create_admin.py   # Administrator bootstrap CLI
│   │   │   └── init_db.py        # Database bootstrap helper
│   │   ├── models/               # SQLAlchemy 2.0 ORM models
│   │   │   ├── base.py           # Base model, GUID type, TimestampMixin
│   │   │   ├── user.py           # User entity & UserRole enum
│   │   │   ├── category.py       # Category entity
│   │   │   ├── report.py         # Report entity & status enum
│   │   │   └── report_media.py   # ReportMedia entity
│   │   ├── schemas/              # Pydantic validation schemas
│   │   │   ├── auth.py           # Auth request/response schemas
│   │   │   ├── user.py           # User schemas
│   │   │   ├── category.py       # Category schemas
│   │   │   ├── report.py         # Report & public response schemas
│   │   │   └── report_media.py   # ReportMedia schemas
│   │   ├── services/             # Business logic layer (reserved)
│   │   └── main.py               # FastAPI application entrypoint
│   ├── migrations/               # Alembic migrations
│   │   ├── env.py
│   │   └── versions/
│   │       └── 20260902_0001_initial_database_foundation.py
│   ├── tests/                    # Automated pytest test suite
│   │   ├── conftest.py           # Pytest fixtures & async test engine
│   │   ├── test_auth.py          # Registration, login, /me, and admin RBAC tests
│   │   ├── test_security.py      # Password hashing & JWT tests
│   │   ├── test_config.py        # Configuration tests
│   │   ├── test_db_session.py    # Database session tests
│   │   ├── test_models.py        # ORM model & privacy tests
│   │   ├── test_migrations.py    # Alembic migration tests
│   │   └── test_health.py        # API & health check tests
│   ├── alembic.ini               # Alembic configuration
│   ├── requirements.txt          # Python dependencies
│   └── pytest.ini                # Pytest configuration
│
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git ignore rules
└── README.md                     # Project documentation
```

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
4. (Optional) Seed initial bootstrap categories:
   ```bash
   python -m app.db.seed
   ```
5. (Optional) Bootstrap an initial development administrator:
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

### Running the Backend Tests

```bash
cd backend
source .venv/bin/activate
pytest -v
```

---

### Running the Frontend

```bash
cd frontend
npm run dev
```
Access the application at [http://localhost:3000](http://localhost:3000).

- **Sign In:** [http://localhost:3000/login](http://localhost:3000/login)
- **Register:** [http://localhost:3000/register](http://localhost:3000/register)
- **Citizen Dashboard:** [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Admin Console:** [http://localhost:3000/admin](http://localhost:3000/admin)
