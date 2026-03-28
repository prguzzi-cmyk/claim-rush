#!/usr/bin/env python

"""A utility file for the application constants."""


class Constants:
    def __init__(self):
        self._EMAIL_REGEX: str = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"

    @property
    def EMAIL_REGEX(self) -> str:
        return self._EMAIL_REGEX

    @EMAIL_REGEX.setter
    def EMAIL_REGEX(self, value):
        raise AttributeError("Cannot modify constant EMAIL_REGEX")


# Create an instance of Constants
constants = Constants()
