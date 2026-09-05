import hmac
import uuid

from fastapi import Depends, Header, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import create_access_token, decode_access_token
from app.models.user import User, UserRole
from app.services.auth import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user(
    response: Response,
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please log in again") from exc

    user = await get_user_by_id(db, uuid.UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    # Sliding-window session (FR1.4): reissue a fresh 30-minute token on every
    # authenticated request instead of tracking server-side session state. The
    # frontend must replace its stored token with this header's value on each response.
    response.headers["X-Refreshed-Token"] = create_access_token(subject=str(user.user_id), role=user.role.value)
    return user


def require_role(role: UserRole):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires {role.value} role")
        return user

    return _check


async def require_internal_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not x_internal_secret or not hmac.compare_digest(x_internal_secret, settings.internal_shared_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing internal secret")
