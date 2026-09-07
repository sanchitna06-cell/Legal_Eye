from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def migrate():
    async with AsyncSessionLocal() as db:
        try:
            print("🚀 Starting annotation soft-delete migration...")

            await db.execute(
                text("""
                    ALTER TABLE annotations
                    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
                """)
            )

            result = await db.execute(
                text("""
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'annotations'
                      AND column_name = 'deleted_at';
                """)
            )

            column_count = result.scalar_one()

            if column_count != 1:
                raise RuntimeError(
                    "annotations.deleted_at was not created."
                )

            await db.commit()

            print("✅ Annotation soft-delete migration completed.")
            print(f"   deleted_at column: {column_count}")

        except Exception as exc:
            await db.rollback()
            print("❌ Annotation soft-delete migration failed.")
            print(f"Reason: {exc}")
            print("↩️ Transaction rolled back.")
            raise


if __name__ == "__main__":
    import asyncio

    asyncio.run(migrate())