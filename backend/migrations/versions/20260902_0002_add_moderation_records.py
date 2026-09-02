"""Add moderation records table

Revision ID: 0002_add_moderation_records
Revises: 0001_initial_database_foundation
Create Date: 2026-09-02 09:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = "0002_add_moderation_records"
down_revision: Union[str, None] = "0001_initial_database_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "moderation_records",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("report_id", GUID(), nullable=False),
        sa.Column("admin_id", GUID(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("user_message", sa.Text(), nullable=True),
        sa.Column("internal_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["admin_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_moderation_records_report_id"), "moderation_records", ["report_id"], unique=False)
    op.create_index(op.f("ix_moderation_records_admin_id"), "moderation_records", ["admin_id"], unique=False)
    op.create_index(op.f("ix_moderation_records_action"), "moderation_records", ["action"], unique=False)
    op.create_index("ix_moderation_records_report_created", "moderation_records", ["report_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_moderation_records_report_created", table_name="moderation_records")
    op.drop_index(op.f("ix_moderation_records_action"), table_name="moderation_records")
    op.drop_index(op.f("ix_moderation_records_admin_id"), table_name="moderation_records")
    op.drop_index(op.f("ix_moderation_records_report_id"), table_name="moderation_records")
    op.drop_table("moderation_records")
