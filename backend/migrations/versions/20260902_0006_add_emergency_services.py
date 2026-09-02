"""Add emergency services table

Revision ID: 0006_add_emergency_services
Revises: 0005_add_notifications
Create Date: 2026-09-02 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = "0006_add_emergency_services"
down_revision: Union[str, None] = "0005_add_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "emergency_services",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("name_bn", sa.String(length=255), nullable=True),
        sa.Column("service_type", sa.String(length=50), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("area", sa.String(length=100), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("address_bn", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("alternate_phone", sa.String(length=100), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("source", sa.String(length=255), nullable=False, server_default="Official Bangladesh Police Directory"),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("verification_status", sa.String(length=50), nullable=False, server_default="VERIFIED"),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_emergency_services_name"), "emergency_services", ["name"], unique=False)
    op.create_index(op.f("ix_emergency_services_service_type"), "emergency_services", ["service_type"], unique=False)
    op.create_index(op.f("ix_emergency_services_district"), "emergency_services", ["district"], unique=False)
    op.create_index(op.f("ix_emergency_services_area"), "emergency_services", ["area"], unique=False)
    op.create_index(op.f("ix_emergency_services_latitude"), "emergency_services", ["latitude"], unique=False)
    op.create_index(op.f("ix_emergency_services_longitude"), "emergency_services", ["longitude"], unique=False)
    op.create_index(op.f("ix_emergency_services_verification_status"), "emergency_services", ["verification_status"], unique=False)
    op.create_index(op.f("ix_emergency_services_is_active"), "emergency_services", ["is_active"], unique=False)
    op.create_index("ix_emergency_services_lat_lng", "emergency_services", ["latitude", "longitude"], unique=False)
    op.create_index("ix_emergency_services_type_active", "emergency_services", ["service_type", "is_active"], unique=False)
    op.create_index("ix_emergency_services_district_area", "emergency_services", ["district", "area"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_emergency_services_district_area", table_name="emergency_services")
    op.drop_index("ix_emergency_services_type_active", table_name="emergency_services")
    op.drop_index("ix_emergency_services_lat_lng", table_name="emergency_services")
    op.drop_index(op.f("ix_emergency_services_is_active"), table_name="emergency_services")
    op.drop_index(op.f("ix_emergency_services_verification_status"), table_name="emergency_services")
    op.drop_index(op.f("ix_emergency_services_longitude"), table_name="emergency_services")
    op.drop_index(op.f("ix_emergency_services_latitude"), table_name="emergency_services")
    op.drop_index(op.f("ix_emergency_services_area"), table_name="emergency_services")
    op.drop_index(op.f("ix_emergency_services_district"), table_name="emergency_services")
    op.drop_index(op.f("ix_emergency_services_service_type"), table_name="emergency_services")
    op.drop_index(op.f("ix_emergency_services_name"), table_name="emergency_services")
    op.drop_table("emergency_services")
