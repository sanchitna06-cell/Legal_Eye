import asyncio

from sqlalchemy import select

from app.core.blockchain import BlockchainService
from app.core.database import AsyncSessionLocal
from app.models import Document


async def main():
    async with AsyncSessionLocal() as db:

        result = await db.execute(
            select(Document)
            .limit(1)
        )

        document = result.scalar_one_or_none()

        if document is None:
            print("No case files exist in the database.")
            return

        blockchain = BlockchainService(db)

        print("\n=== Using existing document ===")
        print(f"Document ID: {document.id}")
        print(f"File name:   {document.file_name}")

        print("\n=== Adding test block ===")

        block = await blockchain.add_block(
            action="TEST_UPLOAD",
            document_id=document.id,
            document_hash="a" * 64,
            user_id=document.uploaded_by,
            metadata={
                "file_name": document.file_name,
                "test": True,
            },
        )

        await db.commit()

        print(f"Block index:    {block.block_index}")
        print(f"Action:         {block.action}")
        print(f"Document ID:    {block.document_id}")
        print(f"Document hash:  {block.document_hash}")
        print(f"Previous hash:  {block.previous_hash}")
        print(f"Block hash:     {block.hash}")

        print("\n=== Verifying chain ===")

        chain_valid = await blockchain.verify_chain_integrity()

        print(f"Chain valid: {chain_valid}")


if __name__ == "__main__":
    asyncio.run(main())