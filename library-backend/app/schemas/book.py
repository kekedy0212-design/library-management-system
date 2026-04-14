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
    """创建书籍时不需要指定available_copies，系统会自动设置为total_copies"""
    pass

class BookUpdate(BaseModel):
    """更新书籍时不能直接修改available_copies，系统会根据total_copies自动计算"""
    title: Optional[str] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    description: Optional[str] = None
    total_copies: Optional[int] = None
    location: Optional[str] = None

class BookInDB(BookBase):
    id: int
    available_copies: int
    created_at: datetime
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

class BookPublic(BookInDB):
    pass
