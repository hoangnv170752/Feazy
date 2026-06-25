from fastapi import APIRouter, status
from fastapi.responses import ORJSONResponse

from app.core.config import settings

router = APIRouter()


@router.get("", status_code=status.HTTP_200_OK)
async def health_check() -> ORJSONResponse:
    return ORJSONResponse(
        {
            "status": "ok",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
        }
    )
