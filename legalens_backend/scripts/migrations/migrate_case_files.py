import asyncio
import uuid

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def migrate():
    async with AsyncSessionLocal() as db:
        try:
            print("🚀 Starting LegalLens case_files migration...")

            # =========================================================
            # 1. Add new columns
            # =========================================================
            print("1️⃣ Adding new case_files columns...")

            await db.execute(
                text(
                    """
                    ALTER TABLE case_files
                    ADD COLUMN IF NOT EXISTS storage_key VARCHAR(300),
                    ADD COLUMN IF NOT EXISTS is_original BOOLEAN,
                    ADD COLUMN IF NOT EXISTS parent_file_id VARCHAR(36);
                    """
                )
            )

            # =========================================================
            # 2. Copy file_path → storage_key
            # =========================================================
            print("2️⃣ Migrating file_path → storage_key...")

            await db.execute(
                text(
                    """
                    UPDATE case_files
                    SET storage_key = file_path
                    WHERE storage_key IS NULL;
                    """
                )
            )

            # =========================================================
            # 3. Existing documents are original evidence
            # =========================================================
            print("3️⃣ Marking existing files as original...")

            await db.execute(
                text(
                    """
                    UPDATE case_files
                    SET is_original = TRUE
                    WHERE is_original IS NULL;
                    """
                )
            )

            # =========================================================
            # 4. Create document_integrity table
            # =========================================================
            print("4️⃣ Creating document_integrity...")

            await db.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS document_integrity (
                        id VARCHAR(36) PRIMARY KEY,

                        case_file_id VARCHAR(36)
                            NOT NULL
                            UNIQUE
                            REFERENCES case_files(id),

                        sha256_hash VARCHAR(64)
                            NOT NULL,

                        algorithm VARCHAR(20)
                            NOT NULL
                            DEFAULT 'SHA-256',

                        blockchain_block_id INTEGER
                            NULL,

                        blockchain_hash VARCHAR(64)
                            NULL,

                        anchored_at TIMESTAMP
                            NULL,

                        created_at TIMESTAMP
                            NOT NULL
                            DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
            )

            # =========================================================
            # 5. Read legacy integrity information
            # =========================================================
            print("5️⃣ Reading legacy integrity information...")

            result = await db.execute(
                text(
                    """
                    SELECT
                        id,
                        sha256_hash,
                        blockchain_block_id,
                        uploaded_at
                    FROM case_files
                    WHERE sha256_hash IS NOT NULL;
                    """
                )
            )

            legacy_rows = result.fetchall()

            print(
                f"   Found {len(legacy_rows)} documents "
                "with SHA-256 hashes."
            )

            # =========================================================
            # 6. Populate document_integrity
            # =========================================================
            print("6️⃣ Creating integrity records...")

            for row in legacy_rows:
                await db.execute(
                    text(
                        """
                        INSERT INTO document_integrity (
                            id,
                            case_file_id,
                            sha256_hash,
                            algorithm,
                            blockchain_block_id,
                            blockchain_hash,
                            anchored_at,
                            created_at
                        )
                        VALUES (
                            :id,
                            :case_file_id,
                            :sha256_hash,
                            'SHA-256',
                            :blockchain_block_id,
                            NULL,
                            NULL,
                            :created_at
                        )
                        ON CONFLICT (case_file_id) DO NOTHING;
                        """
                    ),
                    {
                        "id": uuid.uuid4().hex,
                        "case_file_id": row.id,
                        "sha256_hash": row.sha256_hash,
                        "blockchain_block_id": row.blockchain_block_id,
                        "created_at": row.uploaded_at,
                    },
                )

            # =========================================================
            # 7. Normalize legacy status
            # =========================================================
            print("7️⃣ Converting TAMPERED → INTEGRITY_FAILED...")

            await db.execute(
                text(
                    """
                    ALTER TABLE case_files
                    ALTER COLUMN status TYPE VARCHAR(50)
                    USING status::text;
                    """
                )
            )

            await db.execute(
                text(
                    """
                    UPDATE case_files
                    SET status = 'INTEGRITY_FAILED'
                    WHERE status = 'TAMPERED';
                    """
                )
            )

            # =========================================================
            # 8. Create new PostgreSQL enum
            # =========================================================
            print("8️⃣ Creating new documentstatus enum...")

            await db.execute(
                text(
                    """
                    CREATE TYPE documentstatus_new AS ENUM (
                        'UPLOADED',
                        'PROCESSING',
                        'PROCESSED',
                        'VERIFIED',
                        'INTEGRITY_FAILED',
                        'ERROR'
                    );
                    """
                )
            )

            # =========================================================
            # 9. Convert status to new enum
            # =========================================================
            print("9️⃣ Converting status to new enum...")

            await db.execute(
                text(
                    """
                    ALTER TABLE case_files
                    ALTER COLUMN status TYPE documentstatus_new
                    USING status::documentstatus_new;
                    """
                )
            )

            # =========================================================
            # 10. Replace old enum
            # =========================================================
            print("🔟 Replacing legacy documentstatus enum...")

            await db.execute(
                text(
                    """
                    DROP TYPE documentstatus;
                    """
                )
            )

            await db.execute(
                text(
                    """
                    ALTER TYPE documentstatus_new
                    RENAME TO documentstatus;
                    """
                )
            )

            # =========================================================
            # 11. Enforce new NOT NULL constraints
            # =========================================================
            print("1️⃣1️⃣ Applying NOT NULL constraints...")

            await db.execute(
                text(
                    """
                    ALTER TABLE case_files
                    ALTER COLUMN storage_key SET NOT NULL,
                    ALTER COLUMN file_size_bytes SET NOT NULL,
                    ALTER COLUMN mime_type SET NOT NULL,
                    ALTER COLUMN uploaded_by SET NOT NULL,
                    ALTER COLUMN is_original SET NOT NULL;
                    """
                )
            )

            # =========================================================
            # 12. Add parent_file_id self-reference
            # =========================================================
            print("1️⃣2️⃣ Adding parent_file_id foreign key...")

            await db.execute(
                text(
                    """
                    ALTER TABLE case_files
                    ADD CONSTRAINT fk_case_files_parent_file
                    FOREIGN KEY (parent_file_id)
                    REFERENCES case_files(id);
                    """
                )
            )

            # =========================================================
            # 13. Remove legacy columns
            # =========================================================
            print("1️⃣3️⃣ Removing legacy columns...")

            await db.execute(
                text(
                    """
                    ALTER TABLE case_files
                    DROP COLUMN file_path,
                    DROP COLUMN sha256_hash,
                    DROP COLUMN blockchain_block_id,
                    DROP COLUMN last_verified_at,
                    DROP COLUMN metadata;
                    """
                )
            )

            # =========================================================
            # 14. Rename stale cases FK constraint
            # =========================================================
            print("1️⃣4️⃣ Renaming stale cases FK constraint...")

            await db.execute(
                text(
                    """
                    ALTER TABLE cases
                    RENAME CONSTRAINT cases_lead_investigator_id_fkey
                    TO cases_created_by_fkey;
                    """
                )
            )

            # =========================================================
            # 15. Verification
            # =========================================================
            print("1️⃣5️⃣ Verifying migration...")

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM case_files;
                    """
                )
            )

            document_count = result.scalar_one()

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM document_integrity;
                    """
                )
            )

            integrity_count = result.scalar_one()

            result = await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM case_files
                    WHERE storage_key IS NULL
                       OR file_size_bytes IS NULL
                       OR mime_type IS NULL
                       OR uploaded_by IS NULL
                       OR is_original IS NULL;
                    """
                )
            )

            invalid_documents = result.scalar_one()

            print(f"   case_files:          {document_count}")
            print(f"   document_integrity:  {integrity_count}")
            print(f"   invalid documents:   {invalid_documents}")

            if document_count != integrity_count:
                raise RuntimeError(
                    "Integrity record count does not match "
                    "case_files count."
                )

            if invalid_documents != 0:
                raise RuntimeError(
                    "One or more case_files rows contain "
                    "NULL required values."
                )

            # =========================================================
            # 16. Commit
            # =========================================================
            await db.commit()

            print()
            print("✅ Migration completed successfully.")
            print("🔐 Existing document data preserved.")
            print("🔐 Integrity records created.")
            print("🔐 Legacy columns removed.")
            print("🔐 Status enum synchronized with ORM.")

        except Exception as exc:
            await db.rollback()

            print()
            print("❌ Migration failed.")
            print(f"Reason: {exc}")
            print("↩️ Transaction rolled back.")

            raise


if __name__ == "__main__":
    asyncio.run(migrate())