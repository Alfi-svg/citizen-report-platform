import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.reputation import (
    UserReputationResponse,
    ReputationHistoryResponse,
    ImpactPointTransactionResponse,
    TrustScoreHistoryResponse,
)
from app.services import reputation as reputation_service

router = APIRouter()


@router.get("/me", response_model=UserReputationResponse)
async def get_my_reputation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get authenticated user's trust score, impact points, badge, and contributions breakdown.
    """
    rep = await reputation_service.get_or_create_user_reputation(db, current_user.id)
    return UserReputationResponse.model_validate(rep)


@router.get("/users/{user_id}", response_model=UserReputationResponse)
async def get_user_public_reputation(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get public civic reliability and impact score of a user.
    """
    rep = await reputation_service.get_or_create_user_reputation(db, user_id)
    return UserReputationResponse.model_validate(rep)


@router.get("/history", response_model=ReputationHistoryResponse)
async def get_my_reputation_history(
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get authenticated user's impact points transactions and trust score audit trail.
    """
    rep, txs, ths = await reputation_service.get_user_reputation_history(
        db=db,
        user_id=current_user.id,
        limit=limit,
    )
    return ReputationHistoryResponse(
        reputation=UserReputationResponse.model_validate(rep),
        transactions=[ImpactPointTransactionResponse.model_validate(t) for t in txs],
        trust_history=[TrustScoreHistoryResponse.model_validate(h) for h in ths],
    )
