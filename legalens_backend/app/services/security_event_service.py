import uuid
from datetime import datetime

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.security_event import SecurityEvent


class SecurityEventService:

    @staticmethod
    def get_client_ip(
        request: Request,
    ) -> str | None:
        """
        Return the client IP seen by the FastAPI application.

        This intentionally uses request.client.host rather than blindly
        trusting forwarded headers. In production, X-Forwarded-For /
        X-Real-IP should only be trusted when the application is behind
        a configured trusted reverse proxy.
        """

        if request.client is None:
            return None

        return request.client.host


    @staticmethod
    async def record(
        db: AsyncSession,
        *,
        event_type: str,
        severity: str = "medium",
        user_id: str | None = None,
        ip_address: str | None = None,
        endpoint: str | None = None,
        details: dict | None = None,
    ) -> SecurityEvent:

        event = SecurityEvent(
            id=uuid.uuid4().hex,
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            ip_address=ip_address,
            endpoint=endpoint,
            details=details,
            created_at=datetime.utcnow(),
        )

        db.add(event)

        await db.flush()

        return event