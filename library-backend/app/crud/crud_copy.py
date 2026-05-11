from sqlalchemy.orm import Session
from app.models.copy import BookCopy, CopyStatus
from app.models.book import Book
from app.schemas.copy import BookCopyCreate, BookCopyUpdate
import logging

logger = logging.getLogger(__name__)

def get_copy(db: Session, copy_id: int):
    """根据副本ID获取书籍副本"""
    result = db.query(BookCopy).filter(BookCopy.id == copy_id).first()
    if result:
        logger.debug(f"📔 [CRUD] 获取书籍副本: ID: {copy_id} | 书籍 ID: {result.book_id} | 副本号: {result.barcode_number}")
    return result

def get_copy_by_barcode(db: Session, isbn: str, barcode_number: int):
    """根据ISBN和副本号获取书籍副本"""
    from app.models.book import Book
    result = db.query(BookCopy).join(Book).filter(
        Book.isbn == isbn,
        BookCopy.barcode_number == barcode_number
    ).first()
    return result

def get_book_available_copy(db: Session, book_id: int):
    """获取某本书的一个可用副本"""
    result = db.query(BookCopy).filter(
        BookCopy.book_id == book_id,
        BookCopy.status == CopyStatus.AVAILABLE
    ).first()
    return result

def get_book_copies(db: Session, book_id: int):
    """获取某本书的所有副本"""
    results = db.query(BookCopy).filter(BookCopy.book_id == book_id).all()
    return results

def create_book_copies(db: Session, book_id: int, total_copies: int):
    """为书籍创建指定数量的副本"""
    for i in range(1, total_copies + 1):
        copy = BookCopy(
            book_id=book_id,
            barcode_number=i,
            status=CopyStatus.AVAILABLE
        )
        db.add(copy)
    db.commit()
    logger.info(f"✅ [CRUD] 为书籍创建副本 | 书籍 ID: {book_id} | 数量: {total_copies}")

def update_copy_status(db: Session, copy_id: int, status: CopyStatus):
    """更新副本状态"""
    copy = db.query(BookCopy).filter(BookCopy.id == copy_id).first()
    if copy:
        copy.status = status
        db.commit()
        db.refresh(copy)
        logger.debug(f"🔧 [CRUD] 更新副本状态: ID: {copy_id} | 新状态: {status.value}")
    return copy

def delete_book_copies(db: Session, book_id: int):
    """删除某本书的所有副本"""
    db.query(BookCopy).filter(BookCopy.book_id == book_id).delete()
    db.commit()
    logger.info(f"🗑️ [CRUD] 删除书籍副本 | 书籍 ID: {book_id}")
