import asyncio

from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:

        result = await db.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
        )

        print("DATABASE TABLES:")
        for row in result:
            print(f" - {row[0]}")

        print("\nENTITIES COLUMNS:")

        result = await db.execute(
            text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'entities'
                ORDER BY ordinal_position
            """)
        )

        for row in result:
            print(f" - {row[0]} ({row[1]})")

        print("\nCASE_FILE_PAGES COLUMNS:")

        result = await db.execute(
            text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'case_file_pages'
                ORDER BY ordinal_position
            """)
        )

        for row in result:
            print(f" - {row[0]} ({row[1]})")


if __name__ == "__main__":
    asyncio.run(main())