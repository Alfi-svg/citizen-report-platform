import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.moderation import ModerationRecord, ModerationAction
from app.core.security import create_access_token, get_password_hash
from app.schemas.ai_features import (
    SearchIncidentReportsInput,
    GetIncidentReportInput,
    GetIncidentSummaryInput,
    AnalyzeIncidentReportInput,
    FindPossibleDuplicatesInput,
    PrepareReportReviewInput,
    IncidentIntelligenceRequest,
    IncidentIntelligenceIntent,
)
from app.services.incident_intelligence import (
    tool_search_incident_reports,
    tool_get_incident_report,
    tool_get_incident_summary,
    tool_analyze_incident_report,
    tool_find_possible_duplicate_reports,
    tool_prepare_report_review,
    process_incident_intelligence_chat,
    extract_location_from_text,
    extract_category_slug,
    extract_report_uuid,
)


@pytest.fixture
async def seed_incident_test_data(db_session: AsyncSession):
    """
    Seeds a controlled set of synthetic categories, users, reports,
    and moderation records for testing Incident Intelligence.
    """
    now = datetime.now(timezone.utc)
    hashed_pwd = get_password_hash("test_password_123")

    # 1. Categories
    categories = {}
    cat_specs = [
        ("crime", "Crime"),
        ("public-safety", "Public Safety"),
        ("violence", "Violence"),
        ("fraud", "Fraud"),
        ("environmental-issue", "Environmental Issue"),
    ]
    for slug, name in cat_specs:
        stmt = select(Category).where(Category.slug == slug)
        res = await db_session.execute(stmt)
        cat = res.scalar_one_or_none()
        if not cat:
            cat = Category(name=name, slug=slug, is_active=True)
            db_session.add(cat)
            await db_session.flush()
        categories[slug] = cat

    # 2. Users
    users = {}
    user_specs = [
        ("citizen_1", "citizen_1@test.local", UserRole.USER),
        ("citizen_2", "citizen_2@test.local", UserRole.USER),
        ("mod_officer", "mod_officer@test.local", UserRole.MODERATOR),
        ("admin_user", "admin_user@test.local", UserRole.ADMIN),
    ]
    for uname, email, role in user_specs:
        stmt = select(User).where(User.email == email)
        res = await db_session.execute(stmt)
        usr = res.scalar_one_or_none()
        if not usr:
            usr = User(
                email=email,
                username=uname,
                full_name=f"Test {uname}",
                hashed_password=hashed_pwd,
                role=role,
                is_active=True,
                is_verified=True,
            )
            db_session.add(usr)
            await db_session.flush()
        users[uname] = usr

    # 3. Reports
    reports = {}

    # Report 1: Approved crime report in Savar (has coordinates, non-anonymous)
    r1 = Report(
        user_id=users["citizen_1"].id,
        category_id=categories["crime"].id,
        title="Armed Robbery near Savar Bus Stand",
        description="Two individuals on a motorcycle threatened pedestrians with a weapon and snatched bags.",
        location_text="Savar Bus Stand, Savar, Dhaka",
        latitude=23.8583,
        longitude=90.2667,
        incident_date=now - timedelta(days=2),
        is_anonymous=False,
        status=ReportStatus.APPROVED,
        submitted_at=now - timedelta(days=2),
    )
    db_session.add(r1)
    await db_session.flush()
    reports["savar_approved_crime"] = r1

    # Report 2: Submitted crime report in Savar (Potential Duplicate of R1, anonymous)
    r2 = Report(
        user_id=users["citizen_2"].id,
        category_id=categories["crime"].id,
        title="Mugging with knife near Savar Bus Stop",
        description="Muggers with blades snatched smartphone and cash near bus stand at night.",
        location_text="Near Savar Bus Stop, Savar, Dhaka",
        latitude=23.8588,
        longitude=90.2671,
        incident_date=now - timedelta(days=1, hours=18),
        is_anonymous=True,
        status=ReportStatus.SUBMITTED,
        submitted_at=now - timedelta(days=1, hours=18),
    )
    db_session.add(r2)
    await db_session.flush()
    reports["savar_submitted_duplicate"] = r2

    # Report 3: Approved public safety hazard in Mirpur (no coordinates, text only)
    r3 = Report(
        user_id=users["citizen_1"].id,
        category_id=categories["public-safety"].id,
        title="Open manhole on pedestrian path",
        description="Hazardous open drain without barricade near roundabout.",
        location_text="Mirpur 10 Circle, Mirpur, Dhaka",
        latitude=None,
        longitude=None,
        incident_date=now - timedelta(days=3),
        is_anonymous=False,
        status=ReportStatus.APPROVED,
        submitted_at=now - timedelta(days=3),
    )
    db_session.add(r3)
    await db_session.flush()
    reports["mirpur_approved_safety"] = r3

    # Report 4: Under-review fraud report in Dhanmondi with ModerationRecord containing internal notes
    r4 = Report(
        user_id=users["citizen_2"].id,
        category_id=categories["fraud"].id,
        title="Online MFS phishing scam targeting shopkeepers",
        description="Fake customer care calls tricking users into revealing OTP codes.",
        location_text="Road 27, Dhanmondi, Dhaka",
        latitude=23.7509,
        longitude=90.3753,
        incident_date=now - timedelta(days=1),
        is_anonymous=False,
        status=ReportStatus.UNDER_REVIEW,
        submitted_at=now - timedelta(days=1),
    )
    db_session.add(r4)
    await db_session.flush()

    mod_record = ModerationRecord(
        report_id=r4.id,
        admin_id=users["mod_officer"].id,
        action=ModerationAction.STARTED_REVIEW,
        user_message="Investigation initiated with cyber cell.",
        internal_notes="CONFIDENTIAL: Phone number flagged in national fraud syndicate index.",
    )
    db_session.add(mod_record)
    await db_session.flush()
    reports["dhanmondi_under_review_fraud"] = r4

    await db_session.commit()

    return {
        "categories": categories,
        "users": users,
        "reports": reports,
    }


# ---------------------------------------------------------------------------
# Test 1: Search Reports Public vs Moderator Access Control
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_search_incident_reports_public_vs_moderator(db_session: AsyncSession, seed_incident_test_data):
    users = seed_incident_test_data["users"]

    # 1. Unauthenticated citizen search (should only see APPROVED reports)
    pub_res = await tool_search_incident_reports(
        db_session,
        SearchIncidentReportsInput(),
        current_user=None,
    )
    assert pub_res.total_found >= 2
    for r in pub_res.reports:
        assert r.status == ReportStatus.APPROVED.value
        assert r.is_verified is True

    # 2. Citizen 2 search (sees APPROVED reports + their own submitted/under_review reports)
    c2_res = await tool_search_incident_reports(
        db_session,
        SearchIncidentReportsInput(),
        current_user=users["citizen_2"],
    )
    # Citizen 2 owns "savar_submitted_duplicate" and "dhanmondi_under_review_fraud"
    c2_report_ids = [r.id for r in c2_res.reports]
    assert str(seed_incident_test_data["reports"]["savar_submitted_duplicate"].id) in c2_report_ids

    # 3. Moderator search (sees all reports across all statuses)
    mod_res = await tool_search_incident_reports(
        db_session,
        SearchIncidentReportsInput(status="UNDER_REVIEW"),
        current_user=users["mod_officer"],
    )
    assert mod_res.total_found >= 1
    assert any(r.status == "UNDER_REVIEW" for r in mod_res.reports)


# ---------------------------------------------------------------------------
# Test 2: Search Filters (Category, Location, Pagination)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_search_incident_reports_filters(db_session: AsyncSession, seed_incident_test_data):
    # Filter by Category: crime
    crime_res = await tool_search_incident_reports(
        db_session,
        SearchIncidentReportsInput(category="crime"),
        current_user=None,
    )
    for r in crime_res.reports:
        assert r.category_slug == "crime"

    # Filter by Area: Savar
    savar_res = await tool_search_incident_reports(
        db_session,
        SearchIncidentReportsInput(area="Savar"),
        current_user=None,
    )
    assert savar_res.total_found >= 1
    assert "Savar" in savar_res.reports[0].location_text

    # Pagination bounds
    page_res = await tool_search_incident_reports(
        db_session,
        SearchIncidentReportsInput(limit=1, offset=0),
        current_user=None,
    )
    assert len(page_res.reports) == 1


# ---------------------------------------------------------------------------
# Test 3: Zero Hallucination on Empty Results
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_zero_hallucination_empty_results(db_session: AsyncSession, seed_incident_test_data):
    # Search for an area with no reports
    res = await tool_search_incident_reports(
        db_session,
        SearchIncidentReportsInput(district="Barguna"),
        current_user=None,
    )
    assert res.total_found == 0
    assert len(res.reports) == 0

    # Summary for area with no reports
    summary = await tool_get_incident_summary(
        db_session,
        GetIncidentSummaryInput(district="Barguna"),
        current_user=None,
    )
    assert summary.total_reports == 0
    assert "0 matching incident reports" in summary.summary_narrative or "0" in summary.summary_narrative


# ---------------------------------------------------------------------------
# Test 4: Report Details, Privacy Masking, and Moderation Notes Shielding
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_get_incident_report_and_privacy(db_session: AsyncSession, seed_incident_test_data):
    users = seed_incident_test_data["users"]
    reports = seed_incident_test_data["reports"]

    anon_report = reports["savar_submitted_duplicate"]
    fraud_report = reports["dhanmondi_under_review_fraud"]

    # 1. Anonymous report privacy check:
    # Citizen 2 is the owner, but let's test how it appears when viewed
    r_detail_mod = await tool_get_incident_report(
        db_session,
        GetIncidentReportInput(report_id=str(anon_report.id)),
        current_user=users["mod_officer"],
    )
    assert r_detail_mod.is_authorized is True

    # 2. Unapproved report authorization check:
    # Citizen 1 is not the owner of fraud_report (owned by Citizen 2)
    unauth_res = await tool_get_incident_report(
        db_session,
        GetIncidentReportInput(report_id=str(fraud_report.id)),
        current_user=users["citizen_1"],
    )
    assert unauth_res.is_authorized is False
    assert "not authorized" in unauth_res.error_message.lower()

    # 3. Moderation notes shielding check:
    # Owner Citizen 2 can view the unapproved report, but CANNOT see internal moderation notes
    owner_res = await tool_get_incident_report(
        db_session,
        GetIncidentReportInput(report_id=str(fraud_report.id)),
        current_user=users["citizen_2"],
    )
    assert owner_res.is_authorized is True
    assert owner_res.moderation_notes is None  # Strictly shielded!

    # Moderator CAN view internal moderation notes
    mod_view_res = await tool_get_incident_report(
        db_session,
        GetIncidentReportInput(report_id=str(fraud_report.id)),
        current_user=users["mod_officer"],
    )
    assert mod_view_res.is_authorized is True
    assert mod_view_res.moderation_notes is not None
    assert "CONFIDENTIAL" in mod_view_res.moderation_notes


# ---------------------------------------------------------------------------
# Test 5: Incident Summary Generation Grounded in Database
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_get_incident_summary(db_session: AsyncSession, seed_incident_test_data):
    users = seed_incident_test_data["users"]

    summary = await tool_get_incident_summary(
        db_session,
        GetIncidentSummaryInput(district="Dhaka"),
        current_user=users["mod_officer"],
    )
    assert summary.total_reports >= 3
    assert "Crime" in summary.by_category or "crime" in summary.by_category
    assert summary.verified_count >= 2
    assert "Database summary for Dhaka" in summary.summary_narrative


# ---------------------------------------------------------------------------
# Test 6: Report Analysis (Verified Facts vs AI Interpretation)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_analyze_incident_report(db_session: AsyncSession, seed_incident_test_data):
    reports = seed_incident_test_data["reports"]
    r1 = reports["savar_approved_crime"]
    r3 = reports["mirpur_approved_safety"]

    # Analyze R1 (Has coordinates)
    analysis_r1 = await tool_analyze_incident_report(
        db_session,
        AnalyzeIncidentReportInput(report_id=str(r1.id)),
        current_user=None,
    )
    assert analysis_r1.is_authorized is True
    assert len(analysis_r1.verified_facts) >= 3
    assert any("Geolocation: Coordinates" in f or "Verified Geolocation" in f for f in analysis_r1.verified_facts)
    assert "[AI Interpretation - Advisory Only]" in analysis_r1.ai_interpretation
    assert analysis_r1.confidence_score >= 0.60

    # Analyze R3 (Missing GPS coordinates)
    analysis_r3 = await tool_analyze_incident_report(
        db_session,
        AnalyzeIncidentReportInput(report_id=str(r3.id)),
        current_user=None,
    )
    assert any("GPS Coordinates" in m for m in analysis_r3.missing_or_incomplete_info)


# ---------------------------------------------------------------------------
# Test 7: Duplicate Report Detection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_find_possible_duplicates(db_session: AsyncSession, seed_incident_test_data):
    users = seed_incident_test_data["users"]
    reports = seed_incident_test_data["reports"]
    r1 = reports["savar_approved_crime"]
    r2 = reports["savar_submitted_duplicate"]

    # Moderator queries duplicates for R1
    dup_res = await tool_find_possible_duplicate_reports(
        db_session,
        FindPossibleDuplicatesInput(report_id=str(r1.id)),
        current_user=users["mod_officer"],
    )
    assert dup_res.total_candidates >= 1
    top_cand = dup_res.candidate_duplicates[0]
    assert top_cand.report_id == str(r2.id)
    assert top_cand.similarity_score >= 0.50
    assert any("category" in r.lower() for r in top_cand.similarity_reasons)
    assert "advisory only" in dup_res.safe_notice.lower()


# ---------------------------------------------------------------------------
# Test 8: Prepare Report Review Authorization
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_prepare_report_review_authorization(db_session: AsyncSession, seed_incident_test_data):
    users = seed_incident_test_data["users"]
    reports = seed_incident_test_data["reports"]
    r2 = reports["savar_submitted_duplicate"]

    # Citizen is blocked
    cit_res = await tool_prepare_report_review(
        db_session,
        PrepareReportReviewInput(report_id=str(r2.id)),
        current_user=users["citizen_1"],
    )
    assert cit_res.is_authorized is False
    assert "restricted" in cit_res.error_message.lower()

    # Moderator is permitted
    mod_res = await tool_prepare_report_review(
        db_session,
        PrepareReportReviewInput(report_id=str(r2.id)),
        current_user=users["mod_officer"],
    )
    assert mod_res.is_authorized is True
    assert mod_res.suggested_action in ("APPROVE", "REQUEST_MORE_INFO", "REJECT", "ESCALATE")
    assert len(mod_res.checklist) == 4
    assert mod_res.review_preview["action_requires_explicit_confirmation"] is True


# ---------------------------------------------------------------------------
# Test 9: Conversational Chat across Bangla and English
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_incident_intelligence_natural_language(db_session: AsyncSession, seed_incident_test_data):
    users = seed_incident_test_data["users"]

    # 1. Bangla query for Savar
    chat_bn = await process_incident_intelligence_chat(
        db_session,
        IncidentIntelligenceRequest(message="সাভারে অপরাধের কয়টি রিপোর্ট আছে?"),
        current_user=None,
    )
    assert chat_bn.intent in (IncidentIntelligenceIntent.SEARCH_INCIDENTS, IncidentIntelligenceIntent.GET_INCIDENT_SUMMARY)
    assert "রিপোর্ট" in chat_bn.reply or "সাভার" in chat_bn.reply

    # 2. English query for duplicate reports
    chat_dup = await process_incident_intelligence_chat(
        db_session,
        IncidentIntelligenceRequest(message="Find duplicate reports in Savar"),
        current_user=users["mod_officer"],
    )
    assert chat_dup.intent == IncidentIntelligenceIntent.FIND_DUPLICATES
    assert chat_dup.tool_executed == "find_possible_duplicate_reports"

    # 3. Ambiguous query triggering clarification
    chat_vague = await process_incident_intelligence_chat(
        db_session,
        IncidentIntelligenceRequest(message="tell me reports"),
        current_user=None,
    )
    assert chat_vague.intent == IncidentIntelligenceIntent.CLARIFY_QUERY
    assert chat_vague.is_clarification_needed is True
    assert chat_vague.follow_up_question is not None


# ---------------------------------------------------------------------------
# Test 10: Full HTTP Endpoint Integration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_api_endpoint_incident_intelligence(async_client: AsyncClient, seed_incident_test_data):
    users = seed_incident_test_data["users"]
    mod_user = users["mod_officer"]
    mod_token = create_access_token(subject=str(mod_user.id), role=mod_user.role.value)

    # POST to /api/v1/reports/ai-assistant/incident-intelligence
    response = await async_client.post(
        "/api/v1/reports/ai-assistant/incident-intelligence",
        json={"message": "Show crime reports in Savar"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["intent"] in ["SEARCH_INCIDENTS", "GET_INCIDENT_SUMMARY"]
    assert data["search_results"] is not None

    # Authenticated moderator request with report review intent
    r1 = seed_incident_test_data["reports"]["savar_approved_crime"]
    mod_response = await async_client.post(
        "/api/v1/reports/ai-assistant/incident-intelligence",
        headers={"Authorization": f"Bearer {mod_token}"},
        json={"message": f"review report {r1.id}"},
    )
    assert mod_response.status_code == 200
    mod_data = mod_response.json()
    assert mod_data["intent"] == "PREPARE_REVIEW"
    assert mod_data["review_preview"] is not None
    assert mod_data["review_preview"]["is_authorized"] is True
