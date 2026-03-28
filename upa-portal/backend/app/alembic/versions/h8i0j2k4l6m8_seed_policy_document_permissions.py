"""seed policy_document module permissions

Revision ID: h8i0j2k4l6m8
Revises: g7h9i1j3k5l7
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa

revision = "h8i0j2k4l6m8"
down_revision = "g7h9i1j3k5l7"
branch_labels = None
depends_on = None

MODULE = "policy_document"
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
