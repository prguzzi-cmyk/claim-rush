"""add crime_incident and crime_data_source_config tables

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create crime_incident table
    op.create_table(
        "crime_incident",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("data_source", sa.String(100), nullable=False, index=True),
        sa.Column("external_id", sa.String(255), nullable=False, index=True),
        sa.Column("incident_type", sa.String(50), nullable=False, index=True),
        sa.Column("raw_incident_type", sa.String(255), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(2), nullable=True),
        sa.Column("zip_code", sa.String(10), nullable=True),
        sa.Column("county", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("severity", sa.String(20), server_default="moderate"),
        sa.Column("claim_relevance_score", sa.Float, server_default="0.5"),
        sa.Column("estimated_loss", sa.Float, nullable=True),
        sa.Column("property_type", sa.String(50), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("source_freshness", sa.String(30), nullable=True),
        sa.Column("is_mock", sa.Boolean, server_default=sa.text("false")),
        sa.Column("active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("data_source", "external_id", name="uq_crime_source_ext"),
    )

    # Create crime_data_source_config table
    op.create_table(
        "crime_data_source_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source_type", sa.String(50), index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("endpoint_url", sa.String(500), nullable=True),
        sa.Column("api_key", sa.String(500), nullable=True),
        sa.Column("dataset_id", sa.String(100), nullable=True),
        sa.Column("poll_interval_seconds", sa.Integer, server_default="900"),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_record_count", sa.Integer, server_default="0"),
        sa.Column("connection_status", sa.String(30), server_default="'pending'"),
        sa.Column("freshness_label", sa.String(30), nullable=True),
        sa.Column("enabled", sa.Boolean, server_default=sa.text("true")),
        sa.Column("extra_config", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Seed default source configs
    from uuid import UUID as PyUUID

    seeds = [
        {
            "id": str(PyUUID("00000000-0000-4000-b000-000000000001")),
            "source_type": "socrata",
            "name": "Chicago Open Crime Data",
            "endpoint_url": "https://data.cityofchicago.org",
            "dataset_id": "ijzp-q8t2",
            "poll_interval_seconds": 900,
            "last_record_count": 0,
            "connection_status": "pending",
            "freshness_label": "near_real_time",
            "enabled": True,
        },
        {
            "id": str(PyUUID("00000000-0000-4000-b000-000000000002")),
            "source_type": "carto",
            "name": "Philadelphia Crime Data",
            "endpoint_url": "https://phl.carto.com/api/v2/sql",
            "poll_interval_seconds": 900,
            "last_record_count": 0,
            "connection_status": "pending",
            "freshness_label": "near_real_time",
            "enabled": True,
        },
        {
            "id": str(PyUUID("00000000-0000-4000-b000-000000000003")),
            "source_type": "fbi_api",
            "name": "FBI UCR Crime Stats",
            "endpoint_url": "https://api.usa.gov/crime/fbi/sapi",
            "poll_interval_seconds": 86400,
            "last_record_count": 0,
            "connection_status": "pending",
            "freshness_label": "historical",
            "enabled": True,
        },
        {
            "id": str(PyUUID("00000000-0000-4000-b000-000000000004")),
            "source_type": "mock",
            "name": "Mock Crime Feed",
            "poll_interval_seconds": 0,
            "last_record_count": 0,
            "connection_status": "mock",
            "enabled": False,
        },
    ]

    config_table = sa.table(
        "crime_data_source_config",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("source_type", sa.String),
        sa.column("name", sa.String),
        sa.column("endpoint_url", sa.String),
        sa.column("dataset_id", sa.String),
        sa.column("poll_interval_seconds", sa.Integer),
        sa.column("last_record_count", sa.Integer),
        sa.column("connection_status", sa.String),
        sa.column("freshness_label", sa.String),
        sa.column("enabled", sa.Boolean),
    )

    for seed in seeds:
        op.execute(config_table.insert().values(**seed))


def downgrade() -> None:
    op.drop_table("crime_data_source_config")
    op.drop_table("crime_incident")
