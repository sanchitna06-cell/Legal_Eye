"""
 Lens Shared Contracts

Canonical data structures exchanged between backend modules,
AI/intelligence modules, security components, and the frontend.

IMPORTANT:
- Do not create duplicate representations of these objects.
- Do not modify existing fields without informing the team.
- Every AI-derived object MUST retain source provenance.
- Confidence scores belong to extracted/derived information.
- These contracts describe DATA, not implementation.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

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


class DocumentStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    VERIFIED = "VERIFIED"
    INTEGRITY_FAILED = "INTEGRITY_FAILED"
    ERROR = "ERROR"

class ProcessingType(str, Enum):
    INTEGRITY_ANCHOR = "INTEGRITY_ANCHOR"
    TEXT_EXTRACTION = "TEXT_EXTRACTION"
    ENTITY_EXTRACTION = "ENTITY_EXTRACTION"


class ProcessingJobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# ============================================================
# DOCUMENT EVENT PAYLOAD
# ============================================================

class DocumentUploadedPayload(BaseModel):
    """
    Payload emitted when a document has been successfully uploaded.
    """

    document_id: str
    case_id: str
    file_name: str
    sha256_hash: str
    uploaded_by: str


# ============================================================
# TEXT EXTRACTION EVENT PAYLOAD
# ============================================================

class TextExtractedPayload(BaseModel):
    """
    Payload emitted after text extraction from a document.
    """

    document_id: str
    case_id: str
    text: str
    page_count: int = Field(ge=0)


# ============================================================
# ENTITY EXTRACTION EVENT PAYLOAD
# ============================================================
class ExtractedEntity(BaseModel):
    """One entity produced by the AI/NLP extraction layer."""

    entity_type: EntityType
    value: str
    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )
    page_number: int = Field(ge=1)

class EntityExtractedPayload(BaseModel):
    """
    Batch of entities extracted from a document.
    """

    document_id: str
    case_id: str

    entities: list[ExtractedEntity]

# ============================================================
# INTEGRITY FAILURE EVENT PAYLOAD
# ============================================================

class IntegrityFailedPayload(BaseModel):
    """
    Payload emitted when document integrity verification fails.
    """

    document_id: str
    case_id: str
    expected_hash: str
    actual_hash: str
    detected_at: datetime
    user_id: str


# ============================================================
# ANALYTICAL ENTITY
# ============================================================

class EntityData(BaseModel):
    """
    Canonical representation of one extracted entity.
    """

    entity_id: str
    case_id: str
    document_id: str

    page_number: int = Field(ge=1)

    entity_type: EntityType
    value: str

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )


# ============================================================
# EXTRACTED EVENT
# ============================================================

class EventData(BaseModel):
    """
    Canonical representation of one case event.
    """

    event_id: str
    case_id: str

    event_type: str

    actor: Optional[str] = None
    timestamp: Optional[datetime] = None
    location: Optional[str] = None
    description: Optional[str] = None

    source_document_id: str
    source_page: int = Field(ge=1)

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )


# ============================================================
# TIMELINE EVENT
# ============================================================

class TimelineEvent(BaseModel):
    event_id: str
    case_id: str

    timestamp: Optional[datetime] = None

    event_type: str
    description: str

    source_document_id: str
    source_page: int = Field(ge=1)

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )


# ============================================================
# POTENTIAL CONFLICT
# ============================================================

class PotentialConflict(BaseModel):
    conflict_id: str
    case_id: str

    conflict_type: ConflictType

    document_a_id: str
    page_a: int = Field(ge=1)

    document_b_id: str
    page_b: int = Field(ge=1)

    claim_a: str
    claim_b: str

    explanation: str

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )


# ============================================================
# AUTH
# ============================================================

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user: dict[str, Any]


# ============================================================
# DOCUMENT UPLOAD RESPONSE
# ============================================================

class UploadResponse(BaseModel):
    document_id: str
    case_id: str
    file_name: str
    sha256_hash: str
    blockchain_block_id: int | None = None
    status: str
    message: str
class VerifyResponse(BaseModel):
    """
    Result of document integrity verification.
    """

    document_id: str
    status: str
    current_hash: str
    blockchain_hash: str
    block_number: int | None
    last_verified_at: datetime
    message: str