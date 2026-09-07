import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.database import DATABASE_URL


async def migrate():
    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS blockchain_blocks (
                    id VARCHAR(36) PRIMARY KEY,

                    block_index INTEGER NOT NULL UNIQUE,

                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    action VARCHAR(50) NOT NULL,

                    document_id VARCHAR(36)
                        REFERENCES case_files(id),

                    document_hash VARCHAR(64),

                    previous_hash VARCHAR(64) NOT NULL,

                    hash VARCHAR(64) NOT NULL UNIQUE,

                    user_id VARCHAR(36)
                        REFERENCES users(id),

                    metadata JSONB
                );
                """
            )
        )

        await conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_blockchain_blocks_document_id
                ON blockchain_blocks(document_id);
                """
            )
        )

        await conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_blockchain_blocks_user_id
                ON blockchain_blocks(user_id);
                """
            )
        )

        print("Created blockchain_blocks table.")


    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())