#!/usr/bin/env python

"""Login Schemas"""

from pydantic import BaseModel


class Login(BaseModel):
    username: str
    password: str
