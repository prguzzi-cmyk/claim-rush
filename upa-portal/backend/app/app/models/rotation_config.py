#!/usr/bin/env python

"""SQLAlchemy model for rotation engine configuration"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import User
    from app.models.territory import Territory


class RotationConfig(TimestampMixin, Base):
    """Configuration for the lead rotation engine per territory.

    territory_id = NULL represents the global default configuration.
    Each territory can override with its own row.
    """

    territory_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "territory.id",
            name="fk_rotation_config_territory_id",
        ),
        nullable=True,
        unique=True,
    )
    contact_timeout_hours: Mapped[int] = mapped_column(Integer, default=24)
    max_contact_attempts: Mapped[int] = mapped_column(Integer, default=5)
    auto_reassign_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    rotation_index: Mapped[int] = mapped_column(Integer, default=0)
    use_performance_weighting: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    weight_closing_rate: Mapped[float] = mapped_column(
        Float, default=0.4, server_default="0.4"
    )
    weight_response_speed: Mapped[float] = mapped_column(
        Float, default=0.3, server_default="0.3"
    )
    weight_satisfaction: Mapped[float] = mapped_column(
        Float, default=0.3, server_default="0.3"
    )
    last_assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_rotation_config_last_assigned_agent_id",
        ),
        nullable=True,
    )

    # Relationships
    territory: Mapped["Territory | None"] = relationship(
        foreign_keys=[territory_id],
        lazy="joined",
    )
    last_assigned_agent: Mapped["User | None"] = relationship(
        foreign_keys=[last_assigned_agent_id],
        lazy="joined",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"territory_id={self.territory_id!r})"
        )
