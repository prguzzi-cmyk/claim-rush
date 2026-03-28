#!/usr/bin/env python

"""Coverage type data class."""

from dataclasses import dataclass, field


@dataclass
class CoverageType:
    name: str
    slug: str
    description: str | None = field(default=None)
