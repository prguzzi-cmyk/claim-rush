#!/usr/bin/env python

"""General Schemas for the Application"""

from pydantic import BaseModel, Field


class Enumerator(BaseModel):
    display_name: str | None = Field(description="The display name of the attribute.")
    value: str | None = Field(description="The value of the attribute.")
