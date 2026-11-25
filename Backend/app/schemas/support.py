from datetime import datetime

from pydantic import BaseModel, Field


class SupportChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    contact_support: bool = False


class SupportMessageResponse(BaseModel):
    id: int
    user_id: int | None = None
    sender: str
    message: str
    escalated: bool
    created_at: datetime
    user_email: str | None = None


class SupportChatResponse(BaseModel):
    messages: list[SupportMessageResponse]
    escalated: bool


class SupportReplyRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
