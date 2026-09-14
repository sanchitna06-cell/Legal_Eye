"""
Deterministic entity extraction subscriber.

Listens for TEXT_EXTRACTED events and performs local structured
entity extraction against the document's page-level OCR/text data.

This subscriber is deliberately independent of the existing n8n
entity extraction pipeline.
"""

from __future__ import annotations

from sqlalchemy import delete, select

from app.core.contracts import EntityExtractionSource, TextExtractedPayload
from app.core.database import AsyncSessionLocal
from app.models.case_file_page import CaseFilePage
from app.models.entity import Entity

from app.services.entity_extraction.deterministic import (
    extract_page_entities,
)


async def handle_text_extracted(
    payload: TextExtractedPayload,
) -> None:
    """
    Extract deterministic entities from every extracted page.

    Important:
    - Uses CaseFilePage.extracted_text rather than payload.text.
    - Preserves page-level provenance.
    - Replaces only DETERMINISTIC entities.
    - Never modifies AI entities.
    - Never modifies the ENTITY_EXTRACTION processing job.
    - Never calls n8n.
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CaseFilePage)
                .where(
                    CaseFilePage.case_file_id == payload.document_id,
                )
                .order_by(CaseFilePage.page_number.asc())
            )

            pages = result.scalars().all()

            if not pages:
                print(
                    "⚠️ Deterministic extraction found no pages for "
                    f"document: {payload.document_id}"
                )
                return

            page_ids = [page.id for page in pages]

            # Reprocessing should replace only deterministic results.
            await db.execute(
                delete(Entity).where(
                    Entity.page_id.in_(page_ids),
                    Entity.extraction_source
                    == EntityExtractionSource.DETERMINISTIC,
                )
            )

            entities_to_insert: list[Entity] = []

            for page in pages:
                if not page.extracted_text:
                    continue

                candidates = extract_page_entities(
                    page.extracted_text,
                )

                for candidate in candidates:
                    entities_to_insert.append(
                        Entity(
                            page_id=page.id,
                            entity_type=candidate.entity_type,
                            value=candidate.value,
                            confidence_score=candidate.confidence,
                            context_snippet=candidate.context_snippet,
                            normalized_value=candidate.normalized_value,
                            extraction_source=EntityExtractionSource.DETERMINISTIC,
                        )
                    )

            if entities_to_insert:
                db.add_all(entities_to_insert)

            await db.commit()

            print(
                "🔎 Deterministic entity extraction completed for "
                f"document: {payload.document_id} "
                f"({len(entities_to_insert)} entities)"
            )

    except Exception as exc:
        # Do NOT allow deterministic extraction failures to interfere
        # with the existing TEXT_EXTRACTED → n8n pipeline.
        print(
            "❌ Deterministic entity extraction failed for "
            f"document {payload.document_id}: {exc}"
        )