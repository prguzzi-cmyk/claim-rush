"""Add multi-source fire data support

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-28 00:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'cplprep01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- 1. Create fire_data_source_config table ---
    op.create_table(
        'fire_data_source_config',
        sa.Column('id', sa.Uuid(), nullable=False, default=uuid.uuid4),
        sa.Column('source_type', sa.String(20), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('endpoint_url', sa.String(500), nullable=False),
        sa.Column('api_key', sa.String(200), nullable=True),
        sa.Column('dataset_id', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('poll_interval_seconds', sa.Integer(), nullable=False, server_default='300'),
        sa.Column('last_polled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('extra_config', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # --- 2. Add new columns to fire_incident ---
    op.add_column(
        'fire_incident',
        sa.Column('data_source', sa.String(20), nullable=False, server_default='pulsepoint'),
    )
    op.add_column(
        'fire_incident',
        sa.Column('external_id', sa.String(200), nullable=True),
    )
    op.add_column(
        'fire_incident',
        sa.Column('source_url', sa.String(500), nullable=True),
    )

    # Add indexes
    op.create_index('ix_fire_incident_data_source', 'fire_incident', ['data_source'])
    op.create_index('ix_fire_incident_external_id', 'fire_incident', ['external_id'])

    # --- 3. Make agency_id nullable ---
    op.alter_column(
        'fire_incident',
        'agency_id',
        existing_type=sa.Uuid(),
        nullable=True,
    )

    # Make pulsepoint_id nullable
    op.alter_column(
        'fire_incident',
        'pulsepoint_id',
        existing_type=sa.String(100),
        nullable=True,
    )

    # --- 4. Add unique constraint for multi-source dedup ---
    op.create_unique_constraint(
        'uq_fire_incident_source_external',
        'fire_incident',
        ['data_source', 'external_id'],
    )

    # --- 5. Backfill existing rows ---
    op.execute(
        "UPDATE fire_incident SET "
        "data_source = 'pulsepoint', "
        "external_id = pulsepoint_id "
        "WHERE data_source = 'pulsepoint' AND external_id IS NULL"
    )

    # --- 6. Seed fire_data_source_config with default entries ---

    # Socrata - Seattle
    op.execute(
        sa.text(
            "INSERT INTO fire_data_source_config "
            "(id, source_type, name, endpoint_url, dataset_id, is_active, poll_interval_seconds, extra_config, created_at) "
            "VALUES (:id, 'socrata', 'Seattle Fire 911', 'https://data.seattle.gov', 'kzjm-xkqj', true, 300, "
            "'{\"fire_type_field\": \"type\", \"fire_codes\": [\"Aid Response\", \"Auto Fire Alarm\", \"Brush Fire\", \"Fire in Building\", \"Fire in Single Family Res\"]}', now())"
        ).bindparams(id=str(uuid.uuid4()))
    )

    # Socrata - San Francisco
    op.execute(
        sa.text(
            "INSERT INTO fire_data_source_config "
            "(id, source_type, name, endpoint_url, dataset_id, is_active, poll_interval_seconds, extra_config, created_at) "
            "VALUES (:id, 'socrata', 'San Francisco Fire 911', 'https://data.sfgov.org', 'nuek-vuh3', true, 300, "
            "'{\"fire_type_field\": \"call_type\", \"fire_codes\": [\"Structure Fire\", \"Building Fire\", \"Alarms\"]}', now())"
        ).bindparams(id=str(uuid.uuid4()))
    )

    # Socrata - NYC
    op.execute(
        sa.text(
            "INSERT INTO fire_data_source_config "
            "(id, source_type, name, endpoint_url, dataset_id, is_active, poll_interval_seconds, extra_config, created_at) "
            "VALUES (:id, 'socrata', 'NYC Fire Incidents', 'https://data.cityofnewyork.us', '8m42-w767', true, 300, "
            "'{\"fire_type_field\": \"incident_type\", \"fire_codes\": [\"111\", \"112\", \"113\", \"114\", \"115\", \"116\", \"117\", \"118\", \"120\", \"121\", \"122\", \"123\"]}', now())"
        ).bindparams(id=str(uuid.uuid4()))
    )

    # Socrata - Chicago
    op.execute(
        sa.text(
            "INSERT INTO fire_data_source_config "
            "(id, source_type, name, endpoint_url, dataset_id, is_active, poll_interval_seconds, extra_config, created_at) "
            "VALUES (:id, 'socrata', 'Chicago Fire 911', 'https://data.cityofchicago.org', 'ijzp-q8t2', true, 300, "
            "'{\"fire_type_field\": \"_primary_desc\", \"fire_codes\": [\"FIRE\"]}', now())"
        ).bindparams(id=str(uuid.uuid4()))
    )

    # NIFC
    op.execute(
        sa.text(
            "INSERT INTO fire_data_source_config "
            "(id, source_type, name, endpoint_url, is_active, poll_interval_seconds, created_at) "
            "VALUES (:id, 'nifc', 'NIFC Wildland Fires', "
            "'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query', "
            "true, 600, now())"
        ).bindparams(id=str(uuid.uuid4()))
    )

    # NASA FIRMS
    op.execute(
        sa.text(
            "INSERT INTO fire_data_source_config "
            "(id, source_type, name, endpoint_url, is_active, poll_interval_seconds, extra_config, created_at) "
            "VALUES (:id, 'firms', 'NASA FIRMS Satellite', "
            "'https://firms.modaps.eosdis.nasa.gov/api/country/csv', "
            "true, 900, "
            "'{\"source\": \"VIIRS_SNPP_NRT\", \"country\": \"USA\", \"days\": 1}', now())"
        ).bindparams(id=str(uuid.uuid4()))
    )

    # --- 7. Seed new call type codes ---
    conn = op.get_bind()

    for code, desc, sort_order in [
        ('WF', 'Wildland Fire', 5),
        ('SAT', 'Satellite Detected Fire', 6),
        ('911', '911 Dispatch Fire', 7),
    ]:
        result = conn.execute(
            sa.text("SELECT id FROM call_type_config WHERE code = :code"),
            {"code": code},
        )
        if result.fetchone() is None:
            op.execute(
                sa.text(
                    "INSERT INTO call_type_config (id, code, description, is_enabled, sort_order, created_at) "
                    "VALUES (:id, :code, :desc, true, :sort_order, now())"
                ).bindparams(id=str(uuid.uuid4()), code=code, desc=desc, sort_order=sort_order)
            )


def downgrade() -> None:
    # Drop unique constraint
    op.drop_constraint('uq_fire_incident_source_external', 'fire_incident', type_='unique')

    # Drop indexes
    op.drop_index('ix_fire_incident_external_id', table_name='fire_incident')
    op.drop_index('ix_fire_incident_data_source', table_name='fire_incident')

    # Drop new columns
    op.drop_column('fire_incident', 'source_url')
    op.drop_column('fire_incident', 'external_id')
    op.drop_column('fire_incident', 'data_source')

    # Revert agency_id to non-nullable
    op.alter_column(
        'fire_incident',
        'agency_id',
        existing_type=sa.Uuid(),
        nullable=False,
    )

    # Revert pulsepoint_id to non-nullable
    op.alter_column(
        'fire_incident',
        'pulsepoint_id',
        existing_type=sa.String(100),
        nullable=False,
    )

    # Drop fire_data_source_config table
    op.drop_table('fire_data_source_config')

    # Remove seeded call type codes
    op.execute("DELETE FROM call_type_config WHERE code IN ('WF', 'SAT', '911')")
