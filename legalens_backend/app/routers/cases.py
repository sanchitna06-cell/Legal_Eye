from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_investigator
from app.services.case_service import CaseService

router = APIRouter(prefix="/cases", tags=["Cases"])

@router.get("/")
async def list_cases(
    current_user: dict = Depends(get_current_investigator),
    db: AsyncSession = Depends(get_db),
):
    """List all cases (filtered by user role)."""
    service = CaseService(db)
    return await service.get_all_cases()

@router.get("/{case_id}")
async def get_case(
    case_id: str,
    current_user: dict = Depends(get_current_investigator),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific case by ID."""
    service = CaseService(db)
    case = await service.get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.post("/")
async def create_case(
    case_data: dict,
    current_user: dict = Depends(get_current_supervisor),
    db: AsyncSession = Depends(get_db),
):
    """Create a new case (Supervisor/Admin only)."""
    service = CaseService(db)
    return await service.create_case(case_data, current_user)