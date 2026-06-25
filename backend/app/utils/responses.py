from typing import Any

from fastapi.responses import ORJSONResponse


def success_response(data: Any, status_code: int = 200) -> ORJSONResponse:
    return ORJSONResponse(
        content={"success": True, "data": data},
        status_code=status_code,
    )


def error_response(detail: str, status_code: int = 400) -> ORJSONResponse:
    return ORJSONResponse(
        content={"success": False, "detail": detail},
        status_code=status_code,
    )
