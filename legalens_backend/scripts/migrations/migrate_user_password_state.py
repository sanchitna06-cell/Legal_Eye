import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.database import DATABASE_URL


async def migrate():
    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS must_change_password
                BOOLEAN NOT NULL DEFAULT FALSE;
                """
            )
        )

        print("Added users.must_change_password")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())