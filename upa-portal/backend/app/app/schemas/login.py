#!/usr/bin/env python

"""Login Schemas"""

from pydantic import BaseModel, Field


class Login(BaseModel):
    username: str = Field(description="The user name.")
    password: str = Field(description="The user password.")
