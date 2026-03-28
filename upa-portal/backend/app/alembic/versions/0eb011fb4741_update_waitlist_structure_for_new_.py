"""update waitlist structure for new frontend

Revision ID: 0eb011fb4741
Revises: 0514cbb4602d
Create Date: 2025-02-13 10:27:49.819932

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0eb011fb4741"
down_revision = "0514cbb4602d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE ai_estimate_waitlist SET email = '' WHERE email IS NULL")
    op.execute("UPDATE ai_estimate_waitlist SET phone = '' WHERE phone IS NULL")

    op.alter_column(
        "ai_estimate_waitlist",
        "email",
        existing_type=sa.VARCHAR(length=255),
        nullable=False,
    )
    op.alter_column(
        "ai_estimate_waitlist",
        "phone",
        existing_type=sa.VARCHAR(length=20),
        nullable=False,
    )

    # 添加新列
    op.add_column(
        "ai_estimate_waitlist",
        sa.Column("customer_city", sa.String(100), nullable=True),
    )
    op.add_column(
        "ai_estimate_waitlist", sa.Column("customer_state", sa.String(2), nullable=True)
    )
    op.add_column(
        "ai_estimate_waitlist",
        sa.Column("customer_zip_code", sa.String(10), nullable=True),
    )
    op.add_column(
        "ai_estimate_waitlist", sa.Column("loss_city", sa.String(100), nullable=True)
    )
    op.add_column(
        "ai_estimate_waitlist", sa.Column("loss_state", sa.String(2), nullable=True)
    )
    op.add_column(
        "ai_estimate_waitlist", sa.Column("loss_zip_code", sa.String(10), nullable=True)
    )
    op.add_column(
        "ai_estimate_waitlist",
        sa.Column("mortgage_company", sa.String(255), nullable=True),
    )
    op.add_column(
        "ai_estimate_waitlist", sa.Column("initials", sa.String(3), nullable=True)
    )

    op.drop_index(
        "ix_ai_estimate_waitlist_claim_number", table_name="ai_estimate_waitlist"
    )
    op.drop_index(
        "ix_ai_estimate_waitlist_created_at", table_name="ai_estimate_waitlist"
    )
    op.drop_index("ix_ai_estimate_waitlist_email", table_name="ai_estimate_waitlist")
    op.drop_index("ix_ai_estimate_waitlist_passcode", table_name="ai_estimate_waitlist")
    op.drop_index(
        "ix_ai_estimate_waitlist_policy_number", table_name="ai_estimate_waitlist"
    )
    op.alter_column(
        "comment",
        "text",
        existing_type=sa.TEXT(),
        type_=sa.String(),
        existing_nullable=False,
    )


def downgrade() -> None:
    # 删除新添加的列
    op.drop_column("ai_estimate_waitlist", "customer_city")
    op.drop_column("ai_estimate_waitlist", "customer_state")
    op.drop_column("ai_estimate_waitlist", "customer_zip_code")
    op.drop_column("ai_estimate_waitlist", "loss_city")
    op.drop_column("ai_estimate_waitlist", "loss_state")
    op.drop_column("ai_estimate_waitlist", "loss_zip_code")
    op.drop_column("ai_estimate_waitlist", "mortgage_company")
    op.drop_column("ai_estimate_waitlist", "initials")

    # 恢复列属性
    op.alter_column(
        "ai_estimate_waitlist",
        "phone",
        existing_type=sa.VARCHAR(length=20),
        nullable=True,
    )
    op.alter_column(
        "ai_estimate_waitlist",
        "email",
        existing_type=sa.VARCHAR(length=255),
        nullable=True,
    )
    op.create_index(
        "ix_ai_estimate_waitlist_policy_number",
        "ai_estimate_waitlist",
        ["policy_number"],
        unique=False,
    )
    op.create_index(
        "ix_ai_estimate_waitlist_passcode",
        "ai_estimate_waitlist",
        ["passcode"],
        unique=True,
    )
    op.create_index(
        "ix_ai_estimate_waitlist_email", "ai_estimate_waitlist", ["email"], unique=False
    )
    op.create_index(
        "ix_ai_estimate_waitlist_created_at",
        "ai_estimate_waitlist",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_ai_estimate_waitlist_claim_number",
        "ai_estimate_waitlist",
        ["claim_number"],
        unique=False,
    )
    op.alter_column(
        "comment",
        "text",
        existing_type=sa.String(),
        type_=sa.TEXT(),
        existing_nullable=False,
    )
