from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timedelta
from app.models.borrow import BorrowRecord, BorrowStatus
from app.models.book import Book
from app.schemas.borrow import BorrowRequestCreate, RenewRequestCreate, RequestProcess
import logging

logger = logging.getLogger(__name__)
RENEW_NOTE_PREFIX = "__RENEW__:"
RESERVE_NOTE_FLAG = "__RESERVE__"


def _not_renew_request_filter():
    """过滤掉续借请求记录（__RENEW__），避免被当作真实在借记录。"""
    return or_(
        BorrowRecord.librarian_notes.is_(None),
        ~BorrowRecord.librarian_notes.like(f"{RENEW_NOTE_PREFIX}%")
    )

def get_borrow_record(db: Session, record_id: int):
    result = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if result:
        logger.debug(f"📚 [CRUD] 获取借记录: ID: {record_id} | 状态: {result.status.value}")
    return result

def get_pending_requests(db: Session):
    # 兼容旧流程：把历史 RETURN_PENDING 数据补偿为已归还，避免卡在管理员待处理中
    reconcile_legacy_return_pending(db)
    # 补偿机制：先尝试把可分配的预约自动分配，避免“有库存但仍是pending”的历史遗留状态
    reconcile_reservations(db)
    results = db.query(BorrowRecord).filter(
        BorrowRecord.status == BorrowStatus.PENDING
    ).all()
    logger.debug(f"📋 [CRUD] 查询待处理请求 | 待处理数: {len(results)}")
    return results

def get_user_borrow_history(db: Session, user_id: int):
    # 兼容旧流程：先把历史 RETURN_PENDING 数据补偿为已归还，保证读者看到真实状态
    reconcile_legacy_return_pending(db)
    # 补偿机制：查询前先自动分配预约队列，保证读者看到的是最新状态
    reconcile_reservations(db)
    results = db.query(BorrowRecord).filter(BorrowRecord.user_id == user_id).all()
    logger.debug(f"📚 [CRUD] 查询用户借书历史 | 用户 ID: {user_id} | 记录数: {len(results)}")
    return results


def user_has_active_borrows(db: Session, user_id: int) -> bool:
    """判断用户是否有正在借阅的书籍。

    视为正在借阅的记录包括：`APPROVED`（已借出，未归还）和 `RETURN_PENDING`（待归还处理中）。
    过滤掉续借和预约类的伪记录。
    """
    from app.models.borrow import BorrowStatus

    reconcile_legacy_return_pending(db)
    reconcile_reservations(db)

    record = db.query(BorrowRecord).filter(
        BorrowRecord.user_id == user_id,
        BorrowRecord.status.in_([BorrowStatus.APPROVED, BorrowStatus.RETURN_PENDING]),
        _not_renew_request_filter()
    ).first()
    return bool(record)


def get_all_borrow_records(db: Session):
    """馆员查看全量借阅记录（含借阅/预约/续借/归还历史）"""
    reconcile_legacy_return_pending(db)
    reconcile_reservations(db)
    results = db.query(BorrowRecord).order_by(BorrowRecord.request_date.desc(), BorrowRecord.id.desc()).all()
    logger.debug(f"📚 [CRUD] 查询全量借阅记录 | 记录数: {len(results)}")
    return results

def create_borrow_request(db: Session, user_id: int, request_in: BorrowRequestCreate):
    """创建借书请求"""
    logger.debug(f"📤 [CRUD] 开始创建借书请求 | 用户 ID: {user_id} | 书籍 ID: {request_in.book_id}")
    
    # 检查书籍是否可借
    book = db.query(Book).filter(Book.id == request_in.book_id).first()
    if not book:
        logger.warning(f"⚠️ [CRUD] 借书请求失败: 书籍不存在 | 书籍 ID: {request_in.book_id}")
        return None
    
    if book.available_copies <= 0:
        logger.warning(f"⚠️ [CRUD] 借书请求失败: 书籍无可用副本 | 书籍: {book.title} | 可用数: {book.available_copies}")
        return None

    # 检查用户是否已有未归还的相同书籍
    existing = db.query(BorrowRecord).filter(
        BorrowRecord.user_id == user_id,
        BorrowRecord.book_id == request_in.book_id,
        BorrowRecord.status.in_([BorrowStatus.APPROVED, BorrowStatus.PENDING, BorrowStatus.RETURN_PENDING]),
        _not_renew_request_filter()
    ).first()
    if existing:
        logger.warning(f"⚠️ [CRUD] 借书请求失败: 用户已有该书籍的未归还记录 | 用户 ID: {user_id} | 书籍: {book.title}")
        return None

    db_record = BorrowRecord(
        user_id=user_id,
        book_id=request_in.book_id,
        status=BorrowStatus.PENDING,
        request_date=datetime.utcnow(),
        # 暂存读者期望归还日期，审批通过时优先采用
        due_date=request_in.requested_due_date
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    logger.info(f"✅ [CRUD] 借书请求已创建 | 记录 ID: {db_record.id} | 用户 ID: {user_id} | 书籍: {book.title}")
    return db_record


def create_reserve_request(db: Session, user_id: int, request_in: BorrowRequestCreate):
    """创建预约请求（无库存时）"""
    logger.debug(f"📌 [CRUD] 开始创建预约请求 | 用户 ID: {user_id} | 书籍 ID: {request_in.book_id}")

    book = db.query(Book).filter(Book.id == request_in.book_id).first()
    if not book:
        logger.warning(f"⚠️ [CRUD] 预约请求失败: 书籍不存在 | 书籍 ID: {request_in.book_id}")
        return None

    if book.available_copies > 0:
        logger.warning(f"⚠️ [CRUD] 预约请求失败: 该书当前可借，无需预约 | 书籍: {book.title}")
        return None

    existing = db.query(BorrowRecord).filter(
        BorrowRecord.user_id == user_id,
        BorrowRecord.book_id == request_in.book_id,
        BorrowRecord.status.in_([BorrowStatus.APPROVED, BorrowStatus.PENDING, BorrowStatus.RETURN_PENDING]),
        _not_renew_request_filter()
    ).first()
    if existing:
        logger.warning(f"⚠️ [CRUD] 预约请求失败: 用户已有该书籍相关未结束记录 | 用户 ID: {user_id} | 书籍: {book.title}")
        return None

    db_record = BorrowRecord(
        user_id=user_id,
        book_id=request_in.book_id,
        status=BorrowStatus.PENDING,
        request_date=datetime.utcnow(),
        librarian_notes=RESERVE_NOTE_FLAG
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    logger.info(f"✅ [CRUD] 预约请求已创建 | 记录 ID: {db_record.id} | 用户 ID: {user_id} | 书籍: {book.title}")
    return db_record

def create_return_request(db: Session, user_id: int, record_id: int):
    """直接归还书籍（无需管理员审批）"""
    logger.debug(f"📥 [CRUD] 开始处理直接还书 | 用户 ID: {user_id} | 记录 ID: {record_id}")
    
    record = db.query(BorrowRecord).filter(
        BorrowRecord.id == record_id,
        BorrowRecord.user_id == user_id,
        BorrowRecord.status.in_([BorrowStatus.APPROVED, BorrowStatus.RETURN_PENDING]),
        _not_renew_request_filter()
    ).first()
    if not record:
        logger.warning(f"⚠️ [CRUD] 还书请求失败: 记录不存在或状态不是APPROVED | 记录 ID: {record_id}")
        return None
    
    try:
        book = db.query(Book).filter(Book.id == record.book_id).with_for_update().first()
        book.available_copies += 1
        # 旧流程中可能已经存在 return_request_date，这里保持幂等
        record.return_request_date = record.return_request_date or datetime.utcnow()
        record.status = BorrowStatus.RETURNED
        record.actual_return_date = datetime.utcnow()

        # 直接归还后也触发预约队列自动分配
        auto_assigned_records = assign_reservations_if_available(
            db,
            book,
            reason="AUTO_ASSIGNED_AFTER_DIRECT_RETURN"
        )
        db.add(book)
        db.add(record)
        db.commit()
        db.refresh(record)
        if auto_assigned_records:
            logger.info(
                f"✅ [CRUD] 直接还书成功并自动分配预约 | 记录 ID: {record_id} | 用户 ID: {user_id} | "
                f"分配数量: {len(auto_assigned_records)} | 当前库存: {book.available_copies}"
            )
        else:
            logger.info(f"✅ [CRUD] 直接还书成功 | 记录 ID: {record_id} | 用户 ID: {user_id} | 当前库存: {book.available_copies}")
    except Exception as e:
        logger.error(f"❌ [CRUD] 直接还书异常 | 记录 ID: {record_id} | 错误: {str(e)}")
        db.rollback()
        raise
    return record


def reconcile_legacy_return_pending(db: Session):
    """
    将历史 RETURN_PENDING（旧“需管理员审批还书”流程）补偿为 RETURNED。
    仅在首次补偿时回补库存，避免重复累加。
    """
    legacy_records = db.query(BorrowRecord).filter(
        BorrowRecord.status == BorrowStatus.RETURN_PENDING
    ).all()

    if not legacy_records:
        return 0

    reconciled_count = 0
    for record in legacy_records:
        book = db.query(Book).filter(Book.id == record.book_id).with_for_update().first()
        if not book:
            continue

        if not record.actual_return_date:
            book.available_copies += 1
            record.actual_return_date = datetime.utcnow()

        record.return_request_date = record.return_request_date or datetime.utcnow()
        record.status = BorrowStatus.RETURNED
        db.add(book)
        db.add(record)
        reconciled_count += 1

        assign_reservations_if_available(
            db,
            book,
            reason="AUTO_ASSIGNED_AFTER_LEGACY_RETURN_RECONCILE"
        )

    if reconciled_count > 0:
        db.commit()
        logger.info(f"🔄 [CRUD] 历史还书补偿完成 | 记录数: {reconciled_count}")

    return reconciled_count


def create_renew_request(db: Session, user_id: int, request_in: RenewRequestCreate):
    """创建续借请求（对已借出的记录）"""
    logger.debug(f"🔁 [CRUD] 开始创建续借请求 | 用户 ID: {user_id} | 原借阅记录 ID: {request_in.borrow_record_id}")

    origin = db.query(BorrowRecord).filter(
        BorrowRecord.id == request_in.borrow_record_id,
        BorrowRecord.user_id == user_id,
        BorrowRecord.status == BorrowStatus.APPROVED
    ).first()
    if not origin:
        logger.warning(f"⚠️ [CRUD] 续借请求失败: 原记录不存在或状态不是APPROVED | 记录 ID: {request_in.borrow_record_id}")
        return None

    existing_pending_renew = db.query(BorrowRecord).filter(
        BorrowRecord.user_id == user_id,
        BorrowRecord.book_id == origin.book_id,
        BorrowRecord.status == BorrowStatus.PENDING,
        BorrowRecord.librarian_notes.like(f"{RENEW_NOTE_PREFIX}{request_in.borrow_record_id}%")
    ).first()
    if existing_pending_renew:
        logger.warning(f"⚠️ [CRUD] 续借请求失败: 已有待处理续借请求 | 原记录 ID: {request_in.borrow_record_id}")
        return None

    if request_in.requested_due_date:
        base_due = origin.due_date if origin.due_date and origin.due_date > datetime.utcnow() else datetime.utcnow()
        if request_in.requested_due_date <= base_due:
            logger.warning(
                f"⚠️ [CRUD] 续借请求失败: 期望日期不晚于当前到期日 | 原记录 ID: {request_in.borrow_record_id} | "
                f"当前到期: {base_due} | 期望到期: {request_in.requested_due_date}"
            )
            return None

    renew_record = BorrowRecord(
        user_id=user_id,
        book_id=origin.book_id,
        status=BorrowStatus.PENDING,
        request_date=datetime.utcnow(),
        due_date=request_in.requested_due_date,
        librarian_notes=f"{RENEW_NOTE_PREFIX}{request_in.borrow_record_id}"
    )
    db.add(renew_record)
    db.commit()
    db.refresh(renew_record)
    logger.info(f"✅ [CRUD] 续借请求已创建 | 请求记录 ID: {renew_record.id} | 原记录 ID: {request_in.borrow_record_id}")
    return renew_record


def is_renew_request(record: BorrowRecord) -> bool:
    return bool(record.librarian_notes and record.librarian_notes.startswith(RENEW_NOTE_PREFIX))


def is_reserve_request(record: BorrowRecord) -> bool:
    return bool(record.librarian_notes and record.librarian_notes.startswith(RESERVE_NOTE_FLAG))


def assign_reservations_if_available(db: Session, book: Book, reason: str):
    """
    若该书有可用库存，则按先到先得自动分配给预约队列。
    返回被自动分配的预约记录列表。
    """
    assigned_records = []
    while book.available_copies > 0:
        next_reservation = db.query(BorrowRecord).filter(
            BorrowRecord.book_id == book.id,
            BorrowRecord.status == BorrowStatus.PENDING,
            BorrowRecord.librarian_notes.like(f"{RESERVE_NOTE_FLAG}%")
        ).order_by(BorrowRecord.request_date.asc(), BorrowRecord.id.asc()).first()

        if not next_reservation:
            break

        # 自动分配会立即消耗一个可用副本，保证库存一致性
        book.available_copies -= 1
        now = datetime.utcnow()
        next_reservation.status = BorrowStatus.APPROVED
        next_reservation.approve_date = now
        next_reservation.due_date = now + timedelta(days=14)
        next_reservation.librarian_notes = f"{RESERVE_NOTE_FLAG}|{reason}"
        db.add(book)
        db.add(next_reservation)
        assigned_records.append(next_reservation)

    return assigned_records


def reconcile_reservations(db: Session):
    """
    补偿分配：扫描所有有可用库存且有预约队列的书，自动完成可分配预约。
    主要用于修复历史数据或异常中断导致的状态不一致。
    """
    books = db.query(Book).filter(Book.available_copies > 0).all()
    total_assigned = 0
    for book in books:
        assigned = assign_reservations_if_available(
            db,
            book,
            reason="AUTO_ASSIGNED_RECONCILE"
        )
        if assigned:
            total_assigned += len(assigned)

    if total_assigned > 0:
        db.commit()
        logger.info(f"🔄 [CRUD] 补偿分配完成 | 自动分配预约数量: {total_assigned}")
    return total_assigned

def process_borrow_request(db: Session, record_id: int, process_in: RequestProcess):
    """处理借书请求（批准或拒绝）"""
    logger.info(f"⚙️ [CRUD] 开始处理借书请求 | 记录 ID: {record_id} | 操作: {process_in.action}")
    
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record or record.status != BorrowStatus.PENDING:
        logger.warning(f"⚠️ [CRUD] 处理借书请求失败: 记录状态不是PENDING | 记录 ID: {record_id}")
        return None

    try:
        if process_in.action == "approve":
            # 加行锁防止并发超借
            book = db.query(Book).filter(Book.id == record.book_id).with_for_update().first()
            if book.available_copies <= 0:
                if is_reserve_request(record):
                    logger.warning(f"⚠️ [CRUD] 预约审批暂不可通过: 当前无库存 | 书籍: {book.title} | 可用数: {book.available_copies}")
                    return None
                record.status = BorrowStatus.REJECTED
                record.librarian_notes = "库存不足"
                db.add(record)
                db.commit()
                logger.warning(f"❌ [CRUD] 借书请求被拒: 库存不足 | 书籍: {book.title} | 可用数: {book.available_copies}")
                return record

            book.available_copies -= 1
            now = datetime.utcnow()
            due_date = record.due_date if record.due_date and record.due_date > now else now + timedelta(days=14)
            record.status = BorrowStatus.APPROVED
            record.approve_date = now
            record.due_date = due_date
            record.librarian_notes = process_in.notes
            db.add(book)
            db.add(record)
            db.commit()
            logger.info(f"✅ [CRUD] 借书请求已批准 | 记录 ID: {record_id} | 书籍: {book.title} | 归还期限: 14天 | 剩余库存: {book.available_copies}")
        elif process_in.action == "reject":
            record.status = BorrowStatus.REJECTED
            record.librarian_notes = process_in.notes
            db.add(record)
            db.commit()
            logger.info(f"✅ [CRUD] 借书请求已拒绝 | 记录 ID: {record_id} | 备注: {process_in.notes}")
        else:
            logger.error(f"❌ [CRUD] 处理借书请求失败: 无效的操作 | 操作: {process_in.action}")
            return None
    except Exception as e:
        logger.error(f"❌ [CRUD] 处理借书请求异常 | 记录 ID: {record_id} | 错误: {str(e)}")
        db.rollback()
        raise

    db.refresh(record)
    return record


def process_renew_request(db: Session, request_id: int, process_in: RequestProcess):
    """处理续借请求（批准或拒绝）"""
    logger.info(f"⚙️ [CRUD] 开始处理续借请求 | 请求记录 ID: {request_id} | 操作: {process_in.action}")

    request_record = db.query(BorrowRecord).filter(BorrowRecord.id == request_id).first()
    if not request_record or request_record.status != BorrowStatus.PENDING or not is_renew_request(request_record):
        logger.warning(f"⚠️ [CRUD] 处理续借请求失败: 请求记录非法 | 请求 ID: {request_id}")
        return None

    try:
        origin_id = int(request_record.librarian_notes.replace(RENEW_NOTE_PREFIX, "").split("|")[0])
        origin = db.query(BorrowRecord).filter(BorrowRecord.id == origin_id).first()
        if not origin or origin.status != BorrowStatus.APPROVED:
            logger.warning(f"⚠️ [CRUD] 处理续借请求失败: 原借阅记录不可续借 | 原记录 ID: {origin_id}")
            request_record.status = BorrowStatus.REJECTED
            request_record.librarian_notes = f"{RENEW_NOTE_PREFIX}{origin_id}|invalid_origin"
            db.add(request_record)
            db.commit()
            db.refresh(request_record)
            return request_record

        if process_in.action == "approve":
            now = datetime.utcnow()
            base_due = origin.due_date if origin.due_date and origin.due_date > now else now
            preferred_due = request_record.due_date
            if preferred_due and preferred_due > base_due:
                origin.due_date = preferred_due
            elif preferred_due and preferred_due <= base_due:
                request_record.status = BorrowStatus.REJECTED
                request_record.librarian_notes = f"{RENEW_NOTE_PREFIX}{origin_id}|invalid_preferred_due"
                db.add(request_record)
                db.commit()
                db.refresh(request_record)
                logger.warning(
                    f"⚠️ [CRUD] 续借请求被拒: 期望日期不晚于当前到期日 | 请求 ID: {request_id} | "
                    f"当前到期: {base_due} | 期望到期: {preferred_due}"
                )
                return request_record
            else:
                origin.due_date = base_due + timedelta(days=14)
            request_record.status = BorrowStatus.APPROVED
            request_record.approve_date = now
            request_record.due_date = origin.due_date
            request_record.librarian_notes = f"{RENEW_NOTE_PREFIX}{origin_id}|approved|{process_in.notes or ''}"
            db.add(origin)
            db.add(request_record)
            db.commit()
            logger.info(f"✅ [CRUD] 续借请求已批准 | 原记录 ID: {origin_id} | 新到期时间: {origin.due_date}")
        elif process_in.action == "reject":
            request_record.status = BorrowStatus.REJECTED
            request_record.librarian_notes = f"{RENEW_NOTE_PREFIX}{origin_id}|rejected|{process_in.notes or ''}"
            db.add(request_record)
            db.commit()
            logger.info(f"✅ [CRUD] 续借请求已拒绝 | 原记录 ID: {origin_id}")
        else:
            logger.error(f"❌ [CRUD] 处理续借请求失败: 无效操作 | 操作: {process_in.action}")
            return None
    except Exception as e:
        logger.error(f"❌ [CRUD] 处理续借请求异常 | 请求 ID: {request_id} | 错误: {str(e)}")
        db.rollback()
        raise

    db.refresh(request_record)
    return request_record

def process_return_request(db: Session, record_id: int, process_in: RequestProcess):
    """处理还书请求（批准或拒绝）"""
    logger.info(f"⚙️ [CRUD] 开始处理还书请求 | 记录 ID: {record_id} | 操作: {process_in.action}")
    
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record or record.status != BorrowStatus.RETURN_PENDING:
        logger.warning(f"⚠️ [CRUD] 处理还书请求失败: 记录状态不是RETURN_PENDING | 记录 ID: {record_id}")
        return None

    try:
        if process_in.action == "approve":
            book = db.query(Book).filter(Book.id == record.book_id).with_for_update().first()
            book.available_copies += 1
            record.status = BorrowStatus.RETURNED
            record.actual_return_date = datetime.utcnow()
            record.librarian_notes = process_in.notes

            # 自动分配给最早预约者（如果有）
            auto_assigned_records = assign_reservations_if_available(
                db,
                book,
                reason="AUTO_ASSIGNED_AFTER_RETURN"
            )
            db.add(book)
            db.add(record)
            db.commit()
            if auto_assigned_records:
                logger.info(
                    f"✅ [CRUD] 还书请求已批准并自动分配预约 | 还书记录 ID: {record_id} | 书籍: {book.title} | "
                    f"分配数量: {len(auto_assigned_records)} | 当前库存: {book.available_copies}"
                )
            else:
                logger.info(f"✅ [CRUD] 还书请求已批准 | 记录 ID: {record_id} | 书籍: {book.title} | 库存已增加 | 当前库存: {book.available_copies}")
        elif process_in.action == "reject":
            record.status = BorrowStatus.APPROVED
            record.return_request_date = None
            record.librarian_notes = process_in.notes
            db.add(record)
            db.commit()
            logger.info(f"✅ [CRUD] 还书请求已拒绝 | 记录 ID: {record_id} | 用户需重新提交还书请求")
        else:
            logger.error(f"❌ [CRUD] 处理还书请求失败: 无效的操作 | 操作: {process_in.action}")
            return None
    except Exception as e:
        logger.error(f"❌ [CRUD] 处理还书请求异常 | 记录 ID: {record_id} | 错误: {str(e)}")
        db.rollback()
        raise

    db.refresh(record)
    return record