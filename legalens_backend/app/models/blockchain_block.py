import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BlockchainBlock(Base):
    __tablename__ = "blockchain_blocks"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: uuid.uuid4().hex,
    )

    block_index: Mapped[int] = mapped_column(
        Integer,
        unique=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    document_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("case_files.id"),
        nullable=True,
        index=True,
    )

    document_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    previous_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
    )

    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    block_metadata: Mapped[dict | None] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
    )

    document = relationship("Document")
    user = relationship("User")