from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import hashlib

from app.core.database import get_db
from app.core.security import get_current_lawyer
from app.core.blockchain import blockchain
from app.core.contracts import DocumentStatus, VerifyResponse
from app.services.supabase_storage import SupabaseStorage
from app.models.case import Case
from app.models.document import Document
from app.models.document_integrity import DocumentIntegrity
from app.core.event_bus import event_bus
from app.core.contracts import IntegrityFailedPayload

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])

@router.get("/verify/{document_id}")
async def verify_document(
    document_id: str,
    current_user: dict = Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
):
    """Verify a document's integrity using the blockchain."""

    # Get document only if it belongs to the current lawyer's case
    stmt = (
        select(Document)
        .join(Case, Document.case_id == Case.id)
        .where(
            Document.id == document_id,
            Case.created_by == current_user["user_id"],
        )
    )

    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    # Get the canonical integrity record
    integrity_result = await db.execute(
        select(DocumentIntegrity).where(
            DocumentIntegrity.case_file_id == document_id
        )
    )

    integrity = integrity_result.scalar_one_or_none()

    if integrity is None:
        raise HTTPException(
            status_code=404,
            detail="Document integrity record not found",
        )

    # Download the original file from private Supabase Storage
    storage = SupabaseStorage()

    try:
        file_bytes = storage.download_file(doc.storage_key)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not read file from storage",
        )

    # Calculate the hash of the currently stored file
    current_hash = hashlib.sha256(file_bytes).hexdigest()

    # Verify against the blockchain
    verification = blockchain.verify_document(
        document_id,
        current_hash,
    )

    # Detect integrity failure
    if not verification["verified"]:
        doc.status = DocumentStatus.INTEGRITY_FAILED

        await event_bus.publish(
            "document.integrity_failed",
            IntegrityFailedPayload(
                document_id=document_id,
                case_id=doc.case_id,
                expected_hash=integrity.sha256_hash,
                actual_hash=current_hash,
                detected_at=datetime.utcnow(),
                user_id=current_user["user_id"],
            ),
        )

        await db.commit()

    return VerifyResponse(
        document_id=document_id,
        status=(
            "VERIFIED"
            if verification["verified"]
            else "INTEGRITY_FAILED"
        ),
        current_hash=current_hash,
        blockchain_hash=integrity.blockchain_hash or "",
        block_number=integrity.blockchain_block_id or 0,
        last_verified_at=datetime.utcnow(),
        message=(
            "Verified"
            if verification["verified"]
            else "Tamper detected!"
        ),
    )
@router.post("/tamper/{document_id}")
async def simulate_tamper(
    document_id: str,
    current_user: dict = Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
):
    """
    SIMULATE TAMPERING – FOR DEMO ONLY.

    Downloads the original file, changes one byte in memory,
    and calculates the resulting hash.

    The original file in Supabase Storage is NOT modified.
    """

    # Get document only if it belongs to the current lawyer's case
    stmt = (
        select(Document)
        .join(Case, Document.case_id == Case.id)
        .where(
            Document.id == document_id,
            Case.created_by == current_user["user_id"],
        )
    )

    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    # Get canonical integrity record
    integrity_result = await db.execute(
        select(DocumentIntegrity).where(
            DocumentIntegrity.case_file_id == document_id
        )
    )

    integrity = integrity_result.scalar_one_or_none()

    if integrity is None:
        raise HTTPException(
            status_code=404,
            detail="Document integrity record not found",
        )

    # Download original file
    storage = SupabaseStorage()

    try:
        file_bytes = storage.download_file(doc.storage_key)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not read file from storage",
        )

    if not file_bytes:
        raise HTTPException(
            status_code=500,
            detail="File is empty",
        )

    # Simulate tampering only in memory
    tampered_bytes = bytearray(file_bytes)
    tampered_bytes[0] ^= 1

    # Calculate resulting hash
    tampered_hash = hashlib.sha256(tampered_bytes).hexdigest()

    return {
        "status": "tampered",
        "message": (
            "🚨 Simulated tampering detected. "
            "Original file was not modified."
        ),
        "original_hash": integrity.sha256_hash,
        "tampered_hash": tampered_hash,
        "document_id": document_id,
    }