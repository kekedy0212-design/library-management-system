from sqlalchemy.orm import Session
from app.models.user import User
from app.models.borrow import BorrowRecord, BorrowStatus
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash
import logging

logger = logging.getLogger(__name__)

def get_user_by_username(db: Session, username: str):
    result = db.query(User).filter(User.username == username).first()
    if result:
        logger.debug(f"👤 [CRUD] 按用户名查询: {username} -> ID: {result.id}, 角色: {result.role.value}")
    return result

def get_user_by_email(db: Session, email: str):
    result = db.query(User).filter(User.email == email).first()
    if result:
        logger.debug(f"📧 [CRUD] 按邮箱查询: {email} -> 用户: {result.username}")
    return result

def get_user(db: Session, user_id: int):
    result = db.query(User).filter(User.id == user_id).first()
    if result:
        logger.debug(f"👤 [CRUD] 获取用户: {result.username} (ID: {user_id})")
    return result

def get_users(db: Session, skip: int = 0, limit: int = 100):
    results = db.query(User).offset(skip).limit(limit).all()
    logger.debug(f"👥 [CRUD] 查询用户列表: skip={skip}, limit={limit} -> 返回 {len(results)} 个用户")
    return results

def create_user(db: Session, user_in: UserCreate):
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    logger.info(f"👤 [CRUD] 创建新用户 | 用户名: {db_user.username} | 邮箱: {db_user.email} | 角色: {db_user.role.value} | ID: {db_user.id}")
    return db_user

def update_user(db: Session, db_user: User, user_in: UserUpdate):
    old_data = {
        "username": db_user.username,
        "role": db_user.role.value,
        "is_active": db_user.is_active
    }
    
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    db.commit()
    db.refresh(db_user)
    
    # 记录修改内容
    changes = []
    if "role" in update_data:
        changes.append(f"角色: {old_data['role']} → {db_user.role.value}")
    if "is_active" in update_data:
        status = "启用" if db_user.is_active else "禁用"
        changes.append(f"状态: {status}")
    
    if changes:
        logger.info(f"✅ [CRUD] 更新用户成功 | 用户: {db_user.username} (ID: {db_user.id}) | 修改项: {' | '.join(changes)}")
    
    return db_user

def authenticate_user(db: Session, username: str, password: str):
    from app.core.security import verify_password
    user = get_user_by_username(db, username)
    if not user:
        logger.debug(f"🔐 [CRUD] 认证失败: 用户不存在 | 用户名: {username}")
        return None
    if not verify_password(password, user.hashed_password):
        logger.debug(f"🔐 [CRUD] 认证失败: 密码错误 | 用户名: {username}")
        return None
    logger.debug(f"✅ [CRUD] 用户认证成功 | 用户名: {username} | 角色: {user.role.value}")
    return user

def is_active(user: User) -> bool:
    return user.is_active

def get_active_borrow_count(db: Session, user_id: int) -> int:
    """
    统计用户当前“正在借阅中”的记录数量。
    不包含 PENDING（仅申请中）和 RETURNED/REJECTED（已结束）状态。
    """
    active_statuses = [
        BorrowStatus.APPROVED,
        BorrowStatus.OVERDUE,
        BorrowStatus.RETURN_PENDING
    ]
    return db.query(BorrowRecord).filter(
        BorrowRecord.user_id == user_id,
        BorrowRecord.status.in_(active_statuses)
    ).count()