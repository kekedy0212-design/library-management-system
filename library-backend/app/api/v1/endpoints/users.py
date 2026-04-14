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
    users = crud_user.get_users(db, skip=skip, limit=limit)
    return users

@router.put("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)  # 允许 librarian 和 admin
):
    user = crud_user.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 禁止修改自己的角色
    if user.id == current_user.id and user_in.role is not None:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    # 检查权限：如果要修改 is_active 或 role，需要权限检查
    if user_in.is_active is not None or user_in.role is not None:
        check_permission_hierarchy(current_user, user)

    old_role = user.role.value
    old_active = user.is_active

    user = crud_user.update_user(db, user, user_in)

    # 记录关键变更
    if user_in.role is not None and old_role != user.role.value:
        logger.warning(f"Admin '{current_user.username}' changed user '{user.username}' role from '{old_role}' to '{user.role.value}'")
    if user_in.is_active is not None and old_active != user.is_active:
        action = "disabled" if not user.is_active else "enabled"
        logger.warning(f"Admin '{current_user.username}' {action} user '{user.username}'")

    return user

@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    password_in: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_librarian)
):
    user = crud_user.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 检查权限：不能修改权限高于自己的用户的密码
    check_permission_hierarchy(current_user, user)
    
    from app.core.security import get_password_hash
    user.hashed_password = get_password_hash(password_in.new_password)
    db.commit()
    logger.warning(f"Librarian/Admin '{current_user.username}' reset password for user '{user.username}'")
    return {"msg": "Password reset successfully"}