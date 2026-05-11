from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.deposit import (
    Deposit,
    DepositStatus,
    DepositTransaction,
    TransactionStatus,
    TransactionType,
)


def get_user_deposit(db: Session, user_id: int) -> Deposit | None:
    return db.query(Deposit).filter(Deposit.user_id == user_id).first()


def get_or_create_user_deposit(db: Session, user_id: int, amount: Decimal) -> Deposit:
    deposit = get_user_deposit(db, user_id)
    if deposit:
        # Keep already-paid deposits as historical records.
        # For unpaid deposits, sync with current configured amount.
        if deposit.status == DepositStatus.UNPAID and Decimal(str(deposit.amount)) != amount:
            deposit.amount = amount
            db.add(deposit)
            db.commit()
            db.refresh(deposit)
        return deposit

    deposit = Deposit(user_id=user_id, amount=amount, status=DepositStatus.UNPAID)
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


def set_deposit_pending(db: Session, deposit: Deposit):
    deposit.status = DepositStatus.PENDING
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


def has_paid_deposit(db: Session, user_id: int) -> bool:
    deposit = get_user_deposit(db, user_id)
    return bool(deposit and deposit.status == DepositStatus.PAID)


def create_payment_transaction(
    db: Session,
    deposit_id: int,
    out_trade_no: str,
    amount: Decimal,
) -> DepositTransaction:
    tx = DepositTransaction(
        deposit_id=deposit_id,
        biz_type=TransactionType.PAY,
        out_trade_no=out_trade_no,
        amount=amount,
        channel="alipay",
        status=TransactionStatus.CREATED,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def get_transaction_by_out_trade_no(db: Session, out_trade_no: str) -> DepositTransaction | None:
    return db.query(DepositTransaction).filter(DepositTransaction.out_trade_no == out_trade_no).first()


def mark_payment_success(
    db: Session,
    tx: DepositTransaction,
    trade_no: str | None,
    notify_payload: str,
):
    if tx.status == TransactionStatus.SUCCESS:
        return tx

    tx.status = TransactionStatus.SUCCESS
    tx.trade_no = trade_no
    tx.raw_notify = notify_payload
    tx.updated_at = datetime.utcnow()

    deposit = db.query(Deposit).filter(Deposit.id == tx.deposit_id).first()
    if deposit and deposit.status != DepositStatus.PAID:
        deposit.status = DepositStatus.PAID
        deposit.paid_at = datetime.utcnow()
        db.add(deposit)

    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def mark_payment_failed(db: Session, tx: DepositTransaction, notify_payload: str):
    tx.status = TransactionStatus.FAILED
    tx.raw_notify = notify_payload
    tx.updated_at = datetime.utcnow()
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def create_refund_transaction(
    db: Session,
    deposit_id: int,
    out_trade_no: str,
    amount: Decimal,
) -> DepositTransaction:
    tx = DepositTransaction(
        deposit_id=deposit_id,
        biz_type=TransactionType.REFUND,
        out_trade_no=out_trade_no,
        amount=amount,
        channel="alipay",
        status=TransactionStatus.CREATED,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def set_deposit_refund_pending(db: Session, deposit: Deposit):
    deposit.status = DepositStatus.REFUND_PENDING
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


def mark_refund_success(
    db: Session,
    tx: DepositTransaction,
    trade_no: str | None,
    notify_payload: str,
):
    if tx.status == TransactionStatus.SUCCESS:
        return tx

    tx.status = TransactionStatus.SUCCESS
    tx.trade_no = trade_no
    tx.raw_notify = notify_payload
    tx.updated_at = datetime.utcnow()

    deposit = db.query(Deposit).filter(Deposit.id == tx.deposit_id).first()
    if deposit and deposit.status != DepositStatus.REFUNDED:
        deposit.status = DepositStatus.REFUNDED
        deposit.refunded_at = datetime.utcnow()
        db.add(deposit)

    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def mark_refund_failed(db: Session, tx: DepositTransaction, notify_payload: str):
    tx.status = TransactionStatus.FAILED
    tx.raw_notify = notify_payload
    tx.updated_at = datetime.utcnow()
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx
