#!/usr/bin/env python

import uuid

from sqlalchemy import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

from app.utils.common import camel_to_snake_case


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models

    Define a series of common elements that may be applied to mapped classes
    using this class as a base class.
    """

    # Default columns
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Set DB engine
    __table_args__ = {"mysql_engine": "InnoDB"}

    # In case returning is supported
    __mapper_args__ = {"eager_defaults": "auto"}

    @declared_attr.directive
    def __tablename__(self) -> str:
        """
        Generate the tablename with the help of class name

        Returns
        -------
        str
            Returns tablename
        """
        return camel_to_snake_case(self.__name__)
