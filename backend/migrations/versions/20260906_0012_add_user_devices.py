"""add user devices for push notifications

Revision ID: 0012_add_user_devices
Revises: 0011_add_blood_help_system
Create Date: 2026-09-06 01:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0012_add_user_devices'
down_revision: Union[str, None] = '0011_add_blood_help_system'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_devices',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('token', sa.String(length=512), nullable=False),
        sa.Column('platform', sa.String(length=20), nullable=False, server_default='ANDROID'),
        sa.Column('device_name', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_devices_token', 'user_devices', ['token'], unique=True)
    op.create_index('ix_user_devices_user_id', 'user_devices', ['user_id'])
    op.create_index('ix_user_devices_platform', 'user_devices', ['platform'])
    op.create_index('ix_user_devices_is_active', 'user_devices', ['is_active'])
    op.create_index('ix_user_devices_created_at', 'user_devices', ['created_at'])
    op.create_index('ix_user_devices_user_active', 'user_devices', ['user_id', 'is_active'])


def downgrade() -> None:
    op.drop_table('user_devices')
