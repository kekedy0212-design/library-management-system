from decimal import Decimal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.core.alipay import get_alipay_client
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.deposit import DepositStatus, DepositTransaction, TransactionType, TransactionStatus
from app.schemas.deposit import (
    DepositPublic,
    DepositOrderCreateResponse,
    DepositConfirmRequest,
    DepositConfirmResponse,
    DepositRefundRequest,
    DepositRefundResponse,
    DepositRefundConfirmRequest,
)
from app.crud import crud_deposit
from app.crud import crud_borrow
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/deposits/me", response_model=DepositPublic)
def get_my_deposit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    deposit = crud_deposit.get_or_create_user_deposit(
        db,
        current_user.id,
        Decimal(str(settings.DEPOSIT_AMOUNT))
    )
    return deposit


@router.post("/deposits/create-order", response_model=DepositOrderCreateResponse)
def create_deposit_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    deposit = crud_deposit.get_or_create_user_deposit(
        db,
        current_user.id,
        Decimal(str(settings.DEPOSIT_AMOUNT))
    )
    if deposit.status == DepositStatus.PAID:
        raise HTTPException(status_code=400, detail="Deposit already paid")

    try:
        alipay = get_alipay_client()
    except RuntimeError as exc:
        logger.error(f"Alipay client unavailable: {exc}")
        raise HTTPException(
            status_code=503,
            detail=(
                "Payment service is not configured on this server. "
                "Install python-alipay-sdk and set ALIPAY_* in backend .env. "
                f"Reason: {exc}"
            ),
        ) from exc

    out_trade_no = f"deposit_{current_user.id}_{uuid4().hex[:12]}"
    total_amount = str(deposit.amount)

    try:
        order_string = alipay.api_alipay_trade_page_pay(
            out_trade_no=out_trade_no,
            total_amount=total_amount,
            subject=f"Library Deposit - {current_user.username}",
            return_url=settings.ALIPAY_RETURN_URL,
            notify_url=settings.ALIPAY_NOTIFY_URL,
            product_code="FAST_INSTANT_TRADE_PAY",
        )
    except Exception as exc:
        logger.exception("Alipay page pay sign/request build failed")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to create Alipay order. Check keys and gateway in .env. {exc}",
        ) from exc
    pay_url = f"{settings.ALIPAY_GATEWAY}?{order_string}"

    crud_deposit.set_deposit_pending(db, deposit)
    crud_deposit.create_payment_transaction(
        db=db,
        deposit_id=deposit.id,
        out_trade_no=out_trade_no,
        amount=deposit.amount,
    )

    logger.info(
        f"💰 [押金订单创建] 用户 '{current_user.username}' | 用户 ID: {current_user.id} | "
        f"订单号: {out_trade_no} | 金额: {total_amount}"
    )
    return {
        "out_trade_no": out_trade_no,
        "pay_url": pay_url,
        "amount": deposit.amount,
        "status": "created",
    }


@router.post("/payments/alipay/notify")
async def alipay_notify(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    payload = dict(form)

    sign = payload.pop("sign", None)
    payload.pop("sign_type", None)
    out_trade_no = payload.get("out_trade_no")
    total_amount = payload.get("total_amount")
    trade_status = payload.get("trade_status")
    trade_no = payload.get("trade_no")

    if not sign or not out_trade_no:
        return PlainTextResponse("failure")

    try:
        alipay = get_alipay_client()
        verified = alipay.verify(payload, sign)
    except Exception as e:
        logger.error(f"❌ [支付宝回调] 验签失败: {str(e)}")
        return PlainTextResponse("failure")

    if not verified:
        logger.warning(f"⚠️ [支付宝回调] 验签未通过 | out_trade_no: {out_trade_no}")
        return PlainTextResponse("failure")

    tx = crud_deposit.get_transaction_by_out_trade_no(db, out_trade_no)
    if not tx:
        logger.warning(f"⚠️ [支付宝回调] 未找到交易流水 | out_trade_no: {out_trade_no}")
        return PlainTextResponse("failure")

    if str(tx.amount) != str(total_amount):
        logger.error(
            f"❌ [支付宝回调] 金额不一致 | out_trade_no: {out_trade_no} | "
            f"expected: {tx.amount} | received: {total_amount}"
        )
        crud_deposit.mark_payment_failed(db, tx, json.dumps(dict(form), ensure_ascii=False))
        return PlainTextResponse("failure")

    raw_notify = json.dumps(dict(form), ensure_ascii=False)
    if trade_status in ["TRADE_SUCCESS", "TRADE_FINISHED"]:
        crud_deposit.mark_payment_success(db, tx, trade_no, raw_notify)
        logger.info(f"✅ [支付宝回调] 押金支付成功 | out_trade_no: {out_trade_no}")
        return PlainTextResponse("success")

    crud_deposit.mark_payment_failed(db, tx, raw_notify)
    logger.warning(f"⚠️ [支付宝回调] 支付未成功 | out_trade_no: {out_trade_no} | trade_status: {trade_status}")
    return PlainTextResponse("failure")


@router.post("/deposits/confirm", response_model=DepositConfirmResponse)
def confirm_deposit_payment(
    confirm_in: DepositConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    兜底确认接口：
    当支付宝异步通知因网络原因未到达时，前端回跳后可主动查单并更新状态。
    """
    tx = crud_deposit.get_transaction_by_out_trade_no(db, confirm_in.out_trade_no)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    deposit = crud_deposit.get_user_deposit(db, current_user.id)
    if not deposit or tx.deposit_id != deposit.id:
        raise HTTPException(status_code=403, detail="Transaction does not belong to current user")

    alipay = get_alipay_client()
    result = alipay.api_alipay_trade_query(out_trade_no=confirm_in.out_trade_no)
    trade_status = result.get("trade_status")
    trade_no = result.get("trade_no")
    total_amount = result.get("total_amount")

    if str(tx.amount) != str(total_amount):
        return {
            "success": False,
            "trade_status": trade_status,
            "msg": "Amount mismatch in trade query",
        }

    if trade_status in ["TRADE_SUCCESS", "TRADE_FINISHED"]:
        crud_deposit.mark_payment_success(
            db,
            tx,
            trade_no,
            json.dumps(result, ensure_ascii=False)
        )
        return {
            "success": True,
            "trade_status": trade_status,
            "msg": "Deposit payment confirmed",
        }

    return {
        "success": False,
        "trade_status": trade_status,
        "msg": "Payment is not successful yet",
    }



@router.post("/deposits/refund", response_model=DepositRefundResponse)
def request_deposit_refund(
    refund_in: DepositRefundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    发起押金退款申请（用户）
    """
    deposit = crud_deposit.get_user_deposit(db, current_user.id)
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")

    if deposit.status != DepositStatus.PAID:
        raise HTTPException(status_code=400, detail=f"Cannot refund deposit with status: {deposit.status}")

    # Business rule: only allow refund when user has no active borrows
    if crud_borrow.user_has_active_borrows(db, current_user.id):
        raise HTTPException(status_code=400, detail="Cannot refund while user has active borrowings")

    try:
        alipay = get_alipay_client()
    except RuntimeError as exc:
        logger.error(f"Alipay client unavailable: {exc}")
        raise HTTPException(status_code=503, detail="Payment service not configured")

    out_refund_no = f"refund_{current_user.id}_{uuid4().hex[:12]}"

    # find last successful pay tx
    last_pay_tx = db.query(DepositTransaction).filter(
        DepositTransaction.deposit_id == deposit.id,
        DepositTransaction.biz_type == TransactionType.PAY,
        DepositTransaction.status == TransactionStatus.SUCCESS,
    ).order_by(DepositTransaction.created_at.desc()).first()

    if not last_pay_tx or not last_pay_tx.trade_no:
        raise HTTPException(status_code=400, detail="No successful payment found for refund")

    try:
        result = alipay.api_alipay_trade_refund(
            out_trade_no=last_pay_tx.out_trade_no,
            trade_no=last_pay_tx.trade_no,
            out_refund_no=out_refund_no,
            refund_amount=str(deposit.amount),
            refund_reason=refund_in.reason or "User requested deposit refund",
        )

        # create refund tx and set deposit state
        crud_deposit.set_deposit_refund_pending(db, deposit)
        refund_tx = crud_deposit.create_refund_transaction(
            db=db,
            deposit_id=deposit.id,
            out_trade_no=out_refund_no,
            amount=deposit.amount,
        )

        # if immediate success returned
        if result.get("code") == "10000" and result.get("refund_fee"):
            # Treat as success if refund_fee equals amount (best-effort)
            try:
                crud_deposit.mark_refund_success(db, refund_tx, result.get("trade_no"), json.dumps(result, ensure_ascii=False))
                logger.info(f"✅ [押金退款] 立即成功 | out_refund_no: {out_refund_no}")
            except Exception:
                logger.exception("Failed to mark immediate refund success")

        logger.info(f"⏳ [押金退款] 退款申请已创建 | user_id: {current_user.id} | out_refund_no: {out_refund_no}")
        return {"out_refund_no": out_refund_no, "amount": deposit.amount, "status": "processing"}

    except Exception as exc:
        logger.exception(f"Failed to create Alipay refund: {exc}")
        raise HTTPException(status_code=503, detail=f"Failed to process refund. {exc}")


@router.post("/payments/alipay/refund-notify")
async def alipay_refund_notify(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    payload = dict(form)

    sign = payload.pop("sign", None)
    payload.pop("sign_type", None)
    out_refund_no = payload.get("out_refund_no")
    refund_status = payload.get("refund_status")
    trade_no = payload.get("trade_no")

    if not sign or not out_refund_no:
        return PlainTextResponse("failure")

    try:
        alipay = get_alipay_client()
        verified = alipay.verify(payload, sign)
    except Exception as e:
        logger.error(f"❌ [支付宝退款回调] 验签失败: {str(e)}")
        return PlainTextResponse("failure")

    if not verified:
        logger.warning(f"⚠️ [支付宝退款回调] 验签未通过 | out_refund_no: {out_refund_no}")
        return PlainTextResponse("failure")

    tx = crud_deposit.get_transaction_by_out_trade_no(db, out_refund_no)
    if not tx:
        logger.warning(f"⚠️ [支付宝退款回调] 未找到退款流水 | out_refund_no: {out_refund_no}")
        return PlainTextResponse("failure")

    raw_notify = json.dumps(dict(form), ensure_ascii=False)
    if refund_status == "REFUND_SUCCESS":
        crud_deposit.mark_refund_success(db, tx, trade_no, raw_notify)
        logger.info(f"✅ [支付宝退款回调] 押金退款成功 | out_refund_no: {out_refund_no}")
        return PlainTextResponse("success")

    crud_deposit.mark_refund_failed(db, tx, raw_notify)
    logger.warning(f"⚠️ [支付宝退款回调] 退款失败 | out_refund_no: {out_refund_no} | refund_status: {refund_status}")
    return PlainTextResponse("failure")


@router.post("/deposits/confirm-refund", response_model=DepositRefundResponse)
def confirm_deposit_refund(
    confirm_in: DepositRefundConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    tx = crud_deposit.get_transaction_by_out_trade_no(db, confirm_in.out_refund_no)
    if not tx:
        raise HTTPException(status_code=404, detail="Refund transaction not found")

    deposit = crud_deposit.get_user_deposit(db, current_user.id)
    if not deposit or tx.deposit_id != deposit.id:
        raise HTTPException(status_code=403, detail="Refund does not belong to current user")

    alipay = get_alipay_client()
    try:
        result = alipay.api_alipay_trade_fastpay_refund_query(out_refund_no=confirm_in.out_refund_no)
        # result processing depends on API response shape
        refund_status = result.get("refund_status") or ("REFUND_SUCCESS" if result.get("code") == "10000" and result.get("refund_fee") else None)

        if refund_status == "REFUND_SUCCESS":
            crud_deposit.mark_refund_success(db, tx, result.get("trade_no"), json.dumps(result, ensure_ascii=False))
            return {"out_refund_no": confirm_in.out_refund_no, "amount": deposit.amount, "status": "refunded"}

        return {"out_refund_no": confirm_in.out_refund_no, "amount": deposit.amount, "status": "processing"}
    except Exception as exc:
        logger.error(f"Failed to query refund status: {exc}")
        raise HTTPException(status_code=503, detail="Failed to query refund status")
