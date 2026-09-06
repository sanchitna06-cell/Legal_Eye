"""
app/subscribers/text_extractor.py
---------------------------------
Listens for document.uploaded events and extracts text from PDFs.
"""
import io
import uuid
from datetime import datetime

import PyPDF2
import pymupdf
import pytesseract
from PIL import Image

from app.core.database import AsyncSessionLocal
from app.models.case_file_page import CaseFilePage
from app.models.document import Document
from app.core.event_bus import event_bus
from app.core.contracts import (
    DocumentUploadedPayload,
    TextExtractedPayload,
    ProcessingType,
    ProcessingJobStatus,
)
from app.models.file_processing_job import FileProcessingJob
from app.services.supabase_storage import SupabaseStorage


async def handle_document_uploaded(payload: DocumentUploadedPayload):
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
       file_bytes = storage.download_file(storage_key)

    except Exception as e:
        print(f"❌ Could not download document: {e}")

        async with AsyncSessionLocal() as db:
            job = await db.get(
                FileProcessingJob,
                job_id,
            )

            if job is not None:
                job.status = ProcessingJobStatus.FAILED
                job.error_message = str(e)[:1000]
                job.completed_at = datetime.utcnow()

                await db.commit()

        raise


    # Give the PDF reader an in-memory file
    pdf_stream = io.BytesIO(file_bytes)
    try:
        reader = PyPDF2.PdfReader(pdf_stream)

        page_text = []

        ocr_pdf = pymupdf.open(
            stream=file_bytes,
            filetype="pdf",
        )

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

            for page_number, page in enumerate(reader.pages, start=1):
                text = (page.extract_text() or "").replace("\x00", "")

                extraction_method = "PYPDF2_TEXT"
                ocr_confidence = None

                if not text.strip():
                    print(
                        f"🔎 Page {page_number}: "
                    "No embedded text found. Running OCR..."
                )
                     # Get the already-opened PDF page
                    ocr_page = ocr_pdf[page_number - 1]

                    # Render the page as an image
                    pixmap = ocr_page.get_pixmap(dpi=200)
                    image_bytes = pixmap.tobytes("png")

                    image = Image.open(io.BytesIO(image_bytes))

                    # Extract text using Tesseract
                    text = pytesseract.image_to_string(image)
                    text = text.replace("\x00", "")

                    # Extract confidence information
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
                        ocr_confidence = sum(confidences) / len(confidences) / 100.0

                    extraction_method = "OCR"
                page_text.append(text)
                page_record = CaseFilePage(
                    id=uuid.uuid4().hex,
                    case_file_id=payload.document_id,
                    page_number=page_number,
                    extracted_text=text,
                    extraction_method=extraction_method,
                    ocr_confidence=ocr_confidence,
                    extraction_status="EXTRACTED",
                )

                db.add(page_record)

                print(
                    f"📄 Page {page_number}: "
                    f"{len(text)} characters extracted "
                    f"using {extraction_method}"
                )
            ocr_pdf.close()

            await db.commit()

            job.status = ProcessingJobStatus.COMPLETED
            job.completed_at = datetime.utcnow()

            await db.commit()

    except Exception as e:
        print(f"❌ PDF extraction failed: {e}")

        async with AsyncSessionLocal() as db:
            job = await db.get(
                FileProcessingJob,
                job_id,
            )

            if job is not None:
                job.status = ProcessingJobStatus.FAILED
                job.error_message = str(e)[:1000]
                job.completed_at = datetime.utcnow()

                await db.commit()
        raise

    # Combine pages for the current event contract
    full_text = "\n\n".join(page_text)

    page_count = len(reader.pages)

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
