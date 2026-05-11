from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class BorrowStatus(str, enum.Enum):
    PENDING = "pending"              # 等待审批
    APPROVED = "approved"            # 已借出
    REJECTED = "rejected"            # 已拒绝
    RETURN_PENDING = "return_pending" # 等待还书审批
    RETURNED = "returned"            # 已归还
    OVERDUE = "overdue"              # 逾期

class BorrowRecord(Base):
    __tablename__ = "borrow_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    copy_id = Column(Integer, ForeignKey("book_copies.id"), nullable=True)  # 预约时可为空
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)  # 冗余存储，便于查询
    request_date = Column(DateTime(timezone=True), server_default=func.now())
    approve_date = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    return_request_date = Column(DateTime(timezone=True), nullable=True)
    actual_return_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(BorrowStatus), default=BorrowStatus.PENDING, nullable=False)
    librarian_notes = Column(String, nullable=True)

    user = relationship("User")
    book = relationship("Book")
    # 使用字符串+select加载以避免循环导入和N+1查询问题
    copy = relationship("BookCopy", lazy="select")