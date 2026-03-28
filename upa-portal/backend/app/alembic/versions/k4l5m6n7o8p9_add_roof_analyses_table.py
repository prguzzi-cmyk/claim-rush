"""add roof_analyses table

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "k4l5m6n7o8p9"
down_revision = "j3k4l5m6n7o8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roof_analyses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        # Property identification
        sa.Column("property_id", sa.String(100), nullable=False, index=True),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("state", sa.String(2), nullable=False, index=True),
        sa.Column("zip_code", sa.String(10), nullable=False),
        sa.Column("county", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        # Roof metadata
        sa.Column("roof_type", sa.String(50), nullable=True),
        sa.Column("roof_age_years", sa.Integer, nullable=True),
        sa.Column("roof_size_sqft", sa.Float, nullable=True),
        # Storm context
        sa.Column("storm_event_id", UUID(as_uuid=True), sa.ForeignKey("storm_event.id"), nullable=True),
        sa.Column("storm_type", sa.String(20), nullable=True),
        sa.Column("hail_size_inches", sa.Float, nullable=True),
        sa.Column("wind_speed_mph", sa.Float, nullable=True),
        # Analysis results
        sa.Column("damage_score", sa.Integer, nullable=False, server_default="0"),
        sa.Column("damage_label", sa.String(20), nullable=False, server_default="none"),
        sa.Column("confidence", sa.String(10), nullable=False, server_default="low"),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("indicators", sa.Text, nullable=True),
        sa.Column("analysis_mode", sa.String(20), nullable=False, server_default="rules"),
        # Imagery
        sa.Column("image_source", sa.String(50), nullable=True),
        sa.Column("image_path", sa.String(500), nullable=True),
        # Claim estimate
        sa.Column("claim_range_low", sa.Float, nullable=True),
        sa.Column("claim_range_high", sa.Float, nullable=True),
        sa.Column("estimated_claim_value", sa.Float, nullable=True),
        # Pipeline status
        sa.Column("status", sa.String(30), nullable=False, server_default="queued", index=True),
        sa.Column("recommended_action", sa.String(200), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        # Ownership / outreach
        sa.Column("owner_name", sa.String(200), nullable=True),
        sa.Column("skip_trace_status", sa.String(20), nullable=False, server_default="not_started"),
        sa.Column("outreach_status", sa.String(20), nullable=False, server_default="not_started"),
        sa.Column("adjuster_notes", sa.Text, nullable=True),
        # Territory
        sa.Column("territory_id", UUID(as_uuid=True), sa.ForeignKey("territory.id"), nullable=True),
        sa.Column("territory_name", sa.String(200), nullable=True),
        # Batch tracking
        sa.Column("batch_id", sa.String(36), nullable=True, index=True),
        # Flags
        sa.Column("is_demo", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # Constraints
        sa.UniqueConstraint("property_id", "storm_event_id", name="uq_roof_property_storm"),
    )


def downgrade() -> None:
    op.drop_table("roof_analyses")
