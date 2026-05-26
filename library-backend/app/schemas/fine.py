from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.models.fine import FineStatus
from app.schemas.book import BookPublic


class FinePublic(BaseModel):
    id: int
    user_id: int
    borrow_record_id: int
    amount: Decimal
    status: FineStatus
    reason: str | None
    created_at: datetime
    paid_at: datetime | None
    book_title: str | None = None

    model_config = ConfigDict(from_attributes=True)


class FineSummary(BaseModel):
    unpaid_count: int
    unpaid_total: Decimal
    has_unpaid: bool
    fines: list[FinePublic]


class FineOrderCreateResponse(BaseModel):
    out_trade_no: str
    pay_url: str
    amount: Decimal
    fine_count: int
    status: str


class FineConfirmRequest(BaseModel):
    out_trade_no: str


class FineConfirmResponse(BaseModel):
    success: bool
    trade_status: str | None = None
    msg: str
