import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Numeric, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class FineStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PENDING = "pending"
    PAID = "paid"


class FineTransactionStatus(str, enum.Enum):
    CREATED = "created"
    SUCCESS = "success"
    FAILED = "failed"


class Fine(Base):
    """逾期还书罚款（每笔借阅记录最多一条）。"""

    __tablename__ = "fines"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    borrow_record_id = Column(
        Integer, ForeignKey("borrow_records.id"), nullable=False, unique=True, index=True
    )
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(FineStatus), nullable=False, default=FineStatus.UNPAID)
    out_trade_no = Column(String, nullable=True, index=True)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    borrow_record = relationship("BorrowRecord")


class FineTransaction(Base):
    __tablename__ = "fine_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    out_trade_no = Column(String, unique=True, index=True, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(
        Enum(FineTransactionStatus),
        nullable=False,
        default=FineTransactionStatus.CREATED,
    )
    trade_no = Column(String, nullable=True)
    raw_notify = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
