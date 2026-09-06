from datetime import datetime

from sqlalchemy import (
    String,
    DateTime,
    Enum,
    Integer,
    ForeignKey,
    BigInteger,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.contracts import DocumentStatus


class Document(Base):
    __tablename__ = "case_files"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: __import__("uuid").uuid4().hex,
    )

    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("cases.id"),
        nullable=False,
        index=True,
    )

    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    storage_key: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
    )

    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus),
        nullable=False,
        default=DocumentStatus.UPLOADED,
    )

    uploaded_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    is_original: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    parent_file_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("case_files.id"),
        nullable=True,
    )

    # Relationships

    case = relationship(
        "Case",
        back_populates="documents",
    )

    uploader = relationship(
        "User",
        back_populates="documents",
    )

    pages = relationship(
        "CaseFilePage",
        back_populates="case_file",
    )

    integrity = relationship(
        "DocumentIntegrity",
        back_populates="case_file",
        uselist=False,
    )

    processing_jobs = relationship(
        "FileProcessingJob",
        back_populates="case_file",
    )

    parent_file = relationship(
        "Document",
        remote_side=[id],
        back_populates="child_files",
    )

    child_files = relationship(
        "Document",
        back_populates="parent_file",
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="document",
    )