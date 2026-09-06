from typing import Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.audit_log import AuditLog


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


@router.get("/audit-logs")
async def get_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
    )

    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "case_id": log.case_id,
                "document_id": log.document_id,
                "action": log.action,
                "details": log.details,
                "ip_address": log.ip_address,
                "created_at": log.created_at,
                "request_id": log.request_id,
            }
            for log in logs
        ]
    }