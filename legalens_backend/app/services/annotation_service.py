from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import Case
from app.models.case_file_page import CaseFilePage
from app.models.document import Document
from app.core.contracts import AnnotationCreate, AnnotationUpdate
from app.models.annotation import Annotation
from app.models.annotation_history import AnnotationHistory
from app.models import annotation
from sqlalchemy import select
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

class AnnotationService:

    @staticmethod
    async def get_accessible_page(
        db: AsyncSession,
        *,
        page_id: str,
        user_id: str,
    ) -> CaseFilePage | None:
        """
        Return a page only if the requesting lawyer owns
        the case containing its document.

        Authorization path:

        CaseFilePage
            -> Document
            -> Case
            -> Case.created_by == user_id
        """

        result = await db.execute(
            select(CaseFilePage)
            .join(Document, CaseFilePage.case_file_id == Document.id)
            .join(Case, Document.case_id == Case.id)
            .where(
                CaseFilePage.id == page_id,
                Case.created_by == user_id,
            )
        )

        return result.scalar_one_or_none()
    @staticmethod
    async def create_annotation(
        db: AsyncSession,
        *,
        page_id: str,
        user_id: str,
        data: AnnotationCreate,
    ) -> Annotation | None:
        """
        Create an annotation only on a page that the user is
        authorized to access.
        """

        page = await AnnotationService.get_accessible_page(
            db,
            page_id=page_id,
            user_id=user_id,
        )

        if page is None:
            return None

        annotation = Annotation(
            page_id=page_id,
            created_by=user_id,
            annotation_type=data.annotation_type,
            content=data.content,
            position=data.position,
        )

        db.add(annotation)
        await db.flush()

        history = AnnotationHistory(
            annotation_id=annotation.id,
            changed_by=user_id,
            action="CREATE",
            annotation_type=annotation.annotation_type,
            content=annotation.content,
            position=annotation.position,
        )

        db.add(history)
        await db.flush()

        return annotation
    @staticmethod
    async def get_annotations(
        db: AsyncSession,
        *,
        page_id: str,
        user_id: str,
    ) -> list[Annotation]:
        page = await AnnotationService.get_accessible_page(
            db,
            page_id=page_id,
            user_id=user_id,
        )

        if page is None:
            return []

        result = await db.execute(
            select(Annotation)
            .where(Annotation.page_id == page_id)
            .where(Annotation.deleted_at.is_(None))
            .order_by(Annotation.created_at.asc())
        )

        return list(result.scalars().all())
    @staticmethod
    async def update_annotation(
        db: AsyncSession,
        *,
        annotation_id: str,
        user_id: str,
        data: AnnotationUpdate,
    ) -> Annotation | None:
        result = await db.execute(
            select(Annotation)
            .join(CaseFilePage, Annotation.page_id == CaseFilePage.id)
            .join(Document, CaseFilePage.case_file_id == Document.id)
            .join(Case, Document.case_id == Case.id)
            .where(
                Annotation.id == annotation_id,
                Case.created_by == user_id,
                Annotation.deleted_at.is_(None),
            )
        )

        annotation = result.scalar_one_or_none()

        if annotation is None:
            return None

        if data.annotation_type is not None:
            annotation.annotation_type = data.annotation_type

        if data.content is not None:
            annotation.content = data.content

        if data.position is not None:
            annotation.position = data.position

        history = AnnotationHistory(
            annotation_id=annotation.id,
            changed_by=user_id,
            action="UPDATE",
            annotation_type=annotation.annotation_type,
            content=annotation.content,
            position=annotation.position,
        )

        db.add(history)

        await db.flush()

        return annotation
    @staticmethod
    async def delete_annotation(
        db: AsyncSession,
        *,
        annotation_id: str,
        user_id: str,
    ) -> Annotation | None:
        result = await db.execute(
            select(Annotation)
            .join(CaseFilePage, Annotation.page_id == CaseFilePage.id)
            .join(Document, CaseFilePage.case_file_id == Document.id)
            .join(Case, Document.case_id == Case.id)
            .where(
                Annotation.id == annotation_id,
                Case.created_by == user_id,
                Annotation.deleted_at.is_(None),
            )
        )

        annotation = result.scalar_one_or_none()

        if annotation is None:
            return None

        # Record the deletion in the immutable history.
        history = AnnotationHistory(
            annotation_id=annotation.id,
            changed_by=user_id,
            action="DELETE",
            annotation_type=annotation.annotation_type,
            content=annotation.content,
            position=annotation.position,
        )

        db.add(history)

        # Soft-delete the annotation.
        annotation.deleted_at = datetime.utcnow()

        await db.flush()

        return annotation