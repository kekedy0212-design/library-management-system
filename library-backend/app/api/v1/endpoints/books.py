from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.book import BookCreate, BookUpdate, BookPublic
from app.crud import crud_book
from app.api.deps import get_current_librarian
from app.models.user import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/", response_model=List[BookPublic])
def search_books(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100
):
    books = crud_book.get_books(db, skip=skip, limit=limit, search=q)
    return books

@router.get("/{book_id}", response_model=BookPublic)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = crud_book.get_book(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@router.post("/", response_model=BookPublic)
def create_book(
    book_in: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    existing = crud_book.get_book_by_isbn(db, book_in.isbn)
    if existing:
        raise HTTPException(status_code=400, detail="ISBN already exists")
    book = crud_book.create_book(db, book_in)
    logger.info(f"Librarian '{current_user.username}' added book '{book.title}' (ISBN: {book.isbn})")
    return book

@router.put("/{book_id}", response_model=BookPublic)
def update_book(
    book_id: int,
    book_in: BookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    book = crud_book.get_book(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    try:
        book = crud_book.update_book(db, book, book_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    logger.info(f"Librarian '{current_user.username}' updated book '{book.title}'")
    return book

@router.delete("/{book_id}")
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    book = crud_book.delete_book(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    logger.info(f"Librarian '{current_user.username}' deleted book '{book.title}' (ID: {book_id})")
    return {"msg": "Book deleted successfully"}