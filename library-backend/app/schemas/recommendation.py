from pydantic import BaseModel, Field

from app.schemas.book import BookPublic


class BookRecommendation(BaseModel):
    book: BookPublic
    match_score: float = Field(description="Recommendation strength (higher is better)")
    reason: str


class BookRecommendationResponse(BaseModel):
    items: list[BookRecommendation]
    strategy: str = Field(
        description="personalized = based on your ratings; popular = community favorites"
    )
