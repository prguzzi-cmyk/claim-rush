"""create claim_zone_lead_tracker table

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-03-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "o8p9q0r1s2t3"
down_revision = "1336c407a174"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "claim_zone_lead_tracker",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("zone_id", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("county", sa.String(100), nullable=True),
        sa.Column("state", sa.String(10), nullable=True),
        sa.Column("priority", sa.String(5), nullable=True),
        sa.Column("claim_probability", sa.Float, nullable=True),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("lead.id", name="fk_czlt_lead_id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("territory_id", UUID(as_uuid=True), sa.ForeignKey("territory.id", name="fk_czlt_territory_id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("claim_zone_lead_tracker")
