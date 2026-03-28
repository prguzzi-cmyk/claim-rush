"""create policy_clause table

Revision ID: j0k2l4m6n8o0
Revises: i9j1k3l5m7n9
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "j0k2l4m6n8o0"
down_revision = "i9j1k3l5m7n9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "policy_clause",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "policy_document_id",
            UUID(as_uuid=True),
            sa.ForeignKey(
                "policy_document.id",
                name="fk_policy_clause_policy_document_id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column("clause_type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("percentage", sa.Float(), nullable=True),
        sa.Column("section_reference", sa.String(128), nullable=True),
        sa.Column("applies_to", sa.String(256), nullable=True),
        sa.Column("ai_confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )
    op.create_index("ix_policy_clause_policy_document_id", "policy_clause", ["policy_document_id"])
    op.create_index("ix_policy_clause_clause_type", "policy_clause", ["clause_type"])


def downgrade() -> None:
    op.drop_index("ix_policy_clause_clause_type", table_name="policy_clause")
    op.drop_index("ix_policy_clause_policy_document_id", table_name="policy_clause")
    op.drop_table("policy_clause")
