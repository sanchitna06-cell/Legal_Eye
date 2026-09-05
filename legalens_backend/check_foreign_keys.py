import asyncio

from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("""
                SELECT
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_name AS referenced_table,
                    ccu.column_name AS referenced_column
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND (
                      tc.table_name = 'case_file_pages'
                      OR tc.table_name = 'entities'
                  )
                ORDER BY tc.table_name, kcu.column_name
            """)
        )

        print("FOREIGN KEYS:")

        for row in result:
            print(
                f" - {row.table_name}.{row.column_name}"
                f" -> {row.referenced_table}.{row.referenced_column}"
            )


if __name__ == "__main__":
    asyncio.run(main())