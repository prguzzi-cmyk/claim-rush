#!/usr/bin/env python

"""SQLAlchemy model for the crime_data_source_config table"""

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class CrimeDataSourceConfig(TimestampMixin, Base):
    source_type: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(200))
    endpoint_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    dataset_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    poll_interval_seconds: Mapped[int] = mapped_column(Integer, default=900)
    last_polled_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_record_count: Mapped[int] = mapped_column(Integer, default=0)
    connection_status: Mapped[str] = mapped_column(String(30), default="pending")
    freshness_label: Mapped[str | None] = mapped_column(String(30), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    extra_config: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"source_type={self.source_type!r}, "
            f"name={self.name!r})"
        )
