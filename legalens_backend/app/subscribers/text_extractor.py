"""
app/subscribers/text_extractor.py
---------------------------------
Listens for document.uploaded events and extracts text from PDFs.
"""
import io
import uuid
from datetime import datetime
from sqlalchemy import select
import asyncio
import PyPDF2
import pymupdf 
import pytesseract
from PIL import Image
from typing import cast
from app.core.database import AsyncSessionLocal
from app.models.case_file_page import CaseFilePage
from app.models.document import Document
from app.core.event_bus import event_bus
from app.core.contracts import (
    DocumentUploadedPayload,
    TextExtractedPayload,
    ProcessingType,
    ProcessingJobStatus,
    DocumentStatus,
)
from app.models.file_processing_job import FileProcessingJob
from app.services.supabase_storage import SupabaseStorage
from app.services.document_status_service import (
    sync_document_lifecycle_status,
)

def extract_pdf_pages(file_bytes: bytes) -> list[dict]:
    """
    Perform blocking PDF parsing and OCR.

    This function must NOT access the database or EventBus.
    It only converts PDF bytes into extracted page data.
    """

    pdf_stream = io.BytesIO(file_bytes)
    reader = PyPDF2.PdfReader(pdf_stream)

    ocr_pdf = pymupdf.open(
        stream=file_bytes,
        filetype="pdf",
    )

    pages = []

    try:
        for page_number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").replace("\x00", "")

            extraction_method = "PYPDF2_TEXT"
            ocr_confidence = None

            if not text.strip():
                print(
                    f"🔎 Page {page_number}: "
                    "No embedded text found. Running OCR..."
                )

                ocr_page = cast(
                    pymupdf.Page,
                    ocr_pdf.load_page(page_number - 1),
                )

                pixmap = ocr_page.get_pixmap(dpi=200)
                image_bytes = pixmap.tobytes("png")

                image = Image.open(
                    io.BytesIO(image_bytes)
                )

                text = pytesseract.image_to_string(image)
                text = text.replace("\x00", "")

                data = pytesseract.image_to_data(
                    image,
                    output_type=pytesseract.Output.DICT,
                )

                confidences = [
                    float(conf)
                    for conf in data["conf"]
                    if float(conf) >= 0
                ]

                if confidences:
                    ocr_confidence = (
                        sum(confidences)
                        / len(confidences)
                        / 100.0
                    )

                extraction_method = "OCR"

            pages.append(
                {
                    "page_number": page_number,
                    "extracted_text": text,
                    "extraction_method": extraction_method,
                    "ocr_confidence": ocr_confidence,
                }
            )

            print(
                f"📄 Page {page_number}: "
                f"{len(text)} characters extracted "
                f"using {extraction_method}"
            )

    finally:
        ocr_pdf.close()

    return pages


async def _mark_job_failed(job_id: str, message: str) -> None:
    """Mark a processing job failed using a FRESH database session.

    A session whose transaction has already failed cannot commit, so
    the session from the failing operation must never be reused here.
    Handler errors are logged and swallowed so they never mask the
    original failure or leave the job stuck in PROCESSING.
    """

    try:
        async with AsyncSessionLocal() as db:
            job = await db.get(
                FileProcessingJob,
                job_id,
            )

            if job is not None:
                job.status = ProcessingJobStatus.FAILED
                job.error_message = message[:1000]
                job.completed_at = datetime.utcnow()

                await db.commit()

    except Exception as handler_error:
        print(
            f"❌ Could not record processing failure "
            f"for job {job_id}: {handler_error}"
        )


async def _mark_document_error(document_id: str) -> None:
    """Mark a document ERROR using a FRESH database session."""

    try:
        async with AsyncSessionLocal() as db:
            document = await db.get(
                Document,
                document_id,
            )

            if document is not None:
                document.status = DocumentStatus.ERROR

                await db.commit()

    except Exception as handler_error:
        print(
            f"❌ Could not record error state "
            f"for document {document_id}: {handler_error}"
        )


async def handle_document_uploaded(
    payload: DocumentUploadedPayload,
) -> None:
    """Extract actual text from the uploaded PDF."""

    print(
        f"📄 Extracting text from: {payload.file_name}"
    )

    storage = SupabaseStorage()

    async with AsyncSessionLocal() as db:
        document = await db.get(
            Document,
            payload.document_id,
        )

        if document is None:
            raise RuntimeError(
                f"Document {payload.document_id} not found "
                "while extracting text."
            )

        if document.case_id != payload.case_id:
            raise RuntimeError(
                f"Document {payload.document_id} does not belong "
                f"to case {payload.case_id}."
            )

        storage_key = document.storage_key

    async with AsyncSessionLocal() as db:
        job = FileProcessingJob(
            case_file_id=payload.document_id,
            processing_type=ProcessingType.TEXT_EXTRACTION,
            status=ProcessingJobStatus.PROCESSING,
            attempt_count=1,
            started_at=datetime.utcnow(),
        )
        db.add(job)
        await db.flush()
        job_id = job.id
        await db.commit()


    try:
        # Blocking network download: keep it OFF the event loop so a
        # large document cannot stall other requests or subscribers.
        file_bytes = await asyncio.to_thread(
            storage.download_file,
            storage_key,
        )

    except Exception as e:
        print(f"❌ Could not download document: {e}")

        await _mark_job_failed(job_id, str(e))
        await _mark_document_error(payload.document_id)

        raise


    # Give the PDF reader an in-memory file
    try:
        # Run blocking PDF/OCR work outside the async event loop.
        pages = await asyncio.to_thread(
            extract_pdf_pages,
            file_bytes,
        )

                # Persist pages in batches instead of one massive transaction.
        #
        # Large PDFs can contain hundreds of pages with substantial
        # extracted_text values. Committing everything in one transaction
        # can create excessive transaction/statement pressure.
        BATCH_SIZE = 50

        try:
            for batch_start in range(0, len(pages), BATCH_SIZE):
                batch = pages[batch_start:batch_start + BATCH_SIZE]

                async with AsyncSessionLocal() as db:
                    for page_data in batch:
                        page_record = CaseFilePage(
                            id=uuid.uuid4().hex,
                            case_file_id=payload.document_id,
                            page_number=page_data["page_number"],
                            extracted_text=page_data["extracted_text"],
                            extraction_method=page_data["extraction_method"],
                            ocr_confidence=page_data["ocr_confidence"],
                            extraction_status="EXTRACTED",
                        )

                        db.add(page_record)

                    await db.commit()

                print(
                    f"💾 Saved pages "
                    f"{batch_start + 1}-{batch_start + len(batch)} "
                    f"of {len(pages)}"
                )

            # Only mark the processing job and document as completed
            # after every page batch has been committed successfully.
            async with AsyncSessionLocal() as db:
                job = await db.get(
                    FileProcessingJob,
                    job_id,
                )

                if job is None:
                    raise RuntimeError(
                        f"Processing job {job_id} not found "
                        "while completing text extraction."
                    )

                job.status = ProcessingJobStatus.COMPLETED
                job.completed_at = datetime.utcnow()

                document = await db.get(
                    Document,
                    payload.document_id,
                )

                if document is not None:
                    await sync_document_lifecycle_status(
                        db,
                        document,
                    )
                await db.commit()

        except Exception:
            # If any batch fails, remove pages already persisted for this
            # document so a failed extraction can never leave partial data.
            try:
                async with AsyncSessionLocal() as cleanup_db:
                    result = await cleanup_db.execute(
                        select(CaseFilePage).where(
                            CaseFilePage.case_file_id == payload.document_id
                        )
                    )

                    persisted_pages = result.scalars().all()

                    for page in persisted_pages:
                        await cleanup_db.delete(page)

                    await cleanup_db.commit()

                    print(
                        f"🧹 Removed {len(persisted_pages)} partially "
                        f"persisted pages for document "
                        f"{payload.document_id}"
                    )

            except Exception as cleanup_error:
                print(
                    f"❌ Could not clean up partial pages for "
                    f"{payload.document_id}: {cleanup_error}"
                )

            raise
    except Exception as e:
        print(f"❌ PDF extraction failed: {e}")

        # Fresh sessions only: the session used for the failed work is
        # potentially in a broken transaction state and cannot commit.
        await _mark_job_failed(job_id, str(e))
        await _mark_document_error(payload.document_id)

        raise

    # Combine pages for the current event contract
    full_text = "\n\n".join(
        page["extracted_text"]
        for page in pages
    )

    page_count = len(pages)

    print(
        f"✅ Extracted {page_count} pages "
        f"({len(full_text)} characters)"
    )

    # Emit extracted text event
    await event_bus.publish(
        "text.extracted",
        TextExtractedPayload(
            case_id=payload.case_id,
            document_id=payload.document_id,
            text=full_text,
            page_count=page_count,
        )
)

    print(
        f"📤 text.extracted event published "
        f"for document: {payload.document_id}"
    )
