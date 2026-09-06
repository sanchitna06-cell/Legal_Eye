import hashlib
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File,Response
from urllib.parse import quote
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_lawyer
from sqlalchemy import select
from app.models.case import Case
from app.core.event_bus import event_bus
from app.core.contracts import UploadResponse, DocumentUploadedPayload
from app.models.document import Document
from app.services.case_service import CaseService
from app.services.supabase_storage import SupabaseStorage
from app.services.audit_service import AuditService
MAX_FILE_SIZE = 50 * 1024 * 1024

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload/{case_id}")
async def upload_document(
    
    case_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_lawyer),
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

# Check case ownership
    if case.created_by != current_user["user_id"]:
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
        storage_key=storage_key,
        file_size_bytes=len(content),
        mime_type=file.content_type or "application/pdf",
        uploaded_by=current_user["user_id"],
        status="UPLOADED",
        is_original=True,
    )
    db.add(doc)

    await AuditService.log(
        db,
        user_id=current_user["user_id"],
        action="DOCUMENT_UPLOADED",
        case_id=case_id,
        document_id=file_id,
        details={
        "file_name": file.filename,
        "file_size_bytes": len(content),
        "sha256_hash": sha256_hash,
    },
    )

    await db.commit()
    await db.refresh(doc)
    
    # Emit event for processing
    try:
        await event_bus.publish(
            "document.uploaded",
            DocumentUploadedPayload(
                document_id=file_id,
                case_id=case_id,
                file_name=file.filename,
                sha256_hash=sha256_hash,
                uploaded_by=current_user["user_id"],
            )
        )

    except Exception as e:
        print(
            f"❌ Document processing failed "
            f"for {file_id}: {e}"
        )

        raise HTTPException(
            status_code=500,
            detail="Document processing failed."
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
@router.get("/{document_id}")
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a document only if it belongs to the lawyer's case."""

    # Find the document only if its case belongs to the current lawyer
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

    if doc is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    # Read the original file from private storage
    storage = SupabaseStorage()

    try:
        file_bytes = storage.download_file(doc.storage_key)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not read file from storage",
        )

    # Return the PDF directly to the authorized lawyer
    return Response(
        content=file_bytes,
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": (
                f"inline; filename*=UTF-8''{quote(doc.file_name)}"
            )
        },
    )