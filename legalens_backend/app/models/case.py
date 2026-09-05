from datetime import datetime

from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    case_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )

    classification: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="CONFIDENTIAL",
    )

    department: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
    )

    created_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # Relationships

    creator = relationship(
        "User",
        back_populates="created_cases",
    )

    documents = relationship(
        "Document",
        back_populates="case",
    )

    audit_logs = relationship(
        "AuditLog",
        back_populates="case",
    )