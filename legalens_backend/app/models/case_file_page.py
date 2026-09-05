from datetime import datetime

from sqlalchemy import (
    String,
    DateTime,
    Text,
    ForeignKey,
    Integer,
    Float,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CaseFilePage(Base):
    __tablename__ = "case_file_pages"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    case_file_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("case_files.id"),
        nullable=False,
        index=True,
    )

    page_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    extracted_text: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )

    extraction_method: Mapped[str] = mapped_column(
        String(50),
        nullable=True,
    )

    ocr_confidence: Mapped[float] = mapped_column(
        Float,
        nullable=True,
    )

    extraction_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="PENDING",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    case_file = relationship(
        "Document",
        back_populates="pages",
    )

    __table_args__ = (
        UniqueConstraint(
            "case_file_id",
            "page_number",
            name="uq_case_file_page",
        ),
    )