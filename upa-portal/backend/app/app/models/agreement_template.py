#!/usr/bin/env python

"""SQLAlchemy model for agreement_template.

One row per role × version. Only one row per role is `is_active=True`
at any time — the R1 invite endpoint reads the active row when
generating a charter agreement. Admin can upload a real PDF to
replace the seeded placeholder body via R2's templates endpoints.
"""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class AgreementTemplate(Base):
    __table_args__ = (
        CheckConstraint("role IN ('cp', 'rvp', 'agent')",
                        name="ck_agreement_template_role"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    # 'cp' | 'rvp' | 'agent' — lowercase canonical (matches the invite
    # endpoint payload + role.name lowercasing).
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Markdown / plain-text body. Rendered by the signing UI when no
    # operator-uploaded PDF is on file.
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional S3 / local key. When set, the signer renders this PDF
    # instead of the body text. Caller constructs the storage key.
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true", default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
