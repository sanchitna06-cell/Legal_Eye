from datetime import datetime

import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AnnotationHistory(Base):
    __tablename__ = "annotation_history"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: uuid.uuid4().hex,
    )

    annotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("annotations.id"),
        nullable=False,
        index=True,
    )

    changed_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    annotation_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    position: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    changed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    annotation = relationship(
        "Annotation",
        back_populates="history",
    )

    changer = relationship(
        "User",
        back_populates="annotation_history",
    )