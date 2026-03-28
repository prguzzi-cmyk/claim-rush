"""seed lead_outcome permissions for all roles

Revision ID: h1i2j3k4l5m6
Revises: g1h2i3j4k5l6
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa

revision = "h1i2j3k4l5m6"
down_revision = "g1h2i3j4k5l6"
branch_labels = None
depends_on = None

MODULE = "lead_outcome"
OPERATIONS = ["create", "read", "update", "delete"]
ROLES = ["super-admin", "admin", "manager", "agent"]


def upgrade() -> None:
    conn = op.get_bind()

    # Check if already seeded
    existing = conn.execute(
        sa.text("SELECT COUNT(*) FROM permission WHERE module = :m"),
        {"m": MODULE},
    ).scalar()
    if existing:
        return

    # Insert permissions
    for operation in OPERATIONS:
        conn.execute(
            sa.text(
                "INSERT INTO permission (id, name, module, operation, can_be_removed, is_removed, created_at) "
                "VALUES (gen_random_uuid(), :name, :module, :op, false, false, now())"
            ),
            {"name": f"{MODULE}:{operation}", "module": MODULE, "op": operation},
        )

    # Link to roles
    conn.execute(
        sa.text(
            "INSERT INTO role_permission (role_id, permission_id) "
            "SELECT r.id, p.id FROM role r CROSS JOIN permission p "
            "WHERE p.module = :m AND r.name = ANY(:roles)"
        ),
        {"m": MODULE, "roles": ROLES},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM role_permission WHERE permission_id IN "
            "(SELECT id FROM permission WHERE module = :m)"
        ),
        {"m": MODULE},
    )
    conn.execute(
        sa.text("DELETE FROM permission WHERE module = :m"),
        {"m": MODULE},
    )
