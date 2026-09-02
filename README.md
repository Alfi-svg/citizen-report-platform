# Bangladesh Citizen Report Platform — Production Deployment Guide

> **Current Stage:** `STEP 12 — Production Deployment Preparation`

---

## 1. System Overview & Architecture

The **Bangladesh Citizen Report Platform** is an enterprise-grade citizen reporting and community verification platform. It allows verified citizens to submit incident reports with multimedia evidence (images, documents, videos), participate in civic discussion, endorse verified issues, flag policy violations, and track live investigation progress.

```
[Public Browser / Citizen Client]
        |
        |  (JSON API / Bearer Token)
        v
+---------------------------------------------------------------+
|                       FastAPI Backend                         |
|  - Structured Logging & Health Probes (/api/v1/health)        |
|  - HTTP Security Headers (CSP, HSTS, X-Frame-Options)         |
|  - Environment-Driven CORS (Multi-origin support)             |
|  - Strict Role-Based Access Control (USER vs ADMIN)           |
|  - Anonymous Whistleblower Masking                            |
|  - Global Safe Exception Handler (No traceback leakage)       |
+---------------+-------------------------------+---------------+
                |                               |
                v                               v
+-------------------------------+ +-----------------------------+
|    PostgreSQL Relational DB   | |   S3-Compatible Object Store|
|  * Users & Auth Records       | |  * AWS S3 / Cloudflare R2   |
|  * Categories & Seed Data     | |  * Encrypted binary storage |
|  * Incident Reports           | |  * Magic-byte validation    |
|  * Moderation Audit History   | |  * Sanitized storage paths  |
|  * Comments & Reactions       | +-----------------------------+
|  * Safety Review Flags        |
|  * In-App Notifications       |
+-------------------------------+
```

---

## 2. Environment Variables & Secret Separation

The platform distinguishes between **SERVER-ONLY Secrets** and **PUBLIC Browser Variables**.

### Server-Only Secrets (Backend / Runtime Container)
| Variable | Description | Example / Required Format |
|---|---|---|
| `ENVIRONMENT` | Deployment stage | `production`, `staging`, `development` |
| `SECRET_KEY` | 32+ character secret for JWT signing | Generate via `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifespan | `10080` (7 days) |
| `DATABASE_URL` | PostgreSQL async connection string | `postgresql+asyncpg://user:password@host:5432/citizen_db?ssl=require` |
| `CORS_ORIGINS` | Comma-separated or JSON list of authorized web origins | `https://citizenreport.gov.bd,https://admin.citizenreport.gov.bd` |
| `STORAGE_BACKEND` | Storage driver | `s3` (for cloud) or `local` (for development) |
| `STORAGE_ENDPOINT` | S3-compatible API endpoint | `https://<account-id>.r2.cloudflarestorage.com` or `https://s3.<region>.amazonaws.com` |
| `STORAGE_BUCKET` | Dedicated bucket name | `citizen-report-evidence-prod` |
| `STORAGE_REGION` | S3 region | `ap-southeast-1` or `auto` |
| `STORAGE_ACCESS_KEY` | Cloud storage access key | `AKIA...` |
| `STORAGE_SECRET_KEY` | Cloud storage secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCY...` |
| `LOG_LEVEL` | Python logging verbosity | `INFO`, `WARNING`, `ERROR` |
| `ENABLE_DOCS` | Toggle Swagger/OpenAPI docs | `false` (default in production) |

### Public Variables (Frontend Client Bundle)
| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL for FastAPI backend API | `https://api.citizenreport.gov.bd/api/v1` |
| `NEXT_PUBLIC_APP_URL` | Canonical public web URL | `https://citizenreport.gov.bd` |

---

## 3. Production Deployment Step-by-Step

### Step 3.1 — PostgreSQL Provisioning & Migrations
1. Provision a PostgreSQL 15+ database instance (AWS RDS, Supabase, Neon, Railway, or self-hosted).
2. Configure your connection string in `DATABASE_URL` with `postgresql+asyncpg://` driver prefix and SSL enabled (`?ssl=require`).
3. Run database migrations to apply all tables, indexes, and constraints:
   ```bash
   cd backend
   source .venv/bin/activate
   alembic upgrade head
   ```

### Step 3.2 — Initial Administrator Bootstrap
Create the primary platform administrator securely without hardcoded credentials or public registration endpoints:
```bash
cd backend
source .venv/bin/activate
python -m app.db.create_admin \
  --email "lead-admin@citizenreport.gov.bd" \
  --username "lead_admin" \
  --password "YourStrongProductionPassword2026!" \
  --name "Lead Platform Administrator"
```
*(If `--password` is omitted in an interactive terminal, the script securely prompts via `getpass`)*.

### Step 3.3 — S3 Object Storage Provisioning
1. Create a private bucket (e.g., `citizen-report-evidence-prod`).
2. Generate IAM access credentials restricted to `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` for that bucket.
3. Configure `STORAGE_BACKEND=s3`, `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, and `STORAGE_SECRET_KEY`.

### Step 3.4 — Backend Deployment & Start Command
Deploy the FastAPI backend container or process:
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --proxy-headers --forwarded-allow-ips='*'
```

### Step 3.5 — Frontend Next.js Deployment & Start Command
Build and start the Next.js production server:
```bash
cd frontend
npm ci
npm run build
npm run start -p 3000
```

---

## 4. Health Checks & Observability

### Health Probe (`GET /api/v1/health`)
Used by load balancers, Kubernetes liveness/readiness probes, and monitoring services:
- **HTTP 200 OK** (Database reachable):
  ```json
  {
    "status": "ok",
    "project": "Bangladesh Citizen Report Platform",
    "version": "0.1.0",
    "environment": "production",
    "database": "connected"
  }
  ```
- **HTTP 503 Service Unavailable** (Database unreachable):
  ```json
  {
    "status": "degraded",
    "project": "Bangladesh Citizen Report Platform",
    "version": "0.1.0",
    "environment": "production",
    "database": "unavailable"
  }
  ```
*Guaranteed Zero Disclosure: The health probe never discloses host IPs, credentials, or SQL connection strings.*

---

## 5. Security & Verification Checklist

- [x] **No Secrets in Source Control:** `.env*`, `.venv`, and certificates are strictly `.gitignore`d.
- [x] **Strict Public Visibility:** Public news feed and search display **only** `APPROVED` reports.
- [x] **Anonymous Whistleblower Privacy:** Reporter identity is masked on public APIs and interfaces.
- [x] **CORS Guard:** Wildcard `*` is prohibited when credentials are enabled. Comma-delimited and JSON origin arrays are safely parsed.
- [x] **HTTP Security Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security` in production.
- [x] **MIME & Magic-Byte Validation:** Evidence uploads verified at header and byte level before storing in cloud storage.
- [x] **IDOR Protection:** Ownership validation on drafts, evidence attachments, comments, and notifications.
- [x] **Role Demotion Protection:** Admins cannot demote themselves or deactivate the last active administrator.
- [x] **Category Relational Integrity:** Soft-deactivates categories referenced by existing reports to preserve history.
- [x] **Automated Tests:** **80 backend test scenarios passing** (`pytest -v`).
- [x] **Frontend Quality:** TypeScript compilation (`tsc --noEmit`), ESLint, and Next.js production build passing with zero errors.

---

## 6. Ready Now vs. User Must Configure in Cloud

| Resource / Setting | Status | Action Required by Operator |
|---|---|---|
| Application Code & APIs | **READY** | Deploy backend & frontend containers |
| Database Migrations | **READY** | Run `alembic upgrade head` against target DB |
| Seed Incident Categories | **READY** | Automatically seeded in migration revision 1 |
| Admin Bootstrap CLI | **READY** | Run `python -m app.db.create_admin` |
| Security Headers & CORS | **READY** | Set `CORS_ORIGINS` to production domain |
| Production PostgreSQL DB | *OPERATOR PROVIDED* | Provision managed PostgreSQL & set `DATABASE_URL` |
| S3 Object Storage Bucket | *OPERATOR PROVIDED* | Provision S3/R2 bucket & set `STORAGE_*` keys |
| Production Domain & SSL | *OPERATOR PROVIDED* | Point DNS A/CNAME and configure TLS certificates |

---

## 7. Rollback & Maintenance Procedures

### Database Rollback
To roll back the most recent migration revision:
```bash
cd backend
source .venv/bin/activate
alembic downgrade -1
```

### Application Rollback
Revert the container tag or Git commit to the previous stable release hash. No destructive database alterations are performed during application startup.


