import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.contracts import (
    EntityExtractedPayload,
    ProcessingType,
    ProcessingJobStatus,
)
from app.core.database import get_db
from app.core.event_bus import event_bus
from app.core.events import ENTITY_EXTRACTED
from app.models.case_file_page import CaseFilePage
from app.models.document import Document
from app.models.entity import Entity
from app.models.file_processing_job import FileProcessingJob


router = APIRouter(
    prefix="/entities",
    tags=["Entities"],
)


@router.post("/ingest")
async def ingest_entities(
    payload: EntityExtractedPayload,
    x_n8n_secret: str | None = Header(
        default=None,
        alias="X-N8N-Secret",
    ),
    db: AsyncSession = Depends(get_db),
):
    # ---------------------------------------------------------
    # 1. Authenticate n8n
    # ---------------------------------------------------------

    if not x_n8n_secret or not secrets.compare_digest(
        x_n8n_secret,
        settings.N8N_SHARED_SECRET,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ingestion credentials",
        )

    # ---------------------------------------------------------
    # 2. Validate document
    # ---------------------------------------------------------

    document = await db.get(
        Document,
        payload.document_id,
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.case_id != payload.case_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document does not belong to the specified case",
        )

    # ---------------------------------------------------------
    # 3. Find entity-extraction job
    # ---------------------------------------------------------

    job_result = await db.execute(
        select(FileProcessingJob)
        .where(
            FileProcessingJob.case_file_id
            == payload.document_id,
            FileProcessingJob.processing_type
            == ProcessingType.ENTITY_EXTRACTION,
        )
        .order_by(
            FileProcessingJob.created_at.desc()
        )
        .limit(1)
    )

    job = job_result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No entity extraction job exists for this document",
        )

    # ---------------------------------------------------------
    # 4. Idempotency
    # ---------------------------------------------------------

    if job.status == ProcessingJobStatus.COMPLETED:
        return {
            "status": "already_processed",
            "document_id": payload.document_id,
            "entity_count": 0,
        }

    # ---------------------------------------------------------
    # 5. Resolve page numbers → page IDs
    # ---------------------------------------------------------

    page_result = await db.execute(
        select(CaseFilePage)
        .where(
            CaseFilePage.case_file_id
            == payload.document_id
        )
    )

    pages = page_result.scalars().all()

    pages_by_number = {
        page.page_number: page.id
        for page in pages
    }

    # Validate every supplied page number first.
    for item in payload.entities:
        if item.page_number not in pages_by_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Page {item.page_number} does not exist "
                    f"for document {payload.document_id}"
                ),
            )

    # ---------------------------------------------------------
    # 6. Replace entities for this document
    # ---------------------------------------------------------

    page_ids = list(pages_by_number.values())

    if page_ids:
        await db.execute(
            delete(Entity).where(
                Entity.page_id.in_(page_ids)
            )
        )

    # ---------------------------------------------------------
    # 7. Insert extracted entities
    # ---------------------------------------------------------

    entities = []

    for item in payload.entities:
        entities.append(
            Entity(
                id=uuid.uuid4().hex,
                page_id=pages_by_number[item.page_number],
                entity_type=item.entity_type,
                value=item.value,
                confidence_score=item.confidence,
                context_snippet=item.context_snippet,
                normalized_value=item.normalized_value,
                created_at=datetime.utcnow(),
            )
        )

    db.add_all(entities)

    # ---------------------------------------------------------
    # 8. Mark processing job complete
    # ---------------------------------------------------------

    job.status = ProcessingJobStatus.COMPLETED
    job.completed_at = datetime.utcnow()
    job.error_message = None

    await db.commit()

    # ---------------------------------------------------------
    # 9. Publish canonical event
    # ---------------------------------------------------------

    await event_bus.publish(
        ENTITY_EXTRACTED,
        payload,
    )

    return {
        "status": "processed",
        "document_id": payload.document_id,
        "entity_count": len(entities),
    }