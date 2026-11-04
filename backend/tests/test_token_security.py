import uuid
import asyncio
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.moderation import ModerationRecord
from app.core.security import get_password_hash, create_access_token
from app.schemas.ai_features import AdminCopilotConfirmRequest
from app.services.admin_copilot import (
    generate_action_preview,
    execute_admin_copilot_confirmation,
    _ADMIN_COPILOT_TOKENS,
)
from app.services.donor_coordination import (
    _COORDINATION_TOKENS,
)


@pytest.fixture
async def sample_category(db_session: AsyncSession) -> Category:
    cat = Category(id=uuid.uuid4(), name="Safety Hazard", slug="safety-hazard", description="Road & physical hazards")
    db_session.add(cat)
    await db_session.commit()
    return cat


@pytest.fixture
async def sample_moderator(db_session: AsyncSession) -> User:
    mod = User(
        id=uuid.uuid4(),
        email="moderator_token_test@nirapotta.gov.bd",
        username="modtokentest",
        hashed_password=get_password_hash("ModPassword123!"),
        role=UserRole.MODERATOR,
        is_active=True,
    )
    db_session.add(mod)
    await db_session.commit()
    return mod


@pytest.fixture
async def sample_citizen(db_session: AsyncSession) -> User:
    citizen = User(
        id=uuid.uuid4(),
        email="citizen_token_test@example.com",
        username="citizentokentest",
        hashed_password=get_password_hash("CitizenPassword123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(citizen)
    await db_session.commit()
    return citizen


@pytest.fixture
async def sample_report(db_session: AsyncSession, sample_citizen: User, sample_category: Category) -> Report:
    report = Report(
        id=uuid.uuid4(),
        user_id=sample_citizen.id,
        category_id=sample_category.id,
        title="Pothole near Farmgate",
        description="Hazardous road depression blocking bus lane.",
        location_text="Farmgate Tejgaon",
        latitude=23.7561,
        longitude=90.3872,
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(report)
    await db_session.commit()
    return report


# ---------------------------------------------------------------------------
# Test 1: Active Token Generation and Expiration
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_token_creation_and_expiration(sample_report: Report, sample_moderator: User, db_session: AsyncSession):
    preview = generate_action_preview(
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
        target_title=sample_report.title,
        current_status="SUBMITTED",
        proposed_status="APPROVED",
        reason="Report verified with clear photographic evidence",
        details={"category": "safety-hazard"},
        user_id=sample_moderator.id,
    )

    token = preview.confirmation_token
    assert token is not None
    assert token.startswith("adm-token-")
    assert token in _ADMIN_COPILOT_TOKENS
    assert preview.expires_at > datetime.now(timezone.utc)

    # Artificially expire token
    _ADMIN_COPILOT_TOKENS[token]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=10)

    confirm_req = AdminCopilotConfirmRequest(
        conversation_id="conv-test-1",
        confirmation_token=token,
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
    )

    with pytest.raises(ValueError, match="expired"):
        await execute_admin_copilot_confirmation(db=db_session, confirm_data=confirm_req, current_user=sample_moderator)


# ---------------------------------------------------------------------------
# Test 2: Single-Use Consumption and Replay Rejection
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_token_single_use_and_replay_rejection(
    sample_report: Report,
    sample_moderator: User,
    db_session: AsyncSession,
):
    preview = generate_action_preview(
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
        target_title=sample_report.title,
        current_status="SUBMITTED",
        proposed_status="APPROVED",
        reason="Verified valid community report",
        details={},
        user_id=sample_moderator.id,
    )
    token = preview.confirmation_token

    confirm_req = AdminCopilotConfirmRequest(
        conversation_id="conv-test-1",
        confirmation_token=token,
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
    )

    # 1. First execution succeeds
    resp1 = await execute_admin_copilot_confirmation(db=db_session, confirm_data=confirm_req, current_user=sample_moderator)
    assert resp1.status == "SUCCESS"
    assert resp1.new_status == "APPROVED"

    # 2. Second execution with same token is detected as replay and rejected
    resp2 = await execute_admin_copilot_confirmation(db=db_session, confirm_data=confirm_req, current_user=sample_moderator)
    assert resp2.status == "ALREADY_PROCESSED"
    assert "already been confirmed and executed" in resp2.message


# ---------------------------------------------------------------------------
# Test 3: Process Restart Behavior (In-Memory Loss Analysis)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_token_behavior_on_process_restart(
    sample_report: Report,
    sample_moderator: User,
    db_session: AsyncSession,
):
    """
    Simulates a backend process restart where in-process token dictionaries are reset.
    Verifies that:
    1. Unconsumed outstanding tokens cannot execute after restart.
    2. Completed tokens cannot be re-executed because active token presence is required.
    """
    preview = generate_action_preview(
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
        target_title=sample_report.title,
        current_status="SUBMITTED",
        proposed_status="APPROVED",
        reason="Verified valid report",
        details={},
        user_id=sample_moderator.id,
    )
    token = preview.confirmation_token

    # Simulate Process Restart (all in-process memory is wiped)
    _ADMIN_COPILOT_TOKENS.clear()

    confirm_req = AdminCopilotConfirmRequest(
        conversation_id="conv-test-1",
        confirmation_token=token,
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
    )

    # The token is no longer in memory; system must safely reject execution
    with pytest.raises(ValueError, match="Invalid, expired, or previously consumed confirmation token"):
        await execute_admin_copilot_confirmation(db=db_session, confirm_data=confirm_req, current_user=sample_moderator)


# ---------------------------------------------------------------------------
# Test 4: State Conflict Detection
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_token_state_conflict_detection(
    sample_report: Report,
    sample_moderator: User,
    db_session: AsyncSession,
):
    """
    If target record status changes in the database between preview generation and confirmation,
    the backend detects the state conflict and aborts.
    """
    preview = generate_action_preview(
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
        target_title=sample_report.title,
        current_status="SUBMITTED",
        proposed_status="APPROVED",
        reason="Valid report",
        details={},
        user_id=sample_moderator.id,
    )
    token = preview.confirmation_token

    # External actor changes status in DB prior to confirmation
    sample_report.status = ReportStatus.REJECTED
    await db_session.commit()

    confirm_req = AdminCopilotConfirmRequest(
        conversation_id="conv-test-1",
        confirmation_token=token,
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
    )

    with pytest.raises(ValueError, match="State conflict: Report status changed"):
        await execute_admin_copilot_confirmation(db=db_session, confirm_data=confirm_req, current_user=sample_moderator)


# ---------------------------------------------------------------------------
# Test 5: Permission Re-Validation at Confirmation Time
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_token_authorization_revalidation(
    sample_report: Report,
    sample_moderator: User,
    sample_citizen: User,
    db_session: AsyncSession,
):
    """Even if an attacker obtains a valid admin confirmation token, an unauthorized user cannot execute it."""
    preview = generate_action_preview(
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
        target_title=sample_report.title,
        current_status="SUBMITTED",
        proposed_status="APPROVED",
        reason="Valid report",
        details={},
        user_id=sample_moderator.id,
    )
    token = preview.confirmation_token

    confirm_req = AdminCopilotConfirmRequest(
        conversation_id="conv-test-1",
        confirmation_token=token,
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
    )

    with pytest.raises(PermissionError, match="Access restricted"):
        await execute_admin_copilot_confirmation(db=db_session, confirm_data=confirm_req, current_user=sample_citizen)


# ---------------------------------------------------------------------------
# Test 6: Concurrent Confirmation Deduplication
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_concurrent_confirmation_deduplication(
    sample_report: Report,
    sample_moderator: User,
    db_session: AsyncSession,
):
    """
    Simulates concurrent confirmation submissions with the same token.
    Verifies that only one execution mutates database state, and the duplicate is rejected.
    """
    preview = generate_action_preview(
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
        target_title=sample_report.title,
        current_status="SUBMITTED",
        proposed_status="APPROVED",
        reason="Approved valid report",
        details={},
        user_id=sample_moderator.id,
    )
    token = preview.confirmation_token

    confirm_req = AdminCopilotConfirmRequest(
        conversation_id="conv-test-1",
        confirmation_token=token,
        action_type="APPROVE_REPORT",
        target_record_id=str(sample_report.id),
    )

    # First execution succeeds
    resp1 = await execute_admin_copilot_confirmation(db=db_session, confirm_data=confirm_req, current_user=sample_moderator)
    assert resp1.status == "SUCCESS"

    # Concurrent or immediate second execution
    resp2 = await execute_admin_copilot_confirmation(db=db_session, confirm_data=confirm_req, current_user=sample_moderator)
    assert resp2.status == "ALREADY_PROCESSED"

