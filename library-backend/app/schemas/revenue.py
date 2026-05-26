from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class RevenueTransactionItem(BaseModel):
    type: Literal["deposit", "fine"]
    out_trade_no: str
    amount: Decimal
    paid_at: datetime


class DailyRevenueResponse(BaseModel):
    date: date
    deposit_total: Decimal = Field(description="Successful deposit payments on this day")
    fine_total: Decimal = Field(description="Successful fine payments on this day")
    total: Decimal
    deposit_count: int
    fine_count: int
    transactions: list[RevenueTransactionItem] = []
