import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.case import Case
from app.models.document import Document


async def inspect_data() -> None:
    async with AsyncSessionLocal() as db:
        print("CASES")
        print("=" * 60)

        result = await db.execute(
            select(Case.id, Case.case_number, Case.title)
            .order_by(Case.created_at.asc())
        )

        cases = result.all()

        for case_id, case_number, title in cases:
            print(f"ID:     {case_id}")
            print(f"Number: {case_number}")
            print(f"Title:  {title}")
            print()

        print(f"Total cases: {len(cases)}")

        print("\nCASE FILES")
        print("=" * 60)

        result = await db.execute(
            select(
                Document.id,
                Document.case_id,
                Document.file_name,
                Document.storage_key,
            ).order_by(Document.uploaded_at.asc())
        )

        documents = result.all()

        for (
            document_id,
            case_id,
            file_name,
            storage_key,
        ) in documents:
            print(f"ID:          {document_id}")
            print(f"Case ID:     {case_id}")
            print(f"File:        {file_name}")
            print(f"Storage key: {storage_key}")
            print()

        print(f"Total case files: {len(documents)}")


if __name__ == "__main__":
    asyncio.run(inspect_data())