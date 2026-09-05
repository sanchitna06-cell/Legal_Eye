import asyncio

from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("""
                SELECT
                    id,
                    case_file_id,
                    page_number,
                    extraction_method,
                    ocr_confidence,
                    extraction_status,
                    LENGTH(extracted_text) AS text_length
                FROM case_file_pages
                ORDER BY case_file_id, page_number
            """)
        )

        print("CASE FILE PAGES:")

        for row in result:
            print(
                f" - page_id={row.id}, "
                f"case_file_id={row.case_file_id}, "
                f"page={row.page_number}, "
                f"method={row.extraction_method}, "
                f"confidence={row.ocr_confidence}, "
                f"status={row.extraction_status}, "
                f"text_length={row.text_length}"
            )


if __name__ == "__main__":
    asyncio.run(main())