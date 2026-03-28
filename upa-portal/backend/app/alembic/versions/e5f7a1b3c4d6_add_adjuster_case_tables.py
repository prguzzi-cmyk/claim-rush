"""add adjuster_case, adjuster_case_document, adjuster_case_policy_analysis tables

Revision ID: e5f7a1b3c4d6
Revises: q0r1s2t3u4v5
Create Date: 2026-03-10 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "e5f7a1b3c4d6"
down_revision = "q0r1s2t3u4v5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # adjuster_case
    op.create_table(
        "adjuster_case",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_number", sa.String(32), nullable=False, unique=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="intake"),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fire_claim_id", UUID(as_uuid=True), sa.ForeignKey("fire_claim.id", name="fk_adjuster_case_fire_claim_id", ondelete="SET NULL"), nullable=True, unique=True),
        sa.Column("estimate_project_id", UUID(as_uuid=True), sa.ForeignKey("estimate_project.id", name="fk_adjuster_case_estimate_project_id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_pa_id", UUID(as_uuid=True), sa.ForeignKey("user.id", name="fk_adjuster_case_assigned_pa_id", ondelete="SET NULL"), nullable=True),
        sa.Column("intake_notes", sa.Text(), nullable=True),
        sa.Column("intake_loss_date", sa.Date(), nullable=True),
        sa.Column("intake_loss_type", sa.String(64), nullable=True),
        sa.Column("intake_address", sa.String(256), nullable=True),
        sa.Column("intake_insured_name", sa.String(128), nullable=True),
        sa.Column("intake_carrier", sa.String(128), nullable=True),
        sa.Column("intake_policy_number", sa.String(64), nullable=True),
        sa.Column("intake_claim_number", sa.String(64), nullable=True),
        sa.Column("scope_notes", sa.Text(), nullable=True),
        sa.Column("scope_ai_summary", sa.Text(), nullable=True),
        sa.Column("damage_ai_summary", sa.Text(), nullable=True),
        sa.Column("final_report_url", sa.String(512), nullable=True),
        sa.Column("pa_approved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("pa_approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pa_notes", sa.Text(), nullable=True),
        # AuditMixin columns
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
        sa.Column("updated_by_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
        # TimestampMixin columns
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )

    # adjuster_case_document
    op.create_table(
        "adjuster_case_document",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", UUID(as_uuid=True), sa.ForeignKey("adjuster_case.id", name="fk_adjuster_case_document_case_id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(256), nullable=False),
        sa.Column("file_key", sa.String(512), nullable=False),
        sa.Column("file_type", sa.String(64), nullable=False),
        sa.Column("step", sa.String(32), nullable=False),
        sa.Column("ai_extracted_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )

    # adjuster_case_policy_analysis
    op.create_table(
        "adjuster_case_policy_analysis",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", UUID(as_uuid=True), sa.ForeignKey("adjuster_case.id", name="fk_adjuster_case_policy_analysis_case_id", ondelete="CASCADE"), nullable=False),
        sa.Column("coverage_type", sa.String(128), nullable=False),
        sa.Column("limit_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("deductible", sa.Numeric(12, 2), nullable=True),
        sa.Column("exclusions", sa.Text(), nullable=True),
        sa.Column("ai_confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("raw_ai_response", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("adjuster_case_policy_analysis")
    op.drop_table("adjuster_case_document")
    op.drop_table("adjuster_case")
