from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class BookBase(BaseModel):
    title: str
    author: str
    isbn: str
    description: Optional[str] = None
    total_copies: int = 1
    location: Optional[str] = None

class BookCreate(BookBase):
    available_copies: Optional[int] = None

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    description: Optional[str] = None
    total_copies: Optional[int] = None
    available_copies: Optional[int] = None
    location: Optional[str] = None

class BookInDB(BookBase):
    id: int
    available_copies: int
    created_at: datetime
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

class BookPublic(BookInDB):
    pass