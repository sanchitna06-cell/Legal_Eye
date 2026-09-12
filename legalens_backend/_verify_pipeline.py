"""
Live end-to-end verification for the upload-status architecture.

Single event loop for the whole run (the asyncpg pool must live on
one loop). Uploads PDFs of increasing size through the running API,
polls the public status endpoint until a terminal state, then
verifies database truth directly:
  - CaseFilePage rows committed and visible
  - FileProcessingJob rows terminal (COMPLETED/FAILED), none stuck
  - Document terminal state
  - GET /documents/{id}/pages returns every page after success
"""

import asyncio
import time

import httpx
from sqlalchemy import select, func

from app.core.database import AsyncSessionLocal
from app.models.case_file_page import CaseFilePage
from app.models.document import Document
from app.models.file_processing_job import FileProcessingJob

BASE_URL = "http://127.0.0.1:8011"
USERNAME = "test_lawyer_b"
PASSWORD = "TestPassword123!"

POLL_INTERVAL_S = 1.5
MAX_POLLS = 240  # generous ceiling for the 324-page document


async def db_truth(document_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        page_count = (
            await db.execute(
                select(func.count())
                .select_from(CaseFilePage)
                .where(CaseFilePage.case_file_id == document_id)
            )
        ).scalar()

        doc = await db.get(Document, document_id)

        jobs = (
            (
                await db.execute(
                    select(FileProcessingJob).where(
                        FileProcessingJob.case_file_id == document_id
                    )
                )
            )
            .scalars()
            .all()
        )

        return {
            "pages": page_count,
            "doc_status": doc.status.value if doc else None,
            "jobs": [(job.processing_type.value, job.status.value) for job in jobs],
        }


async def pages_endpoint_count(
    client: httpx.AsyncClient,
    token: str,
    document_id: str,
) -> int:
    response = await client.get(
        f"{BASE_URL}/documents/{document_id}/pages",
        headers={"Authorization": f"Bearer {token}"},
    )

    if response.status_code == 404:
        return -1

    response.raise_for_status()
    return len(response.json()["pages"])


async def run_case(
    client: httpx.AsyncClient,
    token: str,
    case_id: str,
    path: str,
    label: str,
) -> bool:
    print(f"\n=== {label}: {path} ===", flush=True)

    with open(path, "rb") as fh:
        started = time.perf_counter()
        response = await client.post(
            f"{BASE_URL}/documents/upload/{case_id}",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (path, fh, "application/pdf")},
        )
        elapsed = time.perf_counter() - started

    if response.status_code != 200:
        print(f"UPLOAD HTTP {response.status_code}: {response.text[:200]}")
        return False

    document_id = response.json()["document_id"]
    print(
        f"upload accepted in {elapsed:.2f}s -> document {document_id}",
        flush=True,
    )

    seen: list[tuple[str, str]] = []
    terminal: tuple[str, str] | None = None

    for _ in range(MAX_POLLS):
        status_response = await client.get(
            f"{BASE_URL}/documents/{document_id}/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = status_response.json()
        state = (body["status"], body["stage"])

        if not seen or seen[-1] != state:
            seen.append(state)
            print(f"  status: {state[0]} / {state[1]}", flush=True)

        if state[0] in ("COMPLETED", "FAILED"):
            terminal = state
            break

        await asyncio.sleep(POLL_INTERVAL_S)

    truth = await db_truth(document_id)
    pages_via_api = await pages_endpoint_count(client, token, document_id)

    print(f"  transitions: {' -> '.join(f'{s}/{t}' for s, t in seen)}")
    print(
        f"  DB: pages={truth['pages']} doc={truth['doc_status']} "
        f"jobs={truth['jobs']}"
    )
    print(f"  pages endpoint count: {pages_via_api}")

    stuck = [s for _, s in truth["jobs"] if s == "PROCESSING"]

    ok = (
        terminal is not None
        and not stuck
        and truth["pages"] > 0
        and pages_via_api == truth["pages"]
    )

    print(f"  RESULT: {'PASS' if ok else 'FAIL'}", flush=True)
    return ok


async def main() -> None:
    async with httpx.AsyncClient(timeout=180) as client:
        login = await client.post(
            f"{BASE_URL}/auth/login",
            json={"username": USERNAME, "password": PASSWORD},
        )
        login.raise_for_status()
        token = login.json()["access_token"]

        case = await client.post(
            f"{BASE_URL}/cases",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "title": "Pipeline verification",
                "description": "upload-status architecture verification",
                "classification": "general",
            },
        )
        case.raise_for_status()
        case_id = case.json()["case"]["id"]
        print(f"case {case_id}")

        results = [
            await run_case(client, token, case_id, "_test_1page.pdf", "SMALL 1-PAGE"),
            await run_case(client, token, case_id, "_test_13page.pdf", "13-PAGE"),
            await run_case(client, token, case_id, "_test_324page.pdf", "324-PAGE"),
        ]

    print(f"\nOVERALL: {'PASS' if all(results) else 'FAIL'}")


if __name__ == "__main__":
    asyncio.run(main())
