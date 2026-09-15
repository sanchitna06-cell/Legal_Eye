from typing import Dict, Any

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.audit_service import AuditService
from app.core.database import get_db
from app.core.security import get_current_lawyer
from app.models.case import Case


router = APIRouter()


# ============================================================================
# CASE INPUT
# ============================================================================

class CaseCreate(BaseModel):
    title: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )

    description: str = Field(
        default="",
        max_length=5000,
    )

    classification: str = Field(
        ...,
        pattern="^(general|confidential)$",
    )

    category: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )


# ============================================================================
# GET CASES
# ============================================================================

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
                # `department` is the existing DB field used to persist
                # the lawyer-selected case category.
                "category": case.department,
                "created_at": case.created_at,
            }
            for case in cases
        ]
    }


# ============================================================================
# CREATE CASE
# ============================================================================

@router.post("/cases")
async def create_case(
    case: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_lawyer),
):
    case_id = str(uuid4())

    new_case = Case(
        id=case_id,
        case_number=(
            f"LL-"
            f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
        ),
        title=case.title.strip(),
        description=case.description.strip(),
        classification=case.classification.upper(),

        # Existing database column.
        # Semantically this now stores the selected case category.
        department=case.category.strip(),

        created_by=current_user["user_id"],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    db.add(new_case)

    await AuditService.log(
        db,
        user_id=current_user["user_id"],
        action="CASE_CREATED",
        case_id=new_case.id,
        details={
            "case_number": new_case.case_number,
            "title": new_case.title,
            "category": case.category.strip(),
            "classification": case.classification,
        },
    )

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
            "category": new_case.department,
            "created_at": new_case.created_at,
        },
    }