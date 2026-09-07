import asyncio

from sqlalchemy import select

from app.core.contracts import DocumentUploadedPayload
from app.core.database import AsyncSessionLocal
from app.models.document import Document
from app.subscribers.blockchain_subscriber import handle_document_uploaded


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Document).where(
                Document.file_name == "BLOCKCHAIN_TEST.pdf"
            )
        )

        document = result.scalar_one_or_none()

        if document is None:
            print("BLOCKCHAIN_TEST.pdf not found.")
            return

        payload = DocumentUploadedPayload(
            document_id=document.id,
            case_id=document.case_id,
            file_name=document.file_name,
            sha256_hash="a" * 64,
            uploaded_by=document.uploaded_by,
        )

    print("=== Testing blockchain subscriber ===")
    print(f"Document ID: {payload.document_id}")
    print(f"File name:   {payload.file_name}")
    print(f"SHA-256:     {payload.sha256_hash}")

    await handle_document_uploaded(payload)

    print("\n✅ Blockchain subscriber completed successfully.")


if __name__ == "__main__":
    asyncio.run(main())