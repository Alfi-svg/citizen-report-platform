"""add blood help system

Revision ID: 0011_add_blood_help_system
Revises: 0010_upgrade_safety_directory_verification
Create Date: 2026-09-03 10:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0011_add_blood_help_system'
down_revision: Union[str, None] = '0010_upgrade_safety_directory_verification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. blood_requests
    op.create_table(
        'blood_requests',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('blood_group', sa.String(length=10), nullable=False),
        sa.Column('units_required', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('hospital_name', sa.String(length=255), nullable=False),
        sa.Column('hospital_area', sa.String(length=150), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('required_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('required_time', sa.String(length=100), nullable=True),
        sa.Column('urgency', sa.String(length=20), nullable=False, server_default='URGENT'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='OPEN'),
        sa.Column('contact_name', sa.String(length=150), nullable=True),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('contact_method', sa.String(length=50), nullable=False, server_default='PHONE'),
        sa.Column('additional_information', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_blood_requests_user_id', 'blood_requests', ['user_id'])
    op.create_index('ix_blood_requests_blood_group', 'blood_requests', ['blood_group'])
    op.create_index('ix_blood_requests_hospital_name', 'blood_requests', ['hospital_name'])
    op.create_index('ix_blood_requests_hospital_area', 'blood_requests', ['hospital_area'])
    op.create_index('ix_blood_requests_district', 'blood_requests', ['district'])
    op.create_index('ix_blood_requests_required_date', 'blood_requests', ['required_date'])
    op.create_index('ix_blood_requests_urgency', 'blood_requests', ['urgency'])
    op.create_index('ix_blood_requests_status', 'blood_requests', ['status'])
    op.create_index('ix_blood_requests_is_active', 'blood_requests', ['is_active'])
    op.create_index('ix_blood_requests_group_dist_status', 'blood_requests', ['blood_group', 'district', 'status'])
    op.create_index('ix_blood_requests_status_urgency', 'blood_requests', ['status', 'urgency'])

    # 2. blood_donor_profiles
    op.create_table(
        'blood_donor_profiles',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('blood_group', sa.String(length=10), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('area', sa.String(length=150), nullable=False),
        sa.Column('availability_status', sa.String(length=20), nullable=False, server_default='AVAILABLE'),
        sa.Column('last_donation_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('preferred_contact_method', sa.String(length=50), nullable=False, server_default='IN_APP'),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('additional_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('ix_blood_donor_profiles_user_id', 'blood_donor_profiles', ['user_id'])
    op.create_index('ix_blood_donor_profiles_blood_group', 'blood_donor_profiles', ['blood_group'])
    op.create_index('ix_blood_donor_profiles_district', 'blood_donor_profiles', ['district'])
    op.create_index('ix_blood_donor_profiles_area', 'blood_donor_profiles', ['area'])
    op.create_index('ix_blood_donor_profiles_availability', 'blood_donor_profiles', ['availability_status'])
    op.create_index('ix_blood_donors_group_dist_avail', 'blood_donor_profiles', ['blood_group', 'district', 'availability_status'])

    # 3. blood_request_responses
    op.create_table(
        'blood_request_responses',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('request_id', GUID(), nullable=False),
        sa.Column('donor_user_id', GUID(), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['blood_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['donor_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_blood_request_responses_request_id', 'blood_request_responses', ['request_id'])
    op.create_index('ix_blood_request_responses_donor_user_id', 'blood_request_responses', ['donor_user_id'])
    op.create_index('ix_blood_request_responses_status', 'blood_request_responses', ['status'])

    # 4. blood_request_flags
    op.create_table(
        'blood_request_flags',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('request_id', GUID(), nullable=False),
        sa.Column('reporter_user_id', GUID(), nullable=False),
        sa.Column('reason', sa.String(length=100), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['blood_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reporter_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_blood_request_flags_request_id', 'blood_request_flags', ['request_id'])
    op.create_index('ix_blood_request_flags_reporter_user_id', 'blood_request_flags', ['reporter_user_id'])
    op.create_index('ix_blood_request_flags_status', 'blood_request_flags', ['status'])


def downgrade() -> None:
    op.drop_table('blood_request_flags')
    op.drop_table('blood_request_responses')
    op.drop_table('blood_donor_profiles')
    op.drop_table('blood_requests')
