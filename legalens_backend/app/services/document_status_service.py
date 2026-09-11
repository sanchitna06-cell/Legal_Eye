"""
app/services/document_status_service.py
---------------------------------------
Maps INTERNAL document-processing state (case_files.status,
file_processing_jobs rows) onto the sanitized PUBLIC status
contract defined in app/core/contracts.py.

This module is the single translation point between the
internal processing pipeline and the public API. It performs
authorization-safe lookups and never leaks internal
identifiers, storage keys, event names, or infrastructure
details beyond the contract shape.
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

# Friendly, stage-specific working copy for the UI.
_STAGE_ACTIVE_MESSAGE = {
    PublicProcessingStage.DOCUMENT_ANALYSIS: "Analyzing document.",
    PublicProcessingStage.CASE_RECORD: "Preparing case record.",
    PublicProcessingStage.INTEGRITY: "Securing document integrity.",
    PublicProcessingStage.COMPLETE: "Document analysis complete.",
}


def _public_message(stage: PublicProcessingStage, status: PublicDocumentStatus) -> str:
    if status is PublicDocumentStatus.QUEUED:
        return "Document accepted. Processing queued."

    if status is PublicDocumentStatus.PROCESSING:
        return _STAGE_ACTIVE_MESSAGE[stage]

    if status is PublicDocumentStatus.COMPLETED:
        return "Document processing completed."

    return "The document could not be processed. Please try again."


async def get_document_status_for_user(
    db: AsyncSession,
    document_id: str,
    user_id: str,
) -> DocumentStatusResponse | None:
    """
    Return the public status of a document for an authorized user.

    Returns None when the document does not exist or the user does
    not own the case it belongs to — the caller must treat both as
    404 so the existence of foreign documents is not revealed.
    """

    stmt = (
        select(Document)
        .join(Case, Document.case_id == Case.id)
        .where(
            Document.id == document_id,
            Case.created_by == user_id,
        )
    )

    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if document is None:
        # Foreign or nonexistent document: identical, opaque response.
        return None

    jobs_result = await db.execute(
        select(FileProcessingJob).where(
            FileProcessingJob.case_file_id == document.id
        )
    )
    jobs = list(jobs_result.scalars().all())

    return _map_to_public_status(document.status, jobs)


def _stage_for_job_type(processing_type: ProcessingType) -> PublicProcessingStage:
    """Internal job type -> public stage (single mapping point)."""

    if processing_type is ProcessingType.ENTITY_EXTRACTION:
        return PublicProcessingStage.CASE_RECORD

    if processing_type is ProcessingType.INTEGRITY_ANCHOR:
        return PublicProcessingStage.INTEGRITY

    # TEXT_EXTRACTION (and any future job type) reports as analysis.
    return PublicProcessingStage.DOCUMENT_ANALYSIS


def _map_to_public_status(
    doc_status: DocumentStatus,
    jobs: list[FileProcessingJob],
) -> DocumentStatusResponse:
    """
    Derive the public status/stage from internal state.

    Mapping (deliberately coarse-grained and infrastructure-free):

        case_files.status INTEGRITY_FAILED    -> FAILED / INTEGRITY
        case_files.status ERROR               -> FAILED / DOCUMENT_ANALYSIS
        case_files.status PROCESSED|VERIFIED  -> COMPLETED / COMPLETE
        case_files.status UPLOADED|PROCESSING -> observe processing jobs:
            - any FAILED job                  -> FAILED (stage = that job's stage)
            - an active job                   -> PROCESSING (stage = job's stage)
            - no active job yet               -> QUEUED (accepted, not started)
    """

    # Terminal document states first.
    if doc_status is DocumentStatus.INTEGRITY_FAILED:
        return DocumentStatusResponse(
            status=PublicDocumentStatus.FAILED,
            stage=PublicProcessingStage.INTEGRITY,
            message=_public_message(PublicProcessingStage.INTEGRITY, PublicDocumentStatus.FAILED),
        )

    if doc_status is DocumentStatus.ERROR:
        return DocumentStatusResponse(
            status=PublicDocumentStatus.FAILED,
            stage=PublicProcessingStage.DOCUMENT_ANALYSIS,
            message=_public_message(
                PublicProcessingStage.DOCUMENT_ANALYSIS, PublicDocumentStatus.FAILED
            ),
        )

    if doc_status in (DocumentStatus.PROCESSED, DocumentStatus.VERIFIED):
        return DocumentStatusResponse(
            status=PublicDocumentStatus.COMPLETED,
            stage=PublicProcessingStage.COMPLETE,
            message=_public_message(PublicProcessingStage.COMPLETE, PublicDocumentStatus.COMPLETED),
        )

    # Non-terminal document state: let the processing jobs speak.
    failed = [job for job in jobs if job.status is ProcessingJobStatus.FAILED]
    if failed:
        stage = _stage_for_job_type(failed[0].processing_type)
        return DocumentStatusResponse(
            status=PublicDocumentStatus.FAILED,
            stage=stage,
            message=_public_message(stage, PublicDocumentStatus.FAILED),
        )

    running = [job for job in jobs if job.status is ProcessingJobStatus.PROCESSING]
    if running:
        # Report the earliest active stage in the pipeline.
        stage = _stage_for_job_type(running[0].processing_type)
        return DocumentStatusResponse(
            status=PublicDocumentStatus.PROCESSING,
            stage=stage,
            message=_public_message(stage, PublicDocumentStatus.PROCESSING),
        )

    # No failed and no running job: the document is accepted but no
    # processing has started (or is between pipeline hand-offs).
    return DocumentStatusResponse(
        status=PublicDocumentStatus.QUEUED,
        stage=PublicProcessingStage.INTEGRITY,
        message=_public_message(PublicProcessingStage.INTEGRITY, PublicDocumentStatus.QUEUED),
    )
