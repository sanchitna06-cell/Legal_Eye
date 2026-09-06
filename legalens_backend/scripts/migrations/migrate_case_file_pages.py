import asyncio

from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:
        try:
            # 1. Create case_file_pages
            await db.execute(
                text("""
                    CREATE TABLE IF NOT EXISTS case_file_pages (
                        id VARCHAR(36) PRIMARY KEY,
                        case_file_id VARCHAR(36) NOT NULL,
                        page_number INTEGER NOT NULL,
                        extracted_text TEXT,
                        extraction_method VARCHAR(50),
                        ocr_confidence DOUBLE PRECISION,
                        extraction_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

                        CONSTRAINT fk_case_file_pages_case_file
                            FOREIGN KEY (case_file_id)
                            REFERENCES case_files(id),

                        CONSTRAINT uq_case_file_page
                            UNIQUE (case_file_id, page_number)
                    )
                """)
            )

            # 2. Add page_id to entities
            await db.execute(
                text("""
                    ALTER TABLE entities
                    ADD COLUMN page_id VARCHAR(36)
                """)
            )

            # 3. Remove old entity relationships
            await db.execute(
                text("""
                    ALTER TABLE entities
                    DROP COLUMN document_id
                """)
            )

            await db.execute(
                text("""
                    ALTER TABLE entities
                    DROP COLUMN case_id
                """)
            )

            # 4. Add foreign key from entities -> case_file_pages
            await db.execute(
                text("""
                    ALTER TABLE entities
                    ADD CONSTRAINT fk_entities_page
                    FOREIGN KEY (page_id)
                    REFERENCES case_file_pages(id)
                """)
            )

            # 5. Entity page_id is required
            await db.execute(
                text("""
                    ALTER TABLE entities
                    ALTER COLUMN page_id SET NOT NULL
                """)
            )

            await db.commit()

            print("Database migration completed successfully.")

        except Exception:
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())