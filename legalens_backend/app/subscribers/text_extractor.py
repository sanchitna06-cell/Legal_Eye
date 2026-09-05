"""
app/subscribers/text_extractor.py
---------------------------------
Listens for document.uploaded events and extracts text from PDFs.
"""

from csv import reader
import io
import PyPDF2
import uuid

from app.core.database import AsyncSessionLocal
from app.models.case_file_page import CaseFilePage

from app.core.event_bus import event_bus
from app.core.contracts import (
    DocumentUploadedPayload,
    TextExtractedPayload,
)
from app.services.supabase_storage import SupabaseStorage


async def handle_document_uploaded(payload: DocumentUploadedPayload):
    """Extract actual text from the uploaded PDF."""

    print(f"📄 Extracting text from: {payload.file_name}")

    # Create storage client
    storage = SupabaseStorage()

    # The event currently contains document_id,
    # so we will use that later to retrieve the storage key.
    #
    # For this first step, we temporarily construct the
    # storage path from the information already available.
    storage_key = (
        f"cases/{payload.case_id}/"
        f"{payload.document_id}/original.pdf"
    )

    try:
        # Download PDF bytes from Supabase
        file_bytes = storage.download_file(storage_key)

    except Exception as e:
        print(f"❌ Could not download document: {e}")
        return

    # Give the PDF reader an in-memory file
    pdf_stream = io.BytesIO(file_bytes)

    try:
        reader = PyPDF2.PdfReader(pdf_stream)

        page_text = []

        async with AsyncSessionLocal() as db:
            for page_number, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""

                page_text.append(text)

                page_record = CaseFilePage(
                    id=uuid.uuid4().hex,
                    case_file_id=payload.document_id,
                    page_number=page_number,
                    extracted_text=text,
                    extraction_method="PYPDF2_TEXT",
                    ocr_confidence=None,
                    extraction_status="EXTRACTED",
                )

                db.add(page_record)

                print(  
                    f"📄 Page {page_number}: "
                    f"{len(text)} characters extracted"
                )

            await db.commit()

    except Exception as e:
        print(f"❌ PDF extraction failed: {e}")
        return

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