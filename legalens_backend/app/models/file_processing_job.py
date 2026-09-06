from datetime import datetime

from sqlalchemy import (
    String,
    DateTime,
    Integer,
    ForeignKey,
    Enum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.contracts import ProcessingType, ProcessingJobStatus

from app.core.database import Base


class FileProcessingJob(Base):
    __tablename__ = "file_processing_jobs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: __import__("uuid").uuid4().hex,
    )

    case_file_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("case_files.id"),
        nullable=False,
        index=True,
    )

    processing_type: Mapped[ProcessingType] = mapped_column(
        Enum(
            ProcessingType,
            native_enum=False,
            length=50,
        ),
        nullable=False,
        )

    status: Mapped[ProcessingJobStatus] = mapped_column(
        Enum(
            ProcessingJobStatus,
            native_enum=False,
            length=30,
        ),
        nullable=False,
        default=ProcessingJobStatus.PENDING,
    )

    attempt_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    error_message: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    case_file = relationship(
        "Document",
        back_populates="processing_jobs",
    )