"""
Entity extraction job coordinator.

Listens for text.extracted events and opens (or refreshes) the
ENTITY_EXTRACTION processing job, then triggers n8n to perform the
actual AI extraction.

Actual entity extraction is performed by n8n, not here.
This subscriber's responsibility is to ensure an ENTITY_EXTRACTION
job exists in the correct state, and to kick off n8n's Pipeline
webhook when (and only when) a fresh extraction attempt starts.

n8n performs the AI extraction separately and reports the results
back through POST /entities/ingest. That endpoint is responsible for
persisting Entity rows, marking the job COMPLETED, and publishing
entity.extracted.
"""

from datetime import datetime

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.contracts import (
    ProcessingJobStatus,
    ProcessingType,
    TextExtractedPayload,
)
from app.core.database import AsyncSessionLocal
from app.models.case_file_page import CaseFilePage
from app.models.file_processing_job import FileProcessingJob

N8N_TRIGGER_TIMEOUT = httpx.Timeout(30.0)


async def _trigger_n8n_pipeline(
    document_id: str,
    case_id: str,
    job_id: str,
    pages: list[dict],
) -> None:
    """
    POST the document's page text to n8n so it can run AI extraction.

    n8n is expected to respond quickly (accepting the job) and report
    actual results back later via POST /entities/ingest — this call
    does not wait for extraction itself to finish.

    If this call fails outright (bad URL, n8n unreachable, non-2xx),
    the job is marked FAILED here, since otherwise it would sit in
    PROCESSING indefinitely with no signal anything went wrong.
    """

    if not settings.N8N_PIPELINE_WEBHOOK_URL:
        print(
            "⚠️  N8N_PIPELINE_WEBHOOK_URL not configured — skipping "
            f"n8n trigger for document: {document_id}"
        )
        return

    body = {
        "document_id": document_id,
        "case_id": case_id,
        "job_id": job_id,
        "pages": pages,
    }

    try:
        async with httpx.AsyncClient(timeout=N8N_TRIGGER_TIMEOUT) as client:
            response = await client.post(
                settings.N8N_PIPELINE_WEBHOOK_URL,
                json=body,
                headers={"X-N8N-Secret": settings.N8N_SHARED_SECRET},
            )
            response.raise_for_status()

        print(
            f"📤 Triggered n8n Pipeline for document: {document_id} "
            f"(job {job_id})"
        )

    except Exception as exc:
        print(
            f"❌ Could not trigger n8n Pipeline for document "
            f"{document_id} (job {job_id}): {exc}"
        )

        try:
            async with AsyncSessionLocal() as db:
                failed_job = await db.get(FileProcessingJob, job_id)
                if failed_job is not None:
                    failed_job.status = ProcessingJobStatus.FAILED
                    failed_job.error_message = (
                        f"Failed to trigger n8n Pipeline: {exc}"
                    )[:1000]
                    failed_job.completed_at = datetime.utcnow()
                    await db.commit()
        except Exception as handler_error:
            print(
                f"❌ Could not record n8n-trigger failure for job "
                f"{job_id}: {handler_error}"
            )


async def handle_text_extracted(payload: TextExtractedPayload) -> None:
    """
    Open an ENTITY_EXTRACTION job for the document and leave it
    PROCESSING while n8n performs the actual extraction.

    State handling:

    - No existing job:
        Create a new PROCESSING job, then trigger n8n.

    - Existing PROCESSING job:
        Leave it PROCESSING. Do not create a duplicate job or
        re-trigger n8n.

    - Existing COMPLETED job:
        Leave it COMPLETED. A duplicate text.extracted event must
        not reopen a successfully completed extraction, and must not
        re-trigger n8n.

    - Existing FAILED job:
        Start a new attempt by resetting the job to PROCESSING, then
        trigger n8n again.

    This handler never marks extraction COMPLETED. Completion is handled
    by POST /entities/ingest after n8n successfully reports the results.
    """

    print(
        f"🗂️  Opening ENTITY_EXTRACTION job for document: "
        f"{payload.document_id}"
    )

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(FileProcessingJob)
                .where(
                    FileProcessingJob.case_file_id == payload.document_id,
                    FileProcessingJob.processing_type
                    == ProcessingType.ENTITY_EXTRACTION,
                )
                .order_by(FileProcessingJob.created_at.desc())
            )

            job = result.scalars().first()
            should_trigger_n8n = False

            if job is None:
                # First entity-extraction attempt for this document.
                job = FileProcessingJob(
                    case_file_id=payload.document_id,
                    processing_type=ProcessingType.ENTITY_EXTRACTION,
                    status=ProcessingJobStatus.PROCESSING,
                    attempt_count=1,
                    started_at=datetime.utcnow(),
                )

                db.add(job)
                await db.flush()

                should_trigger_n8n = True

                print(
                    f"✅ ENTITY_EXTRACTION job {job.id} created and is "
                    f"PROCESSING — triggering n8n for document: "
                    f"{payload.document_id}"
                )

            elif job.status == ProcessingJobStatus.COMPLETED:
                # A duplicate text.extracted event must not reopen a
                # job that is already successfully completed.
                print(
                    f"ℹ️  ENTITY_EXTRACTION job {job.id} is already "
                    f"COMPLETED — ignoring duplicate text.extracted "
                    f"event for document: {payload.document_id}"
                )

            elif job.status == ProcessingJobStatus.PROCESSING:
                # Extraction already running — don't create another
                # attempt, reset its state, or re-trigger n8n.
                print(
                    f"ℹ️  ENTITY_EXTRACTION job {job.id} is already "
                    f"PROCESSING — ignoring duplicate text.extracted "
                    f"event for document: {payload.document_id}"
                )

            else:
                # FAILED, or any unexpected status — start a fresh
                # attempt and trigger n8n again.
                job.status = ProcessingJobStatus.PROCESSING
                job.attempt_count += 1
                job.started_at = datetime.utcnow()
                job.completed_at = None
                job.error_message = None

                should_trigger_n8n = True

                print(
                    f"🔄 ENTITY_EXTRACTION job {job.id} restarted "
                    f"(attempt {job.attempt_count}) — triggering n8n "
                    f"for document: {payload.document_id}"
                )

            pages_payload: list[dict] = []

            if should_trigger_n8n:
                pages_result = await db.execute(
                    select(CaseFilePage)
                    .where(CaseFilePage.case_file_id == payload.document_id)
                    .order_by(CaseFilePage.page_number)
                )

                pages_payload = [
                    {
                        "page_number": p.page_number,
                        "text": p.extracted_text or "",
                    }
                    for p in pages_result.scalars().all()
                ]

            # Commit and capture job_id here, still inside the
            # session's context. Nothing below touches `db` or `job`
            # after this block exits.
            await db.commit()
            job_id = job.id

    except Exception as exc:
        print(
            f"❌ Could not open ENTITY_EXTRACTION job for document "
            f"{payload.document_id}: {exc}"
        )
        raise

    if should_trigger_n8n:
        await _trigger_n8n_pipeline(
            document_id=payload.document_id,
            case_id=payload.case_id,
            job_id=job_id,
            pages=pages_payload,
        )
