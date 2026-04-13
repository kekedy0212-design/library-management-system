from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from app.models.user import UserRole

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None

class UserInDB(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

class UserPasswordReset(BaseModel):
    new_password: str

class UserPublic(UserBase):
    id: int
    role: UserRole
    is_active: bool
    model_config = ConfigDict(from_attributes=True)