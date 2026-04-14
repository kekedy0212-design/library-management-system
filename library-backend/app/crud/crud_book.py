from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.book import Book
from app.models.borrow import BorrowRecord, BorrowStatus
from app.schemas.book import BookCreate, BookUpdate

def get_book(db: Session, book_id: int):
    return db.query(Book).filter(Book.id == book_id).first()

def get_book_by_isbn(db: Session, isbn: str):
    return db.query(Book).filter(Book.isbn == isbn).first()

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
    return query.offset(skip).limit(limit).all()

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
    return db.query(BorrowRecord).filter(
        BorrowRecord.book_id == book_id,
        BorrowRecord.status.in_(borrowed_statuses)
    ).count()

def create_book(db: Session, book_in: BookCreate):
    """创建书籍时，自动将available_copies设置为total_copies"""
    db_book = Book(
        **book_in.model_dump(),
        available_copies=book_in.total_copies  # 自动设置为总数量
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book

def update_book(db: Session, db_book: Book, book_in: BookUpdate):
    """
    更新书籍信息。
    如果修改了total_copies，会自动计算available_copies = total_copies - 在借数量
    """
    update_data = book_in.model_dump(exclude_unset=True)
    
    # 如果要修改total_copies，需要计算在借数量并自动更新available_copies
    if "total_copies" in update_data:
        new_total = update_data["total_copies"]
        borrowed_count = get_borrowed_count(db, db_book.id)
        
        # 验证：新的total_copies不能小于当前在借的数量
        if new_total < borrowed_count:
            raise ValueError(
                f"Cannot reduce total_copies to {new_total}. "
                f"There are {borrowed_count} books currently borrowed. "
                f"New total_copies must be at least {borrowed_count}."
            )
        
        # 自动更新available_copies
        update_data["available_copies"] = new_total - borrowed_count
    
    for field, value in update_data.items():
        setattr(db_book, field, value)
    db.commit()
    db.refresh(db_book)
    return db_book

def delete_book(db: Session, book_id: int):
    book = db.query(Book).filter(Book.id == book_id).first()
    if book:
        db.delete(book)
        db.commit()
    return book