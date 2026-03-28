#!/usr/bin/env python

"""Adjuster Case Document Model — uploaded files per case."""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class AdjusterCaseDocument(TimestampMixin, Base):
    """File attachment for an adjuster case (policy, photo, report, etc.)."""

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("adjuster_case.id", name="fk_adjuster_case_document_case_id", ondelete="CASCADE"),
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_type: Mapped[str] = mapped_column(String(64), nullable=False)  # policy, photo, report, estimate, other
    step: Mapped[str] = mapped_column(String(32), nullable=False)
    ai_extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    case = relationship("AdjusterCase", back_populates="documents")

    def __repr__(self) -> str:
        return f"<AdjusterCaseDocument(id={self.id}, file_name={self.file_name})>"
