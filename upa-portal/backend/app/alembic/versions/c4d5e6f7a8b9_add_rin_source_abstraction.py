"""Add rin_source abstraction layer

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-03-04 00:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None

# Deterministic seed UUIDs for each provider
PULSEPOINT_ID = uuid.UUID("00000000-0000-4000-a000-000000000001")
SOCRATA_ID = uuid.UUID("00000000-0000-4000-a000-000000000002")
NIFC_ID = uuid.UUID("00000000-0000-4000-a000-000000000003")
FIRMS_ID = uuid.UUID("00000000-0000-4000-a000-000000000004")


def upgrade() -> None:
    # 1. Create rin_source table
    op.create_table(
        "rin_source",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(30), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False, server_default="RIN Network"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 2. Seed rows
    rin_source = sa.table(
        "rin_source",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("code", sa.String),
        sa.column("label", sa.String),
        sa.column("display_name", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        rin_source,
        [
            {"id": PULSEPOINT_ID, "code": "pulsepoint", "label": "PulsePoint Dispatch", "display_name": "RIN Network", "is_active": True},
            {"id": SOCRATA_ID, "code": "socrata", "label": "Socrata 911 Dispatch", "display_name": "RIN Network", "is_active": True},
            {"id": NIFC_ID, "code": "nifc", "label": "NIFC Wildland Fire", "display_name": "RIN Network", "is_active": True},
            {"id": FIRMS_ID, "code": "firms", "label": "NASA FIRMS Satellite", "display_name": "RIN Network", "is_active": True},
        ],
    )

    # 3. Add source_id FK column to fire_incident (nullable for now)
    op.add_column(
        "fire_incident",
        sa.Column("source_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_fire_incident_source_id",
        "fire_incident",
        "rin_source",
        ["source_id"],
        ["id"],
    )
    op.create_index("ix_fire_incident_source_id", "fire_incident", ["source_id"])

    # 4. Backfill source_id from existing data_source strings
    op.execute(
        f"""
        UPDATE fire_incident
        SET source_id = CASE data_source
            WHEN 'pulsepoint' THEN '{PULSEPOINT_ID}'::uuid
            WHEN 'socrata'    THEN '{SOCRATA_ID}'::uuid
            WHEN 'nifc'       THEN '{NIFC_ID}'::uuid
            WHEN 'firms'      THEN '{FIRMS_ID}'::uuid
        END
        WHERE data_source IN ('pulsepoint', 'socrata', 'nifc', 'firms')
        """
    )


def downgrade() -> None:
    op.drop_index("ix_fire_incident_source_id", table_name="fire_incident")
    op.drop_constraint("fk_fire_incident_source_id", "fire_incident", type_="foreignkey")
    op.drop_column("fire_incident", "source_id")
    op.drop_table("rin_source")
