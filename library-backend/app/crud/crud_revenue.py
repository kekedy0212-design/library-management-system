from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.deposit import (
    DepositTransaction,
    TransactionStatus,
    TransactionType,
)
from app.models.fine import FineTransaction, FineTransactionStatus


def _utc_today() -> date:
    return datetime.utcnow().date()


def get_daily_revenue(db: Session, target_date: date | None = None) -> dict:
    """Sum successful deposit payments and fine payments for one calendar day (UTC)."""
    day = target_date or _utc_today()
    day_str = day.isoformat()

    deposit_rows = (
        db.query(DepositTransaction)
        .filter(
            DepositTransaction.status == TransactionStatus.SUCCESS,
            DepositTransaction.biz_type == TransactionType.PAY,
            func.date(DepositTransaction.updated_at) == day_str,
        )
        .order_by(DepositTransaction.updated_at.desc())
        .all()
    )

    fine_rows = (
        db.query(FineTransaction)
        .filter(
            FineTransaction.status == FineTransactionStatus.SUCCESS,
            func.date(FineTransaction.updated_at) == day_str,
        )
        .order_by(FineTransaction.updated_at.desc())
        .all()
    )

    deposit_total = sum(
        (Decimal(str(row.amount)) for row in deposit_rows),
        Decimal("0"),
    )
    fine_total = sum(
        (Decimal(str(row.amount)) for row in fine_rows),
        Decimal("0"),
    )

    transactions = []
    for row in deposit_rows:
        transactions.append(
            {
                "type": "deposit",
                "out_trade_no": row.out_trade_no,
                "amount": Decimal(str(row.amount)),
                "paid_at": row.updated_at,
            }
        )
    for row in fine_rows:
        transactions.append(
            {
                "type": "fine",
                "out_trade_no": row.out_trade_no,
                "amount": Decimal(str(row.amount)),
                "paid_at": row.updated_at,
            }
        )

    transactions.sort(key=lambda item: item["paid_at"], reverse=True)

    return {
        "date": day,
        "deposit_total": deposit_total,
        "fine_total": fine_total,
        "total": deposit_total + fine_total,
        "deposit_count": len(deposit_rows),
        "fine_count": len(fine_rows),
        "transactions": transactions,
    }
