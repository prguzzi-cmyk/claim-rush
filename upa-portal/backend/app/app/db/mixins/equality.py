#!/usr/bin/env python

"""Equality check Mixin"""

from sqlalchemy import inspect


class EqMixin:
    def compare_value(self):
        """Return a value or tuple of values to use for comparisons.
        Return instance's primary key by default,
        which requires that it is persistent in the database.
        """
        return inspect(self).identity

    def __eq__(self, other):
        if not isinstance(other, self.__class__):
            return NotImplemented

        return self.compare_value() == other.compare_value()

    def __ne__(self, other):
        eq = self.__eq__(other)

        if eq is NotImplemented:
            return eq

        return not eq

    def __hash__(self):
        return hash(self.__class__) ^ hash(self.compare_value())
