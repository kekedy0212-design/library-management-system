from decimal import Decimal
from uuid import uuid4
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.config import settings
from app.core.alipay import get_alipay_client
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.borrow import BorrowRecord
from app.models.fine import FineStatus
from app.schemas.fine import (
    FineSummary,
    FineOrderCreateResponse,
    FineConfirmRequest,
    FineConfirmResponse,
)
from app.crud import crud_fine

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/fines/me", response_model=FineSummary)
def get_my_fines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.models.fine import Fine

    fines = (
        db.query(Fine)
        .options(joinedload(Fine.borrow_record).joinedload(BorrowRecord.book))
        .filter(Fine.user_id == current_user.id)
        .order_by(Fine.created_at.desc())
        .all()
    )
    unpaid = [f for f in fines if f.status == FineStatus.UNPAID]
    unpaid_total = sum(Decimal(str(f.amount)) for f in unpaid)

    return {
        "unpaid_count": len(unpaid),
        "unpaid_total": unpaid_total,
        "has_unpaid": len(unpaid) > 0,
        "fines": [crud_fine.fine_to_public(f) for f in fines],
    }


@router.post("/fines/create-order", response_model=FineOrderCreateResponse)
def create_fines_payment_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """合并支付当前用户所有未缴逾期罚款。"""
    crud_fine.reset_stale_pending_fines(db, current_user.id)
    unpaid = crud_fine.get_unpaid_fines(db, current_user.id)
    if not unpaid:
        raise HTTPException(status_code=400, detail="No unpaid fines")

    try:
        alipay = get_alipay_client()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Payment service not configured: {exc}",
        ) from exc

    out_trade_no = f"fine_{current_user.id}_{uuid4().hex[:12]}"
    total = sum(Decimal(str(f.amount)) for f in unpaid)
    total_amount = str(total)

    try:
        order_string = alipay.api_alipay_trade_page_pay(
            out_trade_no=out_trade_no,
            total_amount=total_amount,
            subject=f"Library Overdue Fines - {current_user.username}",
            return_url=settings.ALIPAY_FINE_RETURN_URL,
            notify_url=settings.ALIPAY_NOTIFY_URL,
            product_code="FAST_INSTANT_TRADE_PAY",
        )
    except Exception as exc:
        logger.exception("Alipay fine order failed")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to create payment order: {exc}",
        ) from exc

    pay_url = f"{settings.ALIPAY_GATEWAY}?{order_string}"
    tx, fines, amount = crud_fine.prepare_unpaid_fines_payment(
        db, current_user.id, out_trade_no
    )

    logger.info(
        f"💸 [罚款订单] 用户 '{current_user.username}' | 订单号: {out_trade_no} | "
        f"笔数: {len(fines)} | 金额: {amount}"
    )
    return {
        "out_trade_no": out_trade_no,
        "pay_url": pay_url,
        "amount": amount,
        "fine_count": len(fines),
        "status": "created",
    }


@router.post("/fines/confirm", response_model=FineConfirmResponse)
def confirm_fine_payment(
    confirm_in: FineConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    tx = crud_fine.get_transaction_by_out_trade_no(db, confirm_in.out_trade_no)
    if not tx or tx.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Transaction not found")

    try:
        alipay = get_alipay_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    result = alipay.api_alipay_trade_query(out_trade_no=confirm_in.out_trade_no)
    trade_status = result.get("trade_status")
    trade_no = result.get("trade_no")
    total_amount = result.get("total_amount")

    if str(tx.amount) != str(total_amount):
        return {
            "success": False,
            "trade_status": trade_status,
            "msg": "Amount mismatch",
        }

    if trade_status in ["TRADE_SUCCESS", "TRADE_FINISHED"]:
        crud_fine.mark_fine_payment_success(
            db,
            tx,
            trade_no,
            json.dumps(result, ensure_ascii=False),
        )
        return {
            "success": True,
            "trade_status": trade_status,
            "msg": "Fine payment confirmed",
        }

    return {
        "success": False,
        "trade_status": trade_status,
        "msg": "Payment not completed yet",
    }
