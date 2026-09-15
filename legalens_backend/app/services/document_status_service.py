"""
app/services/document_status_service.py
---------------------------------------
Maps INTERNAL document-processing state onto the sanitized
PUBLIC status contract used by the frontend.

The processing jobs are the source of truth for whether the
document is actually complete.

A document is publicly COMPLETED only when all required
processing stages have completed:

    TEXT_EXTRACTION
    ENTITY_EXTRACTION
    INTEGRITY_ANCHOR

The case_files.status value is also synchronized from this
service when processing stages change.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.contracts import (
    DocumentStatus,
    DocumentStatusResponse,
    ProcessingJobStatus,
    ProcessingType,
    PublicDocumentStatus,
    PublicProcessingStage,
)
from app.models.case import Case
from app.models.document import Document
from app.models.file_processing_job import FileProcessingJob


# ============================================================
# PUBLIC MESSAGES
# ============================================================

_STAGE_ACTIVE_MESSAGE = {
    PublicProcessingStage.DOCUMENT_ANALYSIS: "Analyzing document.",
    PublicProcessingStage.CASE_RECORD: "Preparing case record.",
    PublicProcessingStage.INTEGRITY: "Securing document integrity.",
    PublicProcessingStage.COMPLETE: "Document analysis complete.",
}


def _public_message(
    stage: PublicProcessingStage,
    status: PublicDocumentStatus,
) -> str:
    if status is PublicDocumentStatus.QUEUED:
        return "Document accepted. Processing queued."

    if status is PublicDocumentStatus.PROCESSING:
        return _STAGE_ACTIVE_MESSAGE[stage]

    if status is PublicDocumentStatus.COMPLETED:
        return "Document processing completed."

    return "The document could not be processed. Please try again."


# ============================================================
# PROCESSING JOB HELPERS
# ============================================================

_REQUIRED_PROCESSING_TYPES = (
    ProcessingType.TEXT_EXTRACTION,
    ProcessingType.ENTITY_EXTRACTION,
    ProcessingType.INTEGRITY_ANCHOR,
)


def _stage_for_job_type(
    processing_type: ProcessingType,
) -> PublicProcessingStage:
    """Map an internal processing type to a public UI stage."""

    if processing_type is ProcessingType.ENTITY_EXTRACTION:
        return PublicProcessingStage.CASE_RECORD

    if processing_type is ProcessingType.INTEGRITY_ANCHOR:
        return PublicProcessingStage.INTEGRITY

    return PublicProcessingStage.DOCUMENT_ANALYSIS


def _latest_jobs_by_type(
    jobs: list[FileProcessingJob],
) -> dict[ProcessingType, FileProcessingJob]:
    """
    Return the newest processing job for each processing type.

    This matters because AI extraction can be retried. The frontend
    must see the state of the latest attempt rather than an older
    failed/completed attempt.
    """

    latest: dict[ProcessingType, FileProcessingJob] = {}

    for job in jobs:
        current = latest.get(job.processing_type)

        if current is None:
            latest[job.processing_type] = job
            continue

        if job.created_at > current.created_at:
            latest[job.processing_type] = job

    return latest


# ============================================================
# PUBLIC STATUS MAPPING
# ============================================================

def _map_to_public_status(
    doc_status: DocumentStatus,
    jobs: list[FileProcessingJob],
) -> DocumentStatusResponse:
    """
    Derive the frontend-facing processing state.

    IMPORTANT:

    file_processing_jobs is authoritative for processing progress.

    We do NOT trust case_files.status == PROCESSED by itself because
    text extraction can finish before entity extraction and integrity
    processing finish.
    """

    latest = _latest_jobs_by_type(jobs)

    # --------------------------------------------------------
    # 1. FAILED STATES
    # --------------------------------------------------------

    # Check the latest job for each required stage.
    #
    # A failed stage takes priority over processing/completed states.
    for processing_type in _REQUIRED_PROCESSING_TYPES:
        job = latest.get(processing_type)

        if job is None:
            continue

        if job.status is ProcessingJobStatus.FAILED:
            stage = _stage_for_job_type(processing_type)

            return DocumentStatusResponse(
                status=PublicDocumentStatus.FAILED,
                stage=stage,
                message=_public_message(
                    stage,
                    PublicDocumentStatus.FAILED,
                ),
            )

    # Integrity failure stored directly on the document.
    if doc_status is DocumentStatus.INTEGRITY_FAILED:
        stage = PublicProcessingStage.INTEGRITY

        return DocumentStatusResponse(
            status=PublicDocumentStatus.FAILED,
            stage=stage,
            message=_public_message(
                stage,
                PublicDocumentStatus.FAILED,
            ),
        )

    # Generic document error.
    if doc_status is DocumentStatus.ERROR:
        stage = PublicProcessingStage.DOCUMENT_ANALYSIS

        return DocumentStatusResponse(
            status=PublicDocumentStatus.FAILED,
            stage=stage,
            message=_public_message(
                stage,
                PublicDocumentStatus.FAILED,
            ),
        )

    # --------------------------------------------------------
    # 2. ACTIVE PROCESSING
    # --------------------------------------------------------

    # Check the required stages in pipeline order.
    #
    # This makes the UI report the earliest stage currently active.
    for processing_type in _REQUIRED_PROCESSING_TYPES:
        job = latest.get(processing_type)

        if job is None:
            continue

        if job.status is ProcessingJobStatus.PROCESSING:
            stage = _stage_for_job_type(processing_type)

            return DocumentStatusResponse(
                status=PublicDocumentStatus.PROCESSING,
                stage=stage,
                message=_public_message(
                    stage,
                    PublicDocumentStatus.PROCESSING,
                ),
            )

    # --------------------------------------------------------
    # 3. QUEUED / BETWEEN PIPELINE HAND-OFFS
    # --------------------------------------------------------

    # If there are processing jobs but one of the required stages
    # has not been created yet, the document is still progressing
    # through the pipeline rather than being complete.
    if latest:
        incomplete_types = [
            processing_type
            for processing_type in _REQUIRED_PROCESSING_TYPES
            if (
                latest.get(processing_type) is None
                or latest[processing_type].status
                is not ProcessingJobStatus.COMPLETED
            )
        ]

        if incomplete_types:
            stage = _stage_for_job_type(incomplete_types[0])

            return DocumentStatusResponse(
                status=PublicDocumentStatus.PROCESSING,
                stage=stage,
                message=_public_message(
                    stage,
                    PublicDocumentStatus.PROCESSING,
                ),
            )

    # --------------------------------------------------------
    # 4. COMPLETED
    # --------------------------------------------------------

    # Completion is valid ONLY when every required processing job
    # exists and is COMPLETED.
    all_required_completed = all(
        latest.get(processing_type) is not None
        and latest[processing_type].status
        is ProcessingJobStatus.COMPLETED
        for processing_type in _REQUIRED_PROCESSING_TYPES
    )

    if all_required_completed:
        stage = PublicProcessingStage.COMPLETE

        return DocumentStatusResponse(
            status=PublicDocumentStatus.COMPLETED,
            stage=stage,
            message=_public_message(
                stage,
                PublicDocumentStatus.COMPLETED,
            ),
        )

    # --------------------------------------------------------
    # 5. BRAND NEW DOCUMENT
    # --------------------------------------------------------

    stage = PublicProcessingStage.DOCUMENT_ANALYSIS

    return DocumentStatusResponse(
        status=PublicDocumentStatus.QUEUED,
        stage=stage,
        message=_public_message(
            stage,
            PublicDocumentStatus.QUEUED,
        ),
    )


# ============================================================
# DOCUMENT STATUS API
# ============================================================

async def get_document_status_for_user(
    db: AsyncSession,
    document_id: str,
    user_id: str,
) -> DocumentStatusResponse | None:
    """
    Return the public processing status of a document for an
    authorized user.

    Returns None when the document does not exist or when the user
    does not own the case containing it.

    Foreign documents therefore remain indistinguishable from
    nonexistent documents.
    """

    stmt = (
        select(Document)
        .join(
            Case,
            Document.case_id == Case.id,
        )
        .where(
            Document.id == document_id,
            Case.created_by == user_id,
        )
    )

    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if document is None:
        return None

    jobs_result = await db.execute(
        select(FileProcessingJob).where(
            FileProcessingJob.case_file_id == document.id
        )
    )

    jobs = list(jobs_result.scalars().all())

    return _map_to_public_status(
        document.status,
        jobs,
    )


# ============================================================
# INTERNAL DOCUMENT LIFECYCLE SYNCHRONIZATION
# ============================================================

async def sync_document_lifecycle_status(
    db: AsyncSession,
    document: Document,
) -> DocumentStatus:
    """
    Synchronize case_files.status with the actual processing pipeline.

    Rules:

        all required jobs COMPLETED
            -> PROCESSED

        integrity job FAILED
            -> INTEGRITY_FAILED

        text/entity job FAILED
            -> ERROR

        otherwise, processing has started
            -> PROCESSING

    This prevents TEXT_EXTRACTION from incorrectly marking the entire
    document as PROCESSED while AI/entity extraction is still running.
    """

    result = await db.execute(
        select(FileProcessingJob).where(
            FileProcessingJob.case_file_id == document.id
        )
    )

    jobs = list(result.scalars().all())
    latest = _latest_jobs_by_type(jobs)

    # --------------------------------------------------------
    # INTEGRITY FAILURE
    # --------------------------------------------------------

    integrity_job = latest.get(
        ProcessingType.INTEGRITY_ANCHOR
    )

    if (
        integrity_job is not None
        and integrity_job.status is ProcessingJobStatus.FAILED
    ):
        document.status = DocumentStatus.INTEGRITY_FAILED
        return document.status

    # --------------------------------------------------------
    # TEXT / ENTITY FAILURE
    # --------------------------------------------------------

    for processing_type in (
        ProcessingType.TEXT_EXTRACTION,
        ProcessingType.ENTITY_EXTRACTION,
    ):
        job = latest.get(processing_type)

        if (
            job is not None
            and job.status is ProcessingJobStatus.FAILED
        ):
            document.status = DocumentStatus.ERROR
            return document.status

    # --------------------------------------------------------
    # FULL COMPLETION
    # --------------------------------------------------------

    all_required_completed = all(
        latest.get(processing_type) is not None
        and latest[processing_type].status
        is ProcessingJobStatus.COMPLETED
        for processing_type in _REQUIRED_PROCESSING_TYPES
    )

    if all_required_completed:
        document.status = DocumentStatus.PROCESSED
        return document.status

    # --------------------------------------------------------
    # PROCESSING / QUEUED
    # --------------------------------------------------------

    if jobs:
        document.status = DocumentStatus.PROCESSING

    return document.status