import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class UserReputationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    trust_score: int
    trust_level: str
    trust_description: str
    impact_points: int
    badge: str
    verified_reports_count: int
    missing_person_contributions_count: int
    verified_blood_donations_count: int
    helpful_verifications_count: int
    help_rating: float
    help_rating_count: int
    created_at: datetime
    updated_at: datetime


class ImpactPointTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    points: int
    action_type: str
    description: str
    reference_type: str
    reference_id: Optional[uuid.UUID] = None
    created_at: datetime


class TrustScoreHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    old_score: int
    new_score: int
    change: int
    reason: str
    reference_type: Optional[str] = None
    reference_id: Optional[uuid.UUID] = None
    created_at: datetime


class ReputationHistoryResponse(BaseModel):
    reputation: UserReputationResponse
    transactions: List[ImpactPointTransactionResponse]
    trust_history: List[TrustScoreHistoryResponse]


class AdminReputationAdjustRequest(BaseModel):
    user_id: uuid.UUID
    points_delta: Optional[int] = 0
    trust_score_delta: Optional[int] = 0
    reason: str = Field(..., min_length=3, max_length=255)


class AdminUserReputationItem(BaseModel):
    user_id: uuid.UUID
    username: str
    full_name: Optional[str] = None
    role: str
    reputation: UserReputationResponse
