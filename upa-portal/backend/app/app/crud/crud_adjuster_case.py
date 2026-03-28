#!/usr/bin/env python

"""CRUD operations for the Adjuster Case module"""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.crud.base import CRUDBase
from app.models.adjuster_case import AdjusterCase
from app.models.adjuster_case_document import AdjusterCaseDocument
from app.models.adjuster_case_policy_analysis import AdjusterCasePolicyAnalysis
from app.schemas.adjuster_case import AdjusterCaseCreate, AdjusterCaseUpdate

STEP_STATUS_MAP = {
    0: "intake",
    1: "policy_analysis",
    2: "damage_review",
    3: "draft_scope",
    4: "draft_estimate",
    5: "gap_analysis",
    6: "pa_review",
    7: "complete",
}


class CRUDAdjusterCase(CRUDBase[AdjusterCase, AdjusterCaseCreate, AdjusterCaseUpdate]):
    def get_with_details(self, db_session: Session, *, obj_id) -> AdjusterCase | None:
        """Fetch a case with documents and policy analyses eagerly loaded."""
        stmt = select(AdjusterCase).where(AdjusterCase.id == obj_id)
        return db_session.execute(stmt).unique().scalar_one_or_none()

    def advance_step(self, db_session: Session, *, db_obj: AdjusterCase) -> AdjusterCase:
        """Move the case to the next step."""
        next_step = min(db_obj.current_step + 1, 7)
        new_status = STEP_STATUS_MAP.get(next_step, "complete")
        return self.update(
            db_session,
            db_obj=db_obj,
            obj_in={"current_step": next_step, "status": new_status},
        )

    def auto_generate_case_number(self, db_session: Session) -> str:
        """Generate a case number in the format AC-YYYYMMDD-XXXX."""
        today = date.today().strftime("%Y%m%d")
        prefix = f"AC-{today}-"
        stmt = (
            select(func.count())
            .select_from(AdjusterCase)
            .where(AdjusterCase.case_number.like(f"{prefix}%"))
        )
        count = db_session.execute(stmt).scalar() or 0
        return f"{prefix}{count + 1:04d}"


adjuster_case = CRUDAdjusterCase(AdjusterCase)
