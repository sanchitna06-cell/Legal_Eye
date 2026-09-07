"""
Reset LegalLens development/test data.

Keeps:
    - users
    - database schema

Deletes:
    - Supabase Storage files referenced by case_files
    - annotations
    - annotation_history
    - page_flags
    - entities
    - document_integrity
    - file_processing_jobs
    - case_file_pages
    - audit_logs
    - blockchain_blocks
    - case_files
    - cases

IMPORTANT:
This is a development reset.
It does NOT delete users.
It does NOT modify the database schema.
"""

import asyncio

from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal
from app.models.document import Document
from app.services.supabase_storage import SupabaseStorage


async def reset_development_data() -> None:
    # ---------------------------------------------------------
    # First collect the storage keys while the database
    # records still exist.
    # ---------------------------------------------------------

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Document.storage_key)
        )

        storage_keys = list(result.scalars().all())

    print("LegalLens development reset")
    print("=" * 60)

    print(f"\nFound {len(storage_keys)} stored file(s).")

    # ---------------------------------------------------------
    # Delete the corresponding files from Supabase Storage.
    #
    # We do this BEFORE deleting the database records so that
    # the storage_key information is still available.
    # ---------------------------------------------------------

    storage = SupabaseStorage()

    for storage_key in storage_keys:
        print(f"Deleting storage file: {storage_key}")

        storage.delete_file(storage_key)

    print("\nSupabase Storage cleanup complete.")

    # ---------------------------------------------------------
    # Delete database records.
    # ---------------------------------------------------------

    async with AsyncSessionLocal() as db:

        # Break possible self-references between case files.
        await db.execute(
            text(
                """
                UPDATE case_files
                SET parent_file_id = NULL
                """
            )
        )

        # Delete dependent records first.
        tables = [
            "annotation_history",
            "annotations",
            "page_flags",
            "entities",
            "document_integrity",
            "file_processing_jobs",
            "case_file_pages",
            "audit_logs",
            "blockchain_blocks",
            "case_files",
            "cases",
        ]

        for table in tables:
            await db.execute(
                text(f"DELETE FROM {table}")
            )

            print(f"Cleared database table: {table}")

        await db.commit()

    print("\n" + "=" * 60)
    print("Development reset complete.")
    print("Users were preserved.")
    print("Database schema was preserved.")
    print("Supabase test files were deleted.")

if __name__ == "__main__":
    asyncio.run(reset_development_data())