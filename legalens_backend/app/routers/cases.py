from fastapi import APIRouter
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime, timezone

router = APIRouter()


class CaseCreate(BaseModel):
    title: str
    description: str


@router.get("/cases")
def get_cases():
    return {
        "cases": []
    }


@router.post("/cases")
def create_case(case: CaseCreate):
    case_id = str(uuid4())

    return {
        "message": "Case created successfully",
        "case": {
            "id": case_id,
            "title": case.title,
            "description": case.description,
            "created_at": datetime.now(timezone.utc)
        }
    }