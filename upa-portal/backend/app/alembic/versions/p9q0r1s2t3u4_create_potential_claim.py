"""create potential_claim table

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3, 1336c407a174
Create Date: 2026-03-10 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "p9q0r1s2t3u4"
down_revision = ("o8p9q0r1s2t3", "1336c407a174")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "potential_claim",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("zone_id", sa.String(100), nullable=False, index=True),
        sa.Column("property_address", sa.String(500), nullable=False),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(2), nullable=False, index=True),
        sa.Column("zip_code", sa.String(10), nullable=True),
        sa.Column("county", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("property_type", sa.String(50), nullable=True),
        sa.Column("event_type", sa.String(30), nullable=False, index=True),
        sa.Column("claim_probability", sa.Integer, nullable=False),
        sa.Column("estimated_claim_value", sa.Float, nullable=False, server_default="0"),
        sa.Column("event_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending", index=True),
        sa.Column(
            "lead_id",
            UUID(as_uuid=True),
            sa.ForeignKey("lead.id", name="fk_potential_claim_lead_id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "territory_id",
            UUID(as_uuid=True),
            sa.ForeignKey("territory.id", name="fk_potential_claim_territory_id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "storm_event_id",
            UUID(as_uuid=True),
            sa.ForeignKey("storm_event.id", name="fk_potential_claim_storm_event_id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_potential_claim_zone_address",
        "potential_claim",
        ["zone_id", "property_address"],
    )


def downgrade() -> None:
    op.drop_index("ix_potential_claim_zone_address", table_name="potential_claim")
    op.drop_table("potential_claim")
