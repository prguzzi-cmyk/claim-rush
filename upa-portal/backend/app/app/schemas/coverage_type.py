#!/usr/bin/env python

"""Schema for Coverage type."""

from pydantic.dataclasses import dataclass

from app.db.data_classes.coverage_type import CoverageType


@dataclass
class CoverageTypeSchema(CoverageType):
    pass
