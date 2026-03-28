"""add defense_note table

Revision ID: d3f4n5s6e7v8
Revises: r0t1l2e3a4d5
Create Date: 2026-03-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d3f4n5s6e7v8"
down_revision = "r0t1l2e3a4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "defense_note",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("pricing_defense", sa.Text(), nullable=True),
        sa.Column("omitted_scope_defense", sa.Text(), nullable=True),
        sa.Column("matching_continuity_defense", sa.Text(), nullable=True),
        sa.Column("quantity_scope_defense", sa.Text(), nullable=True),
        sa.Column("code_standard_support", sa.Text(), nullable=True),
        sa.Column("recommended_action_notes", sa.Text(), nullable=True),
        sa.Column(
            "project_id",
            sa.UUID(),
            sa.ForeignKey(
                "estimate_project.id",
                name="fk_defense_note_project_id",
                ondelete="CASCADE",
            ),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "created_by_id",
            sa.UUID(),
            sa.ForeignKey(
                "user.id",
                name="fk_defense_note_created_by_id",
            ),
            nullable=True,
        ),
        sa.Column(
            "updated_by_id",
            sa.UUID(),
            sa.ForeignKey(
                "user.id",
                name="fk_defense_note_updated_by_id",
            ),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_defense_note_project_id", "defense_note", ["project_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_defense_note_project_id")
    op.drop_table("defense_note")
