"""seed fire_incident and fire_agency permission rows

The Modules registry expects fire_incident:read / fire_incident:read_removed
and fire_agency:CRUD permissions to exist in the permission table, but no
upstream chain migration inserts them. Without these rows, every
/v1/fire-incidents request 403s with "Operation not permitted" regardless
of role grants.

Idempotent — uses INSERT ... WHERE NOT EXISTS so re-runs are no-ops, and
deliberately does NOT grant the rows to any role. Per-role grants are owned
by the existing per-role seed migrations.

Revision ID: cplprep04
Revises: cplprep03
Create Date: 2026-04-26 11:00:03.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'cplprep04'
down_revision = 'cplprep03'
branch_labels = None
depends_on = None


_FIRE_INCIDENT_OPS = ['read', 'read_removed']
_FIRE_AGENCY_OPS = ['read', 'create', 'update', 'remove', 'read_removed']


def upgrade() -> None:
    bind = op.get_bind()

    for op_name in _FIRE_INCIDENT_OPS:
        bind.execute(
            sa.text(
                """
                INSERT INTO permission (id, name, module, operation, can_be_removed, is_removed, created_at)
                SELECT gen_random_uuid(), :name, 'fire_incident', :op, true, false, now()
                WHERE NOT EXISTS (
                    SELECT 1 FROM permission WHERE module = 'fire_incident' AND operation = :op
                )
                """
            ),
            {"name": f"fire_incident:{op_name}", "op": op_name},
        )

    for op_name in _FIRE_AGENCY_OPS:
        bind.execute(
            sa.text(
                """
                INSERT INTO permission (id, name, module, operation, can_be_removed, is_removed, created_at)
                SELECT gen_random_uuid(), :name, 'fire_agency', :op, true, false, now()
                WHERE NOT EXISTS (
                    SELECT 1 FROM permission WHERE module = 'fire_agency' AND operation = :op
                )
                """
            ),
            {"name": f"fire_agency:{op_name}", "op": op_name},
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DELETE FROM role_permission
            WHERE permission_id IN (
                SELECT id FROM permission WHERE module IN ('fire_incident', 'fire_agency')
            )
            """
        )
    )
    bind.execute(
        sa.text("DELETE FROM permission WHERE module IN ('fire_incident', 'fire_agency')")
    )
