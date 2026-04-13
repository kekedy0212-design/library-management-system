from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.models.borrow import BorrowRecord, BorrowStatus
from app.models.book import Book
from app.schemas.borrow import BorrowRequestCreate, RequestProcess

def get_borrow_record(db: Session, record_id: int):
    return db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()

def get_pending_requests(db: Session):
    return db.query(BorrowRecord).filter(
        BorrowRecord.status.in_([BorrowStatus.PENDING, BorrowStatus.RETURN_PENDING])
    ).all()

def get_user_borrow_history(db: Session, user_id: int):
    return db.query(BorrowRecord).filter(BorrowRecord.user_id == user_id).all()

def create_borrow_request(db: Session, user_id: int, request_in: BorrowRequestCreate):
    # 检查书籍是否可借
    book = db.query(Book).filter(Book.id == request_in.book_id).first()
    if not book or book.available_copies <= 0:
        return None

    # 检查用户是否已有未归还的相同书籍
    existing = db.query(BorrowRecord).filter(
        BorrowRecord.user_id == user_id,
        BorrowRecord.book_id == request_in.book_id,
        BorrowRecord.status.in_([BorrowStatus.APPROVED, BorrowStatus.PENDING, BorrowStatus.RETURN_PENDING])
    ).first()
    if existing:
        return None

    db_record = BorrowRecord(
        user_id=user_id,
        book_id=request_in.book_id,
        status=BorrowStatus.PENDING
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

def create_return_request(db: Session, user_id: int, record_id: int):
    record = db.query(BorrowRecord).filter(
        BorrowRecord.id == record_id,
        BorrowRecord.user_id == user_id,
        BorrowRecord.status == BorrowStatus.APPROVED
    ).first()
    if not record:
        return None
    record.return_request_date = datetime.utcnow()
    record.status = BorrowStatus.RETURN_PENDING
    db.commit()
    db.refresh(record)
    return record

def process_borrow_request(db: Session, record_id: int, process_in: RequestProcess):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record or record.status != BorrowStatus.PENDING:
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
                return record

            book.available_copies -= 1
            record.status = BorrowStatus.APPROVED
            record.approve_date = datetime.utcnow()
            record.due_date = datetime.utcnow() + timedelta(days=14)
            record.librarian_notes = process_in.notes
            db.add(book)
            db.add(record)
            db.commit()
        elif process_in.action == "reject":
            record.status = BorrowStatus.REJECTED
            record.librarian_notes = process_in.notes
            db.add(record)
            db.commit()
        else:
            return None
    except Exception:
        db.rollback()
        raise

    db.refresh(record)
    return record

def process_return_request(db: Session, record_id: int, process_in: RequestProcess):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record or record.status != BorrowStatus.RETURN_PENDING:
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
        elif process_in.action == "reject":
            record.status = BorrowStatus.APPROVED
            record.return_request_date = None
            record.librarian_notes = process_in.notes
            db.add(record)
            db.commit()
        else:
            return None
    except Exception:
        db.rollback()
        raise

    db.refresh(record)
    return record