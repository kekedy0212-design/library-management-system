from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.borrow import (
    BorrowRequestCreate, ReturnRequestCreate,
    RequestProcess, BorrowRecordPublic
)
from app.crud import crud_borrow
from app.api.deps import get_current_active_user, get_current_librarian
from app.models.user import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/borrow-requests", response_model=BorrowRecordPublic)
def request_borrow(
    request_in: BorrowRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    record = crud_borrow.create_borrow_request(db, current_user.id, request_in)
    if not record:
        raise HTTPException(status_code=400, detail="Book not available or already requested")
    logger.info(f"User '{current_user.username}' requested to borrow book ID {record.book_id}")
    return record

@router.post("/return-requests", response_model=BorrowRecordPublic)
def request_return(
    request_in: ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    record = crud_borrow.create_return_request(db, current_user.id, request_in.borrow_record_id)
    if not record:
        raise HTTPException(status_code=400, detail="Invalid borrow record or book not borrowed")
    logger.info(f"User '{current_user.username}' requested to return book ID {record.book_id}")
    return record

@router.get("/requests/pending", response_model=List[BorrowRecordPublic])
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    records = crud_borrow.get_pending_requests(db)
    return records

@router.put("/requests/{request_id}/process", response_model=BorrowRecordPublic)
def process_request(
    request_id: int,
    process_in: RequestProcess,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    record = crud_borrow.get_borrow_record(db, request_id)
    if not record:
        raise HTTPException(status_code=404, detail="Request not found")

    # 记录操作前的状态
    old_status = record.status.value
    book_id = record.book_id
    borrower_username = record.user.username

    if record.status.value == "pending":
        record = crud_borrow.process_borrow_request(db, request_id, process_in)
        if record:
            action = "approved" if process_in.action == "approve" else "rejected"
            logger.warning(
                f"Librarian '{current_user.username}' {action} borrow request #{request_id} "
                f"by user '{borrower_username}' for book ID {book_id}"
            )
    elif record.status.value == "return_pending":
        record = crud_borrow.process_return_request(db, request_id, process_in)
        if record:
            action = "approved" if process_in.action == "approve" else "rejected"
            logger.warning(
                f"Librarian '{current_user.username}' {action} return request #{request_id} "
                f"by user '{borrower_username}' for book ID {book_id}"
            )
    else:
        raise HTTPException(status_code=400, detail="Request is not in pending state")

    if not record:
        raise HTTPException(status_code=400, detail="Processing failed")
    return record

@router.get("/users/me/borrow-history", response_model=List[BorrowRecordPublic])
def get_my_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    records = crud_borrow.get_user_borrow_history(db, current_user.id)
    return records