from datetime import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PageFlag(Base):
    __tablename__ = "page_flags"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: uuid.uuid4().hex,
    )

    page_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("case_file_pages.id"),
        nullable=False,
        index=True,
    )

    flagged_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    flag_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    page = relationship(
        "CaseFilePage",
        back_populates="flags",
    )

    creator = relationship(
        "User",
        back_populates="page_flags",
    )