#!/usr/bin/env python

"""SQLAlchemy model for the business email table"""


from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class BusinessEmail(Base):
    first_name: Mapped[str | None] = mapped_column(String(50))
    last_name: Mapped[str | None] = mapped_column(String(50))
    username: Mapped[str] = mapped_column(String(75))
    email: Mapped[str]
    hashed_password: Mapped[str]
    is_active: Mapped[bool] = mapped_column(default=True)
    related_type: Mapped[str] = mapped_column(String(50))

    # Table Configuration
    __table_args__ = (UniqueConstraint("email", name="uq_business_email_email"),)
    __mapper_args__ = {
        "polymorphic_identity": "business_email",
        "polymorphic_on": "related_type",
    }

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"first_name: {self.first_name!r}, "
            f"last_name: {self.last_name!r}, "
            f"email: {self.email!r})"
        )
