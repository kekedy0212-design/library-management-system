from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.book import Book
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

def create_book(db: Session, book_in: BookCreate):
    available = book_in.available_copies if book_in.available_copies is not None else book_in.total_copies
    db_book = Book(
        **book_in.model_dump(exclude={"available_copies"}),
        available_copies=available
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book

def update_book(db: Session, db_book: Book, book_in: BookUpdate):
    update_data = book_in.model_dump(exclude_unset=True)
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