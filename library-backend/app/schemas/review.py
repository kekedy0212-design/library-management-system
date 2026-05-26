from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReviewUpsert(BaseModel):
    content: str


class BookReviewPublic(BaseModel):
    id: int
    book_id: int
    user_id: int
    username: str
    content: str
    created_at: datetime
    updated_at: datetime | None = None
    is_own: bool = False
    model_config = ConfigDict(from_attributes=True)
