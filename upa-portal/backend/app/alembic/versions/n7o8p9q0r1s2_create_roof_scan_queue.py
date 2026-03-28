"""create roof_scan_queue table

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-03-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "n7o8p9q0r1s2"
down_revision = "m6n7o8p9q0r1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roof_scan_queue",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", sa.String(100), nullable=False, index=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("zone_id", sa.String(100), nullable=False, index=True),
        sa.Column("storm_event_id", UUID(as_uuid=True), sa.ForeignKey("storm_event.id"), nullable=True),
        sa.Column("scan_status", sa.String(30), nullable=False, server_default="pending", index=True),
        sa.Column("roof_analysis_id", UUID(as_uuid=True), sa.ForeignKey("roof_analyses.id"), nullable=True),
        sa.Column("source", sa.String(30), nullable=False, server_default="osm"),
        sa.Column("building_type", sa.String(50), nullable=True),
        sa.Column("building_area_sqft", sa.Float, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("property_id", "zone_id", name="uq_scan_property_zone"),
    )


def downgrade() -> None:
    op.drop_table("roof_scan_queue")
