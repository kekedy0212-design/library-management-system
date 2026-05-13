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


def _normalize_isbn(isbn: str | None) -> str:
    return str(isbn or "").replace("-", "").replace(" ", "").strip()


def _to_naive_utc(dt):
    """把带时区的 datetime 统一转成 naive UTC，避免与库内裸 datetime 比较时报错。

    - None 透传
    - tzinfo 为 None 时直接返回（视作 UTC）
    - tzinfo 不为 None 时按 UTC 偏移转成裸 datetime
    """
    if dt is None:
        return None
    tz = getattr(dt, "tzinfo", None)
    if tz is None:
        return dt
    try:
        from datetime import timezone

        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        return dt.replace(tzinfo=None)


def _parse_barcode_text(barcode: str | None):
    """解析条码文本，格式: ISBN/COPY_NUMBER"""
    if not barcode:
        return None, None

    parts = str(barcode).split("/")
    if len(parts) != 2:
        raise ValueError("Invalid barcode format. Expected ISBN/COPY_NUMBER")

    isbn = parts[0].strip()
    copy_number_text = parts[1].strip()
    if not isbn:
        raise ValueError("Invalid barcode: ISBN missing")
    if not copy_number_text.isdigit():
        raise ValueError("Invalid barcode: COPY_NUMBER must be a positive integer")

    return isbn, int(copy_number_text)


def _not_renew_request_filter():
    """过滤掉续借请求记录（__RENEW__），避免被当作真实在借记录。"""
    return or_(
        BorrowRecord.librarian_notes.is_(None),
        ~BorrowRecord.librarian_notes.like(f"{RENEW_NOTE_PREFIX}%"),
    )


def get_borrow_record(db: Session, record_id: int):
    result = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if result:
        logger.debug(
            f"📚 [CRUD] 获取借记录: ID: {record_id} | 状态: {result.status.value}"
        )
    return result


def get_pending_requests(db: Session):
    # 还书审批已恢复：PENDING（借/续借/预约）和 RETURN_PENDING（待还书审批）都进入馆员处理队列
    reconcile_reservations(db)
    results = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.status.in_(
                [BorrowStatus.PENDING, BorrowStatus.RETURN_PENDING]
            )
        )
        .all()
    )
    logger.debug(f"📋 [CRUD] 查询待处理请求 | 待处理数: {len(results)}")
    return results


def get_user_borrow_history(db: Session, user_id: int):
    # 补偿机制：查询前先自动分配预约队列，保证读者看到的是最新状态
    reconcile_reservations(db)
    results = db.query(BorrowRecord).filter(BorrowRecord.user_id == user_id).all()
    logger.debug(
        f"📚 [CRUD] 查询用户借书历史 | 用户 ID: {user_id} | 记录数: {len(results)}"
    )
    return results


def user_has_active_borrows(db: Session, user_id: int) -> bool:
    """判断用户是否有正在借阅的书籍。

    视为正在借阅的记录包括：`APPROVED`（已借出，未归还）和 `RETURN_PENDING`（待归还处理中）。
    过滤掉续借和预约类的伪记录。
    """
    from app.models.borrow import BorrowStatus

    reconcile_reservations(db)

    record = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.user_id == user_id,
            BorrowRecord.status.in_(
                [BorrowStatus.APPROVED, BorrowStatus.RETURN_PENDING]
            ),
            _not_renew_request_filter(),
        )
        .first()
    )
    return bool(record)


def get_all_borrow_records(db: Session):
    """馆员查看全量借阅记录（含借阅/预约/续借/归还历史）"""
    reconcile_reservations(db)
    results = (
        db.query(BorrowRecord)
        .order_by(BorrowRecord.request_date.desc(), BorrowRecord.id.desc())
        .all()
    )
    logger.debug(f"📚 [CRUD] 查询全量借阅记录 | 记录数: {len(results)}")
    return results


def create_borrow_request(db: Session, user_id: int, request_in: BorrowRequestCreate):
    """创建借书请求。

    校验失败时抛出 `ValueError`，端点会将其转为 HTTP 400 并把具体原因
    透传给前端；只有数据库提交异常等系统级错误才会回滚后返回 `None`。
    """
    from app.models.copy import BookCopy, CopyStatus

    logger.debug(
        f"📤 [CRUD] 开始创建借书请求 | 用户 ID: {user_id} "
        f"| 书籍 ID: {request_in.book_id} "
        f"| 副本 ID: {request_in.copy_id}"
    )

    # 0. 先做一次轻量自愈：清理孤儿 BORROWED 副本（任何用户都借不到的副本）
    #    历史拒绝 / 异常中断可能留下副本仍是 BORROWED 但没活跃借阅记录的脏数据。
    try:
        reconcile_orphan_borrowed_copies(db, book_id=request_in.book_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            f"⚠️ [CRUD] 孤儿副本自愈失败（不影响主流程） | 错误: {exc}"
        )
        db.rollback()

    # 1. 检查书籍是否存在
    book = db.query(Book).filter(Book.id == request_in.book_id).first()

    if not book:
        logger.warning(
            f"⚠️ [CRUD] 借书请求失败: 书籍不存在 | " f"书籍 ID: {request_in.book_id}"
        )
        raise ValueError("Book not found")

    # 2. 检查用户是否已有未归还记录，并给出具体原因
    existing = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.user_id == user_id,
            BorrowRecord.book_id == request_in.book_id,
            BorrowRecord.status.in_(
                [
                    BorrowStatus.APPROVED,
                    BorrowStatus.PENDING,
                    BorrowStatus.RETURN_PENDING,
                ]
            ),
            _not_renew_request_filter(),
        )
        .first()
    )

    if existing:
        logger.warning(
            f"⚠️ [CRUD] 借书请求失败: 用户已有该书籍未归还记录 "
            f"| 用户 ID: {user_id} "
            f"| 书籍: {book.title} "
            f"| 现状态: {existing.status.value}"
        )
        if existing.status == BorrowStatus.RETURN_PENDING:
            raise ValueError(
                f'A return request for "{book.title}" is awaiting librarian '
                "approval. Please wait for the librarian to process it before "
                "borrowing this book again."
            )
        if existing.status == BorrowStatus.PENDING:
            raise ValueError(
                f'You already have a pending borrow request for "{book.title}". '
                "Please wait for librarian approval."
            )
        # APPROVED
        raise ValueError(
            f'You have already borrowed "{book.title}" and have not returned '
            "it yet."
        )

    # 3. 解析副本：支持三种入参
    #    - copy_id：数据库主键
    #    - barcode_number：扫码得到的副本编号（按 book_id 限定）
    #    - 都没传：自动挑一个可用副本（兼容"快速借阅"按钮）
    copy = None
    if request_in.copy_id is not None:
        copy = (
            db.query(BookCopy)
            .filter(BookCopy.id == request_in.copy_id)
            .with_for_update()
            .first()
        )
        if copy and copy.book_id != request_in.book_id:
            logger.warning(
                f"⚠️ [CRUD] 借书请求失败: 副本不属于该书 "
                f"| 副本 ID: {copy.id} "
                f"| 副本书籍 ID: {copy.book_id} "
                f"| 请求书籍 ID: {request_in.book_id}"
            )
            raise ValueError(
                "The scanned copy does not belong to this book."
            )
    elif request_in.barcode_number is not None:
        copy = (
            db.query(BookCopy)
            .filter(
                BookCopy.book_id == request_in.book_id,
                BookCopy.barcode_number == request_in.barcode_number,
            )
            .with_for_update()
            .first()
        )
    else:
        copy = (
            db.query(BookCopy)
            .filter(
                BookCopy.book_id == request_in.book_id,
                BookCopy.status == CopyStatus.AVAILABLE,
            )
            .with_for_update()
            .first()
        )

    if not copy:
        logger.warning(
            f"⚠️ [CRUD] 借书请求失败: 找不到可用副本 "
            f"| 书籍 ID: {request_in.book_id} "
            f"| copy_id: {request_in.copy_id} "
            f"| barcode_number: {request_in.barcode_number}"
        )
        if request_in.copy_id is not None or request_in.barcode_number is not None:
            raise ValueError(
                "The specified copy was not found for this book."
            )
        raise ValueError(
            f'No available copies of "{book.title}" at the moment. '
            "You may reserve it instead."
        )

    # 5. 检查副本状态
    if copy.status != CopyStatus.AVAILABLE:
        logger.warning(
            f"⚠️ [CRUD] 借书请求失败: 副本不可借 "
            f"| 副本 ID: {copy.id} "
            f"| 当前状态: {copy.status}"
        )
        status_label = (
            getattr(copy.status, "value", str(copy.status)) or "unavailable"
        )
        raise ValueError(
            f"Copy #{copy.barcode_number} is currently {status_label} and "
            "cannot be borrowed."
        )

    # 6. 更新副本状态
    copy.status = CopyStatus.BORROWED

    # 7. 更新可借数量
    if book.available_copies > 0:
        book.available_copies -= 1

    # 8. 创建借阅记录
    db_record = BorrowRecord(
        user_id=user_id,
        book_id=request_in.book_id,
        copy_id=copy.id,
        status=BorrowStatus.PENDING,
        request_date=datetime.utcnow(),
        due_date=_to_naive_utc(request_in.requested_due_date),
    )

    db.add(copy)
    db.add(book)
    db.add(db_record)

    try:
        db.commit()
        db.refresh(db_record)

        logger.info(
            f"✅ [CRUD] 借书请求已创建 "
            f"| 记录 ID: {db_record.id} "
            f"| 用户 ID: {user_id} "
            f"| 书籍: {book.title} "
            f"| 副本号: {copy.barcode_number}"
        )

        return db_record

    except Exception as e:
        db.rollback()

        logger.error(
            f"❌ [CRUD] 借书请求创建失败 " f"| 用户 ID: {user_id} " f"| 错误: {str(e)}"
        )

        return None


def create_reserve_request(db: Session, user_id: int, request_in: BorrowRequestCreate):
    """创建预约请求（无库存时）"""
    logger.debug(
        f"📌 [CRUD] 开始创建预约请求 | 用户 ID: {user_id} | 书籍 ID: {request_in.book_id}"
    )

    book = db.query(Book).filter(Book.id == request_in.book_id).first()
    if not book:
        logger.warning(
            f"⚠️ [CRUD] 预约请求失败: 书籍不存在 | 书籍 ID: {request_in.book_id}"
        )
        return None

    if book.available_copies > 0:
        logger.warning(
            f"⚠️ [CRUD] 预约请求失败: 该书当前可借，无需预约 | 书籍: {book.title}"
        )
        return None

    existing = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.user_id == user_id,
            BorrowRecord.book_id == request_in.book_id,
            BorrowRecord.status.in_(
                [
                    BorrowStatus.APPROVED,
                    BorrowStatus.PENDING,
                    BorrowStatus.RETURN_PENDING,
                ]
            ),
            _not_renew_request_filter(),
        )
        .first()
    )
    if existing:
        logger.warning(
            f"⚠️ [CRUD] 预约请求失败: 用户已有该书籍相关未结束记录 | 用户 ID: {user_id} | 书籍: {book.title}"
        )
        return None

    # 预约时不需要关联copy_id，因为副本在批准时才分配
    db_record = BorrowRecord(
        user_id=user_id,
        book_id=request_in.book_id,
        copy_id=None,  # 预约时暂无具体副本
        status=BorrowStatus.PENDING,
        request_date=datetime.utcnow(),
        librarian_notes=RESERVE_NOTE_FLAG,
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    logger.info(
        f"✅ [CRUD] 预约请求已创建 | 记录 ID: {db_record.id} | 用户 ID: {user_id} | 书籍: {book.title}"
    )
    return db_record


def create_return_request(
    db: Session,
    user_id: int,
    record_id: int,
    copy_id: int | None = None,
    isbn: str | None = None,
    barcode_number: int | None = None,
    barcode: str | None = None,
):
    """提交还书请求（需要图书管理员审批）。

    校验通过后只把记录置为 `RETURN_PENDING` 并记下提交时间。
    副本状态、`available_copies`、预约队列自动分配全部留给
    `process_return_request` 在馆员批准时统一执行。
    """
    from app.models.copy import BookCopy as _BookCopy

    logger.debug(
        f"📥 [CRUD] 开始提交还书请求 | 用户 ID: {user_id} | 记录 ID: {record_id}"
    )

    record = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.id == record_id,
            BorrowRecord.user_id == user_id,
            BorrowRecord.status.in_(
                [BorrowStatus.APPROVED, BorrowStatus.RETURN_PENDING]
            ),
            _not_renew_request_filter(),
        )
        .first()
    )
    if not record:
        logger.warning(
            f"⚠️ [CRUD] 还书请求失败: 记录不存在或状态不可还书 | 记录 ID: {record_id}"
        )
        return None

    # 已经在等馆员审批了，幂等返回即可。
    if record.status == BorrowStatus.RETURN_PENDING:
        logger.info(
            f"ℹ️ [CRUD] 还书请求已存在 | 记录 ID: {record_id} | 状态: RETURN_PENDING"
        )
        return record

    # 二次一致性校验：后端独立校验，接受三种输入方式：
    # 1) 前端提供内部 copy_id（BookCopy.id）
    # 2) 前端提供 barcode_number（副本号）和/或 barcode（ISBN/COPY_NUMBER）
    # 3) 两者都提供时会交叉校验
    parsed_isbn, parsed_barcode_number = _parse_barcode_text(barcode)
    expected_isbn = parsed_isbn or isbn
    expected_barcode_number = (
        parsed_barcode_number if parsed_barcode_number is not None else barcode_number
    )

    if copy_id is None:
        if expected_barcode_number is None:
            raise ValueError(
                "copy_id or barcode/barcode_number is required for return request"
            )
        found_copy = (
            db.query(_BookCopy)
            .filter(
                _BookCopy.book_id == record.book_id,
                _BookCopy.barcode_number == expected_barcode_number,
            )
            .first()
        )
        if not found_copy:
            raise ValueError(
                "Copy consistency check failed: barcode number does not match any copy for this book"
            )
        copy_id = found_copy.id

    if record.copy_id is None or record.copy_id != copy_id:
        raise ValueError(
            "Copy consistency check failed: provided copy does not match borrow record"
        )

    copy = db.query(_BookCopy).filter(_BookCopy.id == record.copy_id).first()
    if not copy:
        raise ValueError(
            "Copy consistency check failed: borrow record references a missing copy"
        )

    if (
        expected_barcode_number is not None
        and copy.barcode_number != expected_barcode_number
    ):
        raise ValueError(
            "Copy consistency check failed: barcode number does not match borrow record"
        )

    if expected_isbn:
        book = db.query(Book).filter(Book.id == record.book_id).first()
        if not book:
            raise ValueError(
                "Copy consistency check failed: borrow record references a missing book"
            )
        if _normalize_isbn(book.isbn) != _normalize_isbn(expected_isbn):
            raise ValueError(
                "Copy consistency check failed: ISBN does not match borrow record"
            )

    try:
        record.return_request_date = datetime.utcnow()
        record.status = BorrowStatus.RETURN_PENDING
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.info(
            f"✅ [CRUD] 还书请求已提交 | 记录 ID: {record_id} | 用户 ID: {user_id} | 等待管理员审批"
        )
    except Exception as e:
        logger.error(
            f"❌ [CRUD] 提交还书请求异常 | 记录 ID: {record_id} | 错误: {str(e)}"
        )
        db.rollback()
        raise

    return record


def reconcile_legacy_return_pending(db: Session):
    """
    将历史 RETURN_PENDING（旧“需管理员审批还书”流程）补偿为 RETURNED。
    仅在首次补偿时回补库存，避免重复累加。
    """
    legacy_records = (
        db.query(BorrowRecord)
        .filter(BorrowRecord.status == BorrowStatus.RETURN_PENDING)
        .all()
    )

    if not legacy_records:
        return 0

    reconciled_count = 0
    for record in legacy_records:
        book = (
            db.query(Book).filter(Book.id == record.book_id).with_for_update().first()
        )
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
            db, book, reason="AUTO_ASSIGNED_AFTER_LEGACY_RETURN_RECONCILE"
        )

    if reconciled_count > 0:
        db.commit()
        logger.info(f"🔄 [CRUD] 历史还书补偿完成 | 记录数: {reconciled_count}")

    return reconciled_count


def create_renew_request(db: Session, user_id: int, request_in: RenewRequestCreate):
    """创建续借请求（对已借出的记录）"""
    logger.debug(
        f"🔁 [CRUD] 开始创建续借请求 | 用户 ID: {user_id} | 原借阅记录 ID: {request_in.borrow_record_id}"
    )

    origin = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.id == request_in.borrow_record_id,
            BorrowRecord.user_id == user_id,
            BorrowRecord.status == BorrowStatus.APPROVED,
        )
        .first()
    )
    if not origin:
        logger.warning(
            f"⚠️ [CRUD] 续借请求失败: 原记录不存在或状态不是APPROVED | 记录 ID: {request_in.borrow_record_id}"
        )
        return None

    existing_pending_renew = (
        db.query(BorrowRecord)
        .filter(
            BorrowRecord.user_id == user_id,
            BorrowRecord.book_id == origin.book_id,
            BorrowRecord.status == BorrowStatus.PENDING,
            BorrowRecord.librarian_notes.like(
                f"{RENEW_NOTE_PREFIX}{request_in.borrow_record_id}%"
            ),
        )
        .first()
    )
    if existing_pending_renew:
        logger.warning(
            f"⚠️ [CRUD] 续借请求失败: 已有待处理续借请求 | 原记录 ID: {request_in.borrow_record_id}"
        )
        return None

    requested_due = _to_naive_utc(request_in.requested_due_date)
    if requested_due:
        base_due = (
            origin.due_date
            if origin.due_date and origin.due_date > datetime.utcnow()
            else datetime.utcnow()
        )
        if requested_due <= base_due:
            logger.warning(
                f"⚠️ [CRUD] 续借请求失败: 期望日期不晚于当前到期日 | 原记录 ID: {request_in.borrow_record_id} | "
                f"当前到期: {base_due} | 期望到期: {requested_due}"
            )
            return None

    renew_record = BorrowRecord(
        user_id=user_id,
        book_id=origin.book_id,
        copy_id=origin.copy_id,  # 续借时保持相同的副本
        status=BorrowStatus.PENDING,
        request_date=datetime.utcnow(),
        due_date=requested_due,
        librarian_notes=f"{RENEW_NOTE_PREFIX}{request_in.borrow_record_id}",
    )
    db.add(renew_record)
    db.commit()
    db.refresh(renew_record)
    logger.info(
        f"✅ [CRUD] 续借请求已创建 | 请求记录 ID: {renew_record.id} | 原记录 ID: {request_in.borrow_record_id}"
    )
    return renew_record


def is_renew_request(record: BorrowRecord) -> bool:
    return bool(
        record.librarian_notes and record.librarian_notes.startswith(RENEW_NOTE_PREFIX)
    )


def is_reserve_request(record: BorrowRecord) -> bool:
    return bool(
        record.librarian_notes and record.librarian_notes.startswith(RESERVE_NOTE_FLAG)
    )


def assign_reservations_if_available(db: Session, book: Book, reason: str):
    """
    若该书有可用库存，则按先到先得自动分配给预约队列。
    返回被自动分配的预约记录列表。
    """
    from app.crud import crud_copy
    from app.models.copy import CopyStatus

    assigned_records = []
    while book.available_copies > 0:
        next_reservation = (
            db.query(BorrowRecord)
            .filter(
                BorrowRecord.book_id == book.id,
                BorrowRecord.status == BorrowStatus.PENDING,
                BorrowRecord.librarian_notes.like(f"{RESERVE_NOTE_FLAG}%"),
            )
            .order_by(BorrowRecord.request_date.asc(), BorrowRecord.id.asc())
            .first()
        )

        if not next_reservation:
            break

        # 为预约分配可用副本
        available_copy = crud_copy.get_book_available_copy(db, book.id)
        if not available_copy:
            logger.warning(f"⚠️ [CRUD] 自动分配失败: 无可用副本 | 书籍 ID: {book.id}")
            break

        # 更新副本状态为已借出
        available_copy.status = CopyStatus.BORROWED
        db.add(available_copy)

        # 自动分配会立即消耗一个可用副本，保证库存一致性
        book.available_copies -= 1
        now = datetime.utcnow()
        next_reservation.status = BorrowStatus.APPROVED
        next_reservation.approve_date = now
        next_reservation.due_date = now + timedelta(days=14)
        next_reservation.copy_id = available_copy.id
        next_reservation.librarian_notes = f"{RESERVE_NOTE_FLAG}|{reason}"
        db.add(book)
        db.add(next_reservation)
        assigned_records.append(next_reservation)
        logger.debug(
            f"🔄 [CRUD] 自动分配预约 | 预约ID: {next_reservation.id} | 副本ID: {available_copy.id} | 副本号: {available_copy.barcode_number}"
        )

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
            db, book, reason="AUTO_ASSIGNED_RECONCILE"
        )
        if assigned:
            total_assigned += len(assigned)

    if total_assigned > 0:
        db.commit()
        logger.info(f"🔄 [CRUD] 补偿分配完成 | 自动分配预约数量: {total_assigned}")
    return total_assigned


def reconcile_orphan_borrowed_copies(db: Session, book_id: int | None = None) -> int:
    """检测并修复"孤儿 BORROWED 副本"。

    "孤儿"指：`BookCopy.status == BORROWED`，但数据库里没有任何
    `APPROVED` / `RETURN_PENDING` / 活跃 `PENDING` 借阅记录指向它。

    这种状态的副本任何用户都借不到（会撞到副本状态校验），同时也不属于
    任何用户的借阅历史。本函数会把它们恢复为 AVAILABLE，并以"实际可借
    副本数"重算 `book.available_copies`，避免数据继续漂移。

    出现成因：历史版本的拒绝 / 还书流程没有同步副本状态，或异常中断
    导致 commit 不完整。

    `book_id` 不传则全库扫描；传了就只修复指定书籍，开销可忽略，所以
    安全地放进借书入口做轻量自愈。
    """
    from app.models.copy import BookCopy, CopyStatus

    active_statuses = [
        BorrowStatus.PENDING,
        BorrowStatus.APPROVED,
        BorrowStatus.RETURN_PENDING,
    ]

    active_copy_ids_q = (
        db.query(BorrowRecord.copy_id)
        .filter(
            BorrowRecord.copy_id.isnot(None),
            BorrowRecord.status.in_(active_statuses),
        )
    )

    orphan_q = (
        db.query(BookCopy)
        .filter(
            BookCopy.status == CopyStatus.BORROWED,
            ~BookCopy.id.in_(active_copy_ids_q),
        )
    )
    if book_id is not None:
        orphan_q = orphan_q.filter(BookCopy.book_id == book_id)

    orphans = orphan_q.all()
    if not orphans:
        return 0

    affected_book_ids = {copy.book_id for copy in orphans}

    for copy in orphans:
        logger.warning(
            f"🩹 [CRUD] 检测到孤儿 BORROWED 副本，自动修复 | "
            f"副本 ID: {copy.id} | 副本号: {copy.barcode_number} | "
            f"所属书籍 ID: {copy.book_id}"
        )
        copy.status = CopyStatus.AVAILABLE
        db.add(copy)

    # 重算受影响书籍的 available_copies，避免之前的漂移继续存在
    for bid in affected_book_ids:
        book = (
            db.query(Book)
            .filter(Book.id == bid)
            .with_for_update()
            .first()
        )
        if not book:
            continue
        actual_available = (
            db.query(BookCopy)
            .filter(
                BookCopy.book_id == bid,
                BookCopy.status == CopyStatus.AVAILABLE,
            )
            .count()
        )
        if book.available_copies != actual_available:
            logger.warning(
                f"🩹 [CRUD] 修正 available_copies 漂移 | 书籍 ID: {bid} | "
                f"原值: {book.available_copies} → 实际可借: {actual_available}"
            )
            book.available_copies = actual_available
            db.add(book)

    db.commit()
    logger.info(
        f"✅ [CRUD] 孤儿副本修复完成 | 修复副本数: {len(orphans)} | "
        f"涉及书籍数: {len(affected_book_ids)}"
    )
    return len(orphans)


def process_borrow_request(db: Session, record_id: int, process_in: RequestProcess):
    """处理借书请求（批准或拒绝）"""
    from app.crud import crud_copy
    from app.models.copy import CopyStatus

    logger.info(
        f"⚙️ [CRUD] 开始处理借书请求 | 记录 ID: {record_id} | 操作: {process_in.action}"
    )

    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record or record.status != BorrowStatus.PENDING:
        logger.warning(
            f"⚠️ [CRUD] 处理借书请求失败: 记录状态不是PENDING | 记录 ID: {record_id}"
        )
        return None

    try:
        if process_in.action == "approve":
            # 加行锁防止并发超借
            book = (
                db.query(Book)
                .filter(Book.id == record.book_id)
                .with_for_update()
                .first()
            )
            if book.available_copies <= 0:
                if is_reserve_request(record):
                    logger.warning(
                        f"⚠️ [CRUD] 预约审批暂不可通过: 当前无库存 | 书籍: {book.title} | 可用数: {book.available_copies}"
                    )
                    return None
                record.status = BorrowStatus.REJECTED
                record.librarian_notes = "库存不足"
                db.add(record)
                db.commit()
                logger.warning(
                    f"❌ [CRUD] 借书请求被拒: 库存不足 | 书籍: {book.title} | 可用数: {book.available_copies}"
                )
                return record

            # 为预约分配副本（普通借书已在create_borrow_request中分配）
            inventory_decremented = False
            if record.copy_id is None:
                available_copy = crud_copy.get_book_available_copy(db, record.book_id)
                if not available_copy:
                    logger.warning(
                        f"⚠️ [CRUD] 预约审批失败: 无可用副本 | 书籍: {book.title}"
                    )
                    return None
                record.copy_id = available_copy.id
                book.available_copies -= 1
                inventory_decremented = True

            from app.models.copy import BookCopy

            copy = db.query(BookCopy).filter(BookCopy.id == record.copy_id).first()
            if not copy:
                logger.warning(
                    f"⚠️ [CRUD] 借书审批失败: 副本不存在 | 副本ID: {record.copy_id}"
                )
                return None

            if copy.status == CopyStatus.AVAILABLE:
                copy.status = CopyStatus.BORROWED
                db.add(copy)
                logger.debug(
                    f"🔄 [CRUD] 副本状态更新为已借出 | 副本ID: {record.copy_id} | 副本号: {copy.barcode_number}"
                )
                if not inventory_decremented:
                    book.available_copies -= 1
            elif copy.status != CopyStatus.BORROWED:
                copy.status = CopyStatus.BORROWED
                db.add(copy)
                logger.debug(
                    f"🔄 [CRUD] 副本状态修正为已借出 | 副本ID: {record.copy_id} | 副本号: {copy.barcode_number}"
                )

            now = datetime.utcnow()
            due_date = (
                record.due_date
                if record.due_date and record.due_date > now
                else now + timedelta(days=14)
            )
            record.status = BorrowStatus.APPROVED
            record.approve_date = now
            record.due_date = due_date
            record.librarian_notes = process_in.notes
            db.add(book)
            db.add(record)
            db.commit()
            logger.info(
                f"✅ [CRUD] 借书请求已批准 | 记录 ID: {record_id} | 书籍: {book.title} | 副本ID: {record.copy_id} | 剩余库存: {book.available_copies}"
            )
        elif process_in.action == "reject":
            if record.copy_id:
                from app.models.copy import BookCopy

                copy = db.query(BookCopy).filter(BookCopy.id == record.copy_id).first()
                if copy and copy.status == CopyStatus.BORROWED:
                    copy.status = CopyStatus.AVAILABLE
                    db.add(copy)
                    book = (
                        db.query(Book)
                        .filter(Book.id == record.book_id)
                        .with_for_update()
                        .first()
                    )
                    if book:
                        book.available_copies += 1
                        db.add(book)
            record.status = BorrowStatus.REJECTED
            record.librarian_notes = process_in.notes
            db.add(record)
            db.commit()
            logger.info(
                f"✅ [CRUD] 借书请求已拒绝 | 记录 ID: {record_id} | 备注: {process_in.notes}"
            )
        else:
            logger.error(
                f"❌ [CRUD] 处理借书请求失败: 无效的操作 | 操作: {process_in.action}"
            )
            return None
    except Exception as e:
        logger.error(
            f"❌ [CRUD] 处理借书请求异常 | 记录 ID: {record_id} | 错误: {str(e)}"
        )
        db.rollback()
        raise

    db.refresh(record)
    return record


def process_renew_request(db: Session, request_id: int, process_in: RequestProcess):
    """处理续借请求（批准或拒绝）"""
    logger.info(
        f"⚙️ [CRUD] 开始处理续借请求 | 请求记录 ID: {request_id} | 操作: {process_in.action}"
    )

    request_record = (
        db.query(BorrowRecord).filter(BorrowRecord.id == request_id).first()
    )
    if (
        not request_record
        or request_record.status != BorrowStatus.PENDING
        or not is_renew_request(request_record)
    ):
        logger.warning(
            f"⚠️ [CRUD] 处理续借请求失败: 请求记录非法 | 请求 ID: {request_id}"
        )
        return None

    try:
        origin_id = int(
            request_record.librarian_notes.replace(RENEW_NOTE_PREFIX, "").split("|")[0]
        )
        origin = db.query(BorrowRecord).filter(BorrowRecord.id == origin_id).first()
        if not origin or origin.status != BorrowStatus.APPROVED:
            logger.warning(
                f"⚠️ [CRUD] 处理续借请求失败: 原借阅记录不可续借 | 原记录 ID: {origin_id}"
            )
            request_record.status = BorrowStatus.REJECTED
            request_record.librarian_notes = (
                f"{RENEW_NOTE_PREFIX}{origin_id}|invalid_origin"
            )
            db.add(request_record)
            db.commit()
            db.refresh(request_record)
            return request_record

        if process_in.action == "approve":
            now = datetime.utcnow()
            base_due = (
                origin.due_date if origin.due_date and origin.due_date > now else now
            )
            preferred_due = request_record.due_date
            if preferred_due and preferred_due > base_due:
                origin.due_date = preferred_due
            elif preferred_due and preferred_due <= base_due:
                request_record.status = BorrowStatus.REJECTED
                request_record.librarian_notes = (
                    f"{RENEW_NOTE_PREFIX}{origin_id}|invalid_preferred_due"
                )
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
            request_record.librarian_notes = (
                f"{RENEW_NOTE_PREFIX}{origin_id}|approved|{process_in.notes or ''}"
            )
            db.add(origin)
            db.add(request_record)
            db.commit()
            logger.info(
                f"✅ [CRUD] 续借请求已批准 | 原记录 ID: {origin_id} | 新到期时间: {origin.due_date}"
            )
        elif process_in.action == "reject":
            request_record.status = BorrowStatus.REJECTED
            request_record.librarian_notes = (
                f"{RENEW_NOTE_PREFIX}{origin_id}|rejected|{process_in.notes or ''}"
            )
            db.add(request_record)
            db.commit()
            logger.info(f"✅ [CRUD] 续借请求已拒绝 | 原记录 ID: {origin_id}")
        else:
            logger.error(
                f"❌ [CRUD] 处理续借请求失败: 无效操作 | 操作: {process_in.action}"
            )
            return None
    except Exception as e:
        logger.error(
            f"❌ [CRUD] 处理续借请求异常 | 请求 ID: {request_id} | 错误: {str(e)}"
        )
        db.rollback()
        raise

    db.refresh(request_record)
    return request_record


def process_return_request(db: Session, record_id: int, process_in: RequestProcess):
    """处理还书请求（批准或拒绝）"""
    from app.models.copy import BookCopy, CopyStatus

    logger.info(
        f"⚙️ [CRUD] 开始处理还书请求 | 记录 ID: {record_id} | 操作: {process_in.action}"
    )

    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record or record.status != BorrowStatus.RETURN_PENDING:
        logger.warning(
            f"⚠️ [CRUD] 处理还书请求失败: 记录状态不是RETURN_PENDING | 记录 ID: {record_id}"
        )
        return None

    try:
        if process_in.action == "approve":
            book = (
                db.query(Book)
                .filter(Book.id == record.book_id)
                .with_for_update()
                .first()
            )

            # 更新副本状态为可用
            if record.copy_id:
                copy = db.query(BookCopy).filter(BookCopy.id == record.copy_id).first()
                if copy:
                    copy.status = CopyStatus.AVAILABLE
                    db.add(copy)
                    logger.debug(
                        f"🔄 [CRUD] 副本状态更新为可用 | 副本ID: {record.copy_id} | 副本号: {copy.barcode_number}"
                    )

            book.available_copies += 1
            record.status = BorrowStatus.RETURNED
            record.actual_return_date = datetime.utcnow()
            record.librarian_notes = process_in.notes

            # 自动分配给最早预约者（如果有）
            auto_assigned_records = assign_reservations_if_available(
                db, book, reason="AUTO_ASSIGNED_AFTER_RETURN"
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
                logger.info(
                    f"✅ [CRUD] 还书请求已批准 | 记录 ID: {record_id} | 书籍: {book.title} | 库存已增加 | 当前库存: {book.available_copies}"
                )
        elif process_in.action == "reject":
            record.status = BorrowStatus.APPROVED
            record.return_request_date = None
            record.librarian_notes = process_in.notes
            db.add(record)
            db.commit()
            logger.info(
                f"✅ [CRUD] 还书请求已拒绝 | 记录 ID: {record_id} | 用户需重新提交还书请求"
            )
        else:
            logger.error(
                f"❌ [CRUD] 处理还书请求失败: 无效的操作 | 操作: {process_in.action}"
            )
            return None
    except Exception as e:
        logger.error(
            f"❌ [CRUD] 处理还书请求异常 | 记录 ID: {record_id} | 错误: {str(e)}"
        )
        db.rollback()
        raise

    db.refresh(record)
    return record
