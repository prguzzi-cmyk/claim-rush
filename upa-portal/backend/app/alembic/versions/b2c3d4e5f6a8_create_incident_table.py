"""create incident table for Incident Intelligence Data Engine

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-03-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a8"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "incident",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("incident_type", sa.String(30), nullable=False, index=True),
        sa.Column("source", sa.String(100), nullable=False, index=True),
        sa.Column("external_id", sa.String(255), nullable=True, index=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(2), nullable=True, index=True),
        sa.Column("zip_code", sa.String(10), nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("severity", sa.String(20), server_default="moderate", index=True),
        sa.Column("property_type", sa.String(50), nullable=True),
        sa.Column("priority_score", sa.Float, server_default="0.0", index=True),
        sa.Column("damage_probability", sa.Float, server_default="0.5"),
        sa.Column("location_density", sa.Float, server_default="0.5"),
        sa.Column("lead_converted", sa.Boolean, server_default="0", index=True),
        sa.Column("lead_id", sa.String(36), nullable=True, index=True),
        sa.Column("conversion_skipped_reason", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="1", index=True),
        sa.Column("source_record_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("source", "external_id", name="uq_incident_source_external"),
    )

    # Composite indexes for duplicate detection and geo queries
    op.create_index(
        "ix_incident_dedup",
        "incident",
        ["incident_type", "address", "occurred_at"],
    )
    op.create_index(
        "ix_incident_geo",
        "incident",
        ["latitude", "longitude"],
    )


def downgrade() -> None:
    op.drop_index("ix_incident_geo", table_name="incident")
    op.drop_index("ix_incident_dedup", table_name="incident")
    op.drop_table("incident")
