from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.contracts import AnnotationCreate, AnnotationResponse, AnnotationUpdate
from app.core.database import get_db
from app.core.security import get_current_lawyer
from app.services.annotation_service import AnnotationService
from sqlalchemy import select

from app.models.annotation import Annotation
from app.models.case_file_page import CaseFilePage
from app.models.document import Document
from app.models.case import Case


router = APIRouter(
    prefix="/annotations",
    tags=["Annotations"],
)

@router.patch(
    "/{annotation_id}",
    response_model=AnnotationResponse,
)
async def update_annotation(
    annotation_id: str,
    data: AnnotationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_lawyer),
):
    annotation = await AnnotationService.update_annotation(
        db,
        annotation_id=annotation_id,
        user_id=current_user["user_id"],
        data=data,
    )

    if annotation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found.",
        )

    await db.commit()
    await db.refresh(annotation)

    return annotation
@router.post(
    "/{page_id}",
    response_model=AnnotationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_annotation(
    page_id: str,
    data: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_lawyer),
):
    annotation = await AnnotationService.create_annotation(
        db,
        page_id=page_id,
        user_id=current_user["user_id"],
        data=data,
    )

    if annotation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found.",
        )

    await db.commit()
    await db.refresh(annotation)

    return annotation
@router.get(
    "/{page_id}",
    response_model=list[AnnotationResponse],
)
async def get_annotations(
    page_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_lawyer),
):
    page = await AnnotationService.get_accessible_page(
        db,
        page_id=page_id,
        user_id=current_user["user_id"],
    )

    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found.",
        )

    return await AnnotationService.get_annotations(
        db,
        page_id=page_id,
        user_id=current_user["user_id"],
    )
@router.delete(
    "/{annotation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_annotation(
    annotation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_lawyer),
):
    annotation = await AnnotationService.delete_annotation(
        db,
        annotation_id=annotation_id,
        user_id=current_user["user_id"],
    )

    if annotation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found.",
        )

    await db.commit()
@router.get("/documents/{document_id}/annotations")
async def get_document_annotations(
    document_id: str,
    current_user: dict = Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Annotation)
        .join(CaseFilePage, Annotation.page_id == CaseFilePage.id)
        .join(Document, CaseFilePage.case_file_id == Document.id)
        .join(Case, Document.case_id == Case.id)
        .where(
            Document.id == document_id,
            Case.created_by == current_user["user_id"],
            Annotation.deleted_at.is_(None),
        )
        .order_by(
            CaseFilePage.page_number.asc(),
            Annotation.created_at.asc(),
        )
    )

    result = await db.execute(stmt)
    annotations = result.scalars().all()

    return annotations