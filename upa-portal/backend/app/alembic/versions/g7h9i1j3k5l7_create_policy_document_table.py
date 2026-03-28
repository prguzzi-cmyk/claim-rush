"""create policy_document table

Revision ID: g7h9i1j3k5l7
Revises: b484ce17db0d
Create Date: 2026-03-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "g7h9i1j3k5l7"
down_revision = "b484ce17db0d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "policy_document",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        # File info
        sa.Column("file_name", sa.String(256), nullable=False),
        sa.Column("file_key", sa.String(512), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(64), nullable=False, server_default="application/pdf"),
        # Policy metadata
        sa.Column("insured_name", sa.String(200), nullable=True),
        sa.Column("carrier", sa.String(200), nullable=True),
        sa.Column("policy_number", sa.String(100), nullable=True),
        sa.Column("claim_number", sa.String(100), nullable=True),
        sa.Column("policy_type", sa.String(64), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("expiration_date", sa.Date(), nullable=True),
        # Property address
        sa.Column("property_address", sa.String(256), nullable=True),
        sa.Column("property_city", sa.String(100), nullable=True),
        sa.Column("property_state", sa.String(2), nullable=True),
        sa.Column("property_zip", sa.String(10), nullable=True),
        # AI extraction
        sa.Column("ai_extracted_text", sa.Text(), nullable=True),
        sa.Column("ai_metadata_json", sa.Text(), nullable=True),
        sa.Column("extraction_status", sa.String(32), nullable=False, server_default="pending"),
        # Notes
        sa.Column("notes", sa.Text(), nullable=True),
        # Versioning
        sa.Column(
            "parent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("policy_document.id", name="fk_policy_document_parent_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        # Entity linkages
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("client.id", name="fk_policy_document_client_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "lead_id",
            UUID(as_uuid=True),
            sa.ForeignKey("lead.id", name="fk_policy_document_lead_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "fire_claim_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fire_claim.id", name="fk_policy_document_fire_claim_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "adjuster_case_id",
            UUID(as_uuid=True),
            sa.ForeignKey("adjuster_case.id", name="fk_policy_document_adjuster_case_id", ondelete="SET NULL"),
            nullable=True,
        ),
        # SoftDeleteMixin
        sa.Column("can_be_removed", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default="false"),
        # AuditMixin
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
        sa.Column("updated_by_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("policy_document")
