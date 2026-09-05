from typing import Dict, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_lawyer
from app.models.case import Case


router = APIRouter()


class CaseCreate(BaseModel):
    title: str
    description: str


@router.get("/cases")
async def get_cases(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_lawyer),
):
    result = await db.execute(
        select(Case).where(
            Case.created_by == current_user["user_id"]
        )
    )

    cases = result.scalars().all()

    return {
        "cases": [
            {
                "id": case.id,
                "case_number": case.case_number,
                "title": case.title,
                "description": case.description,
                "classification": case.classification,
                "department": case.department,
                "created_at": case.created_at,
            }
            for case in cases
        ]
    }


@router.post("/cases")
async def create_case(
    case: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_lawyer),
):
    case_id = str(uuid4())

    new_case = Case(
        id=case_id,
        case_number=f"LL-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
        title=case.title,
        description=case.description,
        classification="CONFIDENTIAL",
        department=None,
        created_by=current_user["user_id"],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(new_case)

    await db.commit()
    await db.refresh(new_case)

    return {
        "message": "Case created successfully",
        "case": {
            "id": new_case.id,
            "case_number": new_case.case_number,
            "title": new_case.title,
            "description": new_case.description,
            "classification": new_case.classification,
            "department": new_case.department,
            "created_at": new_case.created_at,
        },
    }