from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.case import Case

class CaseService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all_cases(self):
        stmt = select(Case)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_case_by_id(self, case_id: str) -> Case | None:
        stmt = select(Case).where(Case.id == case_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def create_case(self, case_data: dict, current_user: dict):
        import uuid
        case = Case(
            id=uuid.uuid4().hex,
            case_number=case_data.get("case_number", f"CASE-{uuid.uuid4().hex[:8].upper()}"),
            title=case_data.get("title", "Untitled Case"),
            description=case_data.get("description", ""),
            classification=case_data.get("classification", "CONFIDENTIAL"),
            department=case_data.get("department", ""),
            lead_investigator_id=current_user.get("user_id"),
        )
        self.db.add(case)
        await self.db.commit()
        await self.db.refresh(case)
        return case