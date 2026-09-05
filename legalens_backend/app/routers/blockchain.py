from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_lawyer
from app.core.blockchain import blockchain
from app.core.contracts import DocumentStatus, VerifyResponse
from app.services.supabase_storage import SupabaseStorage
from app.models.case import Case
from app.models.document import Document
from datetime import datetime

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])

@router.get("/verify/{document_id}")
async def verify_document(
    document_id: str,
    current_user: dict = Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
):
    """Verify a document's integrity using the blockchain."""
    
    # Get document from DB
    from sqlalchemy import select
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
        raise HTTPException(status_code=404, detail="Document not found")
    
   # Download the original file from Supabase Storage
    storage = SupabaseStorage()

    try:
        file_bytes = storage.download_file(doc.file_path)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not read file from storage"
        )

    # Calculate current SHA-256 hash
    import hashlib
    current_hash = hashlib.sha256(file_bytes).hexdigest()
    
    # Verify against blockchain
    verification = blockchain.verify_document(document_id, current_hash)
    
    # Update document status if tampered
    if not verification["verified"] and verification["status"] == "TAMPERED":
        doc.status = DocumentStatus.INTEGRITY_FAILED        # Emit integrity failed event
        from app.core.event_bus import event_bus
        from app.core.contracts import IntegrityFailedPayload
        await event_bus.publish(
            "document.integrity_failed",
            IntegrityFailedPayload(
                document_id=document_id,
                case_id=doc.case_id,
                expected_hash=verification["stored_hash"],
                actual_hash=current_hash,
                detected_at=datetime.utcnow(),
                user_id=current_user["user_id"],
            )
        )
        await db.commit()
    
    return VerifyResponse(
        document_id=document_id,
        status=verification["status"],
        current_hash=current_hash,
        blockchain_hash=verification.get("stored_hash", ""),
        block_number=verification.get("block_number", 0),
        last_verified_at=datetime.utcnow(),
        message="Verified" if verification["verified"] else "Tamper detected!"
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

    from sqlalchemy import select
    import hashlib

    # Get document from DB
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
            detail="Document not found"
        )

    # Download the original file from Supabase
    storage = SupabaseStorage()

    try:
        file_bytes = storage.download_file(doc.file_path)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not read file from storage"
        )

    if not file_bytes:
        raise HTTPException(
            status_code=500,
            detail="File is empty"
        )

    # Simulate tampering in memory
    tampered_bytes = bytearray(file_bytes)
    tampered_bytes[0] ^= 1

    # Calculate hash of tampered version
    tampered_hash = hashlib.sha256(tampered_bytes).hexdigest()

    # Add tampered hash to blockchain for demonstration
    blockchain.add_block(
        action="TAMPER_DETECTED",
        document_id=document_id,
        document_hash=doc.sha256_hash,
        user_id=current_user["user_id"],
        metadata={
            "simulated": True,
            "observed_hash": tampered_hash,
    }
)

    return {
        "status": "tampered",
        "message": "🚨 Simulated tampering detected. Original file was not modified.",
        "original_hash": doc.sha256_hash,
        "tampered_hash": tampered_hash,
        "document_id": document_id,
    }