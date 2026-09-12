import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def migrate():
    async with AsyncSessionLocal() as db:
        try:
            print("🚀 Starting calendar events migration...")

            print("1️⃣ Creating calendar_events table...")

            await db.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS calendar_events (
                        id VARCHAR(36) PRIMARY KEY,

                        lawyer_id VARCHAR(36)
                            NOT NULL
                            REFERENCES users(id),

                        case_id VARCHAR(36)
                            NULL
                            REFERENCES cases(id),

                        title VARCHAR(255)
                            NOT NULL,

                        description TEXT
                            NULL,

                        event_type VARCHAR(50)
                            NOT NULL
                            DEFAULT 'OTHER',

                        start_at TIMESTAMP
                            NOT NULL,

                        end_at TIMESTAMP
                            NULL,

                        all_day BOOLEAN
                            NOT NULL
                            DEFAULT FALSE,

                        reminder_minutes INTEGER
                            NULL,

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

            print("2️⃣ Creating indexes...")

            await db.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_calendar_events_lawyer_id
                    ON calendar_events(lawyer_id);
                    """
                )
            )

            await db.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_calendar_events_case_id
                    ON calendar_events(case_id);
                    """
                )
            )

            await db.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_calendar_events_start_at
                    ON calendar_events(start_at);
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
                      AND table_name = 'calendar_events';
                    """
                )
            )

            table_count = result.scalar_one()

            if table_count != 1:
                raise RuntimeError(
                    "calendar_events table was not created."
                )

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'calendar_events';
                    """
                )
            )

            column_count = result.scalar_one()

            print(f"   calendar_events table: {table_count}")
            print(f"   columns:               {column_count}")

            if column_count != 12:
                raise RuntimeError(
                    "calendar_events table does not contain "
                    "the expected 12 columns."
                )

            await db.commit()

            print()
            print("✅ Calendar events migration completed successfully.")

        except Exception as exc:
            await db.rollback()

            print()
            print("❌ Calendar events migration failed.")
            print(f"Reason: {exc}")
            print("↩️ Transaction rolled back.")

            raise


if __name__ == "__main__":
    asyncio.run(migrate())