import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(
                text("""
                    ALTER TABLE documents
                    RENAME TO case_files
                """)
            )

            await db.commit()

            print("documents table renamed to case_files successfully.")

        except Exception:
            await db.rollback()
            raise


asyncio.run(main())