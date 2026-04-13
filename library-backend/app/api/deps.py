from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.schemas.token import TokenPayload
from app.models.user import User, UserRole
from app.crud.crud_user import get_user

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    print("\n=== DEBUG: get_current_user called ===")
    print(f"Token received: {token[:30]}...")
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        print(f"Decoded payload: sub={username}, role={payload.get('role')}")
        if username is None:
            print("!!! ERROR: Token missing 'sub' field !!!")
            raise credentials_exception
    except JWTError as e:
        print(f"!!! JWT decode error: {e} !!!")
        raise credentials_exception

    from app.crud.crud_user import get_user_by_username  # 确保使用正确的函数
    user = get_user_by_username(db, username)
    if user is None:
        print(f"!!! ERROR: User '{username}' not found in database !!!")
        raise credentials_exception
    if not user.is_active:
        print(f"!!! ERROR: User '{username}' is inactive !!!")
        raise HTTPException(status_code=400, detail="Inactive user")
    
    print(f">>> Authenticated user: {user.username} (role={user.role.value})")
    return user

def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_current_librarian(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    if current_user.role not in [UserRole.LIBRARIAN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Librarian or admin privileges required"
        )
    return current_user

def get_current_admin(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user