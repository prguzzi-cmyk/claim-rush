#!/usr/bin/env python

"""Policy Document Model — permanent insurance policy PDF storage."""

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.adjuster_case import AdjusterCase
    from app.models.claim import Claim
    from app.models.client import Client
    from app.models.fire_claim import FireClaim
    from app.models.lead import Lead
    from app.models.policy_clause import PolicyClause
    from app.models.policy_intelligence import PolicyIntelligence


class PolicyDocument(TimestampMixin, AuditMixin, SoftDeleteMixin, Base):
    """Permanent, version-tracked insurance policy PDF storage."""

    # File info
    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str] = mapped_column(
        String(64), nullable=False, default="application/pdf"
    )

    # Policy metadata
    insured_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    carrier: Mapped[str | None] = mapped_column(String(200), nullable=True)
    policy_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    claim_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    policy_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiration_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Property address
    property_address: Mapped[str | None] = mapped_column(String(256), nullable=True)
    property_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    property_state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    property_zip: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # AI extraction
    ai_extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending"
    )

    # AI intelligence fields
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    assistant_ready: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    claim_guidance_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Versioning (self-referential)
    parent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "policy_document.id",
            name="fk_policy_document_parent_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Entity linkages
    claim_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_policy_document_claim_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    client_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "client.id",
            name="fk_policy_document_client_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "lead.id",
            name="fk_policy_document_lead_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    fire_claim_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "fire_claim.id",
            name="fk_policy_document_fire_claim_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    adjuster_case_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "adjuster_case.id",
            name="fk_policy_document_adjuster_case_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # Relationships
    claim: Mapped["Claim | None"] = relationship(
        lazy="joined", viewonly=True,
    )
    clauses: Mapped[list["PolicyClause"]] = relationship(
        back_populates="policy_document",
        lazy="selectin",
    )
    parent: Mapped["PolicyDocument | None"] = relationship(
        remote_side="PolicyDocument.id",
        lazy="joined",
        viewonly=True,
    )
    versions: Mapped[list["PolicyDocument"]] = relationship(
        foreign_keys=[parent_id],
        lazy="selectin",
        viewonly=True,
    )
    client: Mapped["Client | None"] = relationship(
        lazy="joined", viewonly=True,
    )
    lead: Mapped["Lead | None"] = relationship(
        lazy="joined", viewonly=True,
    )
    fire_claim: Mapped["FireClaim | None"] = relationship(
        lazy="joined", viewonly=True,
    )
    adjuster_case: Mapped["AdjusterCase | None"] = relationship(
        lazy="joined", viewonly=True,
    )
    intelligence: Mapped["PolicyIntelligence | None"] = relationship(
        back_populates="policy_document", uselist=False, lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<PolicyDocument(id={self.id}, file_name={self.file_name}, carrier={self.carrier})>"
