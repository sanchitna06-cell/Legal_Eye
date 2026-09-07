from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.contracts import PageFlagCreate, PageFlagResponse
from app.core.database import get_db
from app.core.security import get_current_lawyer
from app.services.page_flag_service import PageFlagService


router = APIRouter(
    prefix="/page-flags",
    tags=["Page Flags"],
)


@router.post(
    "/{page_id}",
    response_model=PageFlagResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_page_flag(
    page_id: str,
    data: PageFlagCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_lawyer),
):
    try:
        flag = await PageFlagService.create_flag(
            db,
            page_id=page_id,
            user_id=current_user["user_id"],
            data=data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found.",
        )

    await db.commit()
    await db.refresh(flag)

    return flag
@router.get(
    "/{page_id}",
    response_model=list[PageFlagResponse],
)
async def get_page_flags(
    page_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_lawyer),
):
    page = await PageFlagService.get_accessible_page(
        db,
        page_id=page_id,
        user_id=current_user["user_id"],
    )

    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found.",
        )

    return await PageFlagService.get_flags(
        db,
        page_id=page_id,
        user_id=current_user["user_id"],
    )