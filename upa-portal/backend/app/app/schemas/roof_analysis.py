"""Pydantic schemas for roof damage analysis."""

from typing import List, Optional

from pydantic import BaseModel, Field, validator


class RoofAnalysisPropertyInput(BaseModel):
    property_id: str
    latitude: float
    longitude: float


class RoofAnalysisRequest(BaseModel):
    properties: List[RoofAnalysisPropertyInput]

    @validator("properties")
    def max_50_properties(cls, v):
        if len(v) > 50:
            raise ValueError("Maximum 50 properties per request")
        return v


class RoofAnalysisResult(BaseModel):
    property_id: str
    damage_score: int = Field(ge=0, le=100)
    damage_label: str  # none / low / moderate / high / severe
    confidence: str  # low / medium / high
    summary: str
    indicators: List[str] = []
    image_url: Optional[str] = None
    error: Optional[str] = None


class RoofAnalysisResponse(BaseModel):
    results: List[RoofAnalysisResult]
    total: int
    analyzed: int
    failed: int
