"""Add content flags table

Revision ID: 0004_add_content_flags
Revises: 0003_add_comments_and_reactions
Create Date: 2026-09-02 10:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = "0004_add_content_flags"
down_revision: Union[str, None] = "0003_add_comments_and_reactions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "content_flags",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("report_id", GUID(), nullable=True),
        sa.Column("comment_id", GUID(), nullable=True),
        sa.Column("reason", sa.String(length=50), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="PENDING", nullable=False),
        sa.Column("reviewed_by", GUID(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_content_flags_user_id"), "content_flags", ["user_id"], unique=False)
    op.create_index(op.f("ix_content_flags_target_type"), "content_flags", ["target_type"], unique=False)
    op.create_index(op.f("ix_content_flags_report_id"), "content_flags", ["report_id"], unique=False)
    op.create_index(op.f("ix_content_flags_comment_id"), "content_flags", ["comment_id"], unique=False)
    op.create_index(op.f("ix_content_flags_status"), "content_flags", ["status"], unique=False)
    op.create_index("ix_flags_target_status", "content_flags", ["target_type", "status"], unique=False)
    op.create_index("ix_flags_report_user_reason", "content_flags", ["report_id", "user_id", "reason"], unique=False)
    op.create_index("ix_flags_comment_user_reason", "content_flags", ["comment_id", "user_id", "reason"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_flags_comment_user_reason", table_name="content_flags")
    op.drop_index("ix_flags_report_user_reason", table_name="content_flags")
    op.drop_index("ix_flags_target_status", table_name="content_flags")
    op.drop_index(op.f("ix_content_flags_status"), table_name="content_flags")
    op.drop_index(op.f("ix_content_flags_comment_id"), table_name="content_flags")
    op.drop_index(op.f("ix_content_flags_report_id"), table_name="content_flags")
    op.drop_index(op.f("ix_content_flags_target_type"), table_name="content_flags")
    op.drop_index(op.f("ix_content_flags_user_id"), table_name="content_flags")
    op.drop_table("content_flags")
