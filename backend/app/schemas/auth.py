import uuid

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    department: str
    password: str
    role: UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


class UserResponse(BaseModel):
    user_id: uuid.UUID
    name: str
    email: EmailStr
    department: str
    role: UserRole

    model_config = {"from_attributes": True}
