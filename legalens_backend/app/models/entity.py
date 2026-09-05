from sqlalchemy import String, DateTime, Enum, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.core.database import Base
from app.core.contracts import EntityType

class Entity(Base):
    __tablename__ = "entities"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: __import__('uuid').uuid4().hex)
    page_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("case_file_pages.id"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[EntityType] = mapped_column(Enum(EntityType), nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    context_snippet: Mapped[str] = mapped_column(Text, nullable=True)
    normalized_value: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    