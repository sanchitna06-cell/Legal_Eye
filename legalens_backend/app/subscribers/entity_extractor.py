"""
app/subscribers/entity_extractor.py
-----------------------------------
Listens for text.extracted events and runs NER to find entities.
"""
from sqlalchemy import select

from app.core.event_bus import event_bus
from app.core.contracts import TextExtractedPayload, EntityExtractedPayload
from app.core.database import AsyncSessionLocal
from app.models.case_file_page import CaseFilePage


async def handle_text_extracted(payload: TextExtractedPayload):
    """Extract entities from text using AI."""

    print(
        f"🔍 Extracting entities from document: "
        f"{payload.document_id}"
    )

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CaseFilePage)
            .where(
                CaseFilePage.case_file_id == payload.document_id
            )
            .order_by(CaseFilePage.page_number)
        )

        pages = result.scalars().all()

    print(
        f"📚 Found {len(pages)} extracted pages "
        f"for document: {payload.document_id}"
    )

    for page in pages:
        print(
            f"🧾 Processing page {page.page_number} "
            f"(page_id={page.id}, "
            f"text_length={len(page.extracted_text or '')})"
        )