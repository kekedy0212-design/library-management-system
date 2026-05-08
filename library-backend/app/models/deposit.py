import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Numeric, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class DepositStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PENDING = "pending"
    PAID = "paid"
    REFUND_PENDING = "refund_pending"
    REFUNDED = "refunded"
    FAILED = "failed"


class TransactionType(str, enum.Enum):
    PAY = "pay"
    REFUND = "refund"


class TransactionStatus(str, enum.Enum):
    CREATED = "created"
    SUCCESS = "success"
    FAILED = "failed"


class Deposit(Base):
    __tablename__ = "deposits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False, default=99.00)
    status = Column(Enum(DepositStatus), nullable=False, default=DepositStatus.UNPAID)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")


class DepositTransaction(Base):
    __tablename__ = "deposit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    deposit_id = Column(Integer, ForeignKey("deposits.id"), nullable=False, index=True)
    biz_type = Column(Enum(TransactionType), nullable=False)
    out_trade_no = Column(String, unique=True, index=True, nullable=False)
    trade_no = Column(String, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    channel = Column(String, nullable=False, default="alipay")
    status = Column(Enum(TransactionStatus), nullable=False, default=TransactionStatus.CREATED)
    raw_notify = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    deposit = relationship("Deposit")
