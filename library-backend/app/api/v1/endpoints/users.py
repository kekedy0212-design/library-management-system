from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.user import UserPublic, UserUpdate, UserPasswordReset
from app.crud import crud_user
from app.api.deps import get_current_librarian, get_current_admin, check_permission_hierarchy
from app.models.user import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/", response_model=List[UserPublic])
def read_users(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_librarian)
):
    """获取用户列表"""
    logger.debug(f"👥 [用户列表] 用户 '{current_user.username}' 查询用户列表 | 分页: skip={skip}, limit={limit}")
    users = crud_user.get_users(db, skip=skip, limit=limit)
    logger.debug(f"✅ [用户列表] 返回 {len(users)} 个用户")
    return users

@router.put("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)  # 允许 librarian 和 admin
):
    """更新用户信息"""
    logger.info(f"✏️ [用户更新] 操作人 '{current_user.username}' (角色: {current_user.role.value}) 开始更新用户 | 用户 ID: {user_id}")
    
    user = crud_user.get_user(db, user_id)
    if not user:
        logger.warning(f"⚠️ [用户更新失败] 用户未找到 | ID: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    # 禁止修改自己的角色
    if user.id == current_user.id and user_in.role is not None:
        logger.warning(f"❌ [用户更新失败] 用户 '{current_user.username}' 尝试修改自己的角色")
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    # 检查权限：如果要修改 is_active 或 role，需要权限检查
    if user_in.is_active is not None or user_in.role is not None:
        check_permission_hierarchy(current_user, user)

    old_role = user.role.value
    old_active = user.is_active

    user = crud_user.update_user(db, user, user_in)

    # 记录关键变更
    changes = []
    if user_in.role is not None and old_role != user.role.value:
        changes.append(f"角色: {old_role} → {user.role.value}")
        logger.info(f"⚠️ [角色变更] 用户 '{current_user.username}' 将用户 '{user.username}' 的角色从 '{old_role}' 修改为 '{user.role.value}'")
    
    if user_in.is_active is not None and old_active != user.is_active:
        action = "禁用" if not user.is_active else "启用"
        status_text = "已禁用" if not user.is_active else "已启用"
        changes.append(f"状态: {status_text}")
        logger.info(f"⚠️ [用户状态变更] 用户 '{current_user.username}' {action}了用户 '{user.username}' | 新状态: {status_text}")
    
    if changes:
        logger.info(f"✅ [用户更新成功] 用户 '{user.username}' (ID: {user.id}) 的信息已更新 | 修改项: {', '.join(changes)}")
    else:
        logger.debug(f"ℹ️ [用户更新] 用户 '{user.username}' 无实质性变更")

    return user

@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    password_in: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    """重置用户密码"""
    logger.info(f"🔑 [密码重置] 用户 '{current_user.username}' 开始重置密码 | 目标用户 ID: {user_id}")
    
    user = crud_user.get_user(db, user_id)
    if not user:
        logger.warning(f"⚠️ [密码重置失败] 用户未找到 | ID: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")
    
    # 检查权限：不能修改权限高于自己的用户的密码
    check_permission_hierarchy(current_user, user)
    
    from app.core.security import get_password_hash
    user.hashed_password = get_password_hash(password_in.new_password)
    db.commit()
    
    logger.info(f"✅ [密码重置成功] 用户 '{current_user.username}' 为用户 '{user.username}' (ID: {user.id}) 重置了密码")
    return {"msg": "Password reset successfully"}