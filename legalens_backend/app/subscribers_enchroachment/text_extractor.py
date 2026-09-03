"""
app/subscribers/text_extractor.py
---------------------------------
Listens for document.uploaded events and extracts text from PDFs.
"""

import os
import PyPDF2
from app.core.event_bus import event_bus
from app.core.contracts import DocumentUploadedPayload, TextExtractedPayload

async def handle_document_uploaded(payload: DocumentUploadedPayload):
    """Extract text from the uploaded document."""
    print(f"📄 Extracting text from: {payload.file_name}")
    
    # In a real implementation, you would locate the file path from DB
    # For now, we simulate extraction
    sample_text = f"""
    This is a simulated text extraction from {payload.file_name}.
    The document contains witness statements and case details.
    Case ID: {payload.case_id}
    Uploaded by: {payload.uploaded_by}
    """
    
    # Emit the extracted text event
    await event_bus.publish(
        "text.extracted",
        TextExtractedPayload(
            document_id=payload.document_id,
            text=sample_text,
            page_count=3
        )
    )
    
    print(f"✅ Text extracted for document: {payload.document_id}")