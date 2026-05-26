from datetime import datetime
from decimal import Decimal
import json
import logging
from sqlalchemy.orm import Session
from app.models.fine import Fine, FineStatus, FineTransaction, FineTransactionStatus
from app.models.borrow import BorrowRecord

logger = logging.getLogger(__name__)


def user_has_unpaid_fines(db: Session, user_id: int) -> bool:
    return (
        db.query(Fine)
        .filter(Fine.user_id == user_id, Fine.status == FineStatus.UNPAID)
        .first()
        is not None
    )


def reset_stale_pending_fines(db: Session, user_id: int) -> int:
    """支付中断后把卡在 PENDING 的罚款恢复为可再次支付。"""
    pending = (
        db.query(Fine)
        .filter(Fine.user_id == user_id, Fine.status == FineStatus.PENDING)
        .all()
    )
    for fine in pending:
        fine.status = FineStatus.UNPAID
        fine.out_trade_no = None
        db.add(fine)
    if pending:
        db.commit()
    return len(pending)


def get_unpaid_fines(db: Session, user_id: int) -> list[Fine]:
    return (
        db.query(Fine)
        .filter(Fine.user_id == user_id, Fine.status == FineStatus.UNPAID)
        .order_by(Fine.created_at.desc())
        .all()
    )


def get_user_fines(db: Session, user_id: int) -> list[Fine]:
    return (
        db.query(Fine)
        .filter(Fine.user_id == user_id)
        .order_by(Fine.created_at.desc())
        .all()
    )


def get_fine_by_borrow_record(db: Session, borrow_record_id: int) -> Fine | None:
    return (
        db.query(Fine)
        .filter(Fine.borrow_record_id == borrow_record_id)
        .first()
    )


def create_overdue_fine(
    db: Session,
    user_id: int,
    borrow_record: BorrowRecord,
    amount: Decimal,
    return_at: datetime,
) -> Fine | None:
    """逾期还书时创建罚款（每笔借阅仅一条，幂等）。"""
    existing = get_fine_by_borrow_record(db, borrow_record.id)
    if existing:
        return existing

    due = borrow_record.due_date
    if not due:
        return None

    due_naive = due.replace(tzinfo=None) if getattr(due, "tzinfo", None) else due
    ret_naive = (
        return_at.replace(tzinfo=None)
        if getattr(return_at, "tzinfo", None)
        else return_at
    )
    if ret_naive <= due_naive:
        return None

    book_title = borrow_record.book.title if borrow_record.book else "Unknown"
    fine = Fine(
        user_id=user_id,
        borrow_record_id=borrow_record.id,
        amount=amount,
        status=FineStatus.UNPAID,
        reason=f"Overdue return: {book_title} (due {due_naive.date()})",
    )
    db.add(fine)
    db.flush()
    logger.info(
        f"💸 [CRUD] 逾期罚款已生成 | 用户 ID: {user_id} | 借阅记录 ID: {borrow_record.id} | "
        f"金额: {amount}"
    )
    return fine


def fine_to_public(fine: Fine) -> dict:
    book_title = None
    if fine.borrow_record and fine.borrow_record.book:
        book_title = fine.borrow_record.book.title
    return {
        "id": fine.id,
        "user_id": fine.user_id,
        "borrow_record_id": fine.borrow_record_id,
        "amount": fine.amount,
        "status": fine.status,
        "reason": fine.reason,
        "created_at": fine.created_at,
        "paid_at": fine.paid_at,
        "book_title": book_title,
    }


def prepare_unpaid_fines_payment(
    db: Session, user_id: int, out_trade_no: str
) -> tuple[FineTransaction, list[Fine], Decimal]:
    fines = get_unpaid_fines(db, user_id)
    if not fines:
        raise ValueError("No unpaid fines")

    total = sum(Decimal(str(f.amount)) for f in fines)
    for fine in fines:
        fine.status = FineStatus.PENDING
        fine.out_trade_no = out_trade_no
        db.add(fine)

    tx = FineTransaction(
        user_id=user_id,
        out_trade_no=out_trade_no,
        amount=total,
        status=FineTransactionStatus.CREATED,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    for fine in fines:
        db.refresh(fine)
    return tx, fines, total


def get_transaction_by_out_trade_no(
    db: Session, out_trade_no: str
) -> FineTransaction | None:
    return (
        db.query(FineTransaction)
        .filter(FineTransaction.out_trade_no == out_trade_no)
        .first()
    )


def mark_fine_payment_success(
    db: Session,
    tx: FineTransaction,
    trade_no: str | None,
    notify_payload: str,
):
    if tx.status == FineTransactionStatus.SUCCESS:
        return tx

    tx.status = FineTransactionStatus.SUCCESS
    tx.trade_no = trade_no
    tx.raw_notify = notify_payload
    tx.updated_at = datetime.utcnow()

    fines = (
        db.query(Fine)
        .filter(
            Fine.out_trade_no == tx.out_trade_no,
            Fine.user_id == tx.user_id,
        )
        .all()
    )
    now = datetime.utcnow()
    for fine in fines:
        if fine.status != FineStatus.PAID:
            fine.status = FineStatus.PAID
            fine.paid_at = now
            db.add(fine)

    db.add(tx)
    db.commit()
    db.refresh(tx)
    logger.info(
        f"✅ [CRUD] 罚款支付成功 | out_trade_no: {tx.out_trade_no} | 笔数: {len(fines)}"
    )
    return tx


def mark_fine_payment_failed(
    db: Session, tx: FineTransaction, notify_payload: str
):
    tx.status = FineTransactionStatus.FAILED
    tx.raw_notify = notify_payload
    tx.updated_at = datetime.utcnow()

    fines = (
        db.query(Fine)
        .filter(
            Fine.out_trade_no == tx.out_trade_no,
            Fine.user_id == tx.user_id,
        )
        .all()
    )
    for fine in fines:
        if fine.status == FineStatus.PENDING:
            fine.status = FineStatus.UNPAID
            fine.out_trade_no = None
            db.add(fine)

    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx
