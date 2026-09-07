import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def migrate():
    async with AsyncSessionLocal() as db:
        try:
            print("🚀 Starting document_integrity blockchain migration...")

            # =========================================================
            # 1. Remove obsolete blockchain references
            # =========================================================
            print("1️⃣ Clearing legacy blockchain references...")

            await db.execute(
                text(
                    """
                    UPDATE document_integrity
                    SET
                        blockchain_block_id = NULL,
                        blockchain_hash = NULL,
                        anchored_at = NULL;
                    """
                )
            )

            # =========================================================
            # 2. Change blockchain_block_id to UUID/string type
            # =========================================================
            print("2️⃣ Converting blockchain_block_id to VARCHAR(36)...")

            await db.execute(
                text(
                    """
                    ALTER TABLE document_integrity
                    ALTER COLUMN blockchain_block_id TYPE VARCHAR(36)
                    USING blockchain_block_id::text;
                    """
                )
            )

            # =========================================================
            # 3. Add foreign key to blockchain_blocks
            # =========================================================
            print("3️⃣ Adding blockchain block foreign key...")

            await db.execute(
                text(
                    """
                    ALTER TABLE document_integrity
                    ADD CONSTRAINT fk_document_integrity_blockchain_block
                    FOREIGN KEY (blockchain_block_id)
                    REFERENCES blockchain_blocks(id);
                    """
                )
            )

            # =========================================================
            # 4. Verify existing integrity records
            # =========================================================
            print("4️⃣ Verifying document integrity records...")

            result = await db.execute(
                text(
                    """
                    SELECT
                        COUNT(*) AS total,
                        COUNT(sha256_hash) AS hashes,
                        COUNT(blockchain_block_id) AS blockchain_links
                    FROM document_integrity;
                    """
                )
            )

            row = result.one()

            print(f"   Total records:       {row.total}")
            print(f"   SHA-256 hashes:      {row.hashes}")
            print(f"   Blockchain links:    {row.blockchain_links}")

            if row.total != row.hashes:
                raise RuntimeError(
                    "Some document_integrity records are missing SHA-256 hashes."
                )

            if row.blockchain_links != 0:
                raise RuntimeError(
                    "Legacy blockchain references were not cleared."
                )

            # =========================================================
            # 5. Commit
            # =========================================================
            await db.commit()

            print()
            print("✅ Document integrity blockchain migration completed.")
            print("🔐 SHA-256 integrity records preserved.")
            print("🔐 Legacy blockchain references removed.")
            print("🔐 blockchain_block_id now references blockchain_blocks.id.")

        except Exception as exc:
            await db.rollback()

            print()
            print("❌ Migration failed.")
            print(f"Reason: {exc}")
            print("↩️ Transaction rolled back.")

            raise


if __name__ == "__main__":
    asyncio.run(migrate())