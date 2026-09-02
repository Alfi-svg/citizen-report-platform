import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.report_media import ReportMedia
from app.schemas.report import ReportPublicResponse, ReportResponse
from app.db.seed import seed_categories


@pytest.mark.asyncio
async def test_user_creation_and_roles(db_session: AsyncSession):
    user = User(
        email="citizen@example.com",
        username="citizen_one",
        full_name="Citizen One",
        hashed_password="hashed_secure_password_example",
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    assert user.id is not None
    assert isinstance(user.id, uuid.UUID)
    assert user.role == UserRole.USER
    assert user.is_active is True
    assert user.is_verified is False
    assert user.created_at is not None
    assert user.updated_at is not None

    # Test admin role creation
    admin = User(
        email="admin@example.com",
        username="admin_user",
        full_name="Admin Moderator",
        hashed_password="hashed_admin_password_example",
        role=UserRole.ADMIN,
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    assert admin.role == UserRole.ADMIN


@pytest.mark.asyncio
async def test_user_unique_constraints(db_session: AsyncSession):
    user1 = User(
        email="duplicate@example.com",
        username="unique_user_1",
        hashed_password="hashed_password",
    )
    db_session.add(user1)
    await db_session.commit()

    # Duplicate email should raise IntegrityError
    user2 = User(
        email="duplicate@example.com",
        username="unique_user_2",
        hashed_password="hashed_password",
    )
    db_session.add(user2)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_category_creation_and_seed_idempotency(db_session: AsyncSession):
    # First seed run
    count1 = await seed_categories(db_session)
    assert count1 >= 12

    # Second seed run should not duplicate
    count2 = await seed_categories(db_session)
    assert count2 == 0

    # Query a seeded category
    stmt = select(Category).where(Category.slug == "crime")
    result = await db_session.execute(stmt)
    category = result.scalar_one_or_none()

    assert category is not None
    assert category.name == "Crime"
    assert category.is_active is True
    assert category.created_at is not None


@pytest.mark.asyncio
async def test_report_lifecycle_and_statuses(db_session: AsyncSession):
    user = User(
        email=f"reporter_{uuid.uuid4().hex[:6]}@example.com",
        username=f"reporter_{uuid.uuid4().hex[:6]}",
        hashed_password="pw",
    )
    category = Category(
        name="Public Safety Test",
        slug=f"public-safety-{uuid.uuid4().hex[:6]}",
        description="Public safety hazards",
    )
    db_session.add_all([user, category])
    await db_session.commit()

    # Test each lifecycle status
    for status in ReportStatus:
        report = Report(
            user_id=user.id,
            category_id=category.id,
            title=f"Report with status {status.value}",
            description="Testing report status lifecycle transitions.",
            location_text="Dhanmondi, Dhaka",
            latitude=23.7465,
            longitude=90.3760,
            incident_date=datetime.now(timezone.utc),
            status=status,
            is_anonymous=False,
        )
        db_session.add(report)

    await db_session.commit()

    stmt = select(Report).where(Report.user_id == user.id)
    result = await db_session.execute(stmt)
    reports = result.scalars().all()
    assert len(reports) == len(ReportStatus)


@pytest.mark.asyncio
async def test_report_media_relationship_and_cascade(db_session: AsyncSession):
    category = Category(
        name="Environmental Test",
        slug=f"env-{uuid.uuid4().hex[:6]}",
        description="Environment test category",
    )
    db_session.add(category)
    await db_session.commit()

    report = Report(
        category_id=category.id,
        title="Illegal dumping on riverbank",
        description="Hazardous chemicals dumped near Buriganga river.",
        location_text="Sadarghat, Dhaka",
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    # Attach media
    media_item = ReportMedia(
        report_id=report.id,
        file_name="evidence_photo_1.jpg",
        mime_type="image/jpeg",
        file_size=2048500,
        storage_path="evidence/reports/photo_1.jpg",
        caption="Photo of dump site",
    )
    db_session.add(media_item)
    await db_session.commit()

    # Verify query
    stmt = select(ReportMedia).where(ReportMedia.report_id == report.id)
    result = await db_session.execute(stmt)
    media_list = result.scalars().all()
    assert len(media_list) == 1
    assert media_list[0].file_name == "evidence_photo_1.jpg"
    assert media_list[0].file_size == 2048500


@pytest.mark.asyncio
async def test_anonymous_reporting_privacy_guarantee(db_session: AsyncSession):
    """
    Verifies that for an anonymous report:
    1. The internal database schema retains user_id for moderation and abuse prevention.
    2. The public API representation (ReportPublicResponse) masks reporter identity.
    """
    user = User(
        email="whistleblower@example.com",
        username="confidential_whistleblower",
        hashed_password="secret_password",
    )
    category = Category(
        name="Corruption Test",
        slug=f"corruption-{uuid.uuid4().hex[:6]}",
    )
    db_session.add_all([user, category])
    await db_session.commit()

    anonymous_report = Report(
        user_id=user.id,
        category_id=category.id,
        title="Extortion attempt at municipal licensing desk",
        description="Detailed evidence of illegal bribery requirement.",
        location_text="City Corporation Zone 3, Dhaka",
        is_anonymous=True,
        status=ReportStatus.APPROVED,
    )
    db_session.add(anonymous_report)
    await db_session.commit()
    await db_session.refresh(anonymous_report)

    # Internal database check: user_id is preserved for administrative accountability
    assert anonymous_report.user_id == user.id
    assert anonymous_report.is_anonymous is True

    # Admin view model check: user_id is present
    admin_view = ReportResponse.model_validate(anonymous_report)
    assert admin_view.user_id == user.id

    # Public view schema check:
    public_view = ReportPublicResponse(
        id=anonymous_report.id,
        category_id=anonymous_report.category_id,
        title=anonymous_report.title,
        description=anonymous_report.description,
        location_text=anonymous_report.location_text,
        is_anonymous=anonymous_report.is_anonymous,
        status=anonymous_report.status,
        created_at=anonymous_report.created_at,
        reporter_username=None if anonymous_report.is_anonymous else user.username,
    )
    assert public_view.is_anonymous is True
    assert public_view.reporter_username is None
