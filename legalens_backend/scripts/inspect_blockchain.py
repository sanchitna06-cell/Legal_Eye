import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models import BlockchainBlock


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(BlockchainBlock)
            .order_by(BlockchainBlock.block_index.asc())
        )

        blocks = result.scalars().all()

        print(f"\nTotal blocks: {len(blocks)}\n")

        for block in blocks:
            print("=" * 70)
            print(f"Index:          {block.block_index}")
            print(f"Action:         {block.action}")
            print(f"Created at:     {block.created_at}")
            print(f"Previous hash:  {block.previous_hash}")
            print(f"Stored hash:    {block.hash}")
            print(f"Document ID:    {block.document_id}")
            print(f"Document hash:  {block.document_hash}")
            print(f"User ID:        {block.user_id}")
            print(f"Metadata:       {block.block_metadata}")


if __name__ == "__main__":
    asyncio.run(main())