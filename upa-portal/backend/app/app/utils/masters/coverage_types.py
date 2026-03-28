#!/usr/bin/env python

"""Coverage Type master data."""

import json
from pathlib import Path

from app import schemas
from app.db.data_classes import CoverageType
from app.utils.singleton_class import Singleton


class CoverageTypes(Singleton):
    def __init__(self):
        # Load JSON data file and read data from it
        file_path = str(
            Path(__file__).parent.parent.parent / "db" / "data" / "coverage_types.json"
        )

        with open(file_path, "r") as file:
            data = json.load(file)
            self._coverage_types = [
                schemas.CoverageTypeSchema(**coverage_type)
                for coverage_type in data["coverage_types"]
            ]

    @property
    def coverage_types(self):
        self._coverage_types.sort(key=lambda ct: ct.name)
        return self._coverage_types

    @property
    def coverage_types_slug(self):
        return {ct.slug for ct in self._coverage_types}

    def get_coverage_type(self, coverage_slug: str) -> CoverageType | None:
        """
        Get a coverage type via coverage type slug.

        Parameters
        ----------
        coverage_slug : str
            A slug string of coverage type.

        Returns
        -------
        CoverageType | None
            If record found then `CoverageType` data object otherwise `None`
        """
        for coverage_type in self._coverage_types:
            if coverage_type.slug == coverage_slug:
                return coverage_type

        return None
