from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RatingUpsert(BaseModel):
    score: int = Field(ge=1, le=5, description="Star rating from 1 to 5")


class BookRatingSummary(BaseModel):
    book_id: int
    average_rating: float | None = None
    rating_count: int = 0
    user_rating: int | None = None


class BookRatingPublic(BaseModel):
    id: int
    user_id: int
    book_id: int
    score: int
    created_at: datetime
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)
