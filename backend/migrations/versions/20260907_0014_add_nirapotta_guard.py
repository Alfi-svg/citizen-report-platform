"""add nirapotta guard trusted contacts settings and emergency sessions

Revision ID: 0014_add_nirapotta_guard
Revises: 0013_add_reputation_and_blood_verification
Create Date: 2026-09-07 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0014_add_nirapotta_guard'
down_revision: Union[str, None] = '0013_add_reputation_and_blood_verification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. trusted_contacts table
    op.create_table(
        'trusted_contacts',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('relationship', sa.String(length=50), nullable=False, server_default='Other'),
        sa.Column('is_confirmed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_trusted_contacts_user_id', 'trusted_contacts', ['user_id'])
    op.create_index('ix_trusted_contacts_phone', 'trusted_contacts', ['phone'])
    op.create_index('ix_trusted_contacts_user_order', 'trusted_contacts', ['user_id', 'display_order'])

    # 2. guard_settings table
    op.create_table(
        'guard_settings',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('alerts_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('share_location', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('custom_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_guard_settings_user_id', 'guard_settings', ['user_id'], unique=True)

    # 3. emergency_sessions table
    op.create_table(
        'emergency_sessions',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='ACTIVE'),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('location_address', sa.String(length=255), nullable=True),
        sa.Column('location_shared', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_test', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_emergency_sessions_user_id', 'emergency_sessions', ['user_id'])
    op.create_index('ix_emergency_sessions_status', 'emergency_sessions', ['status'])
    op.create_index('ix_emergency_sessions_created_at', 'emergency_sessions', ['created_at'])
    op.create_index('ix_emergency_sessions_user_status', 'emergency_sessions', ['user_id', 'status'])

    # 4. emergency_alert_recipients table
    op.create_table(
        'emergency_alert_recipients',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('session_id', GUID(), nullable=False),
        sa.Column('trusted_contact_id', GUID(), nullable=True),
        sa.Column('recipient_name', sa.String(length=100), nullable=False),
        sa.Column('recipient_phone', sa.String(length=50), nullable=False),
        sa.Column('delivery_status', sa.String(length=32), nullable=False, server_default='SENT'),
        sa.Column('delivery_notes', sa.String(length=255), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['emergency_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['trusted_contact_id'], ['trusted_contacts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_emergency_alert_recipients_session_id', 'emergency_alert_recipients', ['session_id'])


def downgrade() -> None:
    op.drop_table('emergency_alert_recipients')
    op.drop_table('emergency_sessions')
    op.drop_table('guard_settings')
    op.drop_table('trusted_contacts')
