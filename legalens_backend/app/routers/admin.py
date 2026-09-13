from typing import Dict, Any

from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.security_event import SecurityEvent

from app.core.database import get_db
from app.core.security import get_current_admin, hash_password
from app.models.user import User, UserRole
from app.models.case import Case
from app.models.document import Document
from app.models.document_integrity import DocumentIntegrity
from app.models.blockchain_block import BlockchainBlock
from app.models.file_processing_job import FileProcessingJob
from app.models.audit_log import AuditLog
from app.core.blockchain import BlockchainService
from app.core.event_bus import event_bus
from app.services.audit_service import AuditService

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)
class CreateAdminUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=100)
    temporary_password: str = Field(min_length=8, max_length=128)
    is_active: bool = True


@router.get("/overview")
async def get_admin_overview(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    """
    Return high-level system statistics for the Admin dashboard.

    This endpoint is ADMIN-only through get_current_admin.
    """

    users_count = await db.scalar(
        select(func.count()).select_from(User)
    )

    active_users_count = await db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.is_active.is_(True))
    )

    cases_count = await db.scalar(
        select(func.count()).select_from(Case)
    )

    documents_count = await db.scalar(
        select(func.count()).select_from(Document)
    )

    integrity_records_count = await db.scalar(
        select(func.count()).select_from(DocumentIntegrity)
    )

    blockchain_blocks_count = await db.scalar(
        select(func.count()).select_from(BlockchainBlock)
    )

    processing_jobs_count = await db.scalar(
        select(func.count()).select_from(FileProcessingJob)
    )

    audit_logs_count = await db.scalar(
        select(func.count()).select_from(AuditLog)
    )

    return {
        "users": {
            "total": users_count or 0,
            "active": active_users_count or 0,
        },
        "cases": {
            "total": cases_count or 0,
        },
        "documents": {
            "total": documents_count or 0,
        },
        "document_integrity": {
            "total_records": integrity_records_count or 0,
        },
        "blockchain": {
            "total_blocks": blockchain_blocks_count or 0,
        },
        "processing": {
            "total_jobs": processing_jobs_count or 0,
        },
        "audit": {
            "total_logs": audit_logs_count or 0,
        },
    }


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
@router.get("/security-events")
async def get_admin_security_events(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    result = await db.execute(
        select(SecurityEvent)
        .order_by(SecurityEvent.created_at.desc())
        .limit(100)
    )

    events = result.scalars().all()

    return {
        "events": [
            {
                "id": event.id,
                "event_type": event.event_type,
                "severity": event.severity,
                "user_id": event.user_id,
                "ip_address": event.ip_address,
                "endpoint": event.endpoint,
                "details": event.details,
                "created_at": event.created_at,
            }
            for event in events
        ]
    }
@router.get("/users")
async def get_admin_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    users = result.scalars().all()

    return {
        "users": [
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role.value,
                "is_active": user.is_active,
                "must_change_password": user.must_change_password,
                "created_at": user.created_at,
                "last_login": user.last_login,
            }
            for user in users
        ]
    }
@router.post("/users")
async def create_admin_user(
    request: CreateAdminUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    """
    Create a new lawyer account.

    The supplied password is stored only as a password hash.
    New accounts are forced to change the temporary password
    before accessing protected application resources.
    """

    username = request.username.strip()
    full_name = request.full_name.strip()

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty.",
        )

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name cannot be empty.",
        )

    # Check for an existing username before attempting the insert.
    result = await db.execute(
        select(User).where(User.username == username)
    )

    existing_user = result.scalar_one_or_none()

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'User with username "{username}" already exists.',
        )

    user = User(
        username=username,
        hashed_password=hash_password(request.temporary_password),
        full_name=full_name,
        role=UserRole.LAWYER,
        is_active=request.is_active,
        must_change_password=True,
    )

    db.add(user)

    try:
        await db.flush()

        await AuditService.log(
            db,
            user_id=current_user["user_id"],
            action="USER_CREATED",
            details={
                "created_user_id": user.id,
                "created_username": user.username,
                "created_full_name": user.full_name,
                "created_role": user.role.value,
            },
        )

        await db.commit()

    except IntegrityError:
        await db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'User with username "{username}" already exists.',
        )

    return {
        "message": f'User "{username}" created successfully.',
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "must_change_password": user.must_change_password,
            "created_at": user.created_at,
            "last_login": user.last_login,
        },
    }
@router.get("/document-integrity")
async def get_admin_document_integrity(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    result = await db.execute(
        select(DocumentIntegrity)
        .order_by(DocumentIntegrity.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    records = result.scalars().all()

    return {
        "records": [
            {
                "id": record.id,
                "case_file_id": record.case_file_id,
                "sha256_hash": record.sha256_hash,
                "algorithm": record.algorithm,
                "blockchain_block_id": record.blockchain_block_id,
                "blockchain_hash": record.blockchain_hash,
                "anchored_at": record.anchored_at,
                "created_at": record.created_at,
            }
            for record in records
        ]
    }
@router.get("/blockchain")
async def get_admin_blockchain(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    result = await db.execute(
        select(BlockchainBlock)
        .order_by(BlockchainBlock.block_index.desc())
        .offset(skip)
        .limit(limit)
    )

    blocks = result.scalars().all()

    return {
        "blocks": [
            {
                "id": block.id,
                "block_index": block.block_index,
                "created_at": block.created_at,
                "action": block.action,
                "document_id": block.document_id,
                "document_hash": block.document_hash,
                "previous_hash": block.previous_hash,
                "hash": block.hash,
                "user_id": block.user_id,
                "metadata": block.block_metadata,
            }
            for block in blocks
        ]
    }
@router.get("/event-pipeline")
async def get_admin_event_pipeline(
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    events = event_bus.get_status()

    return {
        "total_events": len(events),
        "total_handlers": sum(
            len(handlers)
            for handlers in events.values()
        ),
        "events": events,
    }
@router.get("/system-health")
async def get_admin_system_health(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    # Database
    database_status = "healthy"

    try:
        await db.execute(select(1))
    except Exception:
        database_status = "critical"

    # Blockchain / hash chain
    blockchain_status = "healthy"

    try:
        blockchain_service = BlockchainService(db)
        chain_valid = await blockchain_service.verify_chain_integrity()

        if not chain_valid:
            blockchain_status = "degraded"
    except Exception:
        blockchain_status = "critical"

    # Event pipeline
    events = event_bus.get_status()

    total_handlers = sum(
        len(handlers)
        for handlers in events.values()
    )

    event_pipeline_status = (
        "healthy"
        if total_handlers > 0
        else "degraded"
    )

    # Processing jobs
    result = await db.execute(
        select(
            FileProcessingJob.status,
            func.count(FileProcessingJob.id),
        )
        .group_by(FileProcessingJob.status)
    )

    processing = {}

    for status, count in result.all():
        status_name = (
            status.value
            if hasattr(status, "value")
            else str(status)
        )

        processing[status_name] = count

    # Overall status
    component_statuses = [
        database_status,
        blockchain_status,
        event_pipeline_status,
    ]

    if "critical" in component_statuses:
        overall_status = "critical"
    elif "degraded" in component_statuses:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return {
        "status": overall_status,
        "database": database_status,
        "blockchain": blockchain_status,
        "event_pipeline": event_pipeline_status,
        "processing": processing,
    }
@router.get("/security-controls")
async def get_admin_security_controls(
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    return {
        "overall_status": "secure",
        "controls": [
            {
                "name": "JWT Authentication",
                "status": "active",
                "description": (
                    "Protected API endpoints require signed JWT authentication."
                ),
            },
            {
                "name": "Admin RBAC",
                "status": "active",
                "description": (
                    "Administrative endpoints require the ADMIN role."
                ),
            },
            {
                "name": "Active User Validation",
                "status": "active",
                "description": (
                    "Protected requests validate that the authenticated user "
                    "exists and is active."
                ),
            },
            {
                "name": "Password Hashing",
                "status": "active",
                "description": (
                    "User passwords are stored as password hashes."
                ),
            },
            {
                "name": "Audit Logging",
                "status": "active",
                "description": (
                    "Application activity can be recorded through the audit system."
                ),
            },
            {
                "name": "Document Integrity",
                "status": "active",
                "description": (
                    "Documents can be represented by SHA-256 integrity records."
                ),
            },
            {
                "name": "Tamper-Evident Hash Chain",
                "status": "active",
                "description": (
                    "Integrity records can be anchored to the PostgreSQL-backed "
                    "tamper-evident hash chain."
                ),
            },
        ],
    }
@router.delete("/users/{user_id}")
async def delete_admin_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    """
    Permanently delete a user account.

    Only ADMIN users can call this endpoint.

    A user cannot delete their own account or another ADMIN account.
    Database foreign-key constraints protect users that are referenced
    by legal records.
    """

    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    # Never allow an administrator to remove their own account.
    if user.id == current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own administrator account.",
        )

    # Keep administrator accounts protected.
    if user.role.value == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator accounts cannot be deleted.",
        )

    username = user.username
    full_name = user.full_name
    target_user_id = user.id

    # Record the administrative action using the ADMIN performing it,
    # not the account that is about to be deleted.
    await AuditService.log(
        db,
        user_id=current_user["user_id"],
        action="USER_DELETED",
        details={
            "deleted_user_id": target_user_id,
            "deleted_username": username,
            "deleted_full_name": full_name,
        },
    )

    try:
        await db.delete(user)
        await db.flush()
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()

    # Keep the technical database error in backend logs only.
        print(f"USER DELETE FAILED [{username}]: {exc}")

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f'User "{username}" cannot be deleted because '
                "this account has existing legal or audit history. "
                "Deactivate the account instead."
            ),
        )
        

        return {
            "message": f'User "{username}" deleted successfully.',
            "user_id": target_user_id,
        }
@router.patch("/users/{user_id}/deactivate")
async def deactivate_admin_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    if user.id == current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own administrator account.",
        )

    if user.role.value == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator accounts cannot be deactivated.",
        )

    if not user.is_active:
        return {
            "message": f'User "{user.username}" is already inactive.',
            "user_id": user.id,
            "is_active": False,
        }

    user.is_active = False

    await AuditService.log(
        db,
        user_id=current_user["user_id"],
        action="USER_DEACTIVATED",
        details={
            "deactivated_user_id": user.id,
            "deactivated_username": user.username,
            "deactivated_full_name": user.full_name,
        },
    )

    await db.commit()

    return {
        "message": f'User "{user.username}" deactivated successfully.',
        "user_id": user.id,
        "is_active": False,
    }
@router.patch("/users/{user_id}/activate")
async def activate_admin_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_admin),
):
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    if user.role.value == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator accounts are managed separately.",
        )

    if user.is_active:
        return {
            "message": f'User "{user.username}" is already active.',
            "user_id": user.id,
            "is_active": True,
        }

    user.is_active = True

    await AuditService.log(
        db,
        user_id=current_user["user_id"],
        action="USER_ACTIVATED",
        details={
            "activated_user_id": user.id,
            "activated_username": user.username,
            "activated_full_name": user.full_name,
        },
    )

    await db.commit()

    return {
        "message": f'User "{user.username}" activated successfully.',
        "user_id": user.id,
        "is_active": True,
    }
