from pydantic import BaseModel, Field


class PlatformActivityEvent(BaseModel):
    id: str
    event_type: str = Field(description="fire_incident | lead_created | skip_trace_completed | voice_call | claim_opened")
    icon: str
    color: str
    title: str
    detail: str
    location: str | None = None
    assigned_agent: str | None = None
    timestamp: str


class PlatformActivityResponse(BaseModel):
    items: list[PlatformActivityEvent]
    total: int
