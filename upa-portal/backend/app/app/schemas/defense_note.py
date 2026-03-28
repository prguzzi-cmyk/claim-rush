#!/usr/bin/env python

"""Pydantic schemas for the DefenseNote module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


class DefenseNoteBase(BaseModel):
    pricing_defense: str | None = Field(
        default=None,
        description="Code / standard pricing defense narrative.",
    )
    omitted_scope_defense: str | None = Field(
        default=None,
        description="Omitted scope defense narrative.",
    )
    matching_continuity_defense: str | None = Field(
        default=None,
        description="Matching / continuity rationale narrative.",
    )
    quantity_scope_defense: str | None = Field(
        default=None,
        description="Quantity / scope correction rationale.",
    )
    code_standard_support: str | None = Field(
        default=None,
        description="Code and standard support references.",
    )
    recommended_action_notes: str | None = Field(
        default=None,
        description="Adjuster notes on recommended next actions.",
    )


class DefenseNoteCreate(DefenseNoteBase):
    """Used when creating defense notes — all fields optional."""

    pass


class DefenseNoteCreateDB(DefenseNoteBase):
    """Internal schema with project_id for database insertion."""

    project_id: UUID = Field(description="Parent estimate project UUID.")


class DefenseNoteUpdate(DefenseNoteBase):
    """Used for PUT — all fields optional, only non-None fields update."""

    pass


class DefenseNoteInDB(DefenseNoteBase):
    id: UUID | None = Field(description="Defense note UUID.")
    project_id: UUID | None = Field(
        default=None, description="Parent project UUID."
    )

    class Config:
        orm_mode = True


class DefenseNote(Timestamp, Audit, DefenseNoteInDB):
    ...
