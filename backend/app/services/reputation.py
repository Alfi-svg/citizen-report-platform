import uuid
from typing import Optional, Tuple, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.reputation import (
    UserReputation,
    ImpactPointTransaction,
    TrustScoreHistory,
)


async def get_or_create_user_reputation(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> UserReputation:
    """
    Get existing UserReputation or initialize a new one with default 50/100 trust score.
    """
    stmt = select(UserReputation).where(UserReputation.user_id == user_id)
    res = await db.execute(stmt)
    reputation = res.scalar_one_or_none()

    if not reputation:
        reputation = UserReputation(
            user_id=user_id,
            trust_score=50,
            impact_points=0,
            verified_reports_count=0,
            missing_person_contributions_count=0,
            verified_blood_donations_count=0,
            helpful_verifications_count=0,
            help_rating_sum=0,
            help_rating_count=0,
        )
        db.add(reputation)
        await db.flush()
        await db.refresh(reputation)

    return reputation


async def award_impact_points(
    db: AsyncSession,
    user_id: uuid.UUID,
    points: int,
    action_type: str,
    description: str,
    reference_type: str,
    reference_id: Optional[uuid.UUID] = None,
) -> Optional[ImpactPointTransaction]:
    """
    Atomically award or reverse impact points on the server with idempotency protection.
    """
    if points == 0:
        return None

    reputation = await get_or_create_user_reputation(db, user_id)

    # Idempotency check: prevent duplicate point awards for the same action & reference
    if reference_id is not None and points > 0:
        check_stmt = select(ImpactPointTransaction).where(
            ImpactPointTransaction.user_id == user_id,
            ImpactPointTransaction.reference_id == reference_id,
            ImpactPointTransaction.action_type == action_type,
        )
        existing = (await db.execute(check_stmt)).scalar_one_or_none()
        if existing:
            return existing

    # Create transaction record
    tx = ImpactPointTransaction(
        user_id=user_id,
        reputation_id=reputation.id,
        points=points,
        action_type=action_type,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(tx)

    # Update aggregate impact points balance (non-negative floor)
    reputation.impact_points = max(0, reputation.impact_points + points)
    await db.flush()
    return tx


async def adjust_trust_score(
    db: AsyncSession,
    user_id: uuid.UUID,
    delta: int,
    reason: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[uuid.UUID] = None,
) -> Optional[TrustScoreHistory]:
    """
    Adjust user trust score strictly clamped between 0 and 100 with audit logging.
    """
    if delta == 0:
        return None

    reputation = await get_or_create_user_reputation(db, user_id)

    # Idempotency check for positive score additions
    if reference_id is not None and delta > 0 and reference_type:
        check_stmt = select(TrustScoreHistory).where(
            TrustScoreHistory.user_id == user_id,
            TrustScoreHistory.reference_id == reference_id,
            TrustScoreHistory.reference_type == reference_type,
            TrustScoreHistory.change > 0,
        )
        existing = (await db.execute(check_stmt)).scalar_one_or_none()
        if existing:
            return existing

    old_score = reputation.trust_score
    new_score = max(0, min(100, old_score + delta))
    actual_change = new_score - old_score

    reputation.trust_score = new_score

    history = TrustScoreHistory(
        user_id=user_id,
        reputation_id=reputation.id,
        old_score=old_score,
        new_score=new_score,
        change=actual_change,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(history)
    await db.flush()
    return history


async def increment_contribution_count(
    db: AsyncSession,
    user_id: uuid.UUID,
    contribution_type: str,
    count: int = 1,
) -> None:
    """
    Safely increment specific contribution metric counters.
    """
    reputation = await get_or_create_user_reputation(db, user_id)
    if contribution_type == "REPORT":
        reputation.verified_reports_count += count
    elif contribution_type == "MISSING_PERSON":
        reputation.missing_person_contributions_count += count
    elif contribution_type == "BLOOD":
        reputation.verified_blood_donations_count += count
    elif contribution_type == "VERIFICATION":
        reputation.helpful_verifications_count += count
    await db.flush()


async def record_donor_rating(
    db: AsyncSession,
    donor_id: uuid.UUID,
    rating: int,
) -> None:
    """
    Safely record a 1-5 star recipient rating on the donor's reputation.
    """
    clamped_rating = max(1, min(5, rating))
    reputation = await get_or_create_user_reputation(db, donor_id)
    reputation.help_rating_sum += clamped_rating
    reputation.help_rating_count += 1
    await db.flush()


async def get_user_reputation_history(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
) -> Tuple[UserReputation, List[ImpactPointTransaction], List[TrustScoreHistory]]:
    """
    Fetch user reputation with recent transactions and trust history.
    """
    reputation = await get_or_create_user_reputation(db, user_id)

    tx_stmt = (
        select(ImpactPointTransaction)
        .where(ImpactPointTransaction.user_id == user_id)
        .order_by(ImpactPointTransaction.created_at.desc())
        .limit(limit)
    )
    tx_res = await db.execute(tx_stmt)
    transactions = list(tx_res.scalars().all())

    th_stmt = (
        select(TrustScoreHistory)
        .where(TrustScoreHistory.user_id == user_id)
        .order_by(TrustScoreHistory.created_at.desc())
        .limit(limit)
    )
    th_res = await db.execute(th_stmt)
    trust_history = list(th_res.scalars().all())

    return reputation, transactions, trust_history
