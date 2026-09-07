import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def migrate():
    async with AsyncSessionLocal() as db:
        try:
            print("🚀 Starting page flags migration...")

            print("1️⃣ Creating page_flags table...")

            await db.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS page_flags (
                        id VARCHAR(36) PRIMARY KEY,

                        page_id VARCHAR(36)
                            NOT NULL
                            REFERENCES case_file_pages(id),

                        flagged_by VARCHAR(36)
                            NOT NULL
                            REFERENCES users(id),

                        flag_type VARCHAR(30)
                            NOT NULL,

                        reason TEXT
                            NULL,

                        created_at TIMESTAMP
                            NOT NULL
                            DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
            )

            print("2️⃣ Creating indexes...")

            await db.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_page_flags_page_id
                    ON page_flags(page_id);
                    """
                )
            )

            await db.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_page_flags_flagged_by
                    ON page_flags(flagged_by);
                    """
                )
            )

            print("3️⃣ Verifying migration...")

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'page_flags';
                    """
                )
            )

            table_count = result.scalar_one()

            if table_count != 1:
                raise RuntimeError(
                    "page_flags table was not created."
                )

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'page_flags';
                    """
                )
            )

            column_count = result.scalar_one()

            print(f"   page_flags table: {table_count}")
            print(f"   columns:          {column_count}")

            if column_count != 6:
                raise RuntimeError(
                    "page_flags table does not contain "
                    "the expected 6 columns."
                )

            await db.commit()

            print()
            print("✅ Page flags migration completed successfully.")

        except Exception as exc:
            await db.rollback()

            print()
            print("❌ Page flags migration failed.")
            print(f"Reason: {exc}")
            print("↩️ Transaction rolled back.")

            raise


if __name__ == "__main__":
    asyncio.run(migrate())