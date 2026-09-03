from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_investigator
from app.core.blockchain import blockchain
from app.core.contracts import VerifyResponse
from app.services.file_service import FileService
from app.models.document import Document
from datetime import datetime

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])

@router.get("/verify/{document_id}")
async def verify_document(
    document_id: str,
    current_user: dict = Depends(get_current_investigator),
    db: AsyncSession = Depends(get_db),
):
    """Verify a document's integrity using the blockchain."""
    
    # Get document from DB
    from sqlalchemy import select
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Read file from disk and calculate current hash
    file_service = FileService()
    current_hash = await file_service.get_file_hash(doc.file_path)
    
    if not current_hash:
        raise HTTPException(status_code=500, detail="Could not read file")
    
    # Verify against blockchain
    verification = blockchain.verify_document(document_id, current_hash)
    
    # Update document status if tampered
    if not verification["verified"] and verification["status"] == "TAMPERED":
        doc.status = "TAMPERED"
        # Emit integrity failed event
        from app.core.event_bus import event_bus
        from app.core.contracts import IntegrityFailedPayload
        await event_bus.emit(
            "document.integrity_failed",
            IntegrityFailedPayload(
                document_id=document_id,
                expected_hash=verification["stored_hash"],
                actual_hash=current_hash,
                detected_at=datetime.utcnow(),
                user_id=current_user["sub"],
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
    current_user: dict = Depends(get_current_investigator),
    db: AsyncSession = Depends(get_db),
):
    """
    SIMULATE TAMPERING – FOR DEMO ONLY.
    Changes 1 byte in the file to trigger the tamper alert.
    """
    from sqlalchemy import select
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_service = FileService()
    
    # Tamper the file (change 1 byte)
    success = await file_service.tamper_file(doc.file_path)
    
    if not success:
        raise HTTPException(status_code=500, detail="Could not tamper file")
    
    # Recalculate hash
    new_hash = await file_service.get_file_hash(doc.file_path)
    
    # Add a tamper block to the blockchain
    blockchain.add_block(
        action="TAMPER_DETECTED",
        document_id=document_id,
        document_hash=new_hash,
        user_id=current_user["sub"],
        metadata={"simulated": True}
    )
    
    return {
        "status": "tampered",
        "message": "🚨 File tampered! Blockchain hash mismatch detected.",
        "new_hash": new_hash,
        "document_id": document_id
    }