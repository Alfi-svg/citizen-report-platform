import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.reaction import Reaction, ReactionType
from app.models.report import Report, ReportStatus
from app.models.user import User
from app.schemas.reaction import ReactionCreate, ReactionSummaryResponse, ReactionToggleResponse

router = APIRouter()


async def _get_reaction_summary(
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ReactionSummaryResponse:
    # Aggregated counts
    support_stmt = select(func.count(Reaction.id)).where(
        Reaction.report_id == report_id,
        Reaction.reaction_type == ReactionType.SUPPORT,
    )
    important_stmt = select(func.count(Reaction.id)).where(
        Reaction.report_id == report_id,
        Reaction.reaction_type == ReactionType.IMPORTANT,
    )
    user_reacts_stmt = select(Reaction.reaction_type).where(
        Reaction.report_id == report_id,
        Reaction.user_id == user_id,
    )

    support_count = await db.scalar(support_stmt) or 0
    important_count = await db.scalar(important_stmt) or 0
    res_user = await db.execute(user_reacts_stmt)
    user_reactions = [r[0] for r in res_user.all()]

    return ReactionSummaryResponse(
        report_id=report_id,
        support_count=support_count,
        important_count=important_count,
        user_reactions=user_reactions,
    )


@router.post(
    "/reports/{report_id}/reactions",
    response_model=ReactionToggleResponse,
    status_code=status.HTTP_200_OK,
    summary="Toggle a reaction (SUPPORT / IMPORTANT) on an APPROVED report",
)
async def toggle_reaction(
    report_id: uuid.UUID,
    payload: ReactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # 1. Enforce parent report is APPROVED
    report_stmt = select(Report).where(Report.id == report_id)
    res_rep = await db.execute(report_stmt)
    report = res_rep.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident report not found.",
        )

    if report.status != ReportStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reactions are only permitted on platform-approved reports.",
        )

    # 2. Check if reaction exists
    existing_stmt = select(Reaction).where(
        Reaction.report_id == report_id,
        Reaction.user_id == current_user.id,
        Reaction.reaction_type == payload.reaction_type,
    )
    res_ex = await db.execute(existing_stmt)
    existing = res_ex.scalar_one_or_none()

    if existing:
        # Toggle OFF
        await db.delete(existing)
        await db.commit()
        action = "removed"
    else:
        # Toggle ON
        reaction = Reaction(
            report_id=report_id,
            user_id=current_user.id,
            reaction_type=payload.reaction_type,
        )
        db.add(reaction)
        await db.commit()
        action = "added"

    summary = await _get_reaction_summary(report_id, current_user.id, db)

    return ReactionToggleResponse(
        report_id=report_id,
        reaction_type=payload.reaction_type,
        action=action,
        summary=summary,
    )


@router.delete(
    "/reports/{report_id}/reactions/{reaction_type}",
    response_model=ReactionSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove a reaction from an APPROVED report",
)
async def delete_reaction(
    report_id: uuid.UUID,
    reaction_type: ReactionType,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Reaction).where(
        Reaction.report_id == report_id,
        Reaction.user_id == current_user.id,
        Reaction.reaction_type == reaction_type,
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()

    return await _get_reaction_summary(report_id, current_user.id, db)
