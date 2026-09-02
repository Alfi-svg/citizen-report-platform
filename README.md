# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 1 — Database Foundation & Backend Architecture`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence. Reports undergo administrative moderation and verification before public publication.

### Core Architectural Principles
- **Privacy by Design:** Supports anonymous reporting where reporter identity is protected from the public view while retaining internal links for moderation and abuse prevention.
- **Extensible Modular Monolith:** Clean separation into domain models, schemas, database access, and API routers.
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
- **Database:** PostgreSQL (SQLAlchemy 2.0 Async + `asyncpg`, with `psycopg2` fallback)
- **Migrations:** Alembic (Async & offline transactional DDL)
- **Storage:** S3-compatible cloud object storage (Metadata tracked in PostgreSQL)
- **Testing:** `pytest`, `pytest-asyncio`, `httpx`, in-memory `aiosqlite` test engine

---

## 3. Database Schema Foundation

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

### Entity Details

1. **`users`**:
   - Authentication & role metadata (`USER`, `ADMIN`, `MODERATOR`).
   - Passwords stored exclusively as secure hashes.
2. **`categories`**:
   - Extensible incident categories (Crime, Corruption, Missing Person, Violence, Human Rights, Environmental, etc.).
3. **`reports`**:
   - Incident title, description, location details (text + optional coordinates), and incident timestamp.
   - **Report Lifecycle:** `DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED` / `NEEDS_MORE_INFORMATION` → `ARCHIVED`.
   - **Privacy Protection:** When `is_anonymous = true`, internal `user_id` linkage is preserved for moderation, but the public API sanitizes reporter identity.
4. **`report_media`**:
   - Metadata for uploaded evidence (photos, videos, documents). Binary files reside in object storage; database stores metadata only.

---

## 4. Project Structure

```
citizen-report-platform/
├── frontend/                     # Next.js frontend application
│   ├── src/
│   │   └── app/                  # App router pages and layouts
│   ├── package.json              # Frontend dependencies
│   └── tsconfig.json             # TypeScript config
│
├── backend/                      # FastAPI backend application
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   └── health.py # Health check & DB probe endpoint
│   │   │       └── api.py        # v1 router aggregator
│   │   ├── core/
│   │   │   └── config.py         # Pydantic Settings
│   │   ├── db/
│   │   │   ├── base.py           # Model metadata registry
│   │   │   ├── session.py        # Async engine & session management
│   │   │   ├── seed.py           # Initial category bootstrap seeder
│   │   │   └── init_db.py        # Database bootstrap helper
│   │   ├── models/               # SQLAlchemy 2.0 ORM models
│   │   │   ├── base.py           # Base model, GUID type, TimestampMixin
│   │   │   ├── user.py           # User entity
│   │   │   ├── category.py       # Category entity
│   │   │   ├── report.py         # Report entity & status enum
│   │   │   └── report_media.py   # ReportMedia entity
│   │   ├── schemas/              # Pydantic validation schemas
│   │   │   ├── user.py
│   │   │   ├── category.py
│   │   │   ├── report.py
│   │   │   └── report_media.py
│   │   ├── services/             # Business logic layer (reserved)
│   │   └── main.py               # FastAPI application entrypoint
│   ├── migrations/               # Alembic migrations
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 20260902_0001_initial_database_foundation.py
│   ├── tests/                    # Automated pytest test suite
│   │   ├── conftest.py           # Pytest fixtures & async test engine
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

## 5. Local Setup & Commands

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
