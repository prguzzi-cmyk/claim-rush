"""RIN Portal Guide — Anthropic Claude chat proxy."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic

from app.core.config import settings

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    role: str
    content: str


@router.post("/chat", response_model=ChatResponse)
async def rin_chat(body: ChatRequest):
    """Proxy chat completions to Anthropic Claude."""
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise HTTPException(status_code=503, detail="Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=api_key)

    # Separate system message from conversation messages
    system_prompt = ""
    conversation = []
    for m in body.messages:
        if m.role == "system":
            system_prompt = m.content
        else:
            conversation.append({"role": m.role, "content": m.content})

    try:
        message = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=conversation,
        )
        return ChatResponse(
            role="assistant",
            content=message.content[0].text,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
