import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def migrate():
    async with AsyncSessionLocal() as db:
        try:
            print("🚀 Starting LegalLens annotations migration...")

            # =========================================================
            # 1. Create annotations table
            # =========================================================
            print("1️⃣ Creating annotations table...")

            await db.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS annotations (
                        id VARCHAR(36) PRIMARY KEY,

                        page_id VARCHAR(36)
                            NOT NULL
                            REFERENCES case_file_pages(id),

                        created_by VARCHAR(36)
                            NOT NULL
                            REFERENCES users(id),

                        annotation_type VARCHAR(50)
                            NOT NULL,

                        content TEXT
                            NULL,

                        position JSONB
                            NOT NULL,

                        created_at TIMESTAMP
                            NOT NULL
                            DEFAULT CURRENT_TIMESTAMP,

                        updated_at TIMESTAMP
                            NOT NULL
                            DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
            )

            # =========================================================
            # 2. Create indexes
            # =========================================================
            print("2️⃣ Creating annotation indexes...")

            await db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_annotations_page_id
                ON annotations(page_id);
                """
            )
            )

            await db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_annotations_created_by
                ON annotations(created_by);
                """
            )
            )

            # =========================================================
            # 3. Verification
            # =========================================================
            print("3️⃣ Verifying migration...")

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'annotations';
                    """
                )
            )

            table_count = result.scalar_one()

            if table_count != 1:
                raise RuntimeError(
                    "annotations table was not created."
                )

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'annotations';
                    """
                )
            )

            column_count = result.scalar_one()

            print(f"   annotations table: {table_count}")
            print(f"   columns:            {column_count}")

            if column_count != 8:
                raise RuntimeError(
                    "annotations table does not contain "
                    "the expected 8 columns."
                )

            # =========================================================
            # 4. Commit
            # =========================================================
            await db.commit()

            print()
            print("✅ Annotations migration completed successfully.")

        except Exception as exc:
            await db.rollback()

            print()
            print("❌ Annotations migration failed.")
            print(f"Reason: {exc}")
            print("↩️ Transaction rolled back.")

            raise


if __name__ == "__main__":
    asyncio.run(migrate())