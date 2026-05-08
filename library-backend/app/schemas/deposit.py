from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.models.deposit import DepositStatus, TransactionStatus


class DepositPublic(BaseModel):
    id: int
    user_id: int
    amount: Decimal
    status: DepositStatus
    paid_at: datetime | None = None
    refunded_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class DepositOrderCreateResponse(BaseModel):
    out_trade_no: str
    pay_url: str
    amount: Decimal
    status: str

class DepositConfirmRequest(BaseModel):
    out_trade_no: str

class DepositConfirmResponse(BaseModel):
    success: bool
    trade_status: str | None = None
    msg: str


class AlipayNotifyResponse(BaseModel):
    msg: str


class DepositTransactionPublic(BaseModel):
    id: int
    out_trade_no: str
    trade_no: str | None = None
    status: TransactionStatus
    amount: Decimal
    channel: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
