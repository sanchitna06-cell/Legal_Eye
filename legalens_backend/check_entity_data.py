import asyncio

from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:

        result = await db.execute(
            text("SELECT COUNT(*) FROM entities")
        )

        count = result.scalar() or 0

        print(f"Existing entities: {count}")

        if count > 0:
            result = await db.execute(
                text("""
                    SELECT
                        id,
                        document_id,
                        case_id,
                        entity_type,
                        value
                    FROM entities
                    ORDER BY created_at
                    LIMIT 20
                """)
            )

            print("\nExisting entity records:")
            for row in result:
                print(
                    f" - id={row.id}, "
                    f"document_id={row.document_id}, "
                    f"case_id={row.case_id}, "
                    f"type={row.entity_type}, "
                    f"value={row.value}"
                )


if __name__ == "__main__":
    asyncio.run(main())