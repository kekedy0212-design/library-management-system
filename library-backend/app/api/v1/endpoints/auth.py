from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.user import UserCreate, UserPublic
from app.schemas.token import Token
from app.crud import crud_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/register", response_model=UserPublic)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """用户注册端点"""
    logger.info(f"📝 [注册请求] 用户名: {user_in.username}, 邮箱: {user_in.email}")
    
    user = crud_user.get_user_by_username(db, user_in.username)
    if user:
        logger.warning(f"⚠️ [注册失败] 用户名已存在: {user_in.username}")
        raise HTTPException(status_code=400, detail="Username already registered")
    
    user = crud_user.get_user_by_email(db, user_in.email)
    if user:
        logger.warning(f"⚠️ [注册失败] 邮箱已存在: {user_in.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = crud_user.create_user(db, user_in)
    logger.info(f"✅ [注册成功] 新用户已创建 | 用户名: {user.username} | 邮箱: {user.email} | ID: {user.id}")
    return user

@router.post("/login")
def login(
    db: Annotated[Session, Depends(get_db)],
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """用户登录端点"""
    logger.info(f"🔐 [登录请求] 用户名: {form_data.username}")
    
    user = crud_user.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.warning(f"❌ [登录失败] 用户名或密码错误: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        logger.warning(f"⚠️ [登录失败] 用户被禁用: {user.username} (ID: {user.id})")
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role.value,
            "email": user.email,
            "is_active": user.is_active,
        },
        expires_delta=access_token_expires
    )
    logger.info(f"✅ [登录成功] 用户 '{user.username}' 成功登录 | 角色: {user.role.value} | ID: {user.id}")
    return Token(access_token=access_token)

@router.post("/logout")
def logout():
    """用户登出端点"""
    logger.debug("🚪 [登出] 用户已登出")
    return {"msg": "Successfully logged out"}