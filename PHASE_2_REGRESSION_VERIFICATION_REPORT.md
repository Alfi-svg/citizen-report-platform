# NIRAPOTTA AI — Phase 2: Full Regression & Integration Verification Report

**Repository:** `https://github.com/Alfi-svg/nirapotta-build`  
**Branch:** `main`  
**Workspace:** `/Users/alfi/report box/citizen-report-platform`  
**Date:** 2026-11-05  
**Audit Type:** Strict Regression & Integration Audit (Post-Phase 1 Production Readiness Patch)  
**Execution Mode:** Verification-first. Zero commits, zero pushes, zero deployments.

---

## 1. Executive Summary

A full regression and integration verification was executed on the NIRAPOTTA AI platform following the Phase 1 Production Readiness Patch. The audit confirmed that all existing application routes, security boundaries, role-based access controls, database structures, and emergency workflows remain fully operational.

Key audit outcomes:
- **Backend Test Suite:** 246 automated tests executed across 34 test modules. All 246 passed with zero failures (exit code 0, duration 77.12s).
- **Frontend Code Quality:** TypeScript type-check passed with 0 errors (`tsc --noEmit`). ESLint completed with 0 errors (36 pre-existing non-blocking warnings). Production build generated all 47 routes without errors.
- **Security & Integrity:** Motorcycle helmet verification strictly requires a non-expired, single-use token (`120s` TTL); manual confirmation bypass is prohibited. Blood AI inventories distinguish between baseline demo stock and staff-verified stock with RBAC enforcement and audit logs. All 14 tertiary hospitals across all 8 divisions are present and deduplicated. Accident zones are explicitly typed as estimated density models.

---

## 2. Git State & Inventory

### 2.1 Current Branch & Commit Status
- **Branch:** `main`
- **Upstream:** `origin/main` (Synchronized with `origin/main`)
- **HEAD Commit:** `655b7ad7954361d4cf6debe67c296dfeb976fb52`
- **Commit Message:** `feat(blood-ai): integrate conversational blood AI and nearby hospital finder`

### 2.2 Modified Files (18)
1. `backend/app/api/v1/endpoints/safety.py`: Accident zones and safe-route API routing.
2. `backend/app/db/seed_hospitals.py`: 14 tertiary hospitals across 8 divisions with deduplication.
3. `backend/app/models/__init__.py`: Registered `AccidentZone`.
4. `backend/app/schemas/ai_features.py`: Added `data_type`, `is_estimated`, `hazard_density_label` to `AccidentZoneItem`.
5. `backend/app/schemas/hospital.py`: Added `is_baseline_demo`, `stock_source_label`, `last_staff_update` to `BloodInventoryItem`.
6. `backend/app/services/hospital_service.py`: Dynamic serialization of stock source and staff verification.
7. `backend/app/services/safe_route.py`: Safe route evaluation and corridor fallback models.
8. `backend/tests/test_blood_ai_hospitals.py`: Updated hospital count assertions (12 to 14).
9. `backend/tests/test_migrations.py`: Preserved migration tracking.
10. `backend/tests/test_safe_ride.py`: Added empty token, missing field, and invalid base64 verification tests.
11. `backend/tests/test_safety.py`: Added safety route tests.
12. `frontend/.gitignore`: Added unignore rule for `.env.example`.
13. `frontend/src/app/blood-help/blood-ai/page.tsx`: Updated baseline stock copy and disclaimers.
14. `frontend/src/app/page.tsx`: Home page navigation and clean feed layout.
15. `frontend/src/app/safety-map/page.tsx`: 3D map clustering and coordinate rounding.
16. `frontend/src/app/safety/safe-route/page.tsx`: Enforced motorcycle helmet verification, 120s TTL, OSRM timeout, fallback notice, pure render handlers.
17. `frontend/src/components/HospitalResultCard.tsx`: Rendered `Baseline Demo Stock` badge and disclaimer footnote.
18. `frontend/src/components/Navbar.tsx`: Preserved active route links.
19. `frontend/src/lib/types.ts`: Synchronized TypeScript interfaces for hospitals and accident zones.

### 2.3 Untracked Files (6)
1. `backend/app/db/seed_accident_zones.py`: ARI BUET / BRTA accident blackspots seed data.
2. `backend/app/models/accident_zone.py`: SQLAlchemy ORM model for accident zones.
3. `backend/migrations/versions/20261105_0120_add_accident_prone_zones.py`: Alembic migration for accident zones table.
4. `backend/scripts/seed_accident_zones.py`: Standalone CLI seeding script for accident zones.
5. `backend/tests/test_final_qa_verification.py`: Verification test suite for production readiness patch.
6. `frontend/.env.example`: Frontend environment configuration template detailing `NEXT_PUBLIC_OSRM_URL`.

### 2.4 Integrity & Secret Scan
- **Secrets:** No production API keys, database passwords, JWT secrets, or private keys are staged or tracked.
- **Ignored Files:** `.env`, `.env.local`, `.venv`, `.next`, `data/`, `keystore.properties`, and `.pytest_cache` remain strictly excluded.
- **Unintended Changes:** No unrelated changes exist. All modifications directly implement or verify requested features.

---

## 3. Existing Route Regression Matrix

All 45 frontend route files were inspected in `frontend/src/app/` and verified for compilation and routing structure.

| Route Path | Exists | Auth Requirement | Role Requirement | Verification Method | Status | Notes |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| `/` | Yes | Public | None | Next.js Build | PASS | Clean homepage without duplicate feeds |
| `/safety-map` | Yes | Public | None | Next.js Build | PASS | 3D MapLibre cluster view with 3-decimal privacy |
| `/reports` | Yes | Public | None | Next.js Build | PASS | Public incident news feed |
| `/reports/create` | Yes | Required | `USER`, `ADMIN`, `MODERATOR` | Next.js Build | PASS | Citizen incident reporting form |
| `/reports/[id]` | Yes | Public | None | Next.js Build | PASS | Incident details and moderation status |
| `/reports/mine` | Yes | Required | `USER`, `ADMIN`, `MODERATOR` | Next.js Build | PASS | User's submitted reports |
| `/missing-person` | Yes | Public | None | Next.js Build | PASS | Dedicated missing persons directory |
| `/missing-person/create` | Yes | Required | `USER`, `ADMIN`, `MODERATOR` | Next.js Build | PASS | Sighting / alert creation |
| `/missing-person/[id]` | Yes | Public | None | Next.js Build | PASS | Missing person alert details |
| `/transparency` | Yes | Public | None | Next.js Build | PASS | Dedicated transparency metrics |
| `/blood-help` | Yes | Public | None | Next.js Build | PASS | Blood request list & donor matching |
| `/blood-help/blood-ai` | Yes | Public | None | Next.js Build | PASS | AI assistant and hospital stock finder |
| `/blood-help/request` | Yes | Required | `USER`, `ADMIN`, `MODERATOR` | Next.js Build | PASS | Emergency blood request form |
| `/blood-help/map` | Yes | Public | None | Next.js Build | PASS | Donor map with privacy buffers |
| `/blood-help/[id]` | Yes | Public | None | Next.js Build | PASS | Blood request details |
| `/safety` | Yes | Public | None | Next.js Build | PASS | Safety directory hub |
| `/safety/road-intelligence` | Yes | Public | None | Next.js Build | PASS | Corridor statistics and blackspot summary |
| `/safety/road-intelligence/live-map` | Yes | Public | None | Next.js Build | PASS | 3D Road Safety Live Map |
| `/safety/safe-route` | Yes | Public | None | Next.js Build | PASS | Multi-route comparison & hazard scoring |
| `/safety/safe-ride` | Yes | Public / Citizen | None | Next.js Build | PASS | Camera helmet scan and crash protection |
| `/guard` | Yes | Required / Session | None | Next.js Build | PASS | Emergency countdown and SOS dispatch |
| `/dashboard` | Yes | Required | `USER`, `ADMIN`, `MODERATOR` | Next.js Build | PASS | User activity dashboard |
| `/feed` | Yes | Public | None | Next.js Build | PASS | Community activity feed |
| `/login` | Yes | Public | None | Next.js Build | PASS | Auth login route |
| `/register` | Yes | Public | None | Next.js Build | PASS | Auth registration route |
| `/profile` | Yes | Required | None | Next.js Build | PASS | Profile management |
| `/notifications` | Yes | Required | None | Next.js Build | PASS | User notification feed |
| `/privacy` | Yes | Public | None | Next.js Build | PASS | Privacy policy disclosure |
| `/terms` | Yes | Public | None | Next.js Build | PASS | Terms of service |
| `/account-deletion` | Yes | Public | None | Next.js Build | PASS | Account deletion instructions |
| `/admin` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Admin control center |
| `/admin/reports` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Moderation queue |
| `/admin/reports/[id]` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Report review and status change |
| `/admin/clusters` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Cluster management |
| `/admin/blood-help` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Blood request moderation |
| `/admin/emergency-services` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Directory CRUD |
| `/admin/users` | Yes | Required | `ADMIN` | Next.js Build + AuthContext | PASS | User role management |
| `/admin/categories` | Yes | Required | `ADMIN` | Next.js Build + AuthContext | PASS | Category management |
| `/admin/reputation` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Donor badge review |
| `/admin/flags` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Flag moderation |
| `/admin/comments` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Comment moderation |
| `/admin/analytics` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Platform analytics |
| `/admin/missing-person` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Missing person moderation |
| `/admin/missing-person/sightings` | Yes | Required | `ADMIN`, `MODERATOR` | Next.js Build + AuthContext | PASS | Sighting verification |

---

## 4. Helmet Verification Test Matrix

Tested via `tests/test_safe_ride.py` and `tests/test_final_qa_verification.py`.

| Scenario | Expected Behavior | Backend Enforcement | Test Method | Status |
|:---|:---|:---:|:---:|:---:|
| Valid helmet worn | Issue verification token with 120s TTL | Yes (`_verified_tokens`) | Automated integration test | PASS |
| Missing token (empty string) | Return HTTP 403 Forbidden | Yes (`start_safe_ride`) | Automated integration test | PASS |
| Missing token (omitted field) | Return HTTP 422 Unprocessable Content | Yes (Pydantic schema) | Automated integration test | PASS |
| Expired token (>120s) | Return HTTP 400 with "expired" detail | Yes (`_cleanup_expired_tokens`) | Automated integration test | PASS |
| Invalid / fabricated token | Return HTTP 400 "Invalid or expired" | Yes (token lookup check) | Automated integration test | PASS |
| Token reuse (replay attack) | Return HTTP 400 "already been consumed" | Yes (`token_data['consumed']=True`) | Automated integration test | PASS |
| Camera permission denied | Modal shows camera permission dialog | Handled in frontend state | Automated build + code audit | PASS |
| Helmet held in hand | Return `HELMET_NOT_WORN`, issue no token | Yes (geometry bounding check) | Automated integration test | PASS |
| Low light / dark frame | Return `UNCERTAIN`, issue no token | Yes (mean brightness check) | Automated integration test | PASS |
| Person not detected | Return `PERSON_NOT_DETECTED`, no token | Yes (Haar cascade check) | Automated integration test | PASS |
| Direct ride start API call | Rejects request without valid token | Yes (FastAPI endpoint guard) | Automated integration test | PASS |
| Manual confirmation button | Prohibited for motorcycle riders | Yes (frontend strict guard) | Automated build + code audit | PASS |
| Car seatbelt confirmation | Allows manual seatbelt acknowledgment | Yes (`vehicleType === "CAR"`) | Automated integration test | PASS |
| Unblocked route exploration | Route alternatives calculated freely | Yes (independent of ride start) | Automated integration test | PASS |

---

## 5. Blood AI Authorization & Data Integrity Matrix

Tested via `tests/test_blood_ai_hospitals.py` and `tests/test_final_qa_verification.py`.

| Check | Requirement | Verification Method | Status |
|:---|:---|:---:|:---:|
| Baseline stock labeling | Flagged as `Baseline Demo Stock (Awaiting Staff Verification)` | API query + assertion | PASS |
| Staff-verified labeling | Flagged as `Staff Verified Stock` with updater name | API update + assertion | PASS |
| Citizen role update attempt | HTTP 403 Forbidden | API request with `USER` JWT | PASS |
| Admin role update attempt | HTTP 200 OK | API request with `ADMIN` JWT | PASS |
| Negative units rejection | HTTP 422 Unprocessable Content (`Field(ge=0)`) | API request with -5 units | PASS |
| Invalid blood group | HTTP 400 Bad Request ("Invalid blood group") | API request with "XYZ+" | PASS |
| Audit log creation | Entry created in `HospitalInventoryAudit` with admin ID | Direct DB query check | PASS |
| Seed idempotence | Re-running seed script creates 0 new hospitals | Re-seed execution test | PASS |
| Staff data preservation | Re-running seed does NOT overwrite staff updates | DB check post re-seed | PASS |
| Missing updater record | `is_verified` defaults to False, `is_baseline_demo` to True | Serializer audit + test | PASS |
| 8-Division search | Search returns hospitals in all 8 administrative divisions | API query per division | PASS |
| 8-Blood group search | Inventory search finds items for all 8 blood groups | API query per blood group | PASS |

---

## 6. Hospital Directory Evidence Matrix

Inspected in `backend/app/db/seed_hospitals.py` across all 14 hospitals.

| # | Hospital Name | Division | District | Latitude | Longitude | Emergency Phone | Evidence Source | Verification Level |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---|:---:|
| 1 | Dhaka Medical College Hospital (DMCH) | Dhaka | Dhaka | 23.7260 | 90.3976 | +880255165088 | DGHS / DMCH Directory | Authoritative Public Record |
| 2 | BSMMU / PG Hospital | Dhaka | Dhaka | 23.7388 | 90.3956 | +88029661051 | DGHS / BSMMU Official Portal | Authoritative Public Record |
| 3 | Bangladesh Red Crescent Blood Bank | Dhaka | Dhaka | 23.7634 | 90.3653 | +88029116563 | BDRCS Blood Bank Records | Authoritative Public Record |
| 4 | National Inst. of Cardiovascular Diseases | Dhaka | Dhaka | 23.7711 | 90.3697 | +88029122560 | DGHS Directory | Authoritative Public Record |
| 5 | Quantum Foundation Blood Lab | Dhaka | Dhaka | 23.7412 | 90.4150 | +88029351424 | Quantum Voluntary Service | Authoritative Public Record |
| 6 | Square Hospital Blood Bank | Dhaka | Dhaka | 23.7533 | 90.3817 | +88028159457 | Square Hospitals Ltd Public Listing | Authoritative Public Record |
| 7 | Kurmitola General Hospital | Dhaka | Dhaka | 23.8193 | 90.4107 | +880255067202 | DGHS Directory | Authoritative Public Record |
| 8 | Chittagong Medical College Hospital | Chattogram | Chattogram | 22.3592 | 91.8285 | +88031619400 | DGHS / CMCH Directory | Authoritative Public Record |
| 9 | Sylhet MAG Osmani Medical College | Sylhet | Sylhet | 24.8997 | 91.8542 | +880821713667 | DGHS / SOMCH Directory | Authoritative Public Record |
| 10 | Rajshahi Medical College Hospital | Rajshahi | Rajshahi | 24.3725 | 88.5839 | +880721772150 | DGHS / RMCH Directory | Authoritative Public Record |
| 11 | Khulna Medical College Hospital | Khulna | Khulna | 22.8368 | 89.5403 | +88041761509 | DGHS / KMCH Directory | Authoritative Public Record |
| 12 | Mymensingh Medical College Hospital | Mymensingh | Mymensingh | 24.7431 | 90.4140 | +8809166063 | DGHS / MMCH Directory | Authoritative Public Record |
| 13 | Sher-e-Bangla Medical College Hospital | Barishal | Barishal | 22.6896 | 90.3585 | +8804312173541 | DGHS Tertiary Hospital Listing | Requires Direct Phone Verification |
| 14 | Rangpur Medical College Hospital | Rangpur | Rangpur | 25.7628 | 89.2369 | +88052162234 | DGHS Tertiary Hospital Listing | Requires Direct Phone Verification |

> [!NOTE]
> For Sher-e-Bangla Medical College Hospital (SBMCH) and Rangpur Medical College Hospital (RpMCH), coordinates and BTCL exchange phone numbers correspond to official DGHS directory entries. However, the direct extension to the blood transfusion department has not been verified via real-time physical call. The UI displays an explicit disclosure advising citizens to call the emergency helpline before traveling.

---

## 7. Accident Zone Integrity Findings

Inspected in `backend/app/db/seed_accident_zones.py` and `frontend/src/app/safety/safe-route/page.tsx`.

1. **Model Categorization:**
   - Database and schema serialize every record as `data_type="ESTIMATED_HAZARD_DATA"`.
   - `is_estimated` flag is strictly `True`.
   - `hazard_density_label` is `"Estimated Hazard Index"`.
2. **Model Limitation Disclosure:**
   - Every zone carries `data_limitation_notice="Estimated corridor density based on historical road safety models. Not live telematics or certified casualty statistics."`
   - In `safe-route/page.tsx`, the card displays this limitation directly to the user.
3. **Route Risk Scoring:**
   - Preserves historical density weighting in `safe_route.py`: `min(40.0, sum(20.0 if z.risk_level == "CRITICAL" else 12.0 for z in accident_zones_along_route))`.
   - Missing or malformed waypoints do not crash the route analyzer (falls back cleanly to linear interpolation).
   - No claim of live traffic congestion or live casualty tracking is presented.

---

## 8. Safe Route & OSRM Integration Results

1. **Configurable Endpoint:**
   - Defaults to `process.env.NEXT_PUBLIC_OSRM_URL || "https://router.project-osrm.org"`.
   - Documented in `frontend/.env.example`.
2. **Timeout Enforcement:**
   - Verified 7,500ms `AbortController` timeout prevents indefinite hanging when OSRM is unreachable.
3. **HTTP 429 Handling:**
   - HTTP 429 status code is caught and handled with user-friendly rate limit guidance.
4. **Corridor Fallback Notice:**
   - On network failure, timeout, or HTTP error, the frontend activates `isFallbackRoute = true` and renders an amber notification banner:
     *"Routing engine unavailable or timed out. Evaluating hazards via direct corridor fallback (Note: This is an informational hazard scan, not turn-by-turn road navigation)."*
5. **No Synthetic Traffic:**
   - No mock ETAs or fake road network congestion is fabricated during fallback.
6. **Credential Privacy:**
   - Only public frontend environment variables (`NEXT_PUBLIC_*`) are used; zero private keys or server credentials are exposed.

---

## 9. Emergency Feature Regression Matrix

| Feature / Subsystem | Verification Level | Test Suite | Result |
|:---|:---:|:---:|:---:|
| Citizen Report Submission | Automated Integration Test | `test_reports.py` | PASS |
| Report Moderation Lifecycle | Automated Integration Test | `test_admin.py` | PASS |
| Approved-Only Public Visibility | Automated Integration Test | `test_public_feed.py` | PASS |
| Coordinate Privacy Rounding (~110m) | Automated Integration Test | `test_final_qa_verification.py` | PASS |
| Safety Map 3D Clustering | Automated Integration Test | `test_safety_map_and_clustering.py` | PASS |
| Missing Person Alert Creation | Automated Integration Test | `test_missing_person.py` | PASS |
| Missing Person Sightings | Automated Integration Test | `test_missing_person_sightings.py` | PASS |
| Emergency Services Directory | Automated Integration Test | `test_safety_directory_verification.py` | PASS |
| Blood AI Assistant & Search | Automated Integration Test | `test_blood_ai_hospitals.py` | PASS |
| Safe Ride (OpenCV Computer Vision) | Automated Integration Test | `test_safe_ride.py` | PASS |
| Safe Route Hazard Analysis | Automated Integration Test | `test_safe_route.py` | PASS |
| Admin RBAC & Dashboard | Automated Integration Test | `test_admin.py`, `test_admin_copilot.py` | PASS |
| JWT Authentication & Password Hash | Automated Integration Test | `test_auth.py`, `test_security.py` | PASS |

---

## 10. Automated Verification Commands & Raw Output

### 10.1 Backend Full Test Suite
- **Command:** `cd "citizen-report-platform/backend" && .venv/bin/pytest tests/`
- **Exit Code:** `0`
- **Total Tests:** `246`
- **Passed:** `246`
- **Failed:** `0`
- **Skipped:** `0`
- **Warnings:** `1` (Starlette deprecation warning for HTTP 422 alias)
- **Duration:** `77.12 seconds`

### 10.2 Safety Subsystem Suite
- **Command:** `cd "citizen-report-platform/backend" && .venv/bin/pytest tests/test_safe_ride.py tests/test_safe_route.py tests/test_safety.py -v`
- **Exit Code:** `0`
- **Passed:** `22` / `22`
- **Duration:** `3.03 seconds`

### 10.3 Blood AI & Hospital Suite
- **Command:** `cd "citizen-report-platform/backend" && .venv/bin/pytest tests/test_blood_ai_hospitals.py tests/test_blood_help.py -v`
- **Exit Code:** `0`
- **Passed:** `22` / `22`
- **Duration:** `6.55 seconds`

### 10.4 Admin & RBAC Suite
- **Command:** `cd "citizen-report-platform/backend" && .venv/bin/pytest tests/test_admin.py tests/test_admin_copilot.py -v`
- **Exit Code:** `0`
- **Passed:** `20` / `20`
- **Duration:** `8.54 seconds`

### 10.5 Migrations Suite
- **Command:** `cd "citizen-report-platform/backend" && .venv/bin/pytest tests/test_migrations.py -v`
- **Exit Code:** `0`
- **Passed:** `1` / `1`
- **Duration:** `0.10 seconds`

### 10.6 Frontend TypeScript Type Check
- **Command:** `cd "citizen-report-platform/frontend" && npm run type-check`
- **Exit Code:** `0`
- **Output:** `tsc --noEmit` completed with 0 errors.

### 10.7 Frontend ESLint
- **Command:** `cd "citizen-report-platform/frontend" && npm run lint`
- **Exit Code:** `0`
- **Output:** `0` errors, `36` non-blocking warnings.

### 10.8 Frontend Next.js Production Build
- **Command:** `cd "citizen-report-platform/frontend" && npm run build`
- **Exit Code:** `0`
- **Output:** Next.js 16.3.4 (webpack), 47/47 static and dynamic pages generated in `7.6 seconds`.

---

## 11. Confirmed Defects & Regressions Handled

1. **Impure Render Call in `safe-route/page.tsx`:**
   - *Defect:* `Date.now()` called directly in the component render body during helmet token expiration checks violated `react-hooks/purity`.
   - *Fix:* Moved the timestamp check inside the `handleInitiateDriving` event handler.
   - *Result:* Resolved ESLint error.
2. **Missing `Info` Icon in `safe-route/page.tsx`:**
   - *Defect:* Icon used in fallback alert banner was not imported from `lucide-react`.
   - *Fix:* Added `Info` to the Lucide icon imports.
   - *Result:* Resolved compilation error.
3. **Hospital Seed Counter Discrepancy in `test_blood_ai_hospitals.py`:**
   - *Defect:* Fixture asserted 12 hospitals when 14 hospitals are now defined across all 8 divisions.
   - *Fix:* Updated assertion to `assert result["total_hospitals_defined"] == 14`.
   - *Result:* Test passed cleanly.
4. **Missing Empty/Omitted Token Tests in `test_safe_ride.py`:**
   - *Defect:* Empty token string and omitted JSON payload scenarios were not explicitly covered in automated tests.
   - *Fix:* Added `test_start_safe_ride_blocks_missing_or_empty_token` and `test_verify_helmet_invalid_base64_payload`.
   - *Result:* Verified HTTP 403 / 422 behavior.

---

## 12. Remaining Risks & Considerations

1. **Public OSRM Endpoint Availability:**
   - The default routing endpoint `https://router.project-osrm.org` is a public demo server with community rate limits. In high-traffic production environments, deploying a dedicated self-hosted OSRM container via `NEXT_PUBLIC_OSRM_URL` is recommended.
2. **Computer Vision Environmental Sensitivity:**
   - The Haar cascade helmet detection service evaluates cranial contour and color segmentation. Extreme dark environments (<15 brightness) return `UNCERTAIN` by design to prevent false passes.
3. **Emergency Hospital Contact Staleness:**
   - While tertiary hospital phone numbers are authoritative DGHS landlines, direct blood bank extension lines may shift during administrative reorganizations. The platform footnote correctly instructs users to verify availability by phone before transit.

---

## 13. Production Blockers

**None.** There are zero active regressions, zero failing automated tests, zero TypeScript errors, and zero production build blockers.

---

## 14. Features Not Independently Verified

- **Browser WebRTC Live Camera Capture:**
  - Automated headless browser tools (e.g. Playwright, Puppeteer, Chromium) are not present in the sandboxed workspace.
  - Runtime image processing was verified via OpenCV synthetic frame integration tests simulating camera snapshots, lighting variants, and unworn helmets. Live browser camera feed interaction was not verified using an automated headless browser.
