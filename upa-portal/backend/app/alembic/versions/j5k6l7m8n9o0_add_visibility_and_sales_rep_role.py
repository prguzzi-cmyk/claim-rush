"""add visibility columns to comment/file and sales-rep role

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa
from uuid import uuid4

# revision identifiers, used by Alembic.
revision = "j5k6l7m8n9o0"
down_revision = "i4j5k6l7m8n9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add visibility column to comment table
    op.add_column(
        "comment",
        sa.Column("visibility", sa.String(20), server_default="internal", nullable=False),
    )

    # Add visibility column to file table
    op.add_column(
        "file",
        sa.Column("visibility", sa.String(20), server_default="internal", nullable=False),
    )

    # Insert sales-rep role if it doesn't already exist
    op.execute(
        sa.text(
            "INSERT INTO role (id, name, display_name, can_be_removed, is_removed, created_at) "
            "SELECT :id, :name, :display_name, :can_be_removed, :is_removed, NOW() "
            "WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = :name)"
        ).bindparams(
            id=str(uuid4()),
            name="sales-rep",
            display_name="Sales Rep",
            can_be_removed=True,
            is_removed=False,
        )
    )


def downgrade() -> None:
    op.drop_column("file", "visibility")
    op.drop_column("comment", "visibility")

    op.execute("DELETE FROM role WHERE name = 'sales-rep'")
