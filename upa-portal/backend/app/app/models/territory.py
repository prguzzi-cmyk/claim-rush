#!/usr/bin/env python

"""SQLAlchemy models for the territory system"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import User


class Territory(TimestampMixin, Base):
    """A geographic territory that can be assigned to users."""

    name: Mapped[str] = mapped_column(String(200))
    territory_type: Mapped[str] = mapped_column(
        String(20), index=True
    )  # state, county, zip, custom
    state: Mapped[str | None] = mapped_column(String(2), index=True, nullable=True)
    county: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    zip_code: Mapped[str | None] = mapped_column(String(10), index=True, nullable=True)
    custom_geometry: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # GeoJSON for custom regions
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # CP & adjuster capacity
    chapter_president_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_territory_chapter_president_id"),
        nullable=True,
        index=True,
    )
    max_adjusters: Mapped[int] = mapped_column(
        Integer, default=3, server_default="3"
    )

    # Lead type flags
    lead_fire_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    lead_hail_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    lead_storm_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    lead_lightning_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    lead_flood_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    lead_theft_vandalism_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Relationships
    chapter_president: Mapped["User | None"] = relationship(
        foreign_keys=[chapter_president_id],
        lazy="joined",
    )
    user_territories: Mapped[list["UserTerritory"]] = relationship(
        back_populates="territory",
        lazy="select",
    )

    __table_args__ = (
        Index("ix_territory_type_state", "territory_type", "state"),
        Index("ix_territory_type_county", "territory_type", "state", "county"),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"name={self.name!r}, "
            f"territory_type={self.territory_type!r})"
        )


class UserTerritory(TimestampMixin, Base):
    """Junction table linking users to their assigned territories."""

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_user_territory_user_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    territory_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "territory.id",
            name="fk_user_territory_territory_id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        lazy="joined",
        viewonly=True,
    )
    territory: Mapped["Territory"] = relationship(
        back_populates="user_territories",
        lazy="joined",
    )

    __table_args__ = (
        Index("ix_user_territory_user_territory", "user_id", "territory_id", unique=True),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"user_id={self.user_id!r}, "
            f"territory_id={self.territory_id!r})"
        )
