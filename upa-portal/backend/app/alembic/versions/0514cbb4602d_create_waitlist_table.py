"""Create waitlist table

Revision ID: 0514cbb4602d
Revises: 32e5974e9f66
Create Date: 2025-01-22 05:26:54.207838

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "0514cbb4602d"
down_revision = "32e5974e9f66"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION generate_unique_passcode() 
        RETURNS TEXT AS $$
        DECLARE
            chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            result TEXT := '';
            i INTEGER := 0;
            success BOOLEAN := false;
        BEGIN
            WHILE NOT success LOOP
                result := '';
                FOR i IN 1..5 LOOP
                    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
                END LOOP;
                
                IF NOT EXISTS (
                    SELECT 1 FROM ai_estimate_waitlist WHERE passcode = result
                ) THEN
                    success := true;
                END IF;
            END LOOP;
            
            RETURN result;
        END;
        $$ LANGUAGE plpgsql VOLATILE;
    """
    )

    # Create AI Estimate Waitlist table
    op.create_table(
        "ai_estimate_waitlist",
        # Basic Information
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        # Passcode for tracking
        sa.Column(
            "passcode",
            sa.String(5),
            nullable=False,
            server_default=sa.text("generate_unique_passcode()"),
            unique=True,
        ),
        # Address Information
        sa.Column("address", sa.Text, nullable=False),
        sa.Column("loss_address", sa.Text, nullable=True),
        # Loss Information
        sa.Column("cause_of_loss", sa.String(255), nullable=False),
        sa.Column("date_of_loss", sa.Date, nullable=False),
        sa.Column("damage_description", sa.Text, nullable=False),
        # Insurance Information
        sa.Column("insurance_company", sa.String(255), nullable=False),
        sa.Column("policy_number", sa.String(100), nullable=False),
        sa.Column("claim_number", sa.String(100), nullable=True),
        # File Paths
        sa.Column("policy_file_path", sa.String(500), nullable=False),
        sa.Column("damage_photos_paths", sa.JSON, nullable=False),
        # Status Tracking
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_by_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True
        ),
        sa.Column(
            "updated_by_id", UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True
        ),
        # Additional Metadata
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
    )

    # Create indexes for better query performance
    op.create_index("ix_ai_estimate_waitlist_email", "ai_estimate_waitlist", ["email"])
    op.create_index(
        "ix_ai_estimate_waitlist_policy_number",
        "ai_estimate_waitlist",
        ["policy_number"],
    )
    op.create_index(
        "ix_ai_estimate_waitlist_claim_number", "ai_estimate_waitlist", ["claim_number"]
    )
    op.create_index(
        "ix_ai_estimate_waitlist_created_at", "ai_estimate_waitlist", ["created_at"]
    )
    # Add index for passcode
    op.create_index(
        "ix_ai_estimate_waitlist_passcode",
        "ai_estimate_waitlist",
        ["passcode"],
        unique=True,
    )


def downgrade() -> None:
    # Remove indexes
    op.drop_index("ix_ai_estimate_waitlist_created_at")
    op.drop_index("ix_ai_estimate_waitlist_claim_number")
    op.drop_index("ix_ai_estimate_waitlist_policy_number")
    op.drop_index("ix_ai_estimate_waitlist_email")
    op.drop_index("ix_ai_estimate_waitlist_passcode")

    # Drop the table
    op.drop_table("ai_estimate_waitlist")
