from datetime import datetime

from sqlalchemy import select

from app.core.blockchain import BlockchainService
from app.core.contracts import (
    DocumentUploadedPayload,
    ProcessingType,
    ProcessingJobStatus,
)
from app.models.file_processing_job import FileProcessingJob
from app.core.database import AsyncSessionLocal
from app.models.document import Document
from app.models.document_integrity import DocumentIntegrity
from app.services.document_status_service import (
    sync_document_lifecycle_status,
)


async def _mark_integrity_failed(document_id: str, message: str) -> None:
    """Mark the integrity job failed using FRESH database sessions.

    A session whose transaction has already failed cannot commit, so
    the session from the failing operation is never reused here.
    Handler errors are logged and swallowed so they never mask the
    original failure or leave the job stuck in PROCESSING.
    """

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(FileProcessingJob).where(
                    FileProcessingJob.case_file_id == document_id,
                    FileProcessingJob.processing_type
                    == ProcessingType.INTEGRITY_ANCHOR,
                )
            )

            jobs = list(result.scalars().all())

            if jobs:
                for job in jobs:
                    if job.status is ProcessingJobStatus.PROCESSING:
                        job.status = ProcessingJobStatus.FAILED
                        job.error_message = message[:1000]
                        job.completed_at = datetime.utcnow()
            else:
                # No job row survived the failure — create one so the
                # failure is observable instead of invisible.
                db.add(
                    FileProcessingJob(
                        case_file_id=document_id,
                        processing_type=ProcessingType.INTEGRITY_ANCHOR,
                        status=ProcessingJobStatus.FAILED,
                        attempt_count=1,
                        error_message=message[:1000],
                        completed_at=datetime.utcnow(),
                    )
                )

            document = await db.get(
                Document,
                document_id,
            )

            if document is not None:
                await sync_document_lifecycle_status(
                    db,
                    document,
                )

            await db.commit()

    except Exception as handler_error:
        print(
            f"❌ Could not record integrity failure "
            f"for document {document_id}: {handler_error}"
        )


async def handle_document_uploaded(
    payload: DocumentUploadedPayload,
) -> None:
    """Anchor the document into the integrity chain.

    Errors are caught (not re-raised) so a failure here cannot abort
    the rest of the document.uploaded fan-out; the integrity job is
    marked FAILED using fresh sessions so a broken transaction can
    never mask the failure or leave the job stuck in PROCESSING.
    """

    try:
        async with AsyncSessionLocal() as db:
            blockchain = BlockchainService(db)

            # Create integrity processing job
            job = FileProcessingJob(
                case_file_id=payload.document_id,
                processing_type=ProcessingType.INTEGRITY_ANCHOR,
                status=ProcessingJobStatus.PROCESSING,
                attempt_count=1,
                started_at=datetime.utcnow(),
            )

            db.add(job)
            await db.flush()

            # Verify that the document exists
            document = await db.get(
                Document,
                payload.document_id,
            )

            if document is None:
                raise RuntimeError(
                    f"Document {payload.document_id} not found "
                    "while recording integrity."
                )

            print(
                f"🔗 Adding blockchain block for: "
                f"{payload.document_id}"
            )

            # Add document hash to the cryptographic hash chain
            block = await blockchain.add_block(
                action="UPLOAD",
                document_id=payload.document_id,
                document_hash=payload.sha256_hash,
                user_id=payload.uploaded_by,
                metadata={
                    "case_id": payload.case_id,
                    "file_name": payload.file_name,
                },
            )

            # Create the canonical integrity record
            integrity = DocumentIntegrity(
                case_file_id=document.id,
                sha256_hash=payload.sha256_hash,
                algorithm="SHA-256",
                blockchain_block_id=block.id,
                blockchain_hash=block.hash,
                anchored_at=block.created_at,
            )

            db.add(integrity)

            # Mark integrity processing job as completed
            job.status = ProcessingJobStatus.COMPLETED
            job.completed_at = datetime.utcnow()

            await sync_document_lifecycle_status(
                db,
                document,
            )

            await db.commit()

        print(
            f"✅ Integrity anchor created: "
            f"block #{block.block_index} "
            f"for {payload.document_id}"
        )

    except Exception as e:
        print(
            f"❌ Integrity anchoring failed for "
            f"{payload.document_id}: {e}"
        )

        await _mark_integrity_failed(
            payload.document_id,
            str(e),
        )