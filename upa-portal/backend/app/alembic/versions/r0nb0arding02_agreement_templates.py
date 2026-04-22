"""agreement_template table + 3 seeded role charter templates

The R1 invite endpoint titled charter agreements with role-specific
prefixes ("CP Charter Agreement — …") but didn't actually look up a
template. R2 adds the agreement_template table + seeds three rows
(CP / RVP / Agent) with placeholder bodies and a clear DRAFT banner.

Schema:
    id           UUID PK
    role         VARCHAR(20)  CHECK ('cp' | 'rvp' | 'agent')
    name         VARCHAR(200)
    body         TEXT          — placeholder text (rendered when no PDF
                                 is uploaded yet)
    pdf_url      VARCHAR(500)  — optional S3/local key to operator-uploaded
                                 real charter PDF
    is_active    BOOLEAN       — only one template per role marked active
                                 at a time
    created_at   timestamptz   — TimestampMixin

Templates seeded with a top-of-body banner:
"DRAFT TEMPLATE — REPLACE BEFORE SENDING TO REAL SIGNERS." Pete fills
in the actual charter text via the admin /app/admin/members/templates
upload UI — the infrastructure is production-ready, the legal text is
his to provide.

Revision ID: r0nb0arding02
Revises: r0nb0arding01
Create Date: 2026-04-22 18:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'r0nb0arding02'
down_revision = 'r0nb0arding01'
branch_labels = None
depends_on = None


_DRAFT_BANNER = (
    "DRAFT TEMPLATE — REPLACE BEFORE SENDING TO REAL SIGNERS.\n"
    "This is placeholder text. The admin can upload a real signed PDF "
    "via Admin → Members → Templates which will replace this body.\n\n"
)

_CP_BODY = (
    _DRAFT_BANNER +
    "Community Partner Charter Agreement\n\n"
    "{{full_name}}, as a Community Partner of ACI United, agrees to "
    "the territory, brand, and revenue-share terms described in this "
    "charter. Effective {{effective_date}}.\n\n"
    "[ Signature: ____________________ ]"
)

_RVP_BODY = (
    _DRAFT_BANNER +
    "Regional Vice President Agreement\n\n"
    "{{full_name}}, as an RVP, agrees to the team-build, revenue-share, "
    "and conduct terms described in this agreement. Effective "
    "{{effective_date}}.\n\n"
    "[ Signature: ____________________ ]"
)

_AGENT_BODY = (
    _DRAFT_BANNER +
    "Agent Engagement Agreement\n\n"
    "{{full_name}}, as a writing Agent, agrees to the commission split, "
    "advance schedule, and conduct terms described in this agreement. "
    "Effective {{effective_date}}.\n\n"
    "[ Signature: ____________________ ]"
)


def upgrade() -> None:
    op.create_table(
        'agreement_template',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('pdf_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("role IN ('cp', 'rvp', 'agent')", name='ck_agreement_template_role'),
    )
    op.create_index('ix_agreement_template_role', 'agreement_template', ['role'])

    # Seed the three role templates.
    op.execute(sa.text("""
        INSERT INTO agreement_template (role, name, body, is_active)
        VALUES (:role, :name, :body, TRUE);
    """).bindparams(role='cp',    name='CP Charter Agreement',    body=_CP_BODY))
    op.execute(sa.text("""
        INSERT INTO agreement_template (role, name, body, is_active)
        VALUES (:role, :name, :body, TRUE);
    """).bindparams(role='rvp',   name='RVP Agreement',           body=_RVP_BODY))
    op.execute(sa.text("""
        INSERT INTO agreement_template (role, name, body, is_active)
        VALUES (:role, :name, :body, TRUE);
    """).bindparams(role='agent', name='Agent Agreement',         body=_AGENT_BODY))


def downgrade() -> None:
    op.drop_index('ix_agreement_template_role', table_name='agreement_template')
    op.drop_table('agreement_template')
