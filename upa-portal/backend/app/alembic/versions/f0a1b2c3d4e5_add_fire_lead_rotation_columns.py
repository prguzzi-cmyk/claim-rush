"""Add fire lead rotation columns

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
Create Date: 2026-03-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f0a1b2c3d4e5"
down_revision = "e9f0a1b2c3d4"
branch_labels = None
depends_on = None

# Call type codes that should have auto_lead_enabled = True
AUTO_LEAD_CODES = ("SF", "CF", "RF", "WSF", "WCF", "WRF")


def upgrade() -> None:
    # 1. CallTypeConfig: auto_lead_enabled
    op.add_column(
        "call_type_config",
        sa.Column("auto_lead_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # 2. FireIncident: auto_lead_attempted + auto_lead_skipped_reason
    op.add_column(
        "fire_incident",
        sa.Column("auto_lead_attempted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "fire_incident",
        sa.Column("auto_lead_skipped_reason", sa.String(100), nullable=True),
    )

    # Seed auto_lead_enabled = True for structure/commercial/residential fire codes
    op.execute(
        sa.text(
            "UPDATE call_type_config SET auto_lead_enabled = true WHERE code IN :codes"
        ).bindparams(codes=AUTO_LEAD_CODES)
    )


def downgrade() -> None:
    op.drop_column("fire_incident", "auto_lead_skipped_reason")
    op.drop_column("fire_incident", "auto_lead_attempted")
    op.drop_column("call_type_config", "auto_lead_enabled")
