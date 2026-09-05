import os
import hashlib
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_investigator
from app.core.event_bus import event_bus
from app.core.contracts import UploadResponse, DocumentUploadedPayload
from app.models.document import Document
from app.services.case_service import CaseService
from app.services.supabase_storage import SupabaseStorage

MAX_FILE_SIZE = 50 * 1024 * 1024

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload/{case_id}")
async def upload_document(
    
    case_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_investigator),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must have a filename"
        )
    """Upload a document to a case. Triggers blockchain and AI events."""
    
    # Check if case exists
    case_service = CaseService(db)
    case = await case_service.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Read file content
    content = await file.read()

    # Enforce application-level file size limit
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 50 MB limit."
        )

    # Validate PDF magic bytes
    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid PDF."
        )
    
    # Calculate SHA-256 hash
    sha256_hash = hashlib.sha256(content).hexdigest()
    
   # Generate unique file ID
    file_id = uuid.uuid4().hex

    # Generate immutable storage key
    storage_key = f"cases/{case_id}/{file_id}/original.pdf"

    # Upload original file to private Supabase Storage
    storage = SupabaseStorage()

    storage.upload_file(
    storage_key=storage_key,
    file_bytes=content,
    content_type=file.content_type or "application/pdf",
)
    
    # Create document record
    doc = Document(
        id=file_id,
        case_id=case_id,
        file_name=file.filename,
        file_path=storage_key,
        file_size_bytes=len(content),
        mime_type=file.content_type,
        sha256_hash=sha256_hash,
        uploaded_by=current_user["user_id"],
        status="UPLOADED",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    

    
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
        blockchain_block_id=None,
        status="UPLOADED",
        message="Document uploaded and integrity event queued."
    )