"""Add comments and reactions tables

Revision ID: 0003_add_comments_and_reactions
Revises: 0002_add_moderation_records
Create Date: 2026-09-02 09:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

# revision identifiers, used by Alembic.
revision: str = "0003_add_comments_and_reactions"
down_revision: Union[str, None] = "0002_add_moderation_records"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create comments table
    op.create_table(
        "comments",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("report_id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="VISIBLE", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_comments_report_id"), "comments", ["report_id"], unique=False)
    op.create_index(op.f("ix_comments_user_id"), "comments", ["user_id"], unique=False)
    op.create_index(op.f("ix_comments_status"), "comments", ["status"], unique=False)
    op.create_index("ix_comments_report_created", "comments", ["report_id", "created_at"], unique=False)
    op.create_index("ix_comments_report_status", "comments", ["report_id", "status"], unique=False)

    # 2. Create reactions table
    op.create_table(
        "reactions",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("report_id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("reaction_type", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_id", "user_id", "reaction_type", name="uq_report_user_reaction"),
    )
    op.create_index(op.f("ix_reactions_report_id"), "reactions", ["report_id"], unique=False)
    op.create_index(op.f("ix_reactions_user_id"), "reactions", ["user_id"], unique=False)
    op.create_index(op.f("ix_reactions_reaction_type"), "reactions", ["reaction_type"], unique=False)
    op.create_index("ix_reactions_report_type", "reactions", ["report_id", "reaction_type"], unique=False)


def downgrade() -> None:
    # Drop reactions
    op.drop_index("ix_reactions_report_type", table_name="reactions")
    op.drop_index(op.f("ix_reactions_reaction_type"), table_name="reactions")
    op.drop_index(op.f("ix_reactions_user_id"), table_name="reactions")
    op.drop_index(op.f("ix_reactions_report_id"), table_name="reactions")
    op.drop_table("reactions")

    # Drop comments
    op.drop_index("ix_comments_report_status", table_name="comments")
    op.drop_index("ix_comments_report_created", table_name="comments")
    op.drop_index(op.f("ix_comments_status"), table_name="comments")
    op.drop_index(op.f("ix_comments_user_id"), table_name="comments")
    op.drop_index(op.f("ix_comments_report_id"), table_name="comments")
    op.drop_table("comments")
