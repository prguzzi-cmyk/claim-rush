#!/usr/bin/env python

"""Soft Delete Mixin"""

from sqlalchemy.orm import Mapped, mapped_column


class SoftDeleteMixin:
    can_be_removed: Mapped[bool] = mapped_column(default=True)
    is_removed: Mapped[bool] = mapped_column(default=False)
