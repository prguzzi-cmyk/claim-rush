#!/usr/bin/env python

"""Schema for Message"""

from pydantic import BaseModel, Field


class Msg(BaseModel):
    msg: str | None = Field(title="Message", description="Response message")
