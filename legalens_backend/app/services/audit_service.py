from datetime import datetime
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


class AuditService:

    @staticmethod
    async def log(
        db: AsyncSession,
        *,
        user_id: str,
        action: str,
        case_id: str | None = None,
        document_id: str | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
        request_id: str | None = None,
    ) -> AuditLog:

        audit_log = AuditLog(
            id=uuid.uuid4().hex,
            user_id=user_id,
            case_id=case_id,
            document_id=document_id,
            action=action,
            details=details,
            ip_address=ip_address,
            request_id=request_id,
            created_at=datetime.utcnow(),
        )

        db.add(audit_log)
        await db.flush()

        return audit_log