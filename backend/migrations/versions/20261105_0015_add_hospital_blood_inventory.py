"""add hospital and blood inventory tables

Revision ID: 0015_add_hospital_blood_inventory
Revises: 0014_add_nirapotta_guard
Create Date: 2026-11-05 00:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0015_add_hospital_blood_inventory'
down_revision: Union[str, None] = '0014_add_nirapotta_guard'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. hospitals table
    op.create_table(
        'hospitals',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('name_bn', sa.String(length=255), nullable=True),
        sa.Column('blood_bank_name', sa.String(length=255), nullable=True),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('area', sa.String(length=100), nullable=False),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('address_bn', sa.Text(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('emergency_phone', sa.String(length=50), nullable=False),
        sa.Column('alternate_phone', sa.String(length=100), nullable=True),
        sa.Column('verification_status', sa.String(length=50), nullable=False, server_default='VERIFIED'),
        sa.Column('has_blood_bank', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_hospitals_name', 'hospitals', ['name'])
    op.create_index('ix_hospitals_district', 'hospitals', ['district'])
    op.create_index('ix_hospitals_area', 'hospitals', ['area'])
    op.create_index('ix_hospitals_district_area', 'hospitals', ['district', 'area'])
    op.create_index('ix_hospitals_lat_lng', 'hospitals', ['latitude', 'longitude'])
    op.create_index('ix_hospitals_status_active', 'hospitals', ['verification_status', 'is_active'])

    # 2. blood_inventories table
    op.create_table(
        'blood_inventories',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('hospital_id', GUID(), nullable=False),
        sa.Column('blood_group', sa.String(length=10), nullable=False),
        sa.Column('available_units', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('availability_status', sa.String(length=50), nullable=False, server_default='UNKNOWN'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_updated', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hospital_id', 'blood_group', name='uq_hospital_blood_group')
    )
    op.create_index('ix_blood_inventories_hospital_id', 'blood_inventories', ['hospital_id'])
    op.create_index('ix_blood_inventories_blood_group', 'blood_inventories', ['blood_group'])
    op.create_index('ix_blood_inventories_group_status', 'blood_inventories', ['blood_group', 'availability_status'])

    # 3. hospital_inventory_audits table
    op.create_table(
        'hospital_inventory_audits',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('hospital_id', GUID(), nullable=False),
        sa.Column('blood_group', sa.String(length=10), nullable=False),
        sa.Column('previous_units', sa.Integer(), nullable=True),
        sa.Column('new_units', sa.Integer(), nullable=False),
        sa.Column('previous_status', sa.String(length=50), nullable=True),
        sa.Column('new_status', sa.String(length=50), nullable=False),
        sa.Column('updated_by_id', GUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_inventory_audits_hospital_created', 'hospital_inventory_audits', ['hospital_id', 'created_at'])


def downgrade() -> None:
    op.drop_table('hospital_inventory_audits')
    op.drop_table('blood_inventories')
    op.drop_table('hospitals')
