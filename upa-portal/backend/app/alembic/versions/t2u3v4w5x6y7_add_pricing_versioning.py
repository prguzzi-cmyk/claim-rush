"""Add pricing versioning

Revision ID: t2u3v4w5x6y7
Revises:
Create Date: 2026-03-14

"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "t2u3v4w5x6y7"
down_revision = None
branch_labels = None
depends_on = None

# Pre-generated UUID for the legacy pricing version
LEGACY_VERSION_ID = str(uuid.uuid4())


def upgrade() -> None:
    # 1. Create pricing_version table
    op.create_table(
        "pricing_version",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("version_label", sa.String(50), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("region", sa.String(100), nullable=False, server_default="national"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("imported_by", UUID(as_uuid=True), nullable=True),
        # SoftDeleteMixin
        sa.Column("can_be_removed", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default="false"),
        # TimestampMixin
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # AuditMixin
        sa.Column("created_by_id", UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_pricing_version_imported_by",
        "pricing_version",
        "user",
        ["imported_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_pricing_version_created_by_id",
        "pricing_version",
        "user",
        ["created_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_pricing_version_updated_by_id",
        "pricing_version",
        "user",
        ["updated_by_id"],
        ["id"],
    )

    # 2. Insert a "Legacy" pricing version for existing data
    op.execute(
        sa.text(
            """
            INSERT INTO pricing_version (id, source, version_label, effective_date, region, status, item_count, notes)
            VALUES (:id, 'legacy', 'pre-versioning', CURRENT_DATE, 'national', 'active', 0, 'Auto-created during versioning migration')
            """
        ).bindparams(id=LEGACY_VERSION_ID)
    )

    # 3. Add version_id column to pricing_item
    op.add_column(
        "pricing_item",
        sa.Column("version_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_pricing_item_version_id", "pricing_item", ["version_id"])
    op.create_foreign_key(
        "fk_pricing_item_version_id",
        "pricing_item",
        "pricing_version",
        ["version_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 4. Update all existing pricing items to point to the legacy version
    op.execute(
        sa.text(
            "UPDATE pricing_item SET version_id = :version_id WHERE version_id IS NULL"
        ).bindparams(version_id=LEGACY_VERSION_ID)
    )

    # 5. Update the legacy version item_count
    op.execute(
        sa.text(
            """
            UPDATE pricing_version
            SET item_count = (SELECT COUNT(*) FROM pricing_item WHERE version_id = :version_id)
            WHERE id = :version_id
            """
        ).bindparams(version_id=LEGACY_VERSION_ID)
    )

    # 6. Drop old unique constraint and create new composite one
    op.drop_constraint("uq_pricing_item_code", "pricing_item", type_="unique")
    op.drop_index("ix_pricing_item_code", table_name="pricing_item")
    op.create_unique_constraint(
        "uq_pricing_item_code_version", "pricing_item", ["code", "version_id"]
    )

    # 7. Add pricing_version_id and pricing_region to estimate_project
    op.add_column(
        "estimate_project",
        sa.Column("pricing_version_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "estimate_project",
        sa.Column("pricing_region", sa.String(100), nullable=True),
    )
    op.create_foreign_key(
        "fk_estimate_project_pricing_version_id",
        "estimate_project",
        "pricing_version",
        ["pricing_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 8. Add pricing_code and pricing_version_id to estimate_line_item
    op.add_column(
        "estimate_line_item",
        sa.Column("pricing_code", sa.String(50), nullable=True),
    )
    op.add_column(
        "estimate_line_item",
        sa.Column("pricing_version_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_estimate_line_item_pricing_version_id",
        "estimate_line_item",
        "pricing_version",
        ["pricing_version_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Remove estimate_line_item columns
    op.drop_constraint(
        "fk_estimate_line_item_pricing_version_id",
        "estimate_line_item",
        type_="foreignkey",
    )
    op.drop_column("estimate_line_item", "pricing_version_id")
    op.drop_column("estimate_line_item", "pricing_code")

    # Remove estimate_project columns
    op.drop_constraint(
        "fk_estimate_project_pricing_version_id",
        "estimate_project",
        type_="foreignkey",
    )
    op.drop_column("estimate_project", "pricing_region")
    op.drop_column("estimate_project", "pricing_version_id")

    # Restore original pricing_item constraint
    op.drop_constraint("uq_pricing_item_code_version", "pricing_item", type_="unique")
    op.create_index("ix_pricing_item_code", "pricing_item", ["code"], unique=True)
    op.create_unique_constraint("uq_pricing_item_code", "pricing_item", ["code"])

    # Remove version_id from pricing_item
    op.drop_constraint(
        "fk_pricing_item_version_id", "pricing_item", type_="foreignkey"
    )
    op.drop_index("ix_pricing_item_version_id", table_name="pricing_item")
    op.drop_column("pricing_item", "version_id")

    # Drop pricing_version table
    op.drop_constraint(
        "fk_pricing_version_updated_by_id", "pricing_version", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_pricing_version_created_by_id", "pricing_version", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_pricing_version_imported_by", "pricing_version", type_="foreignkey"
    )
    op.drop_table("pricing_version")
