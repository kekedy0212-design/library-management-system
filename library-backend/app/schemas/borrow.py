from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models.borrow import BorrowStatus
from app.schemas.user import UserPublic
from app.schemas.book import BookPublic
from app.schemas.copy import BookCopyPublic


class BorrowRequestCreate(BaseModel):
    book_id: int
    # 可选：扫码借阅会带上具体副本 ID；快速借阅（仅点按钮）不传，
    # 后端会自动挑一个可用副本。同时兼容仅传条码 barcode_number 的场景。
    copy_id: int | None = None
    barcode_number: int | None = None
    requested_due_date: datetime | None = None


class ReserveRequestCreate(BaseModel):
    book_id: int


class ReturnRequestCreate(BaseModel):
    borrow_record_id: int
    # 归还可通过内部副本 ID 或者条码信息（barcode / barcode_number）来指定副本
    copy_id: int | None = None
    isbn: str | None = None
    barcode_number: int | None = None
    barcode: str | None = None  # 格式: ISBN/COPY_NUMBER


class RenewRequestCreate(BaseModel):
    borrow_record_id: int
    requested_due_date: datetime | None = None


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


class ReturnRequestResponse(BaseModel):
    record: "BorrowRecordPublic"
    overdue_fine_created: bool = False
    fine_amount: Decimal | None = None
    fine_message: str | None = None


class BorrowRecordPublic(BaseModel):
    id: int
    user_id: int
    book_id: int
    copy_id: int | None
    request_date: datetime
    approve_date: datetime | None
    due_date: datetime | None
    return_request_date: datetime | None
    actual_return_date: datetime | None
    status: BorrowStatus
    librarian_notes: str | None
    user: UserPublic | None = None
    book: BookPublic | None = None
    # 关联副本的完整信息（含 barcode_number，前端扫码比对要用它，
    # 而不是 BookCopy.id —— 两者维度完全不同）
    copy: BookCopyPublic | None = None
    model_config = ConfigDict(from_attributes=True)


ReturnRequestResponse.model_rebuild()
