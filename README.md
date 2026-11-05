# NIRAPOTTA AI — Citizen Safety & Emergency Intelligence Platform

> **AI-Powered Civic Safety, Emergency Response, Blood Discovery & Road Safety Intelligence for Bangladesh**

Built for **Ostad Presents YUNet AIgnite Buildathon 2026**

---

## Developer Information

- **Developer:** Alfi Shahrin Talukder
- **Department:** Department of Computer Science and Engineering
- **University:** Daffodil International University (DIU), Dhaka, Bangladesh
- **Target Country:** Bangladesh (Nationwide 8 Divisions & 64 Districts)
- **Project Repository:** [https://github.com/Alfi-svg/citizen-report-platform](https://github.com/Alfi-svg/citizen-report-platform)
- **Project Status:** Active Development & Production Verified (Buildathon Ready)

---

## Table of Contents

1. [Live Application](#live-application)
2. [Project Overview](#project-overview)
3. [Problems We Solve](#problems-we-solve)
   - [Emergency Blood Discovery](#1-emergency-blood-discovery)
   - [Hospital Discovery & Road Matrix](#2-hospital-discovery--road-distance-matrix)
   - [Agentic Safety Road AI](#3-agentic-safety-road-ai)
   - [Community Incident Reporting & Oversight](#4-community-incident-reporting--oversight)
   - [Emergency Assistance & National 999](#5-emergency-assistance--national-999)
   - [Safe Ride & Computer Vision Helmet Verification](#6-safe-ride--computer-vision-helmet-verification)
   - [Administrative Intelligence & Moderation](#7-administrative-intelligence--moderation)
4. [How to Use the Application](#how-to-use-the-application)
   - [Citizen General Workflow](#citizen-general-workflow)
   - [Blood AI Workflow](#blood-ai-workflow)
   - [Safety Road AI Workflow](#safety-road-ai-workflow)
   - [Incident Reporting Workflow](#incident-reporting-workflow)
   - [Administrator Workflow](#administrator-workflow)
5. [System Architecture](#system-architecture)
6. [Feature Architecture Diagram](#feature-architecture-diagram)
7. [Agentic AI Architecture](#agentic-ai-architecture)
8. [Technology Stack](#technology-stack)
9. [Database Design & Entity Relationship](#database-design--entity-relationship)
10. [Installation & Local Development](#installation--local-development)
    - [Prerequisites](#prerequisites)
    - [Repository Setup](#repository-setup)
    - [Backend Setup](#backend-setup)
    - [Frontend Setup](#frontend-setup)
    - [Environment Variables Reference](#environment-variables-reference)
11. [Security, Privacy & Responsible AI](#security-privacy--responsible-ai)
12. [Future Roadmap](#future-roadmap)
13. [Implemented vs Planned Features Breakdown](#implemented-vs-planned-features-breakdown)
14. [License & Acknowledgements](#license--acknowledgements)

---

## Live Application

| Resource | Environment | URL |
|---|---|---|
| **Web Application** | Production (Vercel) | [https://nirapotta-citizen-platform.vercel.app/](https://nirapotta-citizen-platform.vercel.app/) |
| **Backend REST API** | Production (Render) | [https://citizen-report-backend.onrender.com/api/v1](https://citizen-report-backend.onrender.com/api/v1) |
| **API Health Check** | Production (Render) | [https://citizen-report-backend.onrender.com/health](https://citizen-report-backend.onrender.com/health) |
| **Source Repository** | GitHub | [https://github.com/Alfi-svg/citizen-report-platform](https://github.com/Alfi-svg/citizen-report-platform) |
| **Android Application** | Capacitor / APK | Downloadable via repository release / web download CTA |

### Public vs Authenticated Access Model
To ensure maximum citizen safety during critical situations, NIRAPOTTA AI maintains an **open-access policy for all core safety discovery features**:
- **No Login Required (Unrestricted Public Access):** Emergency 999 dialing, nearby police & fire directory, hospital & blood stock finder, Blood AI assistant, Safe Route driving planner, live safety map, and public verified incident feed.
- **Citizen Account Required:** Submitting new incident reports with evidence, creating urgent blood requests, starting a Safe Ride tracking session, and setting up Nirapotta Guard personal emergency contacts.
- **Administrator Role Required (`role = ADMIN`):** Incident report moderation queue, status overrides, content flags review, hospital inventory updates, and administrative analytics.

---

## Project Overview

**NIRAPOTTA AI** (নিরাপত্তা — *Safety / Protection*) is an intelligent citizen safety, emergency coordination, and civic intelligence platform engineered specifically for the societal context of Bangladesh.

### Why NIRAPOTTA AI Was Developed
In Bangladesh, critical emergency information is fragmented across decentralized channels:
1. **Critical Blood Shortages:** Finding compatible blood donors or locating hospital stock during acute medical emergencies often depends on ad-hoc social media posts, resulting in life-threatening delays.
2. **High Highway & Road Accident Rates:** Commuters and motorcycle riders navigate highways with documented accident blackspots (identified by ARI BUET and BRTA) without real-time safety risk awareness.
3. **Decentralized Emergency Directories:** Citizens facing distress often struggle to rapidly identify and call the specific local police thana, highway patrol, or fire service station covering their immediate vicinity.
4. **Civic Hazard Reporting Barriers:** Community hazards such as broken roads, open manholes, illegal waste dumping, and safety risks frequently lack transparent reporting channels with public oversight.

### How NIRAPOTTA AI Addresses These Challenges
NIRAPOTTA AI combines **deterministic civic services** with **grounded Artificial Intelligence**:
- It uses grounded NLP to extract blood groups, urgency levels, and locations from colloquial user text without hallucinating stock.
- It employs a multi-step heuristic agent pipeline (`agentic_road_ai.py`) that analyzes road network trajectories from OSRM, calculates spatial buffer intersections against documented accident blackspots, and generates safety-versus-time tradeoff recommendations.
- It uses OpenCV computer vision to enforce motorcycle helmet compliance before authorizing ride tracking.
- It provides a centralized administrative intelligence dashboard for verified civic moderators to oversee reported hazards and protect public transparency.

---

## Problems We Solve

### 1. Emergency Blood Discovery
- **8 ABO/Rh Blood Groups:** Full compatibility matching across all eight standard blood groups: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`.
- **Grounded Blood AI Assistant (`/blood-help/blood-ai`):** Natural language conversational assistant that accepts unstructured requests (e.g., *"Need 2 bags of O negative blood in Chittagong urgently"*), extracts clinical parameters, matches compatible donors, and queries hospital blood banks.
- **Anti-Hallucination Guardrails:** The AI is strictly constrained to database-grounded records. When matching inventory or donors are absent, it explicitly informs the citizen rather than generating synthetic contact details or stock counts.
- **Seeded Baseline Transparency:** Inventories not yet verified through hospital telemetry are transparently labeled with **`Blood stock information unavailable`** / **`Unverified Stock`** rather than claiming live availability.

### 2. Hospital Discovery & Road Distance Matrix
- **Nationwide Hospital Directory (`/blood-help/hospitals`):** 14 seeded tertiary and district hospitals across all 8 administrative divisions of Bangladesh (Dhaka, Chittagong, Rajshahi, Khulna, Barishal, Sylhet, Rangpur, Mymensingh).
- **Dual Distance Metrics:**
  - **OSRM Driving Road Distance & Duration:** Computes actual driving kilometers and travel duration in minutes via batched OSRM matrix tables (`/table/v1/driving/`).
  - **Haversine Straight-Line Fallback:** Gracefully falls back to geographic Haversine distance with explicit labeling if the external routing provider is temporarily unreachable.
- **Direct Navigation:** One-tap links to open Google Maps directions directly to the emergency entrance coordinates.

### 3. Agentic Safety Road AI
- **Multi-Route Analysis (`/safety/safe-route`):** Queries the OSRM routing engine with alternative candidate paths (`alternatives=true`).
- **Accident Blackspot Penalty:** Correlates route polylines against geospatial accident zones sourced from the **Accident Research Institute (ARI), BUET** and **BRTA Highway Safety Studies**, as well as verified community road hazard reports.
- **Multiobjective Cost Optimization:** Evaluates travel options using a deterministic cost function:
  $$\text{Cost} = w_{\text{safety}} \times \text{Risk Score} + w_{\text{time}} \times \text{Duration (mins)}$$
- **Route Classification:**
  - **AI Recommended Route:** Optimal balance between road safety and travel efficiency.
  - **Fastest Route:** Minimum elapsed driving time.
  - **Safest Alternative:** Minimizes exposure to documented accident blackspots.
- **Bilingual Rationale Synthesis:** Explains why a route was selected in natural English and Bengali (e.g., *"Avoids 2 severe accident blackspots near Jatrabari intersection with only a 4-minute travel delta"*).

### 4. Community Incident Reporting & Oversight
- **Categorized Reporting (`/reports/create`):** Road Accidents, Fire & Electrical Hazards, Infrastructure & Open Manholes, Public Harassment, Crime & Theft, Healthcare Emergencies, and Other.
- **Multimedia Evidence:** File attachments (photos, videos, documents) verified with magic-byte validation and sanitized storage keys.
- **Location Privacy & Anonymous Masking:** Citizens can submit reports anonymously. Public views suppress user credentials and provide district-level aggregation to prevent harassment.
- **Moderation Workflow:** All reports enter an administrative audit queue (`PENDING` $\rightarrow$ `APPROVED` / `REJECTED` / `RESOLVED`) before appearing on the public feed.

### 5. Emergency Assistance & National 999
- **Direct National Emergency 999:** Instant one-tap `tel:999` protocol integration that immediately launches the native device dialer without requiring user authentication.
- **Emergency Services Directory (`/safety`):** Over 50 verified police stations (*Thanas*), highway patrol outposts, fire service stations, and trauma centers with verified hotline numbers, addresses, and GPS coordinates.
- **Zero Background Tracking:** User coordinates are processed on-demand in memory only when explicitly requested; coordinates are never persisted in user profiles or tracked continuously.

### 6. Safe Ride & Computer Vision Helmet Verification
- **Rider Compliance (`/safety/safe-ride`):** Designed for motorcycle drivers and pillion passengers.
- **Live Camera Capture:** Captures base64 video frames directly from the user's browser or mobile camera feed.
- **OpenCV Computer Vision Pipeline:**
  1. Haar cascade detection for human cranial and profile orientation.
  2. Structural contour analysis ensuring substantial torso presence ($\text{width} \ge 50\text{px}, \text{height} \ge 60\text{px}, \text{area} \ge 4000\text{px}^2$).
  3. Hough circle transforms and elliptical curvature checks on the cranial region above the face.
  4. Fallback classification: Empty, dark, or non-human frames strictly return `PERSON_NOT_DETECTED`.
- **HMAC Cryptographic Token Gate:** Upon successful helmet verification, issues an HMAC-SHA256 signed token valid for 120 seconds. Starting a Safe Ride session requires a valid token; unverified or expired tokens are rejected with HTTP 403/400.

### 7. Administrative Intelligence & Moderation
- **Moderator Dashboard (`/admin`):** Comprehensive interface for authorized civic moderators.
- **Incident Intelligence:** Aggregates geospatial clusters, flagging recurrent incident hotspots.
- **Admin Copilot (`/api/v1/ai/admin-copilot`):** Generates structured incident summaries, detects potential duplicates, and suggests priority tiers for incoming citizen reports.

---

## How to Use the Application

### Citizen General Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen User
    participant Web as NIRAPOTTA Web / Mobile UI
    participant Backend as FastAPI Backend
    participant DB as PostgreSQL Database

    Citizen->>Web: Opens platform homepage (No login required)
    Web->>Citizen: Displays emergency hotlines, live map & safety tools
    
    alt Emergency Distress (Immediate)
        Citizen->>Web: Clicks "SOS 999"
        Web->>Citizen: Triggers native phone dialer to call 999 immediately
    else Search Hospitals & Blood
        Citizen->>Web: Enters blood group & district in Blood Finder
        Web->>Backend: GET /api/v1/blood/hospitals?blood_group=O+&district=Dhaka
        Backend->>DB: Queries hospitals & blood_inventories
        DB-->>Backend: Returns hospital records & coordinates
        Backend-->>Web: Returns driving road distances & inventory status
        Web-->>Citizen: Renders sorted hospital cards with Google Maps directions
    else Safe Route Travel
        Citizen->>Web: Enters Origin & Destination on Safe Route
        Web->>Backend: POST /api/v1/safety/safe-route/agentic-plan
        Backend-->>Web: Returns AI Recommended, Fastest, and Safest route polylines
        Web-->>Citizen: Renders colored routes & blackspot warnings on 3D Map
    end
```

### Blood AI Workflow
1. Navigate to **Blood Help** $\rightarrow$ **Blood AI Assistant** (`/blood-help/blood-ai`).
2. Type an inquiry in conversational English or Bengali (e.g., *"I need B+ blood near Dhanmondi, Dhaka"*).
3. The backend extracts blood group (`B+`), district (`Dhaka`), and urgency (`URGENT`).
4. The system queries verified hospital inventories and registered volunteer donors.
5. The assistant returns a grounded response with hospital contact phone numbers, driving distance, and verified stock indicators without hallucinating unavailable donors.

### Safety Road AI Workflow
1. Navigate to **Road Safety** $\rightarrow$ **Safe Route** (`/safety/safe-route`).
2. Enter the **Starting Point** (e.g., *"Mohakhali, Dhaka"*) and **Destination** (e.g., *"Uttara, Dhaka"*).
3. Select travel priority preference: **Balanced (AI Recommended)**, **Fastest**, or **Safest**.
4. The system queries OSRM, evaluates road corridors against ARI BUET accident blackspots, and returns multi-candidate trajectories.
5. Compare candidate routes with duration, distance, risk scores, and the AI explanation detailing avoided hazards.

### Incident Reporting Workflow
1. Click **Report an Issue** (`/reports/create`) (Authentication required).
2. Select the incident category (e.g., *Road Accident*, *Open Manhole*, *Fire Hazard*).
3. Specify incident title, description, and location (using GPS auto-detect or manual map pin).
4. Attach photographic or documentary evidence (optional, up to 10 files).
5. Choose whether to submit under your verified name or as an **Anonymous Reporter**.
6. Submit the report. The backend validates file magic bytes, hashes filenames, and enters the report into the **Moderation Review Queue**.
7. Once reviewed and approved by an authorized administrator, the report appears on the public community feed and safety map.

### Administrator Workflow
1. Sign in with an administrator account at `/login`.
2. Navigate to `/admin` to open the administrative intelligence dashboard.
3. Review pending reports at `/admin/reports` with submitted evidence, location coordinates, and user credibility scores.
4. Use **Admin Copilot** to view automated incident summaries and duplicate cluster detections.
5. Approve, reject, or flag reports with documented moderation notes.
6. Manage verified hospital blood stocks at `/admin/blood-help`.

---

## System Architecture

```mermaid
flowchart TB
    subgraph Presentation ["Presentation Layer (Client)"]
        CitizenUI["Citizen Web App (Next.js 16 + Tailwind CSS)"]
        MobileApp["Android Mobile App (Capacitor 7)"]
        AdminUI["Admin Intelligence Dashboard (/admin)"]
        MapLibre["MapLibre GL Vector Map (3D Blackspots & Clusters)"]
        WebCam["HTML5 Camera Stream (Base64 Canvas Frame Capture)"]
    end

    subgraph Gateway ["API Gateway & Security Layer"]
        FastAPI["FastAPI Application Server (Python 3.12)"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
        CORSMiddleware["Environment-Driven CORS Validator"]
        RateLimiter["Request Throttling & Health Probes (/health)"]
    end

    subgraph Services ["Application & Domain Services Layer"]
        BloodSvc["Blood & Hospital Discovery Service (hospital_service.py)"]
        RouteSvc["Safe Route & Distance Matrix Service (safe_route.py)"]
        ReportSvc["Incident Reporting & Moderation Service (report_service.py)"]
        EmergSvc["Emergency Services Directory (emergency_service.py)"]
        GuardSvc["Nirapotta Guard Safety Session Service (guard.py)"]
    end

    subgraph Intelligence ["AI & Computer Vision Intelligence Layer"]
        BloodAI["Grounded Blood AI Assistant (blood_ai_service.py)"]
        AgenticRoad["Agentic Safety Road AI Pipeline (agentic_road_ai.py)"]
        HelmetCV["Helmet Detection Service (OpenCV Contour & Hough Engine)"]
        AdminCopilot["Admin & Moderator Copilot (admin_copilot.py)"]
        OpenRouter["OpenRouter AI Gateway (Llama 3.3 70B / Gemini 2.0)"]
    end

    subgraph Persistence ["Data & Storage Layer"]
        PostgreSQL[("PostgreSQL Database (Neon Serverless / Local asyncpg)")]
        LocalStore["Local Object Store (data/storage)"]
        S3Store["AWS S3 / Cloudflare R2 Object Store (boto3)"]
    end

    subgraph External ["External Infrastructure & Datasets"]
        OSRM["OSRM Routing Engine (Driving Polylines & Table Matrix)"]
        ARI_BUET["ARI BUET & BRTA Highway Blackspot Dataset"]
        Dialer["Native Mobile Telephony (tel:999 Protocol)"]
    end

    %% Presentation to Gateway
    CitizenUI --> FastAPI
    MobileApp --> FastAPI
    AdminUI --> FastAPI
    WebCam --> HelmetCV
    CitizenUI --> MapLibre

    %% Gateway to Services
    FastAPI --> AuthMiddleware
    AuthMiddleware --> CORSMiddleware
    CORSMiddleware --> Services

    %% Services Interconnections
    Services --> BloodSvc
    Services --> RouteSvc
    Services --> ReportSvc
    Services --> EmergSvc
    Services --> GuardSvc

    %% Services to Intelligence
    BloodSvc --> BloodAI
    RouteSvc --> AgenticRoad
    FastAPI --> HelmetCV
    AdminUI --> AdminCopilot

    %% AI Integrations
    BloodAI --> OpenRouter
    AgenticRoad --> OpenRouter
    AdminCopilot --> OpenRouter
    AgenticRoad --> OSRM
    RouteSvc --> OSRM

    %% Persistence Connections
    Services --> PostgreSQL
    Intelligence --> PostgreSQL
    PostgreSQL --> ARI_BUET
    ReportSvc --> LocalStore
    ReportSvc --> S3Store

    %% Direct Hardware / External
    CitizenUI --> Dialer
```

---

## Feature Architecture Diagram

```mermaid
flowchart LR
    subgraph Citizens ["Citizen Access (Public / Verified)"]
        C1["Emergency 999 Hotline"]
        C2["Blood & Hospital Finder"]
        C3["Blood AI Assistant"]
        C4["Agentic Safe Route"]
        C5["Safe Ride & Helmet Check"]
        C6["Submit Incident Report"]
        C7["Public Feed & Safety Map"]
        C8["Missing Person Alerts"]
        C9["Nirapotta Guard SOS"]
    end

    subgraph CoreBackend ["FastAPI Core Backend Engine"]
        API["REST API Router (/api/v1)"]
        Auth["JWT / Token Security"]
        CV["OpenCV 4.x CV Engine"]
        HeuristicAI["Agentic Heuristic Optimizer"]
    end

    subgraph Administration ["Administrative Oversight"]
        A1["Moderation Review Queue"]
        A2["Incident Cluster Intelligence"]
        A3["Admin Copilot Summarizer"]
        A4["Hospital Inventory Management"]
        A5["Civic Reputation Tracking"]
    end

    %% Citizen to Backend
    C1 -. "Native Dialer" .-> API
    C2 --> API
    C3 --> API
    C4 --> API
    C5 --> CV
    CV --> Auth
    C6 --> Auth
    C7 --> API
    C8 --> API
    C9 --> Auth

    %% Backend to Admin
    API --> HeuristicAI
    API --> Administration
    Administration --> A1
    Administration --> A2
    Administration --> A3
    Administration --> A4
    Administration --> A5
```

---

## Agentic AI Architecture

NIRAPOTTA AI incorporates purposeful, grounded AI workflows designed to assist human decision-making rather than operating as an unconstrained autonomous black box:

### 1. Blood AI Assistant (`blood_ai_service.py`)
- **Purpose:** Assist citizens in natural language to find compatible blood units, nearby hospitals, and emergency contacts during clinical emergencies.
- **User Input:** Freeform conversational text in English, Bengali, or transliterated Banglish.
- **Processing Logic:** Extracts ABO/Rh blood groups, administrative district, and clinical urgency tier (`NORMAL`, `URGENT`, `CRITICAL`). Injects strict system prompt constraints containing retrieved hospital inventory records and donor profiles.
- **Anti-Hallucination Guardrail:** Forbids generating synthetic blood units, donor identities, or unverified contact numbers. If database records are empty, it explicitly advises the citizen to contact the nearest red crescent center or tertiary hospital.
- **Fallback:** If OpenRouter AI times out or is offline, a deterministic template-based matcher returns exact database results without failing.

### 2. Agentic Safety Road AI (`agentic_road_ai.py`)
- **Purpose:** Evaluate multiple driving route options between origin and destination, calculate spatial exposure to documented accident blackspots, and recommend the safest practical route.
- **User Input:** Origin coordinate/name, destination coordinate/name, and optimization preference (`balanced`, `fastest`, `safest`).
- **5-Step Tool Execution Pipeline:**
  1. `get_route_candidates`: Fetches alternative driving trajectories via OSRM (`alternatives=true`).
  2. `get_road_risk_data`: Pulls spatial accident zones (ARI BUET / BRTA) and verified citizen road hazard reports.
  3. `analyze_route_segments`: Buffers road polylines (500m–1000m corridor) and calculates intersection points with accident blackspots.
  4. `compare_routes`: Applies multiobjective cost function balancing travel time against accident blackspot exposure.
  5. `recommend_safe_route`: Selects the recommended candidate and synthesizes a bilingual explanation of avoided hazards and time deltas.
- **Limitations:** Driving times reflect OSRM graph baselines; real-time dynamic traffic congestion requires commercial sensor integration.

### 3. Admin & Moderator Copilot (`admin_copilot.py`)
- **Purpose:** Accelerate incident report moderation, detect duplicate submissions from the same geographic vicinity, and generate executive summaries for civic authorities.
- **Processing Logic:** Analyzes submitted report text and geospatial coordinates, compares them against existing reports within a 1.5 km radius over the past 24 hours, and flags probable duplicates.
- **Human Oversight:** The Copilot provides **advisory recommendations only**. Human moderators must explicitly click to approve, reject, or re-categorize reports.

---

## Technology Stack

| Domain | Technology / Library | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | Next.js (App Router) | `16.3.4` | Server-rendered and static frontend application |
| **UI Library** | React | `19.2.8` | Component lifecycle, hooks, and interface rendering |
| **Styling & CSS** | Tailwind CSS | `v4` | Modern utility-first responsive design system |
| **Icons & Visuals** | Lucide React | `^1.67.0` | High-quality, consistent vector icons (No emojis) |
| **Vector Mapping** | MapLibre GL | `^5.1.0` | Open-source GPU-accelerated 3D vector map rendering |
| **Mobile Runtime** | Capacitor | `^7.0.0` | Native Android wrapper with live web server sync |
| **Backend Framework** | FastAPI | `>=0.115.0` | High-performance asynchronous Python REST API |
| **ASGI Web Server** | Uvicorn | `>=0.30.0` | Production ASGI web server with worker clustering |
| **Database ORM** | SQLAlchemy (Asyncio) | `>=2.0.30` | Asynchronous relational data modeling and queries |
| **Database Driver** | asyncpg / psycopg2 | `>=0.29.0` | Native PostgreSQL asynchronous connection pool |
| **Schema Migration** | Alembic | `>=1.13.0` | Declarative database migration management (16 migrations) |
| **Computer Vision** | OpenCV Headless | `>=4.10.0` | Real-time cranial contour & Hough circle helmet detection |
| **Data Processing** | NumPy / Pillow | `>=2.0.0` | Fast multi-dimensional array image matrix processing |
| **Authentication** | PyJWT & Passlib / Bcrypt | `>=2.8.0` | Cryptographic JWT token issuance and salted password hashing |
| **AI Gateway** | OpenRouter HTTP Client | HTTPX `>=0.27.0` | Multi-LLM provider integration (Llama 3.3 70B, Gemini) |
| **Routing Provider** | OSRM Driving Engine | Project OSRM | Open-source driving polyline and distance matrix calculation |
| **Object Storage** | Local FS / Boto3 (S3) | `>=1.34.0` | Cloud object storage abstraction (Local / S3 / MinIO / R2) |
| **Test Framework** | Pytest & pytest-asyncio | `>=8.0.0` | Full automated test suite (255 backend tests passing) |

---

## Database Design & Entity Relationship

The database schema is managed via **Alembic** across 16 sequential migrations.

```mermaid
erDiagram
    USERS ||--o{ REPORTS : "submits"
    USERS ||--o{ COMMENTS : "writes"
    USERS ||--o{ REACTIONS : "reacts"
    USERS ||--o{ BLOOD_REQUESTS : "creates"
    USERS ||--o| BLOOD_DONOR_PROFILES : "registers"
    USERS ||--o{ GUARD_SESSIONS : "starts"
    USERS ||--o{ NOTIFICATIONS : "receives"

    CATEGORIES ||--o{ REPORTS : "classifies"
    
    REPORTS ||--o{ REPORT_MEDIA : "contains"
    REPORTS ||--o{ COMMENTS : "receives"
    REPORTS ||--o{ REACTIONS : "receives"
    REPORTS ||--o{ MODERATION_LOGS : "audited_by"
    REPORTS ||--o{ CONTENT_FLAGS : "flagged_by"

    HOSPITALS ||--o{ BLOOD_INVENTORIES : "stocks"
    HOSPITALS ||--o{ BLOOD_REQUESTS : "assigned_to"

    USERS {
        uuid id PK
        string email UK
        string full_name
        string hashed_password
        string role "USER | ADMIN"
        int reputation_score
        string phone_number
        boolean is_active
        datetime created_at
    }

    REPORTS {
        uuid id PK
        uuid user_id FK
        uuid category_id FK
        string title
        text description
        string status "PENDING | APPROVED | REJECTED | RESOLVED"
        float latitude
        float longitude
        string division
        string district
        boolean is_anonymous
        int view_count
        int endorsement_count
        datetime created_at
    }

    REPORT_MEDIA {
        uuid id PK
        uuid report_id FK
        string media_type "IMAGE | VIDEO | DOCUMENT"
        string file_url
        string file_key
        int file_size
        string mime_type
    }

    HOSPITALS {
        uuid id PK
        string name
        string division
        string district
        float latitude
        float longitude
        string phone
        string emergency_hotline
        boolean is_blood_bank
        boolean is_verified
    }

    BLOOD_INVENTORIES {
        uuid id PK
        uuid hospital_id FK
        string blood_group "A+ | A- | B+ | B- | AB+ | AB- | O+ | O-"
        int units_available
        string status "AVAILABLE | LOW | OUT_OF_STOCK | UNKNOWN"
        boolean is_verified
        datetime last_updated
    }

    ACCIDENT_ZONES {
        uuid id PK
        string title
        string highway_name
        float latitude
        float longitude
        float radius_meters
        int incident_count
        int fatality_count
        float severity_index
        string source "ARI BUET | BRTA"
        boolean is_active
    }

    EMERGENCY_SERVICES {
        uuid id PK
        string name
        string service_type "POLICE | FIRE | HOSPITAL"
        string phone
        string division
        string district
        float latitude
        float longitude
        boolean is_verified
    }

    GUARD_SESSIONS {
        uuid id PK
        uuid user_id FK
        string status "ACTIVE | COMPLETED | EMERGENCY"
        datetime expires_at
        float last_latitude
        float last_longitude
        string emergency_notes
    }
```

---

## Installation & Local Development

### Prerequisites
- **Node.js:** `v20.x` or `v22.x` (LTS recommended)
- **Python:** `3.11` or `3.12`
- **PostgreSQL:** `15+` (or a serverless PostgreSQL instance such as Neon)
- **Git**

### Repository Setup
```bash
# Clone the repository
git clone https://github.com/Alfi-svg/citizen-report-platform.git
cd citizen-report-platform
```

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Configure environment variables
cp ../.env.example .env
# Edit .env with your local PostgreSQL credentials

# Run database migrations
alembic upgrade head

# Seed initial emergency services, accident zones, and hospital data
python -m app.db.seed_emergency_services
python -m app.db.seed_accident_zones
python -m app.db.seed_hospitals

# Run automated tests to verify environment
pytest -v

# Start the FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API will be available at: `http://localhost:8000/api/v1`  
Interactive Swagger documentation: `http://localhost:8000/docs`

### Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Configure environment variables
# Ensure NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 is set in .env.local

# Run TypeScript type check
npm run type-check

# Run ESLint validation
npm run lint

# Start the Next.js development server
npm run dev
```
The web application will be accessible at: `http://localhost:3000`

### Environment Variables Reference

| Variable Name | Required | Default / Example | Purpose |
|---|:---:|---|---|
| `DATABASE_URL` | **Yes** | `postgresql+asyncpg://user:pass@localhost:5432/citizen_report_db` | Asynchronous PostgreSQL connection string |
| `SECRET_KEY` | **Yes** | 32+ character cryptographic string | JWT token signing key (HMAC-SHA256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `10080` (7 days) | JWT lifespan in minutes |
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:8000/api/v1` | Public backend API endpoint accessed by browser |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `http://localhost:3000` | Canonical frontend web URL |
| `CORS_ORIGINS` | **Yes** | `http://localhost:3000,http://127.0.0.1:3000` | Whitelisted browser CORS origins |
| `STORAGE_BACKEND` | No | `local` | Object storage mode (`local` or `s3`) |
| `STORAGE_LOCAL_ROOT` | No | `data/storage` | Relative directory for local evidence storage |
| `OPENROUTER_API_KEY` | No | *(Optional API Key)* | OpenRouter key for LLM natural language features |
| `OPENROUTER_MODEL` | No | `meta-llama/llama-3.3-70b-instruct:free` | Primary conversational LLM |
| `AI_FALLBACK_DETERMINISTIC` | No | `true` | Ensures rule-based responses if LLM is offline |
| `GOOGLE_PLACES_API_KEY` | No | *(Optional API Key)* | External Google Places lookup for hospital locations |

---

## Security, Privacy & Responsible AI

### 1. Data Minimization & Location Privacy
- **Zero Background Geolocation Tracking:** NIRAPOTTA AI does not continuously poll or record user GPS positions. Location is captured only when a user explicitly submits an incident report or clicks *"Find Help Near Me"*.
- **Whistleblower & Anonymous Protection:** Citizens can submit incident reports with `is_anonymous = true`. The backend suppresses the reporter's user identity from public database queries, API responses, and feeds.
- **Media Sanitization:** Attached evidence files undergo magic-byte signature validation (to prevent executable spoofing) and are saved under cryptographically hashed UUID keys rather than user-provided filenames.

### 2. Application & API Hardening
- **Password Hashing:** Passwords are never stored in plaintext; salted `bcrypt` is enforced.
- **Role-Based Access Control (RBAC):** Strict dependency injection enforces administrative permission (`require_admin`) on moderation, inventory overrides, and analytics endpoints.
- **Cryptographic Token Gating:** Safe Ride sessions enforce a 120-second time-to-live HMAC-SHA256 verification token issued strictly by the OpenCV computer vision service.
- **Safe Error Handling:** Production API exceptions suppress internal stack traces to prevent reconnaissance disclosures.

### 3. Responsible AI Guardrails
- **No Autonomous Real-World Dispatch:** AI assistants do not place real emergency calls or dispatch police units autonomously. All emergency calling is executed via native device dialers under explicit user control.
- **Anti-Hallucination Grounding:** The Blood AI Assistant is bound by strict system instructions forbidding the fabrication of blood stock units, donor telephone numbers, or hospital inventories.

---

## Future Roadmap

### Short-Term Objectives
- [x] Implement mandatory Buildathon 2026 branding across all viewports.
- [x] Fix OpenCV helmet detection fallback logic for empty/noise frames.
- [x] Complete OSRM driving distance and duration matrix for all 14 hospitals.
- [ ] Add turn-by-turn route step breakdowns on the Safe Route interactive map.
- [ ] Implement server-sent events (SSE) streaming for real-time Blood AI chat.

### Medium-Term Objectives
- [ ] **Automated Seatbelt Detection via Computer Vision:** Train and integrate a lightweight MobileNet / YOLO model to verify seatbelt usage for four-wheeler rides (currently manual checkbox).
- [ ] **Hospital Laboratory API Integrations:** Collaborate with major blood transfusion centers (e.g., Red Crescent Bangladesh) for automated inventory updates.
- [ ] **Expanded Regional Emergency Contacts:** Add dedicated police control room numbers for all 64 districts.
- [ ] **Dynamic Re-Routing on High-Risk Obstacles:** Real-time road route re-calculation if user approaches newly approved incident hazards.

### Long-Term Objectives
- [ ] **Crowdsourced Road Vibration Sensing:** Smartphone accelerometer data collection to map road potholes and infrastructure degradation automatically.
- [ ] **Institutional Civic Partnership:** Direct integration with city corporations (DNCC, DSCC) and emergency dispatchers for automated municipal ticketing.

---

## Implemented vs Planned Features Breakdown

| Feature Area | Specific Capability | Implementation Status | Evidence / File Reference |
|---|---|:---:|---|
| **Buildathon Branding** | Top navbar banner & hero badge | **IMPLEMENTED** | `frontend/src/components/Navbar.tsx`, `page.tsx` |
| **Blood Matching** | All 8 ABO/Rh blood groups | **IMPLEMENTED** | `backend/app/models/hospital.py`, `blood.py` |
| **Blood AI Assistant** | Grounded NLP blood discovery | **IMPLEMENTED** | `backend/app/services/blood_ai_service.py` |
| **Hospital Directory** | 14 tertiary hospitals across 8 divisions | **IMPLEMENTED** | `backend/app/db/seed_hospitals.py` |
| **Hospital Distance** | OSRM driving distance + Haversine fallback | **IMPLEMENTED** | `backend/app/services/hospital_service.py` |
| **Safe Route AI** | Multi-route candidate comparison | **IMPLEMENTED** | `backend/app/services/safe_route.py` |
| **Agentic Road AI** | Tradeoff cost function & bilingual explanation | **IMPLEMENTED** | `backend/app/services/agentic_road_ai.py` |
| **Accident Blackspots** | ARI BUET & BRTA blackspot dataset | **IMPLEMENTED** | `backend/app/models/accident_zone.py` |
| **Helmet Detection** | OpenCV contour & Hough circle analysis | **IMPLEMENTED** | `backend/app/services/helmet_detection.py` |
| **Safe Ride Token** | 120s HMAC-SHA256 ride authorization gate | **IMPLEMENTED** | `backend/app/api/v1/endpoints/safe_ride.py` |
| **Emergency 999** | Direct 1-tap `tel:999` native dialer launch | **IMPLEMENTED** | `frontend/src/components/EmergencyCallModal.tsx` |
| **Police & Fire Directory** | 50+ stations with phone numbers & GPS | **IMPLEMENTED** | `backend/app/models/emergency_service.py` |
| **Incident Reporting** | Civic reporting form with media upload | **IMPLEMENTED** | `frontend/src/app/reports/create/page.tsx` |
| **Moderation Queue** | Admin review, approve, reject, flag | **IMPLEMENTED** | `backend/app/api/v1/endpoints/admin.py` |
| **Safety Map** | MapLibre GL 3D vector map with clusters | **IMPLEMENTED** | `frontend/src/app/safety-map/page.tsx` |
| **Missing Persons** | Alert bulletin board & public sightings | **IMPLEMENTED** | `backend/app/models/missing_person.py` |
| **Nirapotta Guard** | SOS timer & emergency contact dispatch | **IMPLEMENTED** | `backend/app/models/guard.py` |
| **Seatbelt Detection** | Automatic CV model for vehicle seatbelts | **PLANNED** | Currently manual confirmation checkbox |
| **Live Vehicle Traffic** | Real-time congestion telemetry | **PLANNED** | Currently uses OSRM graph baselines |
| **Automated Hospital LIS** | Real-time laboratory blood stock feeds | **PLANNED** | Currently database seeded baseline |

---

## License & Acknowledgements

- **License:** Open-source under the [MIT License](LICENSE).
- **Institution:** Developed at **Daffodil International University (DIU)**, Department of Computer Science and Engineering.
- **Accident Blackspot Data:** Sourced from public studies published by the **Accident Research Institute (ARI), Bangladesh University of Engineering and Technology (BUET)** and the **Bangladesh Road Transport Authority (BRTA)**.
- **Mapping & Routing:** Powered by **OpenStreetMap**, **MapLibre GL**, and **Project OSRM**.
- **Buildathon:** Engineered for **Ostad Presents YUNet AIgnite Buildathon 2026**.
