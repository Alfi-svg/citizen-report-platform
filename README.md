# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 5 — Evidence Upload & Cloud Object Storage`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence (photos, videos, documents). Reports undergo administrative moderation and verification before public publication.

### Core Architectural Principles
- **Privacy by Design:** Supports anonymous reporting where reporter identity is protected from the public view while retaining internal links for moderation and abuse prevention.
- **Secure Authentication & RBAC:** JWT Bearer tokens with bcrypt password hashing and backend-enforced Role-Based Access Control (`USER`, `ADMIN`, `MODERATOR`).
- **Cloud-Compatible Object Storage:** PostgreSQL stores **only file metadata**; all binary evidence files reside in dedicated object storage via a provider-agnostic abstraction layer.
- **Multi-Stage Moderation Lifecycle:** Workflow transitions (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED` / `NEEDS_MORE_INFORMATION`).
- **Audit & Evidence Security:** Non-executable file storage, magic byte verification, MIME whitelisting, size limits, and authorized tokenized streaming.

---

## 2. Storage Architecture & Evidence Pipeline (Step 5)

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

### Storage Providers & Abstraction
The system utilizes `BaseStorageService` with pluggable implementations:
- **`LocalStorageService` (Default for local development & sandboxed environments):** Secure local filesystem storage rooted in `data/storage` with strict path traversal prevention.
- **`S3StorageService` (Production / Cloud):** S3-compatible client for AWS S3, Cloudflare R2, MinIO, or Supabase Storage.

### Supported Evidence Formats & Size Limits
| Category | Allowed Formats / Extensions | MIME Types | Max Size |
| :--- | :--- | :--- | :--- |
| **Photos** | `.jpg`, `.jpeg`, `.png`, `.webp` | `image/jpeg`, `image/png`, `image/webp` | **10 MB** |
| **Videos** | `.mp4`, `.webm`, `.mov` | `video/mp4`, `video/webm`, `video/quicktime` | **50 MB** |
| **Documents** | `.pdf`, `.txt`, `.docx` | `application/pdf`, `text/plain`, `.docx` | **20 MB** |

*Note: Executable scripts (`.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.py`, `.bin`, `.html`) are strictly rejected.*

---

## 3. API Endpoints

### Evidence & Storage Endpoints
| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reports/{id}/media` | Owner / Admin | Uploads and attaches evidence file (enforces editable status) |
| `GET` | `/api/v1/reports/{id}/media/{media_id}` | Owner / Admin | Streams evidence file securely |
| `DELETE` | `/api/v1/reports/{id}/media/{media_id}` | Owner / Admin | Deletes evidence file from storage and database |

### Administrative Endpoints (`role = ADMIN` Required)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard` | Aggregated platform and moderation statistics from real DB data |
| `GET` | `/api/v1/admin/reports` | Paginated moderation queue with status, category, title search, and anonymous filters |
| `GET` | `/api/v1/admin/reports/{id}` | Detailed moderation view including evidence inspection and audit history |
| `POST` | `/api/v1/admin/reports/{id}/review` | Transitions report status to `UNDER_REVIEW` |
| `POST` | `/api/v1/admin/reports/{id}/approve` | Transitions report status to `APPROVED` |
| `POST` | `/api/v1/admin/reports/{id}/reject` | Transitions report status to `REJECTED` |
| `POST` | `/api/v1/admin/reports/{id}/request-information` | Transitions report status to `NEEDS_MORE_INFORMATION` |

### Citizen Report Endpoints
| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories` | Public / Auth | Lists active incident categories |
| `POST` | `/api/v1/reports` | Authenticated | Creates report (`DRAFT` or `SUBMITTED`) |
| `GET` | `/api/v1/reports/mine` | Authenticated | Lists citizen's own reports |
| `GET` | `/api/v1/reports/{id}` | Owner / Admin | Gets report details, media evidence, and moderator feedback |
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

## 4. Frontend Pages & Components

- **Home Page (`/`):** Platform landing page with dynamic authentication state and quick links.
- **Create Report (`/reports/create`):**
  - Integrated `EvidenceUploader` component supporting multi-file selection, client-side type/size validation, captions, and upload progress.
  - Interactive two-step Review & Confirmation screen displaying attached evidence.
- **My Reports (`/reports/mine`):** Citizen report tracker with status badges and filter tabs.
- **Report Detail (`/reports/[id]`):**
  - `EvidenceGallery` displaying photo previews, video players, and document links.
  - Inline evidence uploader and live deletion in `DRAFT` and `NEEDS_MORE_INFORMATION` modes.
- **Admin Console (`/admin`):** Real-time incident counts and pending submission queues.
- **Admin Moderation Console (`/admin/reports/[id]`):**
  - Moderation decision controls (Review, Approve, Reject, Request More Info).
  - Full evidence inspection panel for photos, videos, and documents.

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
