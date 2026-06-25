from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedException
from app.core.security import decode_token
from app.db.session import get_db

DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException()
    token = authorization.removeprefix("Bearer ")
    payload = decode_token(token)
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise UnauthorizedException()
    return user_id


CurrentUserId = Annotated[str, Depends(get_current_user_id)]
