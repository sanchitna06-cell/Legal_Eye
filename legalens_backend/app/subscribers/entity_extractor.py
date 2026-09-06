"""
app/subscribers/entity_extractor.py
-----------------------------------
Listens for text.extracted events and runs NER to find entities.
"""

from sqlalchemy import select
from datetime import datetime

from app.models.file_processing_job import FileProcessingJob
from app.core.event_bus import event_bus
from app.core.contracts import (
    TextExtractedPayload,
    EntityExtractedPayload,
    ProcessingType,
    ProcessingJobStatus,
)
from app.core.database import AsyncSessionLocal
from app.models.case_file_page import CaseFilePage


async def handle_text_extracted(payload: TextExtractedPayload):
    """Extract entities from text using AI."""

    print(
        f"🔍 Extracting entities from document: "
        f"{payload.document_id}"
    )

    async with AsyncSessionLocal() as db:
        job = FileProcessingJob(
            case_file_id=payload.document_id,
            processing_type=ProcessingType.ENTITY_EXTRACTION,
            status=ProcessingJobStatus.PROCESSING,
            attempt_count=1,
            started_at=datetime.utcnow(),
        )

        db.add(job)
        await db.flush()

        job_id = job.id

        await db.commit()

    try:

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

    except Exception as e:
        print(
            f"❌ Entity extraction failed: {e}"
        )

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