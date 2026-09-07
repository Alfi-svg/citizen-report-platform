"""add reputation impact points and blood donation verification

Revision ID: 0013_add_reputation_and_blood_verification
Revises: 0012_add_user_devices
Create Date: 2026-09-07 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0013_add_reputation_and_blood_verification'
down_revision: Union[str, None] = '0012_add_user_devices'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. user_reputations table
    op.create_table(
        'user_reputations',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('trust_score', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('impact_points', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('verified_reports_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('missing_person_contributions_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('verified_blood_donations_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('helpful_verifications_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('help_rating_sum', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('help_rating_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_reputations_user_id', 'user_reputations', ['user_id'], unique=True)

    # 2. impact_point_transactions table
    op.create_table(
        'impact_point_transactions',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('reputation_id', GUID(), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.String(length=64), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('reference_type', sa.String(length=64), nullable=False),
        sa.Column('reference_id', GUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['reputation_id'], ['user_reputations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_impact_point_transactions_user_id', 'impact_point_transactions', ['user_id'])
    op.create_index('ix_impact_point_transactions_reputation_id', 'impact_point_transactions', ['reputation_id'])
    op.create_index('ix_impact_point_transactions_action_type', 'impact_point_transactions', ['action_type'])
    op.create_index('ix_impact_point_transactions_reference_type', 'impact_point_transactions', ['reference_type'])
    op.create_index('ix_impact_point_transactions_reference_id', 'impact_point_transactions', ['reference_id'])
    op.create_index('ix_impact_point_transactions_created_at', 'impact_point_transactions', ['created_at'])

    # 3. trust_score_history table
    op.create_table(
        'trust_score_history',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('reputation_id', GUID(), nullable=False),
        sa.Column('old_score', sa.Integer(), nullable=False),
        sa.Column('new_score', sa.Integer(), nullable=False),
        sa.Column('change', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('reference_type', sa.String(length=64), nullable=True),
        sa.Column('reference_id', GUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['reputation_id'], ['user_reputations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_trust_score_history_user_id', 'trust_score_history', ['user_id'])
    op.create_index('ix_trust_score_history_reputation_id', 'trust_score_history', ['reputation_id'])
    op.create_index('ix_trust_score_history_created_at', 'trust_score_history', ['created_at'])

    # 4. blood_donation_records table
    op.create_table(
        'blood_donation_records',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('request_id', GUID(), nullable=False),
        sa.Column('donor_id', GUID(), nullable=False),
        sa.Column('recipient_id', GUID(), nullable=False),
        sa.Column('response_id', GUID(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='PENDING_CONFIRMATION'),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('disputed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dispute_reason', sa.Text(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('impact_points_awarded', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('donor_rating', sa.Integer(), nullable=True),
        sa.Column('donor_review', sa.Text(), nullable=True),
        sa.Column('rated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['donor_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['request_id'], ['blood_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['response_id'], ['blood_request_responses.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_blood_donations_req_donor', 'blood_donation_records', ['request_id', 'donor_id'], unique=True)
    op.create_index('ix_blood_donations_status', 'blood_donation_records', ['status'])
    op.create_index('ix_blood_donations_donor_id', 'blood_donation_records', ['donor_id'])
    op.create_index('ix_blood_donations_recipient_id', 'blood_donation_records', ['recipient_id'])


def downgrade() -> None:
    op.drop_table('blood_donation_records')
    op.drop_table('trust_score_history')
    op.drop_table('impact_point_transactions')
    op.drop_table('user_reputations')
