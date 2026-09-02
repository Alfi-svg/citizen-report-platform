# Bangladesh Citizen Report Platform

> **Current Stage:** `STEP 9 — Notifications & User Activity`

---

## 1. Project Overview

The **Bangladesh Citizen Report Platform** is a secure, production-grade citizen reporting system designed to empower citizens to submit community incident reports accompanied by multimedia supporting evidence (photos, videos, documents). Reports undergo administrative moderation and verification before publication to the public news feed with interactive citizen discussion, endorsements, safety controls, and real-time in-app activity notifications.

### Core Architectural Principles
- **Strict Public Visibility Policy:** Public feeds, comments, reactions, and APIs display **ONLY** reports in `APPROVED` status. Unapproved reports (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `REJECTED`, `ARCHIVED`) return `404 Not Found` across all public endpoints.
- **Database-Backed In-App Notifications:** Lightweight, transactional notification system alerting citizens whenever their incident reports are submitted, placed under review, approved, rejected, or updated by administrators.
- **Safety Flags as Review Signals:** A flag submitted by a citizen is an allegation/request for moderation review. A flag **never automatically marks content as false, illegal, or malicious**; human administrators make final moderation determinations.
- **Privacy by Design:** Supports anonymous reporting where reporter identity is masked on public interfaces. Notifications, flagger identities, and private moderation notes are **strictly confidential** and isolated per user.
- **Cloud-Compatible Object Storage:** PostgreSQL stores **only file metadata**; all binary evidence files reside in dedicated object storage via a provider-agnostic abstraction layer.

---

## 2. In-App Notification Architecture (Step 9)

```
[Incident Event / Moderation Action]
  - Report Submission
  - Admin Moves to UNDER_REVIEW
  - Admin APPROVES Report
  - Admin REJECTS Report
  - Admin Requests Information
  - Comment Moderation Action
  - Content Flag Reviewed
         |
         v
+---------------------------------------------------------------+
|                 Notification Service Helper                   |
|                                                               |
|  * `notify_report_owner(db, report, type, title, message)`    |
|  * `create_notification(db, user_id, type, title, message)`   |
|  * Transactionally committed alongside domain event           |
+-------------------------------+-------------------------------+
                                |
                                v
                +-------------------------------+
                |      notifications Table      |
                |                               |
                | * id (UUID PK)                |
                | * user_id (FK CASCADE)        |
                | * type (Enum NotificationType)|
                | * title (String)              |
                | * message (Text)              |
                | * report_id (FK CASCADE)      |
                | * comment_id (FK CASCADE)     |
                | * read_at (Nullable DateTime) |
                | * created_at (DateTime)       |
                +---------------+---------------+
                                |
                                v
+---------------------------------------------------------------+
|                    Authenticated User UI                      |
|  * Navbar Bell Icon with dynamic unread badge (`🔔 3`)        |
|  * Interactive quick notification dropdown                    |
|  * Dedicated Notifications Center (`/notifications`)          |
|  * Mark as Read & Mark All as Read actions                    |
+---------------------------------------------------------------+
```

---

## 3. Supported Notification Types & Lifecycle

| Notification Type | Trigger Event | Semantic Badge / Icon |
| :--- | :--- | :--- |
| `REPORT_SUBMITTED` | Citizen submits draft incident report for review | 🔵 Blue (`Submitted`) |
| `REPORT_UNDER_REVIEW` | Admin begins active investigation and review | 🟡 Amber (`Under Review`) |
| `REPORT_APPROVED` | Report approved and verified for public news feed | 🟢 Emerald (`Approved & Verified`) |
| `REPORT_REJECTED` | Report reviewed and rejected with reason | 🔴 Red (`Moderation Decision`) |
| `REPORT_NEEDS_MORE_INFORMATION` | Moderator requests additional evidence/details | 🟣 Purple (`More Info Needed`) |
| `REPORT_ARCHIVED` | Report moved to archive | ⚪ Gray (`Archived`) |
| `COMMENT_MODERATED` | Inappropriate comment hidden or removed | 🟠 Orange (`Comment Moderation`) |
| `FLAG_REVIEWED` | Submitted safety flag reviewed by administrator | 🔷 Cyan (`Flag Inspected`) |

---

## 4. API Endpoints

### Notifications Endpoints (`/api/v1/notifications`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Authenticated | Paginated list of notifications for current user (supports `unread_only` filter) |
| `GET` | `/api/v1/notifications/unread-count` | Authenticated | Returns unread notification count (`{ "unread_count": int }`) |
| `PATCH` | `/api/v1/notifications/{id}/read` | Authenticated | Marks a specific notification as read (strictly owned by current user) |
| `PATCH` | `/api/v1/notifications/read-all` | Authenticated | Marks all unread notifications of the current user as read |

### Safety & Flagging Endpoints (`/api/v1/flags`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reports/{id}/flags` | Authenticated | Submit safety/content flag for an `APPROVED` report |
| `POST` | `/api/v1/comments/{id}/flags` | Authenticated | Submit safety/content flag for a visible comment |
| `GET` | `/api/v1/admin/flags` | Admin | List paginated flag queue with target type and status filters |
| `PATCH` | `/api/v1/admin/flags/{id}` | Admin | Update flag status (`REVIEWED`, `DISMISSED`, `ACTION_TAKEN`) |

### Community Interaction Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/public/reports/{id}/comments` | Public | Paginated list of visible comments on an `APPROVED` report |
| `GET` | `/api/v1/public/reports/{id}/reactions` | Public / Auth | Aggregated reaction counts (`SUPPORT`, `IMPORTANT`) |
| `POST` | `/api/v1/reports/{id}/comments` | Authenticated | Post a comment on an `APPROVED` report |
| `DELETE` | `/api/v1/comments/{comment_id}` | Owner / Admin | Delete own comment or remove comment as administrator |
| `POST` | `/api/v1/reports/{id}/reactions` | Authenticated | Toggle reaction (`SUPPORT` or `IMPORTANT`) on an `APPROVED` report |
| `DELETE` | `/api/v1/reports/{id}/reactions/{type}` | Authenticated | Remove a specific reaction |

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
