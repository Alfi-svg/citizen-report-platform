import uuid
from typing import List
from pydantic import BaseModel, ConfigDict
from app.models.reaction import ReactionType


class ReactionCreate(BaseModel):
    reaction_type: ReactionType


class ReactionSummaryResponse(BaseModel):
    report_id: uuid.UUID
    support_count: int = 0
    important_count: int = 0
    user_reactions: List[ReactionType] = []

    model_config = ConfigDict(from_attributes=True)


class ReactionToggleResponse(BaseModel):
    report_id: uuid.UUID
    reaction_type: ReactionType
    action: str  # "added" or "removed"
    summary: ReactionSummaryResponse
