"""create policy_intelligence table

Revision ID: k1l3m5n7o9p1
Revises: j0k2l4m6n8o0
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "k1l3m5n7o9p1"
down_revision = "j0k2l4m6n8o0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "policy_intelligence",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "policy_document_id",
            UUID(as_uuid=True),
            sa.ForeignKey(
                "policy_document.id",
                name="fk_policy_intelligence_policy_document_id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        # Copied metadata
        sa.Column("carrier", sa.String(200), nullable=True),
        sa.Column("insured_name", sa.String(200), nullable=True),
        sa.Column("policy_number", sa.String(100), nullable=True),
        # Coverage limits (A-F)
        sa.Column("coverage_a_dwelling", sa.Numeric(14, 2), nullable=True),
        sa.Column("coverage_b_other_structures", sa.Numeric(14, 2), nullable=True),
        sa.Column("coverage_c_personal_property", sa.Numeric(14, 2), nullable=True),
        sa.Column("coverage_d_loss_of_use", sa.Numeric(14, 2), nullable=True),
        sa.Column("coverage_e_liability", sa.Numeric(14, 2), nullable=True),
        sa.Column("coverage_f_medical", sa.Numeric(14, 2), nullable=True),
        sa.Column("other_coverage_json", sa.Text(), nullable=True),
        # Deductibles
        sa.Column("deductible_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("deductible_percentage", sa.Float(), nullable=True),
        sa.Column("deductible_wind_hail", sa.Numeric(14, 2), nullable=True),
        sa.Column("deductible_hurricane", sa.Numeric(14, 2), nullable=True),
        sa.Column("deductible_details", sa.Text(), nullable=True),
        # Structured clause text
        sa.Column("endorsements_json", sa.Text(), nullable=True),
        sa.Column("exclusions_json", sa.Text(), nullable=True),
        sa.Column("replacement_cost_language", sa.Text(), nullable=True),
        sa.Column("ordinance_and_law", sa.Text(), nullable=True),
        sa.Column("matching_language", sa.Text(), nullable=True),
        sa.Column("loss_settlement_clause", sa.Text(), nullable=True),
        sa.Column("appraisal_clause", sa.Text(), nullable=True),
        sa.Column("duties_after_loss", sa.Text(), nullable=True),
        sa.Column("ale_loss_of_use_details", sa.Text(), nullable=True),
        sa.Column("deadline_notice_details", sa.Text(), nullable=True),
        # AI summary + confidence
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )
    op.create_index(
        "ix_policy_intelligence_policy_document_id",
        "policy_intelligence",
        ["policy_document_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_policy_intelligence_policy_document_id", table_name="policy_intelligence")
    op.drop_table("policy_intelligence")
