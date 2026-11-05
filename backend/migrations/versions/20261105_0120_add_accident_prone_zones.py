"""add accident prone zones table

Revision ID: 0016_add_accident_prone_zones
Revises: 0015_add_hospital_blood_inventory
Create Date: 2026-11-05 01:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0016_add_accident_prone_zones'
down_revision: Union[str, None] = '0015_add_hospital_blood_inventory'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'accident_zones',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('zone_name', sa.String(length=200), nullable=False),
        sa.Column('zone_name_bn', sa.String(length=250), nullable=True),
        sa.Column('road_name', sa.String(length=200), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('division', sa.String(length=100), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('radius_meters', sa.Integer(), nullable=False, server_default='600'),
        sa.Column('accident_count', sa.Integer(), nullable=True),
        sa.Column('observation_period', sa.String(length=150), nullable=True),
        sa.Column('data_source', sa.String(length=250), nullable=False),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('verification_status', sa.String(length=50), nullable=False, server_default='VERIFIED'),
        sa.Column('risk_level', sa.String(length=20), nullable=False, server_default='HIGH'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('description_bn', sa.Text(), nullable=True),
        sa.Column('last_updated', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index('ix_accident_zones_zone_name', 'accident_zones', ['zone_name'])
    op.create_index('ix_accident_zones_road_name', 'accident_zones', ['road_name'])
    op.create_index('ix_accident_zones_district', 'accident_zones', ['district'])
    op.create_index('ix_accident_zones_division', 'accident_zones', ['division'])
    op.create_index('ix_accident_zones_risk_level', 'accident_zones', ['risk_level'])
    op.create_index('ix_accident_zones_coords', 'accident_zones', ['latitude', 'longitude'])
    op.create_index('ix_accident_zones_dist_risk', 'accident_zones', ['district', 'risk_level'])


def downgrade() -> None:
    op.drop_index('ix_accident_zones_dist_risk', table_name='accident_zones')
    op.drop_index('ix_accident_zones_coords', table_name='accident_zones')
    op.drop_index('ix_accident_zones_risk_level', table_name='accident_zones')
    op.drop_index('ix_accident_zones_division', table_name='accident_zones')
    op.drop_index('ix_accident_zones_district', table_name='accident_zones')
    op.drop_index('ix_accident_zones_road_name', table_name='accident_zones')
    op.drop_index('ix_accident_zones_zone_name', table_name='accident_zones')
    op.drop_table('accident_zones')
