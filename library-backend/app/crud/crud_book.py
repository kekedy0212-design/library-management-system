from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.book import Book
from app.models.borrow import BorrowRecord, BorrowStatus
from app.schemas.book import BookCreate, BookUpdate
import logging

logger = logging.getLogger(__name__)

def get_book(db: Session, book_id: int):
    result = db.query(Book).filter(Book.id == book_id).first()
    if result:
        logger.debug(f"📖 [CRUD] 获取书籍: {result.title} (ID: {result.id})")
    return result

def get_book_by_isbn(db: Session, isbn: str):
    result = db.query(Book).filter(Book.isbn == isbn).first()
    if result:
        logger.debug(f"📖 [CRUD] 按ISBN查询书籍: {isbn} -> {result.title}")
    return result

def get_books(db: Session, skip: int = 0, limit: int = 100, search: str = None):
    query = db.query(Book)
    if search:
        query = query.filter(
            or_(
                Book.title.ilike(f"%{search}%"),
                Book.author.ilike(f"%{search}%"),
                Book.isbn.ilike(f"%{search}%")
            )
        )
    results = query.offset(skip).limit(limit).all()
    logger.debug(f"� [CRUD] 查询书籍列表: skip={skip}, limit={limit}, search='{search}' -> 返回 {len(results)} 条结果")
    return results

def get_borrowed_count(db: Session, book_id: int) -> int:
    """
    计算某本书当前被借出的数量。
    包括状态为 PENDING, APPROVED, OVERDUE, RETURN_PENDING 的记录。
    """
    borrowed_statuses = [
        BorrowStatus.PENDING,
        BorrowStatus.APPROVED,
        BorrowStatus.OVERDUE,
        BorrowStatus.RETURN_PENDING
    ]
    count = db.query(BorrowRecord).filter(
        BorrowRecord.book_id == book_id,
        BorrowRecord.status.in_(borrowed_statuses)
    ).count()
    logger.debug(f"📊 [CRUD] 书籍 ID {book_id} 当前在借数: {count}")
    return count

def get_active_borrowed_count(db: Session, book_id: int) -> int:
    """
    统计当前“实际借出中”的数量。
    不包含 PENDING（仅申请中）与已结束状态。
    """
    active_statuses = [
        BorrowStatus.APPROVED,
        BorrowStatus.OVERDUE,
        BorrowStatus.RETURN_PENDING
    ]
    return db.query(BorrowRecord).filter(
        BorrowRecord.book_id == book_id,
        BorrowRecord.status.in_(active_statuses)
    ).count()

def create_book(db: Session, book_in: BookCreate):
    """创建书籍时，自动将available_copies设置为total_copies，并创建对应的BookCopy副本"""
    from app.crud import crud_copy
    
    db_book = Book(
        **book_in.model_dump(),
        available_copies=book_in.total_copies  # 自动设置为总数量
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    
    # 自动创建BookCopy副本
    crud_copy.create_book_copies(db, db_book.id, book_in.total_copies)
    
    logger.info(f"🔧 [CRUD] 创建新书籍 | 书名: {db_book.title} | ISBN: {db_book.isbn} | 总数: {db_book.total_copies} | ID: {db_book.id} | 已创建副本数: {book_in.total_copies}")
    return db_book

def update_book(db: Session, db_book: Book, book_in: BookUpdate):
    """
    更新书籍信息。
    如果修改了total_copies，会自动计算available_copies = total_copies - 在借数量
    """
    old_title = db_book.title
    old_total = db_book.total_copies
    old_available = db_book.available_copies
    
    update_data = book_in.model_dump(exclude_unset=True)
    
    # 如果要修改total_copies，需要计算在借数量并自动更新available_copies
    if "total_copies" in update_data:
        from app.crud import crud_copy
        from app.models.copy import BookCopy

        new_total = update_data["total_copies"]
        borrowed_count = get_borrowed_count(db, db_book.id)

        # 验证：新的total_copies不能小于当前在借的数量
        if new_total < borrowed_count:
            logger.error(f"❌ [CRUD] 修改total_copies失败 | 书籍 ID: {db_book.id} | 新值 {new_total} < 在借数 {borrowed_count}")
            raise ValueError(
                f"Cannot reduce total_copies to {new_total}. "
                f"There are {borrowed_count} books currently borrowed. "
                f"New total_copies must be at least {borrowed_count}."
            )

        # 自动更新available_copies
        update_data["available_copies"] = new_total - borrowed_count

        # 同步 BookCopy 副本数：缺多少补多少（barcode_number 续编号）
        existing_copy_count = (
            db.query(BookCopy).filter(BookCopy.book_id == db_book.id).count()
        )
        if new_total > existing_copy_count:
            from app.models.copy import CopyStatus
            max_barcode = (
                db.query(BookCopy)
                .filter(BookCopy.book_id == db_book.id)
                .order_by(BookCopy.barcode_number.desc())
                .first()
            )
            next_number = (max_barcode.barcode_number + 1) if max_barcode else 1
            to_create = new_total - existing_copy_count
            for offset in range(to_create):
                db.add(
                    BookCopy(
                        book_id=db_book.id,
                        barcode_number=next_number + offset,
                        status=CopyStatus.AVAILABLE,
                    )
                )
            logger.info(
                f"📦 [CRUD] 自动补齐副本 | 书籍 ID: {db_book.id} "
                f"| 已有: {existing_copy_count} | 补齐: {to_create}"
            )
    
    for field, value in update_data.items():
        setattr(db_book, field, value)

    auto_assigned_count = 0
    if db_book.available_copies > old_available:
        from app.crud import crud_borrow
        auto_assigned_records = crud_borrow.assign_reservations_if_available(
            db,
            db_book,
            reason="AUTO_ASSIGNED_AFTER_STOCK_UPDATE"
        )
        auto_assigned_count = len(auto_assigned_records)

    db.commit()
    db.refresh(db_book)
    
    # 记录修改内容
    changes = []
    if "title" in update_data:
        changes.append(f"书名: {old_title} → {db_book.title}")
    if "total_copies" in update_data:
        changes.append(f"总数: {old_total} → {db_book.total_copies}")
        changes.append(f"可用数: {old_available} → {db_book.available_copies}")
    if auto_assigned_count > 0:
        changes.append(f"自动分配预约: {auto_assigned_count} 条")
    
    if changes:
        logger.info(f"✅ [CRUD] 更新书籍成功 | 书籍 ID: {db_book.id} | 修改项: {' | '.join(changes)}")
    
    return db_book

def delete_book(db: Session, book_id: int):
    from app.crud import crud_copy
    
    book = db.query(Book).filter(Book.id == book_id).first()
    if book:
        active_borrowed_count = get_active_borrowed_count(db, book_id)
        if active_borrowed_count > 0:
            logger.warning(
                f"❌ [CRUD] 删除书籍失败 | 书籍 ID: {book_id} | 仍在借数量: {active_borrowed_count}"
            )
            raise ValueError("Cannot delete book while it is actively borrowed")

        logger.info(f"🗑️ [CRUD] 删除书籍 | 书名: {book.title} | ISBN: {book.isbn} | ID: {book_id}")
        
        # 删除所有BookCopy副本
        crud_copy.delete_book_copies(db, book_id)
        
        db.delete(book)
        db.commit()
        logger.info(f"✅ [CRUD] 书籍删除成功 | ID: {book_id}")
    else:
        logger.warning(f"⚠️ [CRUD] 尝试删除不存在的书籍 | ID: {book_id}")
    return book