"""Create estimating tables

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-03 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. pricing_item — no FKs to other new tables
    op.create_table(
        "pricing_item",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("base_cost", sa.Float(), nullable=True),
        sa.Column("labor_cost", sa.Float(), nullable=True),
        sa.Column("material_cost", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        # TimestampMixin
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pricing_item_code", "pricing_item", ["code"], unique=True)

    # 2. estimate_project — FK to claim
    op.create_table(
        "estimate_project",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("total_cost", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # FK to claim
        sa.Column("claim_id", UUID(as_uuid=True), nullable=False),
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
        "fk_estimate_project_claim_id",
        "estimate_project",
        "claim",
        ["claim_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_estimate_project_created_by_id",
        "estimate_project",
        "user",
        ["created_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_estimate_project_updated_by_id",
        "estimate_project",
        "user",
        ["updated_by_id"],
        ["id"],
    )
    op.create_index("ix_estimate_project_claim_id", "estimate_project", ["claim_id"])

    # 3. estimate_room — FK to estimate_project
    op.create_table(
        "estimate_room",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("room_type", sa.String(50), nullable=True),
        sa.Column("floor_level", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # FK to estimate_project
        sa.Column("project_id", UUID(as_uuid=True), nullable=False),
        # TimestampMixin
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_estimate_room_project_id",
        "estimate_room",
        "estimate_project",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_estimate_room_project_id", "estimate_room", ["project_id"])

    # 4. estimate_measurement — FK to estimate_room
    op.create_table(
        "estimate_measurement",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("length", sa.Float(), nullable=True),
        sa.Column("width", sa.Float(), nullable=True),
        sa.Column("height", sa.Float(), nullable=True),
        sa.Column("square_feet", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # FK to estimate_room
        sa.Column("room_id", UUID(as_uuid=True), nullable=False),
        # TimestampMixin
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_estimate_measurement_room_id",
        "estimate_measurement",
        "estimate_room",
        ["room_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_estimate_measurement_room_id", "estimate_measurement", ["room_id"]
    )

    # 5. estimate_line_item — FKs to estimate_room and pricing_item
    op.create_table(
        "estimate_line_item",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("unit_cost", sa.Float(), nullable=True),
        sa.Column("total_cost", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # FK to estimate_room
        sa.Column("room_id", UUID(as_uuid=True), nullable=False),
        # FK to pricing_item
        sa.Column("pricing_item_id", UUID(as_uuid=True), nullable=True),
        # TimestampMixin
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_estimate_line_item_room_id",
        "estimate_line_item",
        "estimate_room",
        ["room_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_estimate_line_item_pricing_item_id",
        "estimate_line_item",
        "pricing_item",
        ["pricing_item_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_estimate_line_item_room_id", "estimate_line_item", ["room_id"])
    op.create_index(
        "ix_estimate_line_item_pricing_item_id",
        "estimate_line_item",
        ["pricing_item_id"],
    )

    # 6. estimate_photo — FKs to estimate_project and estimate_room
    op.create_table(
        "estimate_photo",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("image_url", sa.String(500), nullable=False),
        sa.Column("caption", sa.String(200), nullable=True),
        sa.Column("ai_tags", sa.Text(), nullable=True),
        sa.Column("photo_type", sa.String(20), nullable=True),
        # FK to estimate_project
        sa.Column("project_id", UUID(as_uuid=True), nullable=False),
        # FK to estimate_room (optional)
        sa.Column("room_id", UUID(as_uuid=True), nullable=True),
        # TimestampMixin
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_estimate_photo_project_id",
        "estimate_photo",
        "estimate_project",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_estimate_photo_room_id",
        "estimate_photo",
        "estimate_room",
        ["room_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_estimate_photo_project_id", "estimate_photo", ["project_id"])
    op.create_index("ix_estimate_photo_room_id", "estimate_photo", ["room_id"])


def downgrade() -> None:
    # Drop in reverse FK-dependency order
    op.drop_index("ix_estimate_photo_room_id", table_name="estimate_photo")
    op.drop_index("ix_estimate_photo_project_id", table_name="estimate_photo")
    op.drop_table("estimate_photo")

    op.drop_index("ix_estimate_line_item_pricing_item_id", table_name="estimate_line_item")
    op.drop_index("ix_estimate_line_item_room_id", table_name="estimate_line_item")
    op.drop_table("estimate_line_item")

    op.drop_index("ix_estimate_measurement_room_id", table_name="estimate_measurement")
    op.drop_table("estimate_measurement")

    op.drop_index("ix_estimate_room_project_id", table_name="estimate_room")
    op.drop_table("estimate_room")

    op.drop_index("ix_estimate_project_claim_id", table_name="estimate_project")
    op.drop_table("estimate_project")

    op.drop_index("ix_pricing_item_code", table_name="pricing_item")
    op.drop_table("pricing_item")
