import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:
        await db.execute(text("""
            ALTER TYPE userrole RENAME TO userrole_old
        """))

        await db.execute(text("""
            CREATE TYPE userrole AS ENUM ('LAWYER', 'ADMIN')
        """))

        await db.execute(text("""
            ALTER TABLE users
            ALTER COLUMN role TYPE userrole
            USING (
                CASE role::text
                    WHEN 'INVESTIGATOR' THEN 'LAWYER'
                    WHEN 'ADMIN' THEN 'ADMIN'
                END
            )::userrole
        """))

        await db.execute(text("""
            DROP TYPE userrole_old
        """))

        await db.commit()

        print("userrole enum migrated successfully.")


asyncio.run(main())