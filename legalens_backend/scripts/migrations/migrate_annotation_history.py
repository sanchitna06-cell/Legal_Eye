import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from typing import cast

async def migrate():
    async with AsyncSessionLocal() as db:
        try:
            print("🚀 Starting LegalLens annotation history migration...")

            print("1️⃣ Creating annotation_history table...")

            await db.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS annotation_history (
                        id VARCHAR(36) PRIMARY KEY,

                        annotation_id VARCHAR(36)
                            NOT NULL
                            REFERENCES annotations(id),

                        changed_by VARCHAR(36)
                            NOT NULL
                            REFERENCES users(id),

                        action VARCHAR(20)
                            NOT NULL,

                        annotation_type VARCHAR(50)
                            NOT NULL,

                        content TEXT
                            NULL,

                        position JSONB
                            NOT NULL,

                        changed_at TIMESTAMP
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
                    CREATE INDEX IF NOT EXISTS ix_annotation_history_annotation_id
                    ON annotation_history(annotation_id);
                    """
                )
            )

            await db.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_annotation_history_changed_by
                    ON annotation_history(changed_by);
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
                      AND table_name = 'annotation_history';
                    """
                )
            )

            table_count = result.scalar_one()

            if table_count != 1:
                raise RuntimeError(
                    "annotation_history table was not created."
                )

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'annotation_history';
                    """
                )
            )

            column_count = result.scalar_one()

            print(f"   annotation_history table: {table_count}")
            print(f"   columns:                  {column_count}")

            if column_count != 8:
                raise RuntimeError(
                    "annotation_history table does not contain "
                    "the expected 8 columns."
                )

            await db.commit()

            print()
            print("✅ Annotation history migration completed successfully.")

        except Exception as exc:
            await db.rollback()

            print()
            print("❌ Annotation history migration failed.")
            print(f"Reason: {exc}")
            print("↩️ Transaction rolled back.")

            raise


if __name__ == "__main__":
    asyncio.run(migrate())