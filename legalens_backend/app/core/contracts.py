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
    AADHAAR = "AADHAAR"
    BANK_ACCOUNT = "BANK_ACCOUNT"
    IP_ADDRESS = "IP_ADDRESS"
    IDENTIFIER = "IDENTIFIER"
    EVIDENCE = "EVIDENCE"
    OTHER = "OTHER"


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

    value: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )

    page_number: int = Field(
        ge=1,
    )

    context_snippet: str | None = Field(
        default=None,
        max_length=5000,
    )

    normalized_value: str | None = Field(
        default=None,
        max_length=500,
    )

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
class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)

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
    blockchain_block_id: str | None = None
    status: str
    message: str

# ============================================================
# DOCUMENT PROCESSING STATUS (PUBLIC API CONTRACT)
#
# Sanitized, frontend-facing representation of internal
# document-processing state. Deliberately minimal:
# no internal identifiers, job records, storage keys,
# event names, or infrastructure details are exposed.
# ============================================================

class PublicDocumentStatus(str, Enum):
    """Public ingestion status of one document."""

    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PublicProcessingStage(str, Enum):
    """Broad public processing stage, decoupled from internal job types."""

    DOCUMENT_ANALYSIS = "DOCUMENT_ANALYSIS"
    CASE_RECORD = "CASE_RECORD"
    INTEGRITY = "INTEGRITY"
    COMPLETE = "COMPLETE"


class DocumentStatusResponse(BaseModel):
    """
    Public processing status for one document.

    This is the ONLY shape the status endpoint returns.
    """

    status: PublicDocumentStatus
    stage: PublicProcessingStage
    message: str = Field(min_length=1, max_length=200)


# ============================================================
# ANNOTATIONS
# ============================================================

class AnnotationCreate(BaseModel):
    """
    Data supplied by the frontend when creating an annotation.

    Server-controlled fields such as id, page_id, created_by,
    and timestamps are intentionally excluded.
    """
    annotation_type: str = Field(..., min_length=1, max_length=50)
    content: str | None = None
    position: dict[str, Any]
class AnnotationUpdate(BaseModel):
    annotation_type: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )
    content: str | None = None
    position: dict[str, Any] | None = None

class AnnotationResponse(BaseModel):
    """
    Annotation returned by the API.
    """
    id: str
    page_id: str
    created_by: str
    annotation_type: str
    content: str | None = None
    position: dict[str, Any]
    created_at: datetime
    updated_at: datetime
class PageFlagCreate(BaseModel):
    flag_type: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )
    reason: str | None = None


class PageFlagResponse(BaseModel):
    id: str
    page_id: str
    flagged_by: str
    flag_type: str
    reason: str | None = None
    created_at: datetime
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
# ============================================================
# CALENDAR
# ============================================================

class CalendarEventType(str, Enum):
    HEARING = "HEARING"
    FILING_DEADLINE = "FILING_DEADLINE"
    CLIENT_MEETING = "CLIENT_MEETING"
    COURT_APPEARANCE = "COURT_APPEARANCE"
    REMINDER = "REMINDER"
    OTHER = "OTHER"


class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    event_type: CalendarEventType = CalendarEventType.OTHER

    start_at: datetime
    end_at: datetime | None = None

    all_day: bool = False
    reminder_minutes: int | None = Field(
        default=None,
        ge=0,
        le=10080,
    )

    case_id: str | None = None


class CalendarEventUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )
    description: str | None = None
    event_type: CalendarEventType | None = None

    start_at: datetime | None = None
    end_at: datetime | None = None

    all_day: bool | None = None

    reminder_minutes: int | None = Field(
        default=None,
        ge=0,
        le=10080,
    )

    case_id: str | None = None


class CalendarEventResponse(BaseModel):
    id: str
    lawyer_id: str
    case_id: str | None

    title: str
    description: str | None
    event_type: CalendarEventType

    start_at: datetime
    end_at: datetime | None

    all_day: bool
    reminder_minutes: int | None

    created_at: datetime
    updated_at: datetime