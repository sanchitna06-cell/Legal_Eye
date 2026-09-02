"""
NyayaLens Shared Contracts

This file defines the canonical data structures exchanged
between backend, AI, intelligence, security and frontend modules.

IMPORTANT:
- Do not create duplicate representations of these objects.
- Do not modify existing fields without informing the team.
- Every AI-derived object MUST retain source provenance.
- Confidence scores belong to extracted/derived information.
- These contracts describe DATA, not implementation.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# ENUMS
# ============================================================

class EntityType(str, Enum):
    PERSON = "PERSON"
    LOCATION = "LOCATION"
    ORGANIZATION = "ORGANIZATION"
    VEHICLE = "VEHICLE"
    PHONE = "PHONE"
    EMAIL = "EMAIL"
    DATE = "DATE"
    EVIDENCE = "EVIDENCE"
    IDENTIFIER = "IDENTIFIER"


class ConflictType(str, Enum):
    TEMPORAL = "TEMPORAL"
    LOCATION = "LOCATION"
    IDENTIFIER = "IDENTIFIER"
    ATTRIBUTE = "ATTRIBUTE"


# ============================================================
# DOCUMENT
# ============================================================

class DocumentData(BaseModel):
    document_id: int
    case_id: int

    filename: str
    file_path: str

    sha256: str

    uploaded_at: datetime


# ============================================================
# EXTRACTED TEXT
# ============================================================

class TextData(BaseModel):
    document_id: int
    case_id: int

    page_number: int

    text: str


# ============================================================
# ENTITY
# ============================================================

class EntityData(BaseModel):
    entity_id: str
    case_id: int
    document_id: int

    page_number: int

    entity_type: EntityType
    value: str

    confidence: float = Field(
        ge=0.0,
        le=1.0
    )


# ============================================================
# EVENT
# ============================================================

class EventData(BaseModel):
    event_id: str
    case_id: int

    event_type: str

    actor: Optional[str] = None
    timestamp: Optional[datetime] = None
    location: Optional[str] = None

    description: Optional[str] = None

    source_document_id: int
    source_page: int

    confidence: float = Field(
        ge=0.0,
        le=1.0
    )


# ============================================================
# TIMELINE
# ============================================================

class TimelineEvent(BaseModel):
    event_id: str

    case_id: int

    timestamp: Optional[datetime] = None

    event_type: str
    description: str

    source_document_id: int
    source_page: int

    confidence: float = Field(
        ge=0.0,
        le=1.0
    )


# ============================================================
# POTENTIAL CONFLICT
# ============================================================

class PotentialConflict(BaseModel):
    conflict_id: str
    case_id: int

    conflict_type: ConflictType

    document_a_id: int
    page_a: int

    document_b_id: int
    page_b: int

    claim_a: str
    claim_b: str

    explanation: str

    confidence: float = Field(
        ge=0.0,
        le=1.0
    )