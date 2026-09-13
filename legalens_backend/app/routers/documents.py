import asyncio
import hashlib
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_lawyer
from sqlalchemy import select
from app.models.case import Case
from app.models.case_file_page import CaseFilePage
from app.core.event_bus import event_bus
from app.core.contracts import (
    DocumentStatusResponse,
    UploadResponse,
    DocumentUploadedPayload,
)
from app.models.document import Document
from app.services.case_service import CaseService
from app.services.document_status_service import get_document_status_for_user
from app.services.supabase_storage import SupabaseStorage
from app.services.audit_service import AuditService
MAX_FILE_SIZE = 50 * 1024 * 1024

# Strong references keep dispatched processing tasks from being
# garbage-collected mid-run; completed tasks are discarded.
_background_processing_tasks: set[asyncio.Task] = set()

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
            detail="Uploaded file must have a filename",
        )

    file_name = file.filename

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

    # Upload original file to private Supabase Storage.
    # Blocking network I/O: keep it OFF the event loop so large
    # originals cannot stall other requests while being accepted.
    storage = SupabaseStorage()

    await asyncio.to_thread(
        storage.upload_file,
        storage_key,
        content,
        file.content_type or "application/pdf",
    )
    
    # Create document record
    doc = Document(
        id=file_id,
        case_id=case_id,
        file_name=file_name,
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
        "file_name": file_name,
        "file_size_bytes": len(content),
        "sha256_hash": sha256_hash,
    },
    )

    await db.commit()
    await db.refresh(doc)

    # ----------------------------------------------------------
    # Asynchronous processing hand-off.
    #
    # The document has been accepted and stored; the request now
    # returns promptly while processing continues on the EXISTING
    # event-driven pipeline. This does not replace or duplicate the
    # pipeline: the same "document.uploaded" event drives the same
    # subscribers (integrity anchoring, text extraction/OCR, entity
    # extraction). Clients observe progress through the dedicated
    # document status endpoint instead of waiting on this request.
    # ----------------------------------------------------------

    async def _dispatch_document_processing() -> None:
        try:
            await event_bus.publish(
                "document.uploaded",
                DocumentUploadedPayload(
                    document_id=file_id,
                    case_id=case_id,
                    file_name=file_name,
                    sha256_hash=sha256_hash,
                    uploaded_by=current_user["user_id"],
                )
            )

        except Exception as e:
            # Background failures are logged for operators; the public
            # status endpoint reports the resulting FAILED state.
            print(
                f"❌ Document processing failed "
                f"for {file_id}: {e}"
            )

    task = asyncio.create_task(_dispatch_document_processing())
    _background_processing_tasks.add(task)
    task.add_done_callback(_background_processing_tasks.discard)

    return UploadResponse(
        document_id=file_id,
        case_id=case_id,
        file_name=file_name,
        sha256_hash=sha256_hash,
        blockchain_block_id=None,
        status="UPLOADED",
        message="Document uploaded successfully and queued for processing.",
        )


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_processing_status(
    document_id: str,
    current_user: dict = Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
) -> DocumentStatusResponse:
    """
    Public, sanitized processing status for one document.

    Requires authentication and case ownership: foreign or unknown
    documents return the same opaque 404. The response contains only
    the public status/stage contract — never internal job records,
    storage keys, or infrastructure details.
    """

    status = await get_document_status_for_user(
        db,
        document_id,
        current_user["user_id"],
    )

    if status is None:
        # Same response whether the document is missing or owned by
        # another user — existence is not revealed.
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return status
@router.get("/case/{case_id}")
async def get_case_documents(
    case_id: str,
    current_user: dict = Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
):
    """Return documents for a case only if the lawyer owns the case."""

    stmt = (
        select(Document)
        .join(Case, Document.case_id == Case.id)
        .where(
            Document.case_id == case_id,
            Case.created_by == current_user["user_id"],
        )
        .order_by(Document.uploaded_at.asc())
    )

    result = await db.execute(stmt)
    documents = result.scalars().all()

    return {
        "documents": [
            {
                "id": document.id,
                "file_name": document.file_name,
                "file_size_bytes": document.file_size_bytes,
                "mime_type": document.mime_type,
                "status": document.status,
                "uploaded_at": document.uploaded_at,
            }
            for document in documents
        ]
    }
@router.get("/{document_id}/pages")
async def get_document_pages(
    document_id: str,
    current_user: dict = Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
):
    """Return page-level data only if the lawyer owns the document's case."""

    stmt = (
        select(CaseFilePage)
        .join(Document, CaseFilePage.case_file_id == Document.id)
        .join(Case, Document.case_id == Case.id)
        .where(
            Document.id == document_id,
            Case.created_by == current_user["user_id"],
        )
        .order_by(CaseFilePage.page_number.asc())
    )

    result = await db.execute(stmt)
    pages = result.scalars().all()

    if not pages:
        raise HTTPException(
            status_code=404,
            detail="Document not found or has no processed pages.",
        )

    return {
        "pages": [
            {
                "id": page.id,
                "page_number": page.page_number,
                "extracted_text": page.extracted_text,
                "extraction_method": page.extraction_method,
                "ocr_confidence": page.ocr_confidence,
                "extraction_status": page.extraction_status,
            }
            for page in pages
        ]
    }
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

        # Generate a short-lived signed URL for the authorized lawyer.
    # The PDF remains in private Supabase Storage and is not
    # downloaded through the FastAPI server.
    storage = SupabaseStorage()

    try:
        signed_url = storage.create_signed_url(
            doc.storage_key,
            expires_in=300,
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not create document access URL",
        )

    return {
        "document_id": doc.id,
        "file_name": doc.file_name,
        "mime_type": doc.mime_type,
        "expires_in": 300,
        "url": signed_url,
    }