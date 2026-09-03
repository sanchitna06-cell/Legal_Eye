"""
app/core/contracts.py
---------------------
The Single Source of Truth for all data structures in NyayaLens.
"""

from datetime import datetime
from typing import Optional, List, Literal, Any, Dict
from pydantic import BaseModel, Field, validator
from enum import Enum


# =========================================================
# 1. ENUMS
# =========================================================

class EntityType(str, Enum):
    PERSON = "PERSON"   
    PHONE = "PHONE"
    AADHAAR = "AADHAAR"
    VEHICLE = "VEHICLE"
    LOCATION = "LOCATION"
    DATE = "DATE"
    ORGANIZATION = "ORGANIZATION"
    BANK_ACCOUNT = "BANK_ACCOUNT"
    EMAIL = "EMAIL"
    IP_ADDRESS = "IP_ADDRESS"


class ConflictType(str, Enum):
    TEMPORAL = "TEMPORAL_INCONSISTENCY"
    ENTITY = "ENTITY_MISMATCH"
    DESCRIPTIVE = "DESCRIPTIVE_INCONSISTENCY"
    LOCATION = "LOCATION_CONFLICT"
    ALIBI = "ALIBI_CONFLICT"


class DocumentStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    TEXT_EXTRACTED = "TEXT_EXTRACTED"
    ENTITIES_EXTRACTED = "ENTITIES_EXTRACTED"
    BLOCKCHAIN_VERIFIED = "BLOCKCHAIN_VERIFIED"
    TAMPERED = "TAMPERED"
    LOCKED = "LOCKED"


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    SUPERVISOR = "SUPERVISOR"
    INVESTIGATOR = "INVESTIGATOR"
    VIEWER = "VIEWER"
    FORENSIC = "FORENSIC"


# =========================================================
# 2. CORE DATA MODELS
# =========================================================

class DocumentData(BaseModel):
    id: Optional[str] = None
    case_id: str = Field(..., min_length=1)
    file_name: str = Field(..., min_length=1, max_length=255)
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = Field(None, ge=0)
    mime_type: Optional[str] = None
    sha256_hash: Optional[str] = None
    blockchain_block_id: Optional[int] = None
    status: DocumentStatus = DocumentStatus.UPLOADED
    uploaded_by: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    last_verified_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator('file_name')
    def validate_file_name(cls, v):
        if not v or v.strip() == '':
            raise ValueError('File name cannot be empty')
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "case_id": "CASE-2026-0142",
                "file_name": "witness_statement.pdf",
                "file_size_bytes": 245760,
                "mime_type": "application/pdf"
            }
        }


class TextData(BaseModel):
    document_id: str
    text: str = Field(..., min_length=1)
    page_count: Optional[int] = Field(None, ge=0)
    extracted_at: datetime = Field(default_factory=datetime.utcnow)


class EntityData(BaseModel):
    id: Optional[str] = None
    document_id: str
    case_id: str
    entity_type: EntityType
    value: str = Field(..., min_length=1, max_length=500)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    context_snippet: Optional[str] = Field(None, max_length=500)
    normalized_value: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "doc_abc123",
                "case_id": "CASE-2026-0142",
                "entity_type": "PERSON",
                "value": "Vikram Singh",
                "confidence_score": 0.96
            }
        }


class TimelineEvent(BaseModel):
    id: Optional[str] = None
    case_id: str
    document_id: Optional[str] = None
    timestamp: datetime
    description: str = Field(..., min_length=1, max_length=1000)
    event_type: Literal["WITNESS", "FIR", "CCTV", "FORENSIC", "DEVICE", "OTHER"] = "OTHER"
    source_page: Optional[int] = Field(None, ge=1)
    evidence_backed: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PotentialConflict(BaseModel):
    id: Optional[str] = None
    case_id: str
    conflict_type: ConflictType
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=1000)
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    affected_entities: List[str] = Field(default_factory=list)
    linked_documents: List[str] = Field(default_factory=list)
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    resolved: bool = False
    resolution_notes: Optional[str] = None


class BlockchainBlock(BaseModel):
    index: int = Field(..., ge=0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    action: Literal["UPLOAD", "VIEW", "EDIT", "DOWNLOAD", "SHARE", "TAMPER_DETECTED", "VERIFIED"]
    document_id: str
    document_hash: str = Field(..., min_length=64, max_length=64)
    user_id: str
    previous_hash: str = Field(..., min_length=64, max_length=64)
    hash: str = Field(..., min_length=64, max_length=64)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


# =========================================================
# 3. EVENT PAYLOADS
# =========================================================

class DocumentUploadedPayload(BaseModel):
    document_id: str
    case_id: str
    file_name: str
    sha256_hash: str
    uploaded_by: str


class TextExtractedPayload(BaseModel):
    document_id: str
    text: str
    page_count: Optional[int]


class EntityExtractedPayload(BaseModel):
    document_id: str
    case_id: str
    entities: List[Dict[str, Any]]


class IntegrityFailedPayload(BaseModel):
    document_id: str
    expected_hash: str
    actual_hash: str
    detected_at: datetime
    user_id: str


# =========================================================
# 4. API REQUEST/RESPONSE MODELS
# =========================================================

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)

    class Config:
        json_schema_extra = {"example": {"username": "sharma", "password": "secure123"}}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: Dict[str, Any]


class UploadResponse(BaseModel):
    document_id: str
    case_id: str
    file_name: str
    sha256_hash: str
    blockchain_block_id: int
    status: str
    message: str


class VerifyResponse(BaseModel):
    document_id: str
    status: Literal["VERIFIED", "TAMPERED", "PENDING"]
    current_hash: str
    blockchain_hash: str
    block_number: int
    last_verified_at: datetime
    message: Optional[str] = None


class GraphResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

    class Config:
        json_schema_extra = {
            "example": {
                "nodes": [
                    {"id": 1, "label": "Case #404 (Mumbai)", "color": "#f97316", "shape": "dot", "size": 25}
                ],
                "edges": [
                    {"from": 1, "to": 2, "label": "linked"}
                ]
            }
        }