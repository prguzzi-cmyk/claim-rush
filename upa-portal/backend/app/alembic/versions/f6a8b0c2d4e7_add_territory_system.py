"""Add territory system

Revision ID: f6a8b0c2d4e7
Revises: e5f7a9b1c3d5
Create Date: 2026-03-06 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f6a8b0c2d4e7"
down_revision = "e5f7a9b1c3d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create territory table
    op.create_table(
        "territory",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("territory_type", sa.String(20), nullable=False),
        sa.Column("state", sa.String(2), nullable=True),
        sa.Column("county", sa.String(100), nullable=True),
        sa.Column("zip_code", sa.String(10), nullable=True),
        sa.Column("custom_geometry", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_territory_territory_type", "territory", ["territory_type"])
    op.create_index("ix_territory_state", "territory", ["state"])
    op.create_index("ix_territory_county", "territory", ["county"])
    op.create_index("ix_territory_zip_code", "territory", ["zip_code"])
    op.create_index("ix_territory_type_state", "territory", ["territory_type", "state"])
    op.create_index(
        "ix_territory_type_county", "territory", ["territory_type", "state", "county"]
    )

    # Create user_territory junction table
    op.create_table(
        "user_territory",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("user.id", name="fk_user_territory_user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "territory_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey(
                "territory.id", name="fk_user_territory_territory_id", ondelete="CASCADE"
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_territory_user_id", "user_territory", ["user_id"])
    op.create_index("ix_user_territory_territory_id", "user_territory", ["territory_id"])
    op.create_index(
        "ix_user_territory_user_territory",
        "user_territory",
        ["user_id", "territory_id"],
        unique=True,
    )

    # Add national_access flag to user table
    op.add_column(
        "user",
        sa.Column("national_access", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("user", "national_access")
    op.drop_table("user_territory")
    op.drop_table("territory")
