import uuid

import pytest
from sqlalchemy import delete, select

from app.core.contracts import (
    DocumentStatus,
    EntityExtractionSource,
    EntityType,
    TextExtractedPayload,
)
from app.core.database import AsyncSessionLocal
from app.models.case import Case
from app.models.document import Document
from app.models.case_file_page import CaseFilePage
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.subscribers.deterministic_entity_extractor import (
    handle_text_extracted,
)


@pytest.mark.asyncio
async def test_deterministic_subscriber_persists_entities():
    user_id = str(uuid.uuid4())
    case_id = str(uuid.uuid4())
    document_id = str(uuid.uuid4())
    page_id = str(uuid.uuid4())

    username = f"deterministic_test_{uuid.uuid4().hex[:12]}"

    test_text = (
        "Contact: test@example.com. "
        "Phone: +91-98765-43210. "
        "Incident date: 15/08/2025."
    )

    try:
        # ---------------------------------------------------------
        # 1. Create required parent records
        # ---------------------------------------------------------
        async with AsyncSessionLocal() as db:
            user = User(
                id=user_id,
                username=username,
                hashed_password="test-hash",
                full_name="Deterministic Extraction Test",
                role=UserRole.LAWYER,
                is_active=True,
                must_change_password=False,
            )

            case = Case(
                id=case_id,
                case_number=f"TEST-{uuid.uuid4().hex[:12]}",
                title="Deterministic Extraction Test Case",
                description="Temporary test case.",
                classification="CONFIDENTIAL",
                created_by=user_id,
            )

            document = Document(
                id=document_id,
                case_id=case_id,
                file_name="deterministic-test.pdf",
                storage_key=f"test/{document_id}.pdf",
                file_size_bytes=100,
                mime_type="application/pdf",
                status=DocumentStatus.PROCESSED,
                uploaded_by=user_id,
                is_original=True,
            )

            page = CaseFilePage(
                id=page_id,
                case_file_id=document_id,
                page_number=1,
                extracted_text=test_text,
                extraction_method="TEST",
                extraction_status="COMPLETED",
            )

            db.add_all([
                user,
                case,
                document,
                page,
            ])

            await db.commit()

        # ---------------------------------------------------------
        # 2. Simulate TEXT_EXTRACTED
        # ---------------------------------------------------------
        payload = TextExtractedPayload(
            case_id=case_id,
            document_id=document_id,
            text=test_text,
            page_count=1,
        )

        await handle_text_extracted(payload)

        # ---------------------------------------------------------
        # 3. Verify deterministic entities were persisted
        # ---------------------------------------------------------
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Entity)
                .where(Entity.page_id == page_id)
                .order_by(Entity.entity_type)
            )

            entities = result.scalars().all()

            assert len(entities) == 3

            assert all(
                entity.extraction_source
                == EntityExtractionSource.DETERMINISTIC
                for entity in entities
            )

            entity_types = {
                entity.entity_type
                for entity in entities
            }

            assert EntityType.EMAIL in entity_types
            assert EntityType.PHONE in entity_types
            assert EntityType.DATE in entity_types

            normalized_values = {
                entity.normalized_value
                for entity in entities
            }

            assert "test@example.com" in normalized_values
            assert "+919876543210" in normalized_values
            assert "2025-08-15" in normalized_values

    finally:
        # ---------------------------------------------------------
        # 4. Clean up in reverse dependency order
        # ---------------------------------------------------------
        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(Entity).where(
                    Entity.page_id == page_id
                )
            )

            await db.execute(
                delete(CaseFilePage).where(
                    CaseFilePage.id == page_id
                )
            )

            await db.execute(
                delete(Document).where(
                    Document.id == document_id
                )
            )

            await db.execute(
                delete(Case).where(
                    Case.id == case_id
                )
            )

            await db.execute(
                delete(User).where(
                    User.id == user_id
                )
            )

            await db.commit()
