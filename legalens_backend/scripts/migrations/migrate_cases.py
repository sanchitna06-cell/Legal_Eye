import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:
        try:
            # 1. Rename the old ownership column.
            await db.execute(
                text("""
                    ALTER TABLE cases
                    RENAME COLUMN lead_investigator_id TO created_by
                """)
            )

            # 2. Find Lawyer A.
            result = await db.execute(
                text("""
                    SELECT id
                    FROM users
                    WHERE username = 'test_investigator'
                      AND role::text = 'LAWYER'
                """)
            )

            lawyer_id = result.scalar_one_or_none()

            if lawyer_id is None:
                raise RuntimeError(
                    "test_investigator lawyer account was not found."
                )

            # 3. Assign existing test cases to Lawyer A.
            await db.execute(
                text("""
                    UPDATE cases
                    SET created_by = :lawyer_id
                    WHERE created_by IS NULL
                """),
                {"lawyer_id": lawyer_id},
            )

            # 4. Enforce ownership at the database level.
            await db.execute(
                text("""
                    ALTER TABLE cases
                    ALTER COLUMN created_by SET NOT NULL
                """)
            )

            await db.commit()

            print("Cases table migrated successfully.")
            print("Existing test cases assigned to test_investigator.")
            print("created_by is now NOT NULL.")

        except Exception:
            await db.rollback()
            raise


asyncio.run(main())
