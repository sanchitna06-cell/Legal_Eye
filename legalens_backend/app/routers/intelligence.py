"""
app/routers/intelligence.py
---------------------------
Chat-style Q&A over a case's extracted entities via the n8n AI Agent.

POST /intelligence/ask

Security:
- Requires authenticated LAWYER.
- Lawyer must own the requested case.
- Only the validated case_id and question are sent to n8n.
- Case entities are retrieved by the n8n AI Agent through its Supabase tool.
- Context size is bounded by the AI/database retrieval layer.
- Question length is bounded.
- Internal n8n errors are not exposed to the client.
"""

import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_lawyer
from app.models.case import Case


router = APIRouter(
    prefix="/intelligence",
    tags=["Intelligence"],
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Limits
# ---------------------------------------------------------------------------

AGENT_TIMEOUT = httpx.Timeout(
    connect=10.0,
    read=150.0,
    write=30.0,
    pool=10.0,
)

MAX_QUESTION_LENGTH = 2000


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    case_id: str = Field(min_length=1, max_length=36)
    question: str = Field(min_length=1, max_length=MAX_QUESTION_LENGTH)


class IntelligenceResponse(BaseModel):
    status: str = "ok"
    answer: str
    facts: list = Field(default_factory=list)
    conflicts: list = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health")
async def intelligence_health():
    return {
        "status": "ok",
        "service": "intelligence",
    }


# ---------------------------------------------------------------------------
# Ask AI Agent
# ---------------------------------------------------------------------------

@router.post(
    "/ask",
    response_model=IntelligenceResponse,
)
async def ask_case_question(
    request: AskRequest,
    current_user=Depends(get_current_lawyer),
    db: AsyncSession = Depends(get_db),
):
    """
    Ask the n8n AI Agent a question about a case.

    The backend validates that the authenticated lawyer owns the case.
    n8n then retrieves the case-specific entities through its Supabase tool.
    """

    # -----------------------------------------------------------------------
    # 1. Verify that the lawyer actually owns the case.
    # -----------------------------------------------------------------------

    case_result = await db.execute(
        select(Case).where(
            Case.id == request.case_id,
            Case.created_by == current_user["user_id"],
        )
    )

    case = case_result.scalar_one_or_none()

    if case is None:
        # Deliberately do not reveal whether the case exists.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    # -----------------------------------------------------------------------
    # 2. Make sure the AI Agent is configured.
    # -----------------------------------------------------------------------

    if not settings.N8N_AGENT_WEBHOOK_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Intelligence service is not configured",
        )

    # -----------------------------------------------------------------------
    # 3. Build n8n request.
    #
    # Do NOT send document_context here.
    #
    # The AI Agent receives the validated case_id and uses its Supabase
    # entity-retrieval tool to obtain only entities belonging to this case.
    # -----------------------------------------------------------------------

    body = {
        "case_id": case.id,
        "chatInput": request.question.strip(),
    }

    # -----------------------------------------------------------------------
    # 4. Call n8n.
    # -----------------------------------------------------------------------

    try:
        async with httpx.AsyncClient(
            timeout=AGENT_TIMEOUT
        ) as client:

            response = await client.post(
                settings.N8N_AGENT_WEBHOOK_URL,
                json=body,
                headers={
                    "X-N8N-Secret": settings.N8N_SHARED_SECRET,
                },
            )

            response.raise_for_status()

            agent_response = response.json()

    except httpx.TimeoutException:
        logger.warning(
            "n8n intelligence request timed out for case %s",
            case.id,
        )

        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Intelligence service timed out",
        )

    except httpx.HTTPStatusError as exc:
        logger.error(
            "n8n intelligence service returned HTTP %s for case %s",
            exc.response.status_code,
            case.id,
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Intelligence service returned an error",
        )

    except httpx.RequestError:
        logger.exception(
            "n8n intelligence connection failed for case %s",
            case.id,
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to reach intelligence service",
        )

    except ValueError:
        logger.exception(
            "n8n intelligence returned invalid JSON for case %s",
            case.id,
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Intelligence service returned an invalid response",
        )

    # -----------------------------------------------------------------------
    # 5. Normalize common n8n response formats.
    # -----------------------------------------------------------------------

    if isinstance(agent_response, list):

        if not agent_response:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Intelligence service returned an empty response",
            )

        agent_response = agent_response[0]

    if isinstance(agent_response, dict) and "output" in agent_response:

        output = agent_response["output"]

        if isinstance(output, str):

            try:
                output = json.loads(output)

            except json.JSONDecodeError:

                return IntelligenceResponse(
                    status="ok",
                    answer=output,
                    facts=[],
                    conflicts=[],
                )

        agent_response = output

    # -----------------------------------------------------------------------
    # 6. Validate the final response shape.
    # -----------------------------------------------------------------------

    if not isinstance(agent_response, dict):

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Intelligence service returned an invalid response",
        )

    answer = agent_response.get("answer")

    if not isinstance(answer, str):

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Intelligence service returned an invalid answer",
        )

    facts = agent_response.get("facts", [])
    conflicts = agent_response.get("conflicts", [])

    if not isinstance(facts, list):
        facts = []

    if not isinstance(conflicts, list):
        conflicts = []

    return IntelligenceResponse(
        status="ok",
        answer=answer,
        facts=facts,
        conflicts=conflicts,
    )