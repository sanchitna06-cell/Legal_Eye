import asyncio

from sqlalchemy import delete

from app.core.database import AsyncSessionLocal
from app.models import BlockchainBlock


async def main():
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(BlockchainBlock)
        )

        print("Blockchain test data reset successfully.")

        await db.commit()
        print("Blockchain test data reset successfully.")


if __name__ == "__main__":
    asyncio.run(main())