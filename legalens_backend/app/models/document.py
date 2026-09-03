from sqlalchemy import String, DateTime, Enum, Integer, ForeignKey, Text, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.core.database import Base
from app.core.contracts import DocumentStatus
import enum

class Document(Base):
    __tablename__ = "documents"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: __import__('uuid').uuid4().hex)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=True)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    blockchain_block_id: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus), default=DocumentStatus.UPLOADED)
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_verified_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    document_metadata: Mapped[str] = mapped_column(
        "metadata",
        Text,
        nullable=True,
    )  # JSON string
    
    # Relationships
    case = relationship("Case", back_populates="documents")
    uploader = relationship("User", back_populates="documents")
    entities = relationship("Entity", back_populates="document")
    audit_logs = relationship("AuditLog", back_populates="document")