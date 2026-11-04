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
from app.models.blood import (
    BloodRequest,
    BloodRequestStatus,
    BloodUrgency,
    BloodGroup,
    BloodDonorProfile,
    DonorAvailability,
    BloodRequestResponse,
    ResponseStatus,
)
from app.models.flag import ContentFlag, FlagStatus
from app.core.security import create_access_token, get_password_hash
from app.schemas.ai_features import (
    SearchModerationReportsInput,
    GetModerationReportInput,
    GetModerationSummaryInput,
    SearchBloodRequestsAdminInput,
    AdminCopilotRequest,
    AdminCopilotConfirmRequest,
    AdminCopilotIntent,
)
from app.services.admin_copilot import (
    tool_search_moderation_reports,
    tool_get_moderation_report,
    tool_get_moderation_summary,
    tool_search_blood_requests_admin,
    tool_get_platform_activity,
    tool_get_recent_moderation_activity,
    tool_identify_operational_attention_items,
    tool_prepare_moderation_action,
    execute_admin_copilot_confirmation,
    process_admin_copilot_chat,
)


@pytest.fixture
async def seed_copilot_test_data(db_session: AsyncSession):
    """
    Seeds a controlled set of synthetic categories, users, reports,
    blood requests, and moderation records for testing Admin Copilot.
    """
    now = datetime.now(timezone.utc)
    hashed_pwd = get_password_hash("test_password_123")

    # 1. Categories
    categories = {}
    for slug, name in [("crime", "Crime"), ("public-safety", "Public Safety"), ("fraud", "Fraud")]:
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
        ("copilot_citizen", "copilot_citizen@test.local", UserRole.USER),
        ("copilot_mod", "copilot_mod@test.local", UserRole.MODERATOR),
        ("copilot_admin", "copilot_admin@test.local", UserRole.ADMIN),
    ]
    for uname, email, role in user_specs:
        stmt = select(User).where(User.email == email)
        res = await db_session.execute(stmt)
        usr = res.scalar_one_or_none()
        if not usr:
            usr = User(
                email=email,
                username=uname,
                full_name=f"Copilot {uname}",
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

    # Report 1: Submitted crime report in Savar (pending review)
    r1 = Report(
        user_id=users["copilot_citizen"].id,
        category_id=categories["crime"].id,
        title="Unverified Street Robbery in Savar",
        description="Muggers on a motorcycle snatched bags from commuters near Savar bus counter.",
        location_text="Savar Bus Stand, Savar, Dhaka",
        latitude=23.8583,
        longitude=90.2667,
        incident_date=now - timedelta(days=1),
        is_anonymous=False,
        status=ReportStatus.SUBMITTED,
        submitted_at=now - timedelta(days=1),
    )
    db_session.add(r1)
    await db_session.flush()
    reports["savar_submitted"] = r1

    # Report 2: Under-review fraud report in Dhanmondi
    r2 = Report(
        user_id=users["copilot_citizen"].id,
        category_id=categories["fraud"].id,
        title="Active MFS Cash-Out Phishing Ring",
        description="Fraudulent syndicate spoofing official merchant support numbers.",
        location_text="Road 27, Dhanmondi, Dhaka",
        latitude=23.7509,
        longitude=90.3753,
        incident_date=now - timedelta(hours=36),
        is_anonymous=True,
        status=ReportStatus.UNDER_REVIEW,
        submitted_at=now - timedelta(hours=36),
    )
    db_session.add(r2)
    await db_session.flush()

    mod_rec = ModerationRecord(
        report_id=r2.id,
        admin_id=users["copilot_mod"].id,
        action=ModerationAction.STARTED_REVIEW,
        user_message="Investigation started.",
        internal_notes="CONFIDENTIAL: Telecom fraud desk blacklist match.",
    )
    db_session.add(mod_rec)
    await db_session.flush()
    reports["dhanmondi_review"] = r2

    # Report 3: Stale report in Mirpur (> 48h in SUBMITTED queue) to trigger operational attention
    r3 = Report(
        user_id=users["copilot_citizen"].id,
        category_id=categories["public-safety"].id,
        title="Overdue Uninspected Hazardous Open Drain",
        description="Dangerous exposed culvert creating risk for pedestrians after dark.",
        location_text="Mirpur 10 Circle, Mirpur, Dhaka",
        latitude=23.8071,
        longitude=90.3686,
        incident_date=now - timedelta(days=3),
        is_anonymous=False,
        status=ReportStatus.SUBMITTED,
        submitted_at=now - timedelta(days=3),
    )
    r3.created_at = now - timedelta(days=3)  # Stale
    db_session.add(r3)
    await db_session.flush()
    reports["mirpur_stale"] = r3

    # 4. Blood Request: Emergency request with 0 responses to trigger operational attention
    br1 = BloodRequest(
        user_id=users["copilot_citizen"].id,
        blood_group=BloodGroup.O_POS,
        units_required=2,
        hospital_name="Savar Prime Hospital",
        hospital_area="Savar",
        district="Dhaka",
        required_date=now + timedelta(days=1),
        urgency=BloodUrgency.EMERGENCY,
        contact_name="Family Member",
        contact_phone="01700000099",
        status=BloodRequestStatus.OPEN,
        is_active=True,
    )
    db_session.add(br1)
    await db_session.flush()

    await db_session.commit()

    return {
        "categories": categories,
        "users": users,
        "reports": reports,
        "blood_request": br1,
    }


# ---------------------------------------------------------------------------
# Test 1: Citizen Access Denied (HTTP 403 Forbidden)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_copilot_citizen_denied_403(async_client: AsyncClient, seed_copilot_test_data):
    citizen = seed_copilot_test_data["users"]["copilot_citizen"]
    token = create_access_token(subject=str(citizen.id), role=citizen.role.value)

    response = await async_client.post(
        "/api/v1/admin/ai-assistant/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Show reports waiting for moderator review"},
    )
    assert response.status_code == 403
    assert "privileges required" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Test 2: Moderator and Admin Roles Authorized
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_copilot_moderator_and_admin_authorized(async_client: AsyncClient, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]
    admin = seed_copilot_test_data["users"]["copilot_admin"]

    mod_token = create_access_token(subject=str(mod.id), role=mod.role.value)
    admin_token = create_access_token(subject=str(admin.id), role=admin.role.value)

    # 1. Moderator authorized
    mod_res = await async_client.post(
        "/api/v1/admin/ai-assistant/copilot",
        headers={"Authorization": f"Bearer {mod_token}"},
        json={"message": "Show reports waiting for review"},
    )
    assert mod_res.status_code == 200
    assert mod_res.json()["intent"] == "SEARCH_MODERATION_REPORTS"

    # 2. Admin authorized
    admin_res = await async_client.post(
        "/api/v1/admin/ai-assistant/copilot",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"message": "Show platform activity"},
    )
    assert admin_res.status_code == 200
    assert admin_res.json()["intent"] == "GET_PLATFORM_ACTIVITY"


# ---------------------------------------------------------------------------
# Test 3: Controlled Tool - search_moderation_reports
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_search_moderation_reports(db_session: AsyncSession, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]

    # Filter by SUBMITTED status
    res = await tool_search_moderation_reports(
        db_session,
        SearchModerationReportsInput(status="SUBMITTED"),
        current_user=mod,
    )
    assert res.total_found >= 2
    for r in res.reports:
        assert r.status == "SUBMITTED"

    # Filter by district: Dhaka
    dhaka_res = await tool_search_moderation_reports(
        db_session,
        SearchModerationReportsInput(district="Dhaka"),
        current_user=mod,
    )
    assert dhaka_res.total_found >= 2


# ---------------------------------------------------------------------------
# Test 4: Controlled Tool - get_moderation_report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_get_moderation_report(db_session: AsyncSession, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]
    r2 = seed_copilot_test_data["reports"]["dhanmondi_review"]

    rep_out = await tool_get_moderation_report(
        db_session,
        GetModerationReportInput(report_id=str(r2.id)),
        current_user=mod,
    )
    assert rep_out.report_id == str(r2.id)
    assert rep_out.title == r2.title
    assert rep_out.reporter_email == "copilot_citizen@test.local"
    assert len(rep_out.moderation_history) >= 1
    assert "CONFIDENTIAL" in rep_out.moderation_history[0]["internal_notes"]


# ---------------------------------------------------------------------------
# Test 5: Controlled Tool - get_moderation_summary
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_get_moderation_summary(db_session: AsyncSession, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]

    summary = await tool_get_moderation_summary(
        db_session,
        GetModerationSummaryInput(),
        current_user=mod,
    )
    assert summary.total_reports >= 3
    assert summary.pending_review_count >= 3  # SUBMITTED + UNDER_REVIEW
    assert "Moderation Queue Summary" in summary.summary_narrative


# ---------------------------------------------------------------------------
# Test 6: Controlled Tool - search_blood_requests_admin
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_search_blood_requests_admin(db_session: AsyncSession, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]

    res = await tool_search_blood_requests_admin(
        db_session,
        SearchBloodRequestsAdminInput(blood_group="O+"),
        current_user=mod,
    )
    assert res.total_found >= 1
    assert res.requests[0].blood_group == "O+"
    assert res.requests[0].urgency == "EMERGENCY"


# ---------------------------------------------------------------------------
# Test 7: Controlled Tool - get_platform_activity
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_get_platform_activity(db_session: AsyncSession, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]

    act = await tool_get_platform_activity(db_session, current_user=mod)
    assert act.total_reports >= 3
    assert act.pending_reports >= 3
    assert act.total_blood_requests >= 1
    assert "Platform Operational Activity Overview" in act.summary_narrative


# ---------------------------------------------------------------------------
# Test 8: Controlled Tool - identify_operational_attention_items
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tool_identify_operational_attention_items(db_session: AsyncSession, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]

    items_out = await tool_identify_operational_attention_items(db_session, current_user=mod)
    assert items_out.total_items >= 1

    # Should detect the unresponded emergency blood request
    emergency_items = [i for i in items_out.items if i.item_type == "BLOOD_UNRESPONDED_EMERGENCY"]
    assert len(emergency_items) >= 1
    assert emergency_items[0].severity == "CRITICAL"


# ---------------------------------------------------------------------------
# Test 9: Action Preview and Explicit Confirmation Lifecycle
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_action_preview_and_explicit_confirmation_lifecycle(db_session: AsyncSession, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]
    r1 = seed_copilot_test_data["reports"]["savar_submitted"]

    # 1. Prepare action preview (Approve report)
    preview = await tool_prepare_moderation_action(
        db=db_session,
        report_id=str(r1.id),
        action_type="APPROVE_REPORT",
        reason="Report verified with local traffic patrol.",
        user_message="Verified and published to feed.",
        internal_notes="Reviewed police GD cross-reference.",
        current_user=mod,
    )
    assert preview.action_type == "APPROVE_REPORT"
    assert preview.current_status == "SUBMITTED"
    assert preview.proposed_status == "APPROVED"
    assert preview.confirmation_token.startswith("adm-token-")
    assert preview.requires_confirmation is True

    # 2. Verify database has NOT changed yet (still SUBMITTED)
    r1_before = (await db_session.execute(select(Report).where(Report.id == r1.id))).scalar_one()
    assert r1_before.status == ReportStatus.SUBMITTED

    # 3. Explicitly confirm and execute
    confirm_res = await execute_admin_copilot_confirmation(
        db=db_session,
        confirm_data=AdminCopilotConfirmRequest(
            conversation_id="conv-test-1",
            confirmation_token=preview.confirmation_token,
            action_type="APPROVE_REPORT",
            target_record_id=str(r1.id),
        ),
        current_user=mod,
    )
    assert confirm_res.status == "SUCCESS"
    assert confirm_res.previous_status == "SUBMITTED"
    assert confirm_res.new_status == "APPROVED"

    # 4. Verify database is now updated to APPROVED
    r1_after = (await db_session.execute(select(Report).where(Report.id == r1.id))).scalar_one()
    assert r1_after.status == ReportStatus.APPROVED

    # 5. Replay attempt returns ALREADY_PROCESSED
    replay_res = await execute_admin_copilot_confirmation(
        db=db_session,
        confirm_data=AdminCopilotConfirmRequest(
            conversation_id="conv-test-1",
            confirmation_token=preview.confirmation_token,
            action_type="APPROVE_REPORT",
            target_record_id=str(r1.id),
        ),
        current_user=mod,
    )
    assert replay_res.status == "ALREADY_PROCESSED"


# ---------------------------------------------------------------------------
# Test 10: Confirmation Security Safeguards
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_confirmation_security_safeguards(db_session: AsyncSession, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]
    r2 = seed_copilot_test_data["reports"]["dhanmondi_review"]

    # 1. Invalid token raises ValueError
    with pytest.raises(ValueError, match="Invalid, expired, or previously consumed"):
        await execute_admin_copilot_confirmation(
            db=db_session,
            confirm_data=AdminCopilotConfirmRequest(
                conversation_id="conv-test-2",
                confirmation_token="invalid-token-12345",
                action_type="APPROVE_REPORT",
                target_record_id=str(r2.id),
            ),
            current_user=mod,
        )

    # 2. Reject action preview & execution
    reject_preview = await tool_prepare_moderation_action(
        db=db_session,
        report_id=str(r2.id),
        action_type="REJECT_REPORT",
        reason="Report could not be verified.",
        user_message="Insufficient credible evidence.",
        internal_notes="Investigated and dismissed.",
        current_user=mod,
    )
    reject_confirm = await execute_admin_copilot_confirmation(
        db=db_session,
        confirm_data=AdminCopilotConfirmRequest(
            conversation_id="conv-test-2",
            confirmation_token=reject_preview.confirmation_token,
            action_type="REJECT_REPORT",
            target_record_id=str(r2.id),
        ),
        current_user=mod,
    )
    assert reject_confirm.status == "SUCCESS"
    assert reject_confirm.new_status == "REJECTED"


# ---------------------------------------------------------------------------
# Test 11: End-to-End HTTP Endpoint Integration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_http_copilot_endpoint_and_confirm(async_client: AsyncClient, seed_copilot_test_data):
    mod = seed_copilot_test_data["users"]["copilot_mod"]
    token = create_access_token(subject=str(mod.id), role=mod.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    r3 = seed_copilot_test_data["reports"]["mirpur_stale"]

    # 1. Natural-language chat request asking to reject a stale report
    chat_res = await async_client.post(
        "/api/v1/admin/ai-assistant/copilot",
        headers=headers,
        json={"message": f"reject report {r3.id}"},
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert chat_data["intent"] == "PREPARE_MODERATION_ACTION"
    assert chat_data["action_preview"] is not None
    conf_token = chat_data["action_preview"]["confirmation_token"]

    # 2. Confirm action execution via HTTP
    confirm_res = await async_client.post(
        "/api/v1/admin/ai-assistant/copilot/confirm",
        headers=headers,
        json={
            "conversation_id": chat_data["conversation_id"],
            "confirmation_token": conf_token,
            "action_type": "REJECT_REPORT",
            "target_record_id": str(r3.id),
            "user_message": "Report expired and deemed unverifiable.",
        },
    )
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["status"] == "SUCCESS"
    assert confirm_data["new_status"] == "REJECTED"
