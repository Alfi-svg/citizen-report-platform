"""Add incident clustering tables and geo indexes

Revision ID: 0008_add_incident_clustering
Revises: 0007_add_missing_person_network
Create Date: 2026-09-02 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0008_add_incident_clustering'
down_revision: Union[str, None] = '0007_add_missing_person_network'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. incident_clusters
    op.create_table(
        'incident_clusters',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('title_bn', sa.String(length=255), nullable=True),
        sa.Column('category_id', GUID(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('summary_bn', sa.Text(), nullable=True),
        sa.Column('approximate_latitude', sa.Float(), nullable=True),
        sa.Column('approximate_longitude', sa.Float(), nullable=True),
        sa.Column('area', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_by_admin_id', GUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_incident_clusters_title', 'incident_clusters', ['title'], unique=False)
    op.create_index('ix_incident_clusters_category_id', 'incident_clusters', ['category_id'], unique=False)
    op.create_index('ix_incident_clusters_area', 'incident_clusters', ['area'], unique=False)
    op.create_index('ix_incident_clusters_is_active', 'incident_clusters', ['is_active'], unique=False)
    op.create_index('ix_incident_clusters_created_by_admin_id', 'incident_clusters', ['created_by_admin_id'], unique=False)
    op.create_index('ix_clusters_active_created', 'incident_clusters', ['is_active', 'created_at'], unique=False)

    # 2. incident_cluster_members
    op.create_table(
        'incident_cluster_members',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('cluster_id', GUID(), nullable=False),
        sa.Column('report_id', GUID(), nullable=False),
        sa.Column('relationship_type', sa.String(length=50), server_default='SIMILAR_INCIDENT', nullable=False),
        sa.Column('similarity_score', sa.Float(), nullable=True),
        sa.Column('added_by_admin_id', GUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['cluster_id'], ['incident_clusters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['added_by_admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cluster_id', 'report_id', name='uq_cluster_member_report'),
    )
    op.create_index('ix_incident_cluster_members_cluster_id', 'incident_cluster_members', ['cluster_id'], unique=False)
    op.create_index('ix_incident_cluster_members_report_id', 'incident_cluster_members', ['report_id'], unique=False)
    op.create_index('ix_cluster_members_cluster', 'incident_cluster_members', ['cluster_id'], unique=False)
    op.create_index('ix_cluster_members_report', 'incident_cluster_members', ['report_id'], unique=False)

    # 3. Composite geo index on reports
    op.create_index('ix_reports_status_lat_lng', 'reports', ['status', 'latitude', 'longitude'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_reports_status_lat_lng', table_name='reports')
    op.drop_table('incident_cluster_members')
    op.drop_table('incident_clusters')
