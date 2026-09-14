"""
app/routers/intelligence.py
---------------------------
Chat-style Q&A over a case's extracted entities via the n8n AI Agent.

POST /intelligence/ask

Security:
- Requires authenticated LAWYER.
- Lawyer must own the requested case.
- Only entities belonging to that case are sent to n8n.
- Context size is bounded.
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
from app.models.case_file_page import CaseFilePage
from app.models.document import Document
from app.models.entity import Entity


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
MAX_ENTITIES = 300
MAX_DOCUMENTS = 20
MAX_PAGES = 200


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

    Context currently consists of extracted entities only.
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
    # 3. Retrieve bounded entity context.
    #
    # We deliberately cap this. A case can contain hundreds of pages,
    # so sending every entity indefinitely would eventually create huge
    # n8n/LLM requests.
    # -----------------------------------------------------------------------

    result = await db.execute(
        select(Entity, CaseFilePage, Document)
        .join(
            CaseFilePage,
            Entity.page_id == CaseFilePage.id,
        )
        .join(
            Document,
            CaseFilePage.case_file_id == Document.id,
        )
        .where(
            Document.case_id == case.id,
        )
        .order_by(
            Document.id,
            CaseFilePage.page_number,
            Entity.id,
        )
        .limit(MAX_ENTITIES),
    )

    rows = result.all()

    if not rows:
        return IntelligenceResponse(
            status="case_context_unavailable",
            answer="No processed entities are available yet for this case.",
            facts=[],
            conflicts=[],
        )

    # -----------------------------------------------------------------------
    # 4. Build compact document/page/entity context.
    # -----------------------------------------------------------------------

    documents_by_id: dict[str, dict] = {}
    page_count = 0

    for entity, page, document in rows:

        if document.id not in documents_by_id:

            if len(documents_by_id) >= MAX_DOCUMENTS:
                continue

            documents_by_id[document.id] = {
                "document_id": document.id,
                "document_name": document.file_name,
                "case_id": case.id,
                "pages": {},
            }

        doc_entry = documents_by_id[document.id]

        if page.page_number not in doc_entry["pages"]:

            if page_count >= MAX_PAGES:
                continue

            doc_entry["pages"][page.page_number] = {
                "page_number": page.page_number,
                "entities": [],
            }

            page_count += 1

        page_entry = doc_entry["pages"][page.page_number]

        page_entry["entities"].append(
            {
                "type": entity.entity_type.value,
                "value": entity.value,
                "attribute": entity.normalized_value,
                "source_text": entity.context_snippet,
                "confidence": entity.confidence_score,
            }
        )

    document_context = []

    for doc_entry in documents_by_id.values():

        doc_entry["pages"] = list(
            doc_entry["pages"].values()
        )

        if doc_entry["pages"]:
            document_context.append(doc_entry)

    if not document_context:
        return IntelligenceResponse(
            status="case_context_unavailable",
            answer="No usable processed entities are available for this case.",
            facts=[],
            conflicts=[],
        )

    # -----------------------------------------------------------------------
    # 5. Build n8n request.
    # -----------------------------------------------------------------------

    body = {
        "case_id": case.id,
        "chatInput": request.question.strip(),
        "document_context": document_context,
    }

    # -----------------------------------------------------------------------
    # 6. Call n8n.
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
    # 7. Normalize common n8n response formats.
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
    # 8. Validate the final response shape.
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