# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 6 — Public News Feed & Approved Reports`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence (photos, videos, documents). Reports undergo administrative moderation and verification before publication to the public news feed.

### Core Architectural Principles
- **Strict Public Visibility Policy:** Public feeds and APIs display **ONLY** reports in `APPROVED` status. Unapproved reports (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `REJECTED`, `ARCHIVED`) return `404 Not Found` across all public endpoints to prevent information leakage.
- **Privacy by Design:** Supports anonymous reporting where reporter identity is protected on public interfaces while retaining internal links for moderation and abuse prevention.
- **Secure Authentication & RBAC:** JWT Bearer tokens with bcrypt password hashing and backend-enforced Role-Based Access Control (`USER`, `ADMIN`, `MODERATOR`).
- **Cloud-Compatible Object Storage:** PostgreSQL stores **only file metadata**; all binary evidence files reside in dedicated object storage via a provider-agnostic abstraction layer.
- **Multi-Stage Moderation Lifecycle:** Workflow transitions (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED` / `NEEDS_MORE_INFORMATION`).
- **Public News Feed & Discovery:** Real-time search, category filtering, location filtering, and verified trending evidence ranking.

---

## 2. Public API Architecture (Step 6)

All public endpoints are grouped under `/api/v1/public/` and require no authentication credentials.

| Method | Endpoint | Query Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/public/reports` | `sort`, `category_id`, `location`, `q`, `limit`, `offset` | Paginated feed of `APPROVED` reports with keyword search, location filtering, and category chips |
| `GET` | `/api/v1/public/reports/{id}` | — | Detailed public report article view (strictly enforces `status = APPROVED`) |
| `GET` | `/api/v1/public/categories` | — | Active categories with verified report counters |
| `GET` | `/api/v1/public/reports/{id}/media/{media_id}` | — | Public streaming of evidence files attached to an `APPROVED` report |

### Strict Public Visibility Rule
Database queries across all public endpoints apply an unconditional `Report.status == ReportStatus.APPROVED` filter:
- If an unapproved report ID (`DRAFT`, `SUBMITTED`, `REJECTED`, etc.) is requested publicly, the API returns `404 Not Found` rather than `403 Forbidden`, preventing discovery of unapproved submissions.
- Anonymous reports have reporter identity sanitized (`reporter_display_name = "Anonymous Citizen"`). User emails, passwords, and private moderation notes are never serialized.

---

## 3. Storage Architecture & Evidence Pipeline (Step 5)

```
[Citizen / Client]
         |
         | (1) Multipart Upload: POST /api/v1/reports/{id}/media
         v
+-------------------------------------------------------------+
|                      FastAPI Backend                        |
|                                                             |
|  * MIME Whitelist Verification (JPEG, PNG, WebP, MP4, PDF)  |
|  * Magic Byte Header Validation                             |
|  * Extension & Executable Blocking (.exe, .sh, .js rejected)|
|  * File Size Constraint Checking                            |
|  * Structured Storage Key Generation:                       |
|    reports/{report_id}/{unique_uuid}.{ext}                  |
+--------------+------------------------------+---------------+
               |                              |
               | (2) Binary Upload            | (3) Record Metadata
               v                              v
+------------------------------+ +----------------------------+
|        Object Storage        | |         PostgreSQL         |
|      (BaseStorageService)    | |       (report_media)       |
|                              | |                            |
| * LocalStorageService (Dev)  | | * id (UUID)                |
| * S3StorageService (Prod)    | | * report_id (FK CASCADE)   |
|   (AWS S3 / R2 / MinIO)      | | * file_name                |
|                              | | * mime_type, file_size     |
|                              | | * storage_path, caption    |
+------------------------------+ +----------------------------+
```

---

## 4. Administrative Moderation Endpoints (`role = ADMIN` Required)

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard` | Aggregated platform and moderation statistics from real DB data |
| `GET` | `/api/v1/admin/reports` | Paginated moderation queue with status, category, title search, and anonymous filters |
| `GET` | `/api/v1/admin/reports/{id}` | Detailed moderation view including evidence inspection and audit history |
| `POST` | `/api/v1/admin/reports/{id}/review` | Transitions report status to `UNDER_REVIEW` |
| `POST` | `/api/v1/admin/reports/{id}/approve` | Transitions report status to `APPROVED` |
| `POST` | `/api/v1/admin/reports/{id}/reject` | Transitions report status to `REJECTED` |
| `POST` | `/api/v1/admin/reports/{id}/request-information` | Transitions report status to `NEEDS_MORE_INFORMATION` |

---

## 5. Citizen Report Endpoints

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories` | Public / Auth | Lists active incident categories |
| `POST` | `/api/v1/reports` | Authenticated | Creates report (`DRAFT` or `SUBMITTED`) |
| `GET` | `/api/v1/reports/mine` | Authenticated | Lists citizen's own reports |
| `GET` | `/api/v1/reports/{id}` | Owner / Admin | Gets report details, media evidence, and moderator feedback |
| `PATCH` | `/api/v1/reports/{id}` | Owner / Admin | Updates editable report (`DRAFT` / `NEEDS_MORE_INFORMATION`) |
| `POST` | `/api/v1/reports/{id}/submit` | Owner / Admin | Submits report for moderation |
| `POST` | `/api/v1/reports/{id}/media` | Owner / Admin | Uploads and attaches evidence file |
| `DELETE` | `/api/v1/reports/{id}/media/{media_id}` | Owner / Admin | Deletes evidence file from storage and database |

---

## 6. Frontend Pages & Components

- **Home / News Feed (`/`):** Public citizen news feed featuring hero search, location filter, category pills, "Latest Reviewed" vs "Trending Evidence" sort modes, and responsive report cards.
- **Public Report Article (`/reports/[id]`):** Editorial incident view displaying verified details, photo previews, video players, and moderation trust disclaimers.
- **Create Report (`/reports/create`):** Multi-step form with evidence attachments and anonymous whistleblower toggle.
- **My Reports (`/reports/mine`):** Personal report tracker with status badges and feedback display.
- **Admin Console (`/admin` & `/admin/reports` & `/admin/reports/[id]`):** Operational dashboard and decision controls.

---

## 7. Local Setup & Verification Commands

### Backend Tests
```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Frontend Build & Lint
```bash
cd frontend
npm run type-check
npm run lint
npm run build
```

### Starting the Services
```bash
# Backend (Port 8000)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (Port 3000)
cd frontend && npm run dev
```
