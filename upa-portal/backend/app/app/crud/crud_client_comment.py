#!/usr/bin/env python

"""CRUD operations for the client comment model"""

from app.crud.base import CRUDBase
from app.models import ClientComment
from app.schemas import ClientCommentCreate, ClientCommentUpdate


class CRUDClientComment(
    CRUDBase[ClientComment, ClientCommentCreate, ClientCommentUpdate]
):
    ...


client_comment = CRUDClientComment(ClientComment)
