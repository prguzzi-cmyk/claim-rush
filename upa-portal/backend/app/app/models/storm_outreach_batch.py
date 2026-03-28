#!/usr/bin/env python

"""SQLAlchemy model for the storm_outreach_batch table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import User


class StormOutreachBatch(TimestampMixin, Base):
    county: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(2))
    zip_codes: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    event_type: Mapped[str] = mapped_column(String(20))
    severity: Mapped[str] = mapped_column(String(20))
    estimated_properties: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")

    # FK to user who created the batch
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_storm_outreach_batch_created_by",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_by: Mapped["User | None"] = relationship(
        lazy="joined",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"county={self.county!r}, "
            f"state={self.state!r}, "
            f"status={self.status!r})"
        )
