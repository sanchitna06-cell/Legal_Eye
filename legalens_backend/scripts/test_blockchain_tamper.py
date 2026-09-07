import asyncio

from sqlalchemy import select, update

from app.core.blockchain import BlockchainService
from app.core.database import AsyncSessionLocal
from app.models import BlockchainBlock


async def main():
    async with AsyncSessionLocal() as db:
        # Find the non-genesis test block.
        result = await db.execute(
            select(BlockchainBlock)
            .where(BlockchainBlock.block_index == 1)
        )

        block = result.scalar_one_or_none()

        if block is None:
            print("Block #1 not found.")
            return

        print("=== Before Tampering ===")
        print(f"Block index: {block.block_index}")
        print(f"Original action: {block.action}")
        print(f"Original hash:   {block.hash}")

        # Simulate someone modifying persisted blockchain data.
        await db.execute(
            update(BlockchainBlock)
            .where(BlockchainBlock.id == block.id)
            .values(action="TAMPERED_ACTION")
        )

        await db.commit()

        print("\n=== After Tampering ===")
        print("Changed block #1 action to: TAMPERED_ACTION")

        # Verify the chain.
        blockchain = BlockchainService(db)

        chain_valid = await blockchain.verify_chain_integrity()

        print("\n=== Verification Result ===")
        print(f"Chain valid: {chain_valid}")

        if chain_valid is False:
            print("SUCCESS: Tampering was detected.")
        else:
            print("FAILURE: Tampering was NOT detected.")


if __name__ == "__main__":
    asyncio.run(main())