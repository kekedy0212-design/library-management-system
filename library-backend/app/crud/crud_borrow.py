from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.models.borrow import BorrowRecord, BorrowStatus
from app.models.book import Book
from app.schemas.borrow import BorrowRequestCreate, RequestProcess
import logging

logger = logging.getLogger(__name__)

def get_borrow_record(db: Session, record_id: int):
    result = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if result:
        logger.debug(f"📚 [CRUD] 获取借记录: ID: {record_id} | 状态: {result.status.value}")
    return result

def get_pending_requests(db: Session):
    results = db.query(BorrowRecord).filter(
        BorrowRecord.status.in_([BorrowStatus.PENDING, BorrowStatus.RETURN_PENDING])
    ).all()
    logger.debug(f"📋 [CRUD] 查询待处理请求 | 待处理数: {len(results)}")
    return results

def get_user_borrow_history(db: Session, user_id: int):
    results = db.query(BorrowRecord).filter(BorrowRecord.user_id == user_id).all()
    logger.debug(f"📚 [CRUD] 查询用户借书历史 | 用户 ID: {user_id} | 记录数: {len(results)}")
    return results

def create_borrow_request(db: Session, user_id: int, request_in: BorrowRequestCreate):
    """创建借书请求"""
    logger.debug(f"📤 [CRUD] 开始创建借书请求 | 用户 ID: {user_id} | 书籍 ID: {request_in.book_id}")
    
    # 检查书籍是否可借
    book = db.query(Book).filter(Book.id == request_in.book_id).first()
    if not book:
        logger.warning(f"⚠️ [CRUD] 借书请求失败: 书籍不存在 | 书籍 ID: {request_in.book_id}")
        return None
    
    if book.available_copies <= 0:
        logger.warning(f"⚠️ [CRUD] 借书请求失败: 书籍无可用副本 | 书籍: {book.title} | 可用数: {book.available_copies}")
        return None

    # 检查用户是否已有未归还的相同书籍
    existing = db.query(BorrowRecord).filter(
        BorrowRecord.user_id == user_id,
        BorrowRecord.book_id == request_in.book_id,
        BorrowRecord.status.in_([BorrowStatus.APPROVED, BorrowStatus.PENDING, BorrowStatus.RETURN_PENDING])
    ).first()
    if existing:
        logger.warning(f"⚠️ [CRUD] 借书请求失败: 用户已有该书籍的未归还记录 | 用户 ID: {user_id} | 书籍: {book.title}")
        return None

    db_record = BorrowRecord(
        user_id=user_id,
        book_id=request_in.book_id,
        status=BorrowStatus.PENDING,
        request_date=datetime.utcnow()
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    logger.info(f"✅ [CRUD] 借书请求已创建 | 记录 ID: {db_record.id} | 用户 ID: {user_id} | 书籍: {book.title}")
    return db_record

def create_return_request(db: Session, user_id: int, record_id: int):
    """创建还书请求"""
    logger.debug(f"📥 [CRUD] 开始创建还书请求 | 用户 ID: {user_id} | 记录 ID: {record_id}")
    
    record = db.query(BorrowRecord).filter(
        BorrowRecord.id == record_id,
        BorrowRecord.user_id == user_id,
        BorrowRecord.status == BorrowStatus.APPROVED
    ).first()
    if not record:
        logger.warning(f"⚠️ [CRUD] 还书请求失败: 记录不存在或状态不是APPROVED | 记录 ID: {record_id}")
        return None
    
    record.return_request_date = datetime.utcnow()
    record.status = BorrowStatus.RETURN_PENDING
    db.commit()
    db.refresh(record)
    logger.info(f"✅ [CRUD] 还书请求已创建 | 记录 ID: {record_id} | 用户 ID: {user_id}")
    return record

def process_borrow_request(db: Session, record_id: int, process_in: RequestProcess):
    """处理借书请求（批准或拒绝）"""
    logger.info(f"⚙️ [CRUD] 开始处理借书请求 | 记录 ID: {record_id} | 操作: {process_in.action}")
    
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record or record.status != BorrowStatus.PENDING:
        logger.warning(f"⚠️ [CRUD] 处理借书请求失败: 记录状态不是PENDING | 记录 ID: {record_id}")
        return None

    try:
        if process_in.action == "approve":
            # 加行锁防止并发超借
            book = db.query(Book).filter(Book.id == record.book_id).with_for_update().first()
            if book.available_copies <= 0:
                record.status = BorrowStatus.REJECTED
                record.librarian_notes = "库存不足"
                db.add(record)
                db.commit()
                logger.warning(f"❌ [CRUD] 借书请求被拒: 库存不足 | 书籍: {book.title} | 可用数: {book.available_copies}")
                return record

            book.available_copies -= 1
            record.status = BorrowStatus.APPROVED
            record.approve_date = datetime.utcnow()
            record.due_date = datetime.utcnow() + timedelta(days=14)
            record.librarian_notes = process_in.notes
            db.add(book)
            db.add(record)
            db.commit()
            logger.info(f"✅ [CRUD] 借书请求已批准 | 记录 ID: {record_id} | 书籍: {book.title} | 归还期限: 14天 | 剩余库存: {book.available_copies}")
        elif process_in.action == "reject":
            record.status = BorrowStatus.REJECTED
            record.librarian_notes = process_in.notes
            db.add(record)
            db.commit()
            logger.info(f"✅ [CRUD] 借书请求已拒绝 | 记录 ID: {record_id} | 备注: {process_in.notes}")
        else:
            logger.error(f"❌ [CRUD] 处理借书请求失败: 无效的操作 | 操作: {process_in.action}")
            return None
    except Exception as e:
        logger.error(f"❌ [CRUD] 处理借书请求异常 | 记录 ID: {record_id} | 错误: {str(e)}")
        db.rollback()
        raise

    db.refresh(record)
    return record

def process_return_request(db: Session, record_id: int, process_in: RequestProcess):
    """处理还书请求（批准或拒绝）"""
    logger.info(f"⚙️ [CRUD] 开始处理还书请求 | 记录 ID: {record_id} | 操作: {process_in.action}")
    
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record or record.status != BorrowStatus.RETURN_PENDING:
        logger.warning(f"⚠️ [CRUD] 处理还书请求失败: 记录状态不是RETURN_PENDING | 记录 ID: {record_id}")
        return None

    try:
        if process_in.action == "approve":
            book = db.query(Book).filter(Book.id == record.book_id).with_for_update().first()
            book.available_copies += 1
            record.status = BorrowStatus.RETURNED
            record.actual_return_date = datetime.utcnow()
            record.librarian_notes = process_in.notes
            db.add(book)
            db.add(record)
            db.commit()
            logger.info(f"✅ [CRUD] 还书请求已批准 | 记录 ID: {record_id} | 书籍: {book.title} | 库存已增加 | 当前库存: {book.available_copies}")
        elif process_in.action == "reject":
            record.status = BorrowStatus.APPROVED
            record.return_request_date = None
            record.librarian_notes = process_in.notes
            db.add(record)
            db.commit()
            logger.info(f"✅ [CRUD] 还书请求已拒绝 | 记录 ID: {record_id} | 用户需重新提交还书请求")
        else:
            logger.error(f"❌ [CRUD] 处理还书请求失败: 无效的操作 | 操作: {process_in.action}")
            return None
    except Exception as e:
        logger.error(f"❌ [CRUD] 处理还书请求异常 | 记录 ID: {record_id} | 错误: {str(e)}")
        db.rollback()
        raise

    db.refresh(record)
    return record