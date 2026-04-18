from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models.borrow import BorrowStatus
from app.schemas.user import UserPublic
from app.schemas.book import BookPublic

class BorrowRequestCreate(BaseModel):
    book_id: int

class ReturnRequestCreate(BaseModel):
    borrow_record_id: int

class BatchReturnRequestCreate(BaseModel):
    borrow_record_ids: list[int]

class BatchReturnRequestResult(BaseModel):
    borrow_record_id: int
    success: bool
    message: str
    record: dict | None = None

class BatchReturnRequestResponse(BaseModel):
    total: int
    success_count: int
    failure_count: int
    results: list[BatchReturnRequestResult]

class RequestProcess(BaseModel):
    action: str  # "approve" or "reject"
    notes: str | None = None

class BatchRequestProcess(BaseModel):
    request_ids: list[int]
    action: str  # "approve" or "reject"
    notes: str | None = None

class BatchRequestProcessResult(BaseModel):
    request_id: int
    success: bool
    message: str
    record: dict | None = None

class BatchRequestProcessResponse(BaseModel):
    total: int
    success_count: int
    failure_count: int
    results: list[BatchRequestProcessResult]

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