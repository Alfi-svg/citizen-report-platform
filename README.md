# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 0 — Environment & Project Foundation`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, modern, and production-grade citizen reporting system designed to allow users to submit community incident reports accompanied by multimedia supporting evidence. Reports undergo a structured administrative moderation and verification workflow before public dissemination.

### Primary Goals
- **Empower Citizens:** Enable straightforward submission of community incidents and evidence.
- **Verification Workflow:** Provide administrative review and moderation before public broadcast.
- **Performance & Reliability:** Built on modern, robust, and lightweight technology stacks.

---

## 2. Architecture & Tech Stack

The platform is designed following a **Modular Monolith** architecture pattern to ensure simplicity, maintainability, and clean separation of concerns without premature microservice overhead.

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
|             Modular Structure (api, core, schemas)          |
+------------------------------+------------------------------+
                               |
        +----------------------+----------------------+
        |                                             |
+-------v---------------+                     +-------v---------------+
|       Database        |                     |     Object Storage    |
|      PostgreSQL       |                     |  Cloud-compatible S3  |
+-----------------------+                     +-----------------------+
```

### Stack Details
- **Frontend:** [Next.js](https://nextjs.org/) (React 19, App Router), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [Python 3.12+](https://www.python.org/), [Uvicorn](https://www.uvicorn.org/), [Pydantic v2](https://docs.pydantic.dev/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) (Async via asyncpg / SQLAlchemy in future steps)
- **Storage:** S3-compatible cloud object storage (configured via environment variables)
- **Communication:** RESTful JSON APIs
- **Testing:** `pytest` & `httpx` (Backend), TypeScript & ESLint (Frontend)

---

## 3. Project Structure

```
citizen-report-platform/
├── frontend/                     # Next.js frontend application
│   ├── src/
│   │   └── app/                  # App router pages, layouts, and styles
│   │       ├── globals.css
│   │       ├── layout.tsx
│   │       └── page.tsx
│   ├── public/                   # Static assets
│   ├── package.json              # Frontend npm dependencies and scripts
│   ├── tsconfig.json             # TypeScript configuration
│   └── next.config.ts            # Next.js configuration
│
├── backend/                      # FastAPI backend application
│   ├── app/
│   │   ├── api/                  # API routes and endpoints
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   └── health.py # Service health check endpoint
│   │   │       └── api.py        # v1 router aggregator
│   │   ├── core/                 # Core configuration and settings
│   │   │   └── config.py         # Pydantic Settings
│   │   ├── models/               # Database ORM models (reserved for future steps)
│   │   ├── schemas/              # Pydantic validation schemas (reserved)
│   │   ├── services/             # Business logic layer (reserved)
│   │   └── main.py               # FastAPI entrypoint application
│   ├── tests/                    # Automated backend test suite
│   │   ├── conftest.py           # Pytest fixtures and TestClient
│   │   └── test_health.py        # Health & root endpoint tests
│   ├── requirements.txt          # Python dependencies
│   └── pytest.ini                # Pytest configuration
│
├── .env.example                  # Environment variable reference template
├── .gitignore                    # Git ignore configuration
└── README.md                     # Project documentation
```

---

## 4. Environment Variables

Copy the template to create local configuration files:

```bash
cp .env.example .env
cp .env.example backend/.env
```

### Key Configuration Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Runtime environment mode | `development` |
| `PROJECT_NAME` | Name of the platform | `Bangladesh Citizen Report Platform` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql+asyncpg://postgres:postgres@localhost:5432/citizen_report_db` |
| `SECRET_KEY` | JWT / session signing secret | `change-in-production` |
| `API_V1_STR` | API prefix path | `/api/v1` |
| `NEXT_PUBLIC_API_URL`| API base URL for frontend | `http://localhost:8000/api/v1` |
| `CORS_ORIGINS` | Allowed frontend origins | `["http://localhost:3000"]` |

---

## 5. Local Development Setup

### Prerequisites
- **Node.js:** v18.18+ (tested on Node 22+)
- **npm:** v9+
- **Python:** 3.12+ (tested with Python 3.12)
- **PostgreSQL:** 14+

---

### Running the Frontend

1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the web interface at [http://localhost:3000](http://localhost:3000).

Additional frontend commands:
```bash
npm run build       # Production build
npm run lint        # Code linting with ESLint
npm run type-check  # TypeScript type-checking
```

---

### Running the Backend

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
5. Access the API at:
   - Root: [http://localhost:8000/](http://localhost:8000/)
   - Interactive Swagger Docs: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
   - Alternative ReDoc: [http://localhost:8000/api/v1/redoc](http://localhost:8000/api/v1/redoc)
   - Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### Running Tests

To run the backend test suite:
```bash
cd backend
source .venv/bin/activate
pytest -v
```

---

## 6. Git Workflow

1. Always branch from `main` or develop for new features:
   ```bash
   git checkout -b feature/<feature-name>
   ```
2. Ensure automated linting, type-checking, and tests pass before committing:
   ```bash
   # In frontend
   npm run lint && npm run type-check
   # In backend
   pytest
   ```
3. Never commit `.env` or sensitive credentials.
4. Keep commits structured, descriptive, and atomic.
