from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class CopyStatus(str, enum.Enum):
    AVAILABLE = "available"      # 可借
    BORROWED = "borrowed"        # 已借出
    DAMAGED = "damaged"          # 损坏
    LOST = "lost"               # 丢失
    MAINTENANCE = "maintenance" # 维护中

class BookCopy(Base):
    __tablename__ = "book_copies"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False, index=True)
    barcode_number = Column(Integer, nullable=False)  # 副本号：1, 2, 3...
    status = Column(Enum(CopyStatus), default=CopyStatus.AVAILABLE, nullable=False)
    location = Column(String, nullable=True)  # 具体位置信息
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    book = relationship("Book", backref="copies")
    
    # 联合唯一约束：同一本书的副本号不重复
    __table_args__ = (
        UniqueConstraint("book_id", "barcode_number", name="uq_book_barcode_number"),
    )
