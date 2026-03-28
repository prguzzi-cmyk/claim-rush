"""seed roof_analysis module permissions

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa

revision = "l5m6n7o8p9q0"
down_revision = "k4l5m6n7o8p9"
branch_labels = None
depends_on = None

MODULE = "roof_analysis"
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
