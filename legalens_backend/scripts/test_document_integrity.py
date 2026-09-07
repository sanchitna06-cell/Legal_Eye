import asyncio

from app.core.blockchain import BlockchainService
from app.core.database import AsyncSessionLocal
from app.models.document_integrity import DocumentIntegrity
from sqlalchemy import select


DOCUMENT_ID = "0b56766308878e401703e64fbc21c090"


async def main():
    async with AsyncSessionLocal() as db:

        result = await db.execute(
            select(DocumentIntegrity).where(
                DocumentIntegrity.case_file_id == DOCUMENT_ID
            )
        )

        integrity = result.scalar_one_or_none()

        if integrity is None:
            print("❌ No integrity record found.")
            return

        print("=== Document Integrity Record ===")
        print(f"Document ID:     {integrity.case_file_id}")
        print(f"SHA-256:         {integrity.sha256_hash}")
        print(f"Blockchain ID:   {integrity.blockchain_block_id}")
        print(f"Blockchain hash: {integrity.blockchain_hash}")

        blockchain = BlockchainService(db)

        print("\n=== Test 1: Correct Hash ===")

        result = await blockchain.verify_document(
            DOCUMENT_ID,
            integrity.sha256_hash,
        )

        print(f"Verification result: {result}")

        print("\n=== Test 2: Tampered Hash ===")

        fake_hash = "b" * 64

        result = await blockchain.verify_document(
            DOCUMENT_ID,
            fake_hash,
        )

        print(f"Verification result: {result}")


if __name__ == "__main__":
    asyncio.run(main())