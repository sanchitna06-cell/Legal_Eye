from datetime import datetime

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


async def handle_document_uploaded(
    payload: DocumentUploadedPayload,
) -> None:
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

        await db.commit()

    print(
        f"✅ Integrity anchor created: "
        f"block #{block.block_index} "
        f"for {payload.document_id}"
    )