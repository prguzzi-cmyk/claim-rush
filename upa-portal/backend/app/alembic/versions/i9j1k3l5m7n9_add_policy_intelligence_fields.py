"""add policy intelligence fields to policy_document

Revision ID: i9j1k3l5m7n9
Revises: h8i0j2k4l6m8
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "i9j1k3l5m7n9"
down_revision = "h8i0j2k4l6m8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "policy_document",
        sa.Column(
            "claim_id",
            UUID(as_uuid=True),
            sa.ForeignKey("claim.id", name="fk_policy_document_claim_id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "policy_document",
        sa.Column("ai_summary", sa.Text(), nullable=True),
    )
    op.add_column(
        "policy_document",
        sa.Column("assistant_ready", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "policy_document",
        sa.Column("claim_guidance_notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("policy_document", "claim_guidance_notes")
    op.drop_column("policy_document", "assistant_ready")
    op.drop_column("policy_document", "ai_summary")
    op.drop_constraint("fk_policy_document_claim_id", "policy_document", type_="foreignkey")
    op.drop_column("policy_document", "claim_id")
