from pydantic import BaseModel
from typing import Optional

class ChatMessage(BaseModel):
    role: str  # user | assistant | system
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    session_id: Optional[str] = None
    user_id: str
    role: str

class ChatResponse(BaseModel):
    answer: str
    citations: list[dict] = []
    session_id: Optional[str] = None