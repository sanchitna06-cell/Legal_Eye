from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: __import__("uuid").uuid4().hex,
    )

    lawyer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    case_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("cases.id"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="OTHER",
    )

    start_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True,
    )

    end_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    all_day: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    reminder_minutes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
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

    lawyer = relationship(
        "User",
        back_populates="calendar_events",
    )

    case = relationship(
        "Case",
        back_populates="calendar_events",
    )