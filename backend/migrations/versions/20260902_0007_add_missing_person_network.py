"""Add missing person alert network tables

Revision ID: 0007_add_missing_person_network
Revises: 0006_add_emergency_services
Create Date: 2026-09-02 19:44:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = '0007_add_missing_person_network'
down_revision: Union[str, None] = '0006_add_emergency_services'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. missing_person_profiles
    op.create_table(
        'missing_person_profiles',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('report_id', GUID(), nullable=False),
        sa.Column('full_name', sa.String(length=200), nullable=False),
        sa.Column('name_bn', sa.String(length=200), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('approximate_age', sa.String(length=50), nullable=True),
        sa.Column('gender', sa.String(length=50), nullable=True),
        sa.Column('photo_url', sa.String(length=1000), nullable=True),
        sa.Column('height', sa.String(length=100), nullable=True),
        sa.Column('clothing', sa.Text(), nullable=True),
        sa.Column('clothing_bn', sa.Text(), nullable=True),
        sa.Column('identifying_features', sa.Text(), nullable=True),
        sa.Column('identifying_features_bn', sa.Text(), nullable=True),
        sa.Column('last_seen_location', sa.String(length=255), nullable=False),
        sa.Column('last_seen_location_bn', sa.String(length=255), nullable=True),
        sa.Column('last_seen_latitude', sa.Float(), nullable=True),
        sa.Column('last_seen_longitude', sa.Float(), nullable=True),
        sa.Column('last_seen_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('contact_information', sa.String(length=255), nullable=True),
        sa.Column('reporting_authority', sa.String(length=255), nullable=True),
        sa.Column('source', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('report_id')
    )
    op.create_index('ix_missing_person_profiles_full_name', 'missing_person_profiles', ['full_name'])
    op.create_index('ix_missing_person_profiles_report_id', 'missing_person_profiles', ['report_id'])

    # 2. missing_person_alerts
    op.create_table(
        'missing_person_alerts',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('report_id', GUID(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('alert_radius_km', sa.Float(), nullable=False, server_default=sa.text('10.0')),
        sa.Column('alert_expiry', sa.DateTime(timezone=True), nullable=True),
        sa.Column('activated_by_admin_id', GUID(), nullable=True),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('activation_notes', sa.Text(), nullable=True),
        sa.Column('found_by_admin_id', GUID(), nullable=True),
        sa.Column('found_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('found_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['activated_by_admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['found_by_admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('report_id')
    )
    op.create_index('ix_missing_person_alerts_report_id', 'missing_person_alerts', ['report_id'])
    op.create_index('ix_missing_person_alerts_status_active', 'missing_person_alerts', ['status', 'is_active'])

    # 3. missing_person_sightings
    op.create_table(
        'missing_person_sightings',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('alert_id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=True),
        sa.Column('approximate_location', sa.String(length=255), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('sighting_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sighting_time', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('photo_url', sa.String(length=1000), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='PENDING'),
        sa.Column('reviewed_by_admin_id', GUID(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['missing_person_alerts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reviewed_by_admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_missing_person_sightings_alert_id', 'missing_person_sightings', ['alert_id'])
    op.create_index('ix_missing_person_sightings_user_id', 'missing_person_sightings', ['user_id'])
    op.create_index('ix_missing_person_sightings_alert_status', 'missing_person_sightings', ['alert_id', 'status'])

    # 4. user_notification_preferences
    op.create_table(
        'user_notification_preferences',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('missing_person_alerts', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('nearby_safety_alerts', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_known_latitude', sa.Float(), nullable=True),
        sa.Column('last_known_longitude', sa.Float(), nullable=True),
        sa.Column('last_location_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('ix_user_notif_prefs_user_id', 'user_notification_preferences', ['user_id'])

    # 5. alert_notification_deliveries
    op.create_table(
        'alert_notification_deliveries',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('alert_id', GUID(), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('delivered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False, server_default='IN_APP'),
        sa.ForeignKeyConstraint(['alert_id'], ['missing_person_alerts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('alert_id', 'user_id', name='uq_alert_user_delivery')
    )
    op.create_index('ix_alert_deliveries_user_alert', 'alert_notification_deliveries', ['user_id', 'alert_id'])


def downgrade() -> None:
    op.drop_table('alert_notification_deliveries')
    op.drop_table('user_notification_preferences')
    op.drop_table('missing_person_sightings')
    op.drop_table('missing_person_alerts')
    op.drop_table('missing_person_profiles')
