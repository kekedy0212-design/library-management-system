from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.borrow import (
    BorrowRequestCreate, ReserveRequestCreate, ReturnRequestCreate, RenewRequestCreate,
    RequestProcess, BorrowRecordPublic,
    BatchRequestProcess, BatchRequestProcessResponse,
    BatchReturnRequestCreate, BatchReturnRequestResponse
)
from app.crud import crud_borrow
from app.crud import crud_deposit
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
    """用户请求借书"""
    if not crud_deposit.has_paid_deposit(db, current_user.id):
        raise HTTPException(status_code=403, detail="Deposit required before borrowing")

    logger.info(f"📤 [借书请求] 用户 '{current_user.username}' (ID: {current_user.id}) 请求借书 | 书籍 ID: {request_in.book_id}")
    
    record = crud_borrow.create_borrow_request(db, current_user.id, request_in)
    if not record:
        logger.warning(f"❌ [借书请求失败] 书籍不可用或已有待处理请求 | 用户: {current_user.username} | 书籍 ID: {request_in.book_id}")
        raise HTTPException(status_code=400, detail="Book not available or already requested")
    
    logger.info(f"✅ [借书请求成功] 用户 '{current_user.username}' 成功创建借书请求 | 记录 ID: {record.id} | 书籍 ID: {record.book_id}")
    return record

@router.post("/return-requests", response_model=BorrowRecordPublic)
def request_return(
    request_in: ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """提交还书请求（需要图书管理员审批后才真正归还）"""
    logger.info(
        f"📥 [还书申请] 用户 '{current_user.username}' (ID: {current_user.id}) 提交还书申请 | 借记录 ID: {request_in.borrow_record_id}"
    )

    try:
        record = crud_borrow.create_return_request(
            db,
            current_user.id,
            request_in.borrow_record_id,
            copy_id=request_in.copy_id,
            isbn=request_in.isbn,
            barcode_number=request_in.barcode_number,
            barcode=request_in.barcode,
        )
    except ValueError as e:
        logger.warning(
            f"❌ [还书申请失败] 一致性校验失败 | 用户: {current_user.username} | "
            f"记录 ID: {request_in.borrow_record_id} | 原因: {str(e)}"
        )
        raise HTTPException(status_code=400, detail=str(e))

    if not record:
        logger.warning(
            f"❌ [还书申请失败] 无效的借记录 | 用户: {current_user.username} | 记录 ID: {request_in.borrow_record_id}"
        )
        raise HTTPException(
            status_code=400, detail="Invalid borrow record or book not borrowed"
        )

    logger.info(
        f"✅ [还书申请已提交] 用户 '{current_user.username}' 提交还书申请 | 记录 ID: {record.id} | 书籍 ID: {record.book_id} | 等待审批"
    )
    return record

@router.post("/reserve-requests", response_model=BorrowRecordPublic)
def request_reserve(
    request_in: ReserveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """用户请求预约书籍（无库存时）"""
    if not crud_deposit.has_paid_deposit(db, current_user.id):
        raise HTTPException(status_code=403, detail="Deposit required before reservation")

    record = crud_borrow.create_reserve_request(db, current_user.id, request_in)
    if not record:
        raise HTTPException(status_code=400, detail="Reservation not available for this book")
    return record

@router.post("/renew-requests", response_model=BorrowRecordPublic)
def request_renew(
    request_in: RenewRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """用户请求续借"""
    record = crud_borrow.create_renew_request(db, current_user.id, request_in)
    if not record:
        raise HTTPException(status_code=400, detail="Invalid renew request")
    return record

@router.post("/return-requests/batch", response_model=BatchReturnRequestResponse)
def request_return_batch(
    request_in: BatchReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """用户批量提交还书申请（需要图书管理员审批后才真正归还）"""
    if not request_in.borrow_record_ids:
        raise HTTPException(status_code=400, detail="borrow_record_ids cannot be empty")

    logger.info(
        f"📥 [批量还书申请] 用户 '{current_user.username}' (ID: {current_user.id}) 开始批量提交还书申请 | "
        f"数量: {len(request_in.borrow_record_ids)}"
    )

    success_count = 0
    results = []
    for record_id in request_in.borrow_record_ids:
        borrow_record = crud_borrow.get_borrow_record(db, record_id)
        if not borrow_record:
            results.append({
                "borrow_record_id": record_id,
                "success": False,
                "message": "Invalid borrow record or book not borrowed",
                "record": None
            })
            continue

        try:
            record = crud_borrow.create_return_request(
                db,
                current_user.id,
                record_id,
                copy_id=borrow_record.copy_id,
            )
        except ValueError as e:
            results.append({
                "borrow_record_id": record_id,
                "success": False,
                "message": str(e),
                "record": None
            })
            continue

        if record:
            success_count += 1
            results.append({
                "borrow_record_id": record_id,
                "success": True,
                "message": "Return request submitted. Awaiting librarian approval.",
                "record": BorrowRecordPublic.model_validate(record).model_dump()
            })
        else:
            results.append({
                "borrow_record_id": record_id,
                "success": False,
                "message": "Invalid borrow record or book not borrowed",
                "record": None
            })

    total = len(request_in.borrow_record_ids)
    failure_count = total - success_count
    logger.info(
        f"✅ [批量还书申请完成] 用户 '{current_user.username}' (ID: {current_user.id}) 批量提交还书申请完成 | "
        f"总数: {total} | 成功: {success_count} | 失败: {failure_count} | 等待审批"
    )
    return {
        "total": total,
        "success_count": success_count,
        "failure_count": failure_count,
        "results": results
    }

@router.get("/requests/pending", response_model=List[BorrowRecordPublic])
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    """获取待处理请求列表"""
    logger.debug(f"📋 [待处理请求] 图书管理员 '{current_user.username}' 查询待处理请求")
    records = crud_borrow.get_pending_requests(db)
    logger.debug(f"✅ [待处理请求] 返回 {len(records)} 条待处理请求")
    return records

@router.put("/requests/{request_id}/process", response_model=BorrowRecordPublic)
def process_request(
    request_id: int,
    process_in: RequestProcess,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    """处理借/还书请求（批准或拒绝）"""
    logger.info(f"⚙️ [请求处理] 图书管理员 '{current_user.username}' 开始处理请求 | 请求 ID: {request_id} | 操作: {process_in.action}")
    
    record = crud_borrow.get_borrow_record(db, request_id)
    if not record:
        logger.warning(f"⚠️ [请求处理失败] 请求未找到 | ID: {request_id}")
        raise HTTPException(status_code=404, detail="Request not found")

    # 记录操作前的状态
    old_status = record.status.value
    book_id = record.book_id
    borrower_username = record.user.username
    borrower_id = record.user_id

    if record.status.value == "pending":
        is_reserve = crud_borrow.is_reserve_request(record)
        if crud_borrow.is_renew_request(record):
            record = crud_borrow.process_renew_request(db, request_id, process_in)
            if record:
                action = "批准" if process_in.action == "approve" else "拒绝"
                logger.info(
                    f"✅ [续借请求{action}] 图书管理员 '{current_user.username}' {action}了续借请求 | "
                    f"请求 ID: {request_id} | 用户: {borrower_username} (ID: {borrower_id}) | 书籍 ID: {book_id}"
                )
        else:
            record = crud_borrow.process_borrow_request(db, request_id, process_in)
            if record:
                action = "批准" if process_in.action == "approve" else "拒绝"
                logger.info(
                    f"✅ [借书/预约请求{action}] 图书管理员 '{current_user.username}' {action}了请求 | "
                    f"请求 ID: {request_id} | 用户: {borrower_username} (ID: {borrower_id}) | 书籍 ID: {book_id}"
                )
    elif record.status.value == "return_pending":
        record = crud_borrow.process_return_request(db, request_id, process_in)
        if record:
            action = "批准" if process_in.action == "approve" else "拒绝"
            logger.info(
                f"✅ [还书请求{action}] 图书管理员 '{current_user.username}' {action}了还书请求 | "
                f"请求 ID: {request_id} | 用户: {borrower_username} (ID: {borrower_id}) | 书籍 ID: {book_id}"
            )
    else:
        logger.error(f"❌ [请求处理失败] 请求状态不是待处理 | ID: {request_id} | 状态: {record.status.value}")
        raise HTTPException(status_code=400, detail="Request is not in pending state")

    if not record:
        if process_in.action == "approve" and 'is_reserve' in locals() and is_reserve:
            raise HTTPException(status_code=400, detail="No available copies now. Reservation remains pending.")
        logger.error(f"❌ [请求处理失败] 处理操作失败 | ID: {request_id}")
        raise HTTPException(status_code=400, detail="Processing failed")
    return record

@router.post("/requests/process-batch", response_model=BatchRequestProcessResponse)
def process_requests_batch(
    process_in: BatchRequestProcess,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    """批量处理借/还书请求（批准或拒绝）"""
    if process_in.action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be approve or reject")
    if not process_in.request_ids:
        raise HTTPException(status_code=400, detail="request_ids cannot be empty")

    logger.info(
        f"⚙️ [批量请求处理] 图书管理员 '{current_user.username}' 开始批量处理请求 | "
        f"数量: {len(process_in.request_ids)} | 操作: {process_in.action}"
    )

    results = []
    success_count = 0
    process_payload = RequestProcess(action=process_in.action, notes=process_in.notes)

    for request_id in process_in.request_ids:
        try:
            record = crud_borrow.get_borrow_record(db, request_id)
            if not record:
                results.append({
                    "request_id": request_id,
                    "success": False,
                    "message": "Request not found",
                    "record": None
                })
                continue

            if record.status.value == "pending":
                is_reserve = crud_borrow.is_reserve_request(record)
                if crud_borrow.is_renew_request(record):
                    processed = crud_borrow.process_renew_request(db, request_id, process_payload)
                else:
                    processed = crud_borrow.process_borrow_request(db, request_id, process_payload)
            elif record.status.value == "return_pending":
                processed = crud_borrow.process_return_request(db, request_id, process_payload)
            else:
                results.append({
                    "request_id": request_id,
                    "success": False,
                    "message": f"Request is not in pending state: {record.status.value}",
                    "record": None
                })
                continue

            if not processed:
                fail_message = "Processing failed"
                if process_in.action == "approve" and 'is_reserve' in locals() and is_reserve:
                    fail_message = "No available copies now. Reservation remains pending."
                results.append({
                    "request_id": request_id,
                    "success": False,
                    "message": fail_message,
                    "record": None
                })
                continue

            success_count += 1
            results.append({
                "request_id": request_id,
                "success": True,
                "message": "Processed successfully",
                "record": BorrowRecordPublic.model_validate(processed).model_dump()
            })
        except Exception as e:
            logger.exception(f"❌ [批量请求处理失败] 请求 ID: {request_id} | 错误: {str(e)}")
            results.append({
                "request_id": request_id,
                "success": False,
                "message": f"Unexpected error: {str(e)}",
                "record": None
            })

    total = len(process_in.request_ids)
    failure_count = total - success_count
    logger.info(
        f"✅ [批量请求处理完成] 图书管理员 '{current_user.username}' 完成批量处理 | "
        f"总数: {total} | 成功: {success_count} | 失败: {failure_count}"
    )
    return {
        "total": total,
        "success_count": success_count,
        "failure_count": failure_count,
        "results": results
    }

@router.get("/users/me/borrow-history", response_model=List[BorrowRecordPublic])
def get_my_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取当前用户的借书历史"""
    logger.debug(f"📚 [借书历史] 用户 '{current_user.username}' 查询个人借书历史")
    records = crud_borrow.get_user_borrow_history(db, current_user.id)
    logger.debug(f"✅ [借书历史] 返回用户 '{current_user.username}' 的 {len(records)} 条借书记录")
    return records


@router.get("/borrow-records", response_model=List[BorrowRecordPublic])
def get_all_borrow_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    """馆员查看全量借阅记录"""
    logger.debug(f"📚 [借阅总览] 馆员 '{current_user.username}' 查询全量借阅记录")
    records = crud_borrow.get_all_borrow_records(db)
    logger.debug(f"✅ [借阅总览] 返回 {len(records)} 条借阅记录")
    return records