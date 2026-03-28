#!/usr/bin/env python

"""CRUD operations for the lead comment model"""

from app.crud.base import CRUDBase
from app.models import LeadComment
from app.schemas import LeadCommentCreate, LeadCommentUpdate


class CRUDLeadComment(CRUDBase[LeadComment, LeadCommentCreate, LeadCommentUpdate]):
    ...


lead_comment = CRUDLeadComment(LeadComment)
