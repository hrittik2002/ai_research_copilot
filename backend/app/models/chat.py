from datetime import datetime

from pydantic import BaseModel


class MessageResponse(BaseModel):
    message_id: str
    role: str          # "user" | "assistant"
    content: str
    created_at: datetime
