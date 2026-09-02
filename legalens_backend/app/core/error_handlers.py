from typing import cast

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.exceptions import InvalidEventPayloadError


async def invalid_event_payload_handler(
    request: Request,
    exc: Exception
):
    error = cast(InvalidEventPayloadError, exc)

    return JSONResponse(
        status_code=400,
        content={
            "error": "INVALID_EVENT_PAYLOAD",
            "message": str(error),
            "expected": error.expected,
            "received": error.received
        }
    )