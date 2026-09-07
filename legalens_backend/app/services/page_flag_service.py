from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import Case
from app.models.case_file_page import CaseFilePage
from app.models.document import Document
from app.models.page_flag import PageFlag
from app.core.contracts import PageFlagCreate
from app.services.audit_service import AuditService
from app.models import document


class PageFlagService:

    ALLOWED_FLAG_TYPES = {
        "IRRELEVANT",
        "DUPLICATE",
        "UNREADABLE",
        "OTHER",
    }

    @staticmethod
    async def get_accessible_page(
        db: AsyncSession,
        *,
        page_id: str,
        user_id: str,
    ) -> CaseFilePage | None:

        result = await db.execute(
            select(CaseFilePage)
            .join(
                Document,
                CaseFilePage.case_file_id == Document.id,
            )
            .join(
                Case,
                Document.case_id == Case.id,
            )
            .where(
                CaseFilePage.id == page_id,
                Case.created_by == user_id,
            )
        )

        return result.scalar_one_or_none()

    @staticmethod
    async def create_flag(
        db: AsyncSession,
        *,
        page_id: str,
        user_id: str,
        data: PageFlagCreate,
    ) -> PageFlag | None:

        if data.flag_type not in PageFlagService.ALLOWED_FLAG_TYPES:
            raise ValueError("Invalid page flag type.")

        page = await PageFlagService.get_accessible_page(
            db,
            page_id=page_id,
            user_id=user_id,
        )

        if page is None:
            return None

        flag = PageFlag(
            page_id=page_id,
            flagged_by=user_id,
            flag_type=data.flag_type,
            reason=data.reason,
        )

        db.add(flag)
        await db.flush()
        document_result = await db.execute(
            select(Document).where(
                Document.id == page.case_file_id
            )
        )

        document = document_result.scalar_one()
        await AuditService.log(
            db,
            user_id=user_id,
            action="PAGE_FLAG_CREATED",
            case_id=page.case_file.case_id,
            document_id=page.case_file_id,
            details={
                "flag_id": flag.id,
                "page_id": page_id,
                "flag_type": data.flag_type,
            },
        )

        return flag
    @staticmethod
    async def get_flags(
        db: AsyncSession,
        *,
        page_id: str,
        user_id: str,
    ) -> list[PageFlag]:

        page = await PageFlagService.get_accessible_page(
            db,
            page_id=page_id,
            user_id=user_id,
        )

        if page is None:
            return []

        result = await db.execute(
            select(PageFlag)
            .where(PageFlag.page_id == page_id)
            .order_by(PageFlag.created_at.asc())
        )

        return list(result.scalars().all())