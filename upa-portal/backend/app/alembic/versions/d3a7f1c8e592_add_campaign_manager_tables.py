"""add campaign manager tables

Revision ID: d3a7f1c8e592
Revises: c8d4e2f503b1
Create Date: 2026-03-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd3a7f1c8e592'
down_revision = 'c8d4e2f503b1'
branch_labels = None
depends_on = None


def upgrade():
    # Extend outreach_campaign table with campaign manager fields
    op.add_column("outreach_campaign", sa.Column("description", sa.String(500), nullable=True))
    op.add_column("outreach_campaign", sa.Column("campaign_type", sa.String(20), nullable=False, server_default="sms"))
    op.add_column("outreach_campaign", sa.Column("status", sa.String(20), nullable=False, server_default="draft"))
    op.add_column("outreach_campaign", sa.Column("incident_type", sa.String(50), nullable=True))
    op.add_column("outreach_campaign", sa.Column("target_zip_code", sa.String(10), nullable=True))
    op.add_column("outreach_campaign", sa.Column("target_radius_miles", sa.Integer(), nullable=True))
    op.add_column("outreach_campaign", sa.Column("total_targeted", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("outreach_campaign", sa.Column("total_sent", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("outreach_campaign", sa.Column("total_delivered", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("outreach_campaign", sa.Column("total_responded", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("outreach_campaign", sa.Column("launched_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("outreach_campaign", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))

    # Create campaign_step table
    op.create_table(
        "campaign_step",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("outreach_campaign.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(10), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("outreach_template.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("delay_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("subject", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("campaign_step")
    op.drop_column("outreach_campaign", "completed_at")
    op.drop_column("outreach_campaign", "launched_at")
    op.drop_column("outreach_campaign", "total_responded")
    op.drop_column("outreach_campaign", "total_delivered")
    op.drop_column("outreach_campaign", "total_sent")
    op.drop_column("outreach_campaign", "total_targeted")
    op.drop_column("outreach_campaign", "target_radius_miles")
    op.drop_column("outreach_campaign", "target_zip_code")
    op.drop_column("outreach_campaign", "incident_type")
    op.drop_column("outreach_campaign", "status")
    op.drop_column("outreach_campaign", "campaign_type")
    op.drop_column("outreach_campaign", "description")
