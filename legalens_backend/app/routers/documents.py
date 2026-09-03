import os
import hashlib
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_investigator
from app.core.blockchain import blockchain
from app.core.event_bus import event_bus
from app.core.contracts import UploadResponse, DocumentUploadedPayload
from app.services.file_service import FileService
from app.models.document import Document
from app.models.case import Case

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload/{case_id}")
async def upload_document(
    case_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_investigator),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document to a case. Triggers blockchain and AI events."""
    
    # Check if case exists
    case_service = CaseService(db)
    case = await case_service.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Read file content
    content = await file.read()
    
    # Calculate SHA-256 hash
    sha256_hash = hashlib.sha256(content).hexdigest()
    
    # Save file to disk
    file_service = FileService()
    file_id = uuid.uuid4().hex
    saved_path = await file_service.save_file(file_id, file.filename, content)
    
    # Create document record
    doc = Document(
        id=file_id,
        case_id=case_id,
        file_name=file.filename,
        file_path=saved_path,
        file_size_bytes=len(content),
        mime_type=file.content_type,
        sha256_hash=sha256_hash,
        uploaded_by=current_user["user_id"],
        status="UPLOADED",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    
    # Add block to blockchain
    block = blockchain.add_block(
        action="UPLOAD",
        document_id=file_id,
        document_hash=sha256_hash,
        user_id=current_user["sub"],
        metadata={"case_id": case_id, "file_name": file.filename}
    )
    
    # Update document with blockchain block ID
    doc.blockchain_block_id = block["index"]
    await db.commit()
    
    # Emit event for AI processing
    await event_bus.publish(
        "document.uploaded",
        DocumentUploadedPayload(
            document_id=file_id,
            case_id=case_id,
            file_name=file.filename,
            sha256_hash=sha256_hash,
            uploaded_by=current_user["sub"],
        )
    )
    
    return UploadResponse(
        document_id=file_id,
        case_id=case_id,
        file_name=file.filename,
        sha256_hash=sha256_hash,
        blockchain_block_id=block["index"],
        status="UPLOADED",
        message="Document uploaded and blockchain verified."
    )