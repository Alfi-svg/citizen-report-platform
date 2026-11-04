import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.core.security import get_password_hash, create_access_token


@pytest.fixture
async def sample_categories(db_session: AsyncSession):
    cats = [
        Category(id=uuid.uuid4(), name="Public Safety", slug="public-safety", description="Safety hazards"),
        Category(id=uuid.uuid4(), name="Crime", slug="crime", description="General crime"),
        Category(id=uuid.uuid4(), name="Violence", slug="violence", description="Violence & clashes"),
    ]
    for c in cats:
        db_session.add(c)
    await db_session.commit()
    return cats


@pytest.fixture
async def sample_user(db_session: AsyncSession):
    user = User(
        id=uuid.uuid4(),
        email="voice_citizen_tester@example.com",
        username="voicecitizentester",
        hashed_password=get_password_hash("SecretVoice123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


# ---------------------------------------------------------------------------
# Phase E: AI Voice & Audio Emergency Intake Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_voice_intake_empty_transcript_fails(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Empty or whitespace-only voice transcript is rejected with HTTP 400."""
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={"transcript": "   ", "lang": "en"},
    )
    assert res.status_code == 400
    assert "Voice transcript cannot be empty" in res.json()["detail"]


@pytest.mark.asyncio
async def test_voice_intake_excessively_long_transcript_fails(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Transcripts exceeding 4000 characters fail schema validation with HTTP 422."""
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={"transcript": "A" * 4001, "lang": "en"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_voice_intake_english_incident_complete(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """Complete English speech transcript generates structured draft and confirmation token."""
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={
            "transcript": "Severe multi-vehicle collision near Dhanmondi 27. Two passengers are injured and bleeding.",
            "raw_transcript": "Severe multi-vehicle collision near Dhanmondi 27",
            "audio_duration_seconds": 6.8,
            "lang": "en",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["input_mode"] == "voice"
    assert data["transcript"] == "Severe multi-vehicle collision near Dhanmondi 27. Two passengers are injured and bleeding."
    assert data["raw_transcript"] == "Severe multi-vehicle collision near Dhanmondi 27"
    assert data["was_edited"] is True
    assert data["audio_duration_seconds"] == 6.8
    assert data["audio_retention_policy"] == "TRANSIENT_PROCESSED_NOT_STORED"
    assert data["is_ready_for_review"] is True
    assert data["confirmation_token"] is not None
    assert data["draft_report"] is not None
    assert "Dhanmondi" in data["draft_report"]["location_text"]
    assert "999" in data["emergency_notice"]
    assert data["speech_synthesis_hint"] is not None
    assert len(data["speech_synthesis_hint"]) > 0


@pytest.mark.asyncio
async def test_voice_intake_bangla_incident_missing_location(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """Bangla speech transcript missing location triggers follow-up question and does not generate confirmation token."""
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={
            "transcript": "একটি বড় বাস দুর্ঘটনা ঘটেছে। কয়েকজন আহত।",
            "audio_duration_seconds": 4.2,
            "lang": "bn",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["input_mode"] == "voice"
    assert data["is_ready_for_review"] is False
    assert data["confirmation_token"] is None
    assert "location_text" in data["missing_fields"]
    assert data["follow_up_question"] is not None
    assert "৯৯৯" in data["emergency_notice"]
    assert data["was_edited"] is False


@pytest.mark.asyncio
async def test_voice_intake_banglish_blood_request(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """Voice emergency blood intake in Banglish correctly extracts blood group, quantity, and urgency."""
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={
            "transcript": "Emergency O+ blood lagbe. Dhaka Medical e patient critical, 2 bags immediately lagbe. Contact: 01712345678",
            "audio_duration_seconds": 8.1,
            "lang": "bn",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["input_mode"] == "voice"
    assert data["emergency_type"] == "BLOOD_REQUEST"
    assert data["extracted_fields"]["blood_group"] == "O+"
    assert data["extracted_fields"]["units_required"] == 2
    assert "Dhaka Medical" in data["extracted_fields"]["hospital_name"]
    assert data["is_ready_for_review"] is True
    assert data["confirmation_token"] is not None


@pytest.mark.asyncio
async def test_voice_intake_was_not_edited(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """When raw_transcript matches transcript, was_edited is false."""
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={
            "transcript": "Fire outbreak near Dhanmondi 32 bridge.",
            "raw_transcript": "Fire outbreak near Dhanmondi 32 bridge.",
            "audio_duration_seconds": 3.5,
            "lang": "en",
        },
    )
    assert res.status_code == 200
    assert res.json()["was_edited"] is False


@pytest.mark.asyncio
async def test_voice_intake_end_to_end_confirmation_and_creation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user: User,
):
    """Verifies complete cycle: Voice transcript -> Draft & Token -> Explicit Confirmation -> Report in DB."""
    # Step 1: Voice intake
    intake_res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={
            "transcript": "Armed mugging near Mirpur 10 roundabout. Perpetrators fled towards sector 2.",
            "audio_duration_seconds": 5.0,
            "lang": "en",
        },
    )
    assert intake_res.status_code == 200
    intake_data = intake_res.json()
    assert intake_data["is_ready_for_review"] is True
    token = intake_data["confirmation_token"]
    draft = intake_data["draft_report"]

    # Step 2: Confirm and submit with citizen auth token
    user_token = create_access_token(subject=str(sample_user.id), role=sample_user.role.value)
    confirm_res = await async_client.post(
        "/api/v1/reports/ai-assistant/confirm",
        headers={"Authorization": f"Bearer {user_token}"},
        json={
            "conversation_id": intake_data["conversation_id"],
            "emergency_type": "INCIDENT",
            "confirmation_token": token,
            "draft_report": draft,
        },
    )
    assert confirm_res.status_code == 201, confirm_res.text
    confirm_data = confirm_res.json()
    assert confirm_data["status"] == "CONFIRMED"
    record_id = confirm_data["record_id"]

    # Step 3: Check database
    db_rep = await db_session.get(Report, uuid.UUID(record_id))
    assert db_rep is not None
    assert db_rep.status == ReportStatus.SUBMITTED
    assert "Mirpur" in db_rep.location_text
    assert db_rep.user_id == sample_user.id


@pytest.mark.asyncio
async def test_voice_intake_replay_and_duplicate_prevention(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user: User,
):
    """Re-submitting the same confirmation token returns cached confirmation without creating duplicate."""
    intake_res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={
            "transcript": "Deep uncovered manhole on Road 11 Banani creating critical hazard.",
            "lang": "en",
        },
    )
    intake_data = intake_res.json()
    token = intake_data["confirmation_token"]
    draft = intake_data["draft_report"]

    user_token = create_access_token(subject=str(sample_user.id), role=sample_user.role.value)
    payload = {
        "conversation_id": intake_data["conversation_id"],
        "emergency_type": "INCIDENT",
        "confirmation_token": token,
        "draft_report": draft,
    }

    # First submission
    res1 = await async_client.post(
        "/api/v1/reports/ai-assistant/confirm",
        headers={"Authorization": f"Bearer {user_token}"},
        json=payload,
    )
    assert res1.status_code == 201
    first_record_id = res1.json()["record_id"]

    # Replay attempt
    res2 = await async_client.post(
        "/api/v1/reports/ai-assistant/confirm",
        headers={"Authorization": f"Bearer {user_token}"},
        json=payload,
    )
    assert res2.status_code == 201
    assert res2.json()["record_id"] == first_record_id
    assert "already been confirmed" in res2.json()["message"]


@pytest.mark.asyncio
async def test_voice_intake_unauthenticated_confirmation_rejected(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """Confirmation requires authentication; anonymous callers receive HTTP 401."""
    intake_res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={
            "transcript": "Electrical fire near Motijheel Commercial Area.",
            "lang": "en",
        },
    )
    intake_data = intake_res.json()

    confirm_res = await async_client.post(
        "/api/v1/reports/ai-assistant/confirm",
        json={
            "conversation_id": intake_data["conversation_id"],
            "emergency_type": "INCIDENT",
            "confirmation_token": intake_data["confirmation_token"],
            "draft_report": intake_data["draft_report"],
        },
    )
    assert confirm_res.status_code == 401


@pytest.mark.asyncio
async def test_voice_intake_alias_endpoint(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """The alias route /api/v1/emergency/ai-assistant/voice-intake works identically."""
    res = await async_client.post(
        "/api/v1/emergency/ai-assistant/voice-intake",
        json={
            "transcript": "Gas cylinder leak near Rampura Bazar.",
            "audio_duration_seconds": 3.1,
            "lang": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["input_mode"] == "voice"
    assert "Rampura" in data["draft_report"]["location_text"]


@pytest.mark.asyncio
async def test_voice_intake_provider_failure_fallback(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    monkeypatch,
):
    """When OpenRouter AI is unavailable, deterministic heuristics process the voice transcript gracefully."""
    from app.services import ai_client

    async def mock_call_ai_json(*args, **kwargs):
        return None

    monkeypatch.setattr(ai_client, "call_ai_json", mock_call_ai_json)

    res = await async_client.post(
        "/api/v1/reports/ai-assistant/voice-intake",
        json={
            "transcript": "Road collision between bus and truck at Uttara Sector 3. Several passengers bleeding.",
            "lang": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_ready_for_review"] is True
    assert "Uttara" in data["extracted_fields"]["location_text"]
    assert "999" in data["emergency_notice"]
