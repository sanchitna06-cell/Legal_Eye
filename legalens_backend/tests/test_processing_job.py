import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.file_processing_job import FileProcessingJob
from app.core.contracts import ProcessingType, ProcessingJobStatus


async def main():
    async with AsyncSessionLocal() as db:
        job = FileProcessingJob(
            case_file_id="44a43ad6ad784f269505f54753da624d",
            processing_type=ProcessingType.TEXT_EXTRACTION,
            status=ProcessingJobStatus.PENDING,
        )

        db.add(job)
        await db.flush()

        print("Created job:")
        print("  ID:", job.id)
        print("  Type:", job.processing_type)
        print("  Status:", job.status)

        result = await db.execute(
            select(FileProcessingJob).where(
                FileProcessingJob.id == job.id
            )
        )

        loaded_job = result.scalar_one()

        print("\nRead back from database:")
        print("  ID:", loaded_job.id)
        print("  Type:", loaded_job.processing_type)
        print("  Status:", loaded_job.status)

        await db.rollback()
        print("\nTransaction rolled back. Test data was not saved.")


asyncio.run(main())
