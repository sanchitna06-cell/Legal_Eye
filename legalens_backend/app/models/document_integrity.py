from datetime import datetime

from sqlalchemy import (
    String,
    DateTime,
    Integer,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DocumentIntegrity(Base):
    __tablename__ = "document_integrity"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: __import__("uuid").uuid4().hex,
    )

    case_file_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("case_files.id"),
        nullable=False,
        unique=True,
    )

    sha256_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    algorithm: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="SHA-256",
    )

    blockchain_block_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    blockchain_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    anchored_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationship

    case_file = relationship(
        "Document",
        back_populates="integrity",
    )