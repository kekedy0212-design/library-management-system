from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models.borrow import BorrowStatus
from app.schemas.user import UserPublic
from app.schemas.book import BookPublic

class BorrowRequestCreate(BaseModel):
    book_id: int

class ReturnRequestCreate(BaseModel):
    borrow_record_id: int

class RequestProcess(BaseModel):
    action: str  # "approve" or "reject"
    notes: str | None = None

class BorrowRecordPublic(BaseModel):
    id: int
    user_id: int
    book_id: int
    request_date: datetime
    approve_date: datetime | None
    due_date: datetime | None
    return_request_date: datetime | None
    actual_return_date: datetime | None
    status: BorrowStatus
    librarian_notes: str | None
    user: UserPublic | None = None
    book: BookPublic | None = None
    model_config = ConfigDict(from_attributes=True)