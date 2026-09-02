# Bangladesh Citizen Report Platform — Production Launch Handoff & Deployment Manual

> **Current Stage:** `STEP 14 — Final Launch Handoff & Deployment Checklist`
> **Status:** Production-Ready & Deployment Handoff Complete

---

## 1. System Overview & Architecture

The **Bangladesh Citizen Report Platform** is an enterprise-grade citizen reporting and civic oversight platform. It allows verified citizens to submit community incident reports with multimedia evidence (photos, documents, videos), engage in constructive discussions, endorse issues, flag violations, and track status updates with in-app activity notifications.

```
[Public Browser / Citizen Client]
        │
        │  (JSON API / JWT Bearer)
        ▼
┌───────────────────────────────────────────────────────────────┐
│                       FastAPI Backend                         │
│  - Structured Logging & Health Probes (/api/v1/health)        │
│  - HTTP Security Headers (HSTS, CSP, X-Frame-Options: DENY)   │
│  - Environment-Driven CORS (Multi-origin validator)           │
│  - Strict Role-Based Access Control (USER vs ADMIN)           │
│  - Anonymous Whistleblower Masking Guaranteed                 │
│  - Global Safe Exception Handler (Zero traceback disclosure)  │
└───────────────┬───────────────────────────────┬───────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────────┐ ┌─────────────────────────────┐
│    PostgreSQL Relational DB   │ │   S3-Compatible Object Store│
│  * Users & Auth Records       │ │  * AWS S3 / Cloudflare R2   │
│  * Categories & Seed Data     │ │  * Encrypted binary storage │
│  * Incident Reports           │ │  * Magic-byte validation    │
│  * Moderation Audit History   │ │  * Sanitized storage paths  │
│  * Comments & Reactions       │ └─────────────────────────────┘
│  * Safety Review Flags        │
│  * In-App Notifications       │
│  * Emergency Services Units   │
└───────────────────────────────┘
```

### 1.1. Citizen Safety Navigator
The **Citizen Safety Navigator** (`/safety`) provides an instant, mobile-first emergency assistance directory across Bangladesh:
- **National Emergency 999:** 1-tap toll-free emergency call action for police, fire service, and ambulance.
- **Nearest Police Station & Police Box:** Server-side Haversine geospatial proximity calculation with accurate human-readable distance (e.g. `350 m`, `1.4 km`), verified phone number, 1-tap call button, and Google Maps directions link.
- **Zero Continuous Tracking:** User GPS coordinates are processed on-demand in memory only when the user explicitly requests *"Find Help Near Me"*. Coordinates are never persisted in the database or exposed publicly.
- **Manual Area Fallback:** Quick-select and dropdown filters for all major divisions/districts in Bangladesh if browser geolocation is unavailable or denied.
- **Bilingual Interface:** Full English and Bangla (বাংলা) support.
- **Admin Directory Management:** Administrative CRUD interface (`/admin/emergency-services`) to maintain official phone numbers, addresses, verification badges, and active directory status.

### 1.2. Missing Person Alert Network
The **Missing Person Alert Network** (`/missing-person`) enables verified community search coordination across Bangladesh:
- **Citizen Report & Profile Attachment:** Citizens submit structured missing person profiles (photo, age, clothing, last seen area, official contact) attached to reports.
- **Strict Admin Verification & Activation:** Reports never auto-publish. An administrator must verify authority records and explicitly activate the alert with a configurable geospatial radius (1 km, 3 km, 5 km, 10 km, 25 km) and expiry.
- **Geospatial & Deduplicated Notifications:** Eligible opted-in citizens within the alert radius receive concise, deduplicated in-app notifications.
- **"I Saw This Person" Community Sightings:** Citizens submit sighting tips with approximate location and description. Sightings route to an admin moderation queue (`/admin/missing-person/sightings`) before safe approximate updates are displayed publicly.
- **Found & Resolution Lifecycle:** Admins can mark individuals as `FOUND` with resolution notes, automatically updating public status and notifying community participants.
- **Zero-Doxxing Privacy Guarantee:** Reporter personal contact info, private metadata, and unreviewed citizen locations are strictly shielded.

---

## 2. Production Deployment Checklist

### Pre-Deployment
- [ ] **Production database created:** PostgreSQL 15+ instance provisioned.
- [ ] **Database connection configured:** `DATABASE_URL` configured with `postgresql+asyncpg://` and SSL enabled (`?ssl=require`).
- [ ] **Required environment variables configured:** All values set in server and frontend environments.
- [ ] **Frontend API URL configured:** `NEXT_PUBLIC_API_URL` set to the backend API domain.
- [ ] **Backend CORS origins configured:** `CORS_ORIGINS` points strictly to authorized frontend domains.
- [ ] **Authentication secret configured:** `SECRET_KEY` set to a random 32+ character string.
- [ ] **Admin bootstrap configuration completed:** CLI procedure ready for initial administrator setup.
- [ ] **Object storage configured:** S3/R2 bucket created with private access policies.
- [ ] **Storage bucket/private access verified:** Public direct bucket listing disabled.
- [ ] **Signed URL/backend media access verified:** Evidence streamed securely through verified API endpoints.
- [ ] **File upload limits configured:** `MAX_IMAGE_SIZE_BYTES`, `MAX_VIDEO_SIZE_BYTES`, `MAX_DOCUMENT_SIZE_BYTES` set.
- [ ] **Production domain configured:** DNS A/CNAME records pointed.
- [ ] **HTTPS enabled:** TLS certificates active on both frontend and backend.
- [ ] **No development secrets committed:** Secret scanning verified 0 credentials in git.
- [ ] **Database migrations ready:** All Alembic revisions verified up to head.

---

## 3. Recommended Deployment Order

Deploy components in this exact sequence to ensure reliable operation:

```
1. DATABASE         Provision managed PostgreSQL database
   │
2. OBJECT STORAGE   Provision private S3 / Cloudflare R2 bucket & IAM keys
   │
3. BACKEND          Deploy FastAPI container/process with environment variables
   │
4. MIGRATIONS       Execute 'alembic upgrade head' against the production database
   │
5. ADMIN BOOTSTRAP  Execute 'python -m app.db.create_admin' to create initial admin
   │
6. FRONTEND         Deploy Next.js application with NEXT_PUBLIC_* variables
   │
7. SMOKE TESTING    Execute the post-deployment verification checklist
```

---

## 4. Environment Variable Reference

Review [`.env.example`](./.env.example) for reference. All required variables:

### DATABASE
- `DATABASE_URL`: PostgreSQL async connection string (`postgresql+asyncpg://user:pass@host:5432/dbname?ssl=require`).
- `DB_ECHO`: Boolean to toggle raw SQL logging (`false` in production).
- `DB_POOL_SIZE`: Database connection pool size (default `5`).
- `DB_MAX_OVERFLOW`: Max overflow connections beyond pool size (default `10`).
- `DB_TIMEOUT`: Connection timeout in seconds (default `10`).

### AUTH
- `SECRET_KEY`: Cryptographic signing secret for JWT tokens (Required in production, min 32 characters).
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT token validity lifespan (default `10080` = 7 days).
- `ADMIN_EMAIL`: Default email for admin CLI bootstrap.
- `ADMIN_USERNAME`: Default username for admin CLI bootstrap.
- `ADMIN_PASSWORD`: Default password for admin CLI bootstrap (or prompted interactively).
- `ADMIN_NAME`: Full name for admin account.

### BACKEND
- `BACKEND_HOST`: Server bind host (`0.0.0.0`).
- `BACKEND_PORT`: Server listening port (`8000`).
- `API_V1_STR`: API route prefix (`/api/v1`).
- `LOG_LEVEL`: Logging verbosity level (`INFO`, `WARNING`, `ERROR`).

### FRONTEND
- `NEXT_PUBLIC_API_URL`: Public-facing backend API URL (e.g. `https://api.citizenreport.gov.bd/api/v1`).
- `NEXT_PUBLIC_APP_URL`: Public-facing web application URL (e.g. `https://citizenreport.gov.bd`).

### CORS
- `CORS_ORIGINS`: Comma-separated or JSON array of authorized web origins (e.g. `https://citizenreport.gov.bd,https://admin.citizenreport.gov.bd`). Wildcard `*` is prohibited.

### STORAGE
- `STORAGE_BACKEND`: Object storage driver (`s3` in production, `local` for dev).
- `STORAGE_LOCAL_ROOT`: Local directory path for file storage if using local backend.
- `STORAGE_BUCKET`: Private S3 bucket name.
- `STORAGE_ENDPOINT`: S3 endpoint URL (for Cloudflare R2, Wasabi, MinIO, or AWS S3).
- `STORAGE_REGION`: AWS/S3 storage region.
- `STORAGE_ACCESS_KEY`: IAM access key ID.
- `STORAGE_SECRET_KEY`: IAM secret access key.
- `MAX_IMAGE_SIZE_BYTES`: Maximum image upload size (default `10485760` = 10 MB).
- `MAX_VIDEO_SIZE_BYTES`: Maximum video upload size (default `52428800` = 50 MB).
- `MAX_DOCUMENT_SIZE_BYTES`: Maximum PDF/document upload size (default `20971520` = 20 MB).
- `MAX_MEDIA_PER_REPORT`: Maximum evidence files allowed per report (default `10`).

### OTHER REQUIRED CONFIGURATION
- `ENVIRONMENT`: Runtime environment mode (`production`, `staging`, `development`).
- `PROJECT_NAME`: Platform display name.
- `VERSION`: Application version string.
- `ENABLE_DOCS`: Toggle Swagger/OpenAPI documentation (`false` default in production).

---

## 5. Admin Bootstrap Instructions

To safely create or update the primary administrator account without public registration endpoints:

```bash
cd backend
source .venv/bin/activate
python -m app.db.create_admin \
  --email "lead-admin@citizenreport.gov.bd" \
  --username "lead_admin" \
  --password "YourSecureProductionPassword2026!" \
  --name "Lead Platform Administrator"
```

**Security Guarantees:**
- If `--password` is omitted in an interactive terminal, the script securely prompts via `getpass` without echoing characters.
- In `ENVIRONMENT=production`, fallback default passwords are strictly rejected.
- Admin credentials are never stored in git or public registration APIs.

---

## 6. Database Migration Handoff

The platform uses **Alembic** for safe, versioned database schema management.

### Apply Migrations to Production
```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

### Verify Migration Lineage
```bash
alembic current
alembic history
```

### Rollback (If needed)
```bash
alembic downgrade -1
```

> [!WARNING]
> Never execute raw `DROP TABLE` or destructive SQL scripts directly in production. All schema modifications must go through Alembic revisions.

---

## 7. Storage Handoff

- **Binary File Isolation:** PostgreSQL stores strictly metadata (filenames, MIME types, byte sizes, storage keys). Binary files reside in object storage.
- **MIME & Magic-Byte Validation:** All uploads are inspected at the byte header level (JPEG, PNG, WebP, PDF, MP4). Executable files (`.exe`, `.sh`, `.php`, etc.) and mismatched content types are rejected with HTTP 400.
- **Access Control:** Public users can stream evidence only for `APPROVED` reports. Private drafts and unapproved report media are restricted to the report owner and authorized administrators.

---

## 8. Deployment Platform Guidance

| Component | Recommended Target | Build Command | Start Command | Health Endpoint |
|---|---|---|---|---|
| **Backend** | Container / Python 3.12 VM | `pip install -r requirements.txt` | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4` | `GET /api/v1/health` |
| **Frontend** | Node.js 20+ / Next.js host | `npm ci && npm run build` | `npm run start -p 3000` | `GET /` |
| **Database** | Managed PostgreSQL 15+ | N/A | Managed service | Monitored by backend probe |
| **Storage** | S3 / Cloudflare R2 | N/A | Managed service | Validated via upload API |

---

## 9. Post-Deployment Smoke Test Checklist

Execute these 22 steps on the deployed production environment:

1. [ ] **Open production website:** Verify home page loads over HTTPS with 200 OK.
2. [ ] **Register normal user:** Register citizen account via `/register`.
3. [ ] **Login:** Authenticate and verify JWT cookie/storage is established.
4. [ ] **Create a report:** Open `/reports/create`, fill in title, description, category, and location.
5. [ ] **Save draft:** Verify draft is created with status `DRAFT`.
6. [ ] **Submit report:** Submit the report and confirm status transitions to `SUBMITTED`.
7. [ ] **Login as admin:** Sign in with the bootstrapped admin credentials.
8. [ ] **Review submitted report:** Open `/admin/reports` and move report to `UNDER_REVIEW`.
9. [ ] **Approve report:** Add moderation notes and approve the report (`APPROVED`).
10. [ ] **Confirm public feed:** Open home page `/` unauthenticated and verify approved report appears.
11. [ ] **Test anonymous report:** Submit report with "Submit Anonymously" checked.
12. [ ] **Confirm anonymous identity hidden:** Verify public view shows "Anonymous Citizen" and hides username/email.
13. [ ] **Upload evidence:** Attach an image/PDF to a draft report.
14. [ ] **Verify authorized evidence access:** Ensure evidence displays on report page and unauthorized users cannot stream drafts.
15. [ ] **Add comment:** Post a community comment on the approved report.
16. [ ] **React:** Toggle reaction (`SUPPORT`, `URGENT`, `VERIFIED`) and check count updates.
17. [ ] **Flag content:** Submit a safety flag on a report or comment.
18. [ ] **Verify notification behavior:** Check navbar notification bell for status change alerts.
19. [ ] **Test Bangla/English switch:** Toggle language in header and check all UI labels update.
20. [ ] **Test mobile layout:** Inspect layout on mobile viewport width (375px).
21. [ ] **Logout:** Click Logout and verify auth state is cleared.
22. [ ] **Verify protected routes:** Confirm direct access to `/dashboard` or `/admin` redirects to `/login`.

---

## 10. Security Launch Checklist

- [x] **HTTPS Enforcement:** TLS certificates active; `Strict-Transport-Security` header sent in production.
- [x] **No Secrets Exposed:** `.env` files not committed; client bundle only receives `NEXT_PUBLIC_*` variables.
- [x] **Password Hashing:** Passwords hashed using `bcrypt` with unique salts.
- [x] **JWT Security:** Signed with SHA-256 HMAC using high-entropy secret; expired/tampered tokens rejected.
- [x] **IDOR Guards:** Report edits, evidence deletion, and notifications verified against `current_user.id`.
- [x] **CORS Origin Filtering:** Prohibits wildcard `*` with credentials; exact origins whitelist parsed safely.
- [x] **Admin Privileges:** RBAC checks (`require_admin`) enforced on all administrative endpoints.
- [x] **Anonymous Reporter Shield:** DB stores user ID internally for moderation audit, but public serializers completely strip reporter identifiers.
- [x] **File Validation:** Magic-byte validation, extension whitelist, and size caps enforced on all evidence uploads.
- [x] **Safe Error Masks:** Unhandled server exceptions return generic HTTP 500 JSON without stack traces.

---

## 11. Monitoring & Operations

### Health Probe Endpoint
- **URL:** `GET /api/v1/health`
- **Healthy Response (HTTP 200):**
  ```json
  {
    "status": "ok",
    "project": "Bangladesh Citizen Report Platform",
    "version": "0.1.0",
    "environment": "production",
    "database": "connected"
  }
  ```
- **Degraded Response (HTTP 503):**
  ```json
  {
    "status": "degraded",
    "project": "Bangladesh Citizen Report Platform",
    "version": "0.1.0",
    "environment": "production",
    "database": "unavailable"
  }
  ```

### Operational Log Monitoring
- Backend logs structured output to stdout: `%(asctime)s [%(levelname)s] %(name)s: %(message)s`.
- Monitor for `[ERROR]` entries to detect unhandled exceptions or database connectivity degradation.

---

## 12. Backup & Recovery Notes

### Database Backups
- **Recommended:** Enable automated daily snapshots and Point-In-Time-Recovery (PITR) with a 7-to-30 day retention window on your managed PostgreSQL provider (e.g., AWS RDS, Supabase, Neon).
- **Currently Configured:** Schema revisions version-controlled in Alembic with reversible downgrade scripts.

### Evidence & Object Storage Durability
- **Recommended:** Enable S3 Versioning and Cross-Region Replication on the evidence bucket to protect against accidental deletion.
- **Currently Configured:** Files stored under sanitized random UUID keys in `data/storage` (local) or S3 bucket.

### Environment Secrets Backup
- Store production `.env` files in a dedicated secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault, Doppler, or cloud hosting environment manager).

---

## 13. Local Verification & Development Commands

### Run Full Test Suite (80 Tests)
```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Frontend Type-Check, Lint & Build
```bash
cd frontend
npm run lint
npm run type-check
npm run build
```



