"""seed adjuster_case module permissions

Revision ID: f6g8h0i2j4k6
Revises: e5f7a1b3c4d6
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa

revision = "f6g8h0i2j4k6"
down_revision = "e5f7a1b3c4d6"
branch_labels = None
depends_on = None

MODULE = "adjuster_case"
OPERATIONS = ["read", "create", "update", "remove", "read_removed", "restore"]
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
