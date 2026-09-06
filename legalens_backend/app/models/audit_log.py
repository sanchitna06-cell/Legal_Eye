from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: __import__("uuid").uuid4().hex,
    )

    user_id: Mapped[str] = mapped_column(
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

    document_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("case_files.id"),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    details: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    request_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    user = relationship("User", back_populates="audit_logs")
    case = relationship("Case", back_populates="audit_logs")
    document = relationship("Document", back_populates="audit_logs")