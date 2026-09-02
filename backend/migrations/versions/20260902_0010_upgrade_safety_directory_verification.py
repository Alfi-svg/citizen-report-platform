"""upgrade safety directory verification

Revision ID: 0010_upgrade_safety_directory_verification
Revises: 0009_add_sighting_details
Create Date: 2026-09-02 23:48:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0010_upgrade_safety_directory_verification'
down_revision: Union[str, None] = '0009_add_sighting_details'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new columns to emergency_services
    op.add_column('emergency_services', sa.Column('division', sa.String(length=100), nullable=True))
    op.add_column('emergency_services', sa.Column('verified_by_admin_id', GUID(), nullable=True))
    op.add_column('emergency_services', sa.Column('verification_notes_internal', sa.Text(), nullable=True))
    
    # Make latitude and longitude nullable if supported
    try:
        op.alter_column('emergency_services', 'latitude', existing_type=sa.Float(), nullable=True)
        op.alter_column('emergency_services', 'longitude', existing_type=sa.Float(), nullable=True)
    except Exception:
        pass

    try:
        op.create_foreign_key(
            'fk_emergency_services_admin_id',
            'emergency_services',
            'users',
            ['verified_by_admin_id'],
            ['id'],
            ondelete='SET NULL'
        )
    except Exception:
        pass

    try:
        op.create_index(op.f('ix_emergency_services_division'), 'emergency_services', ['division'], unique=False)
        op.create_index('ix_emergency_services_status_active', 'emergency_services', ['verification_status', 'is_active'], unique=False)
    except Exception:
        pass

    # 2. Create safety_service_verification_audits table
    op.create_table(
        'safety_service_verification_audits',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('service_id', GUID(), nullable=False),
        sa.Column('admin_id', GUID(), nullable=True),
        sa.Column('previous_status', sa.String(length=50), nullable=False),
        sa.Column('new_status', sa.String(length=50), nullable=False),
        sa.Column('changed_fields', sa.Text(), nullable=True),
        sa.Column('verification_notes', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=255), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['service_id'], ['emergency_services.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
    )

    try:
        op.create_index(op.f('ix_safety_service_verification_audits_service_id'), 'safety_service_verification_audits', ['service_id'], unique=False)
        op.create_index(op.f('ix_safety_service_verification_audits_admin_id'), 'safety_service_verification_audits', ['admin_id'], unique=False)
        op.create_index(op.f('ix_safety_service_verification_audits_created_at'), 'safety_service_verification_audits', ['created_at'], unique=False)
        op.create_index('ix_safety_audits_service_created', 'safety_service_verification_audits', ['service_id', 'created_at'], unique=False)
    except Exception:
        pass


def downgrade() -> None:
    op.drop_table('safety_service_verification_audits')
    try:
        op.drop_index('ix_emergency_services_status_active', table_name='emergency_services')
        op.drop_index(op.f('ix_emergency_services_division'), table_name='emergency_services')
        op.drop_constraint('fk_emergency_services_admin_id', 'emergency_services', type_='foreignkey')
    except Exception:
        pass
    op.drop_column('emergency_services', 'verification_notes_internal')
    op.drop_column('emergency_services', 'verified_by_admin_id')
    op.drop_column('emergency_services', 'division')
