"""
LegalLens Event Definitions

This file defines the canonical event names used by
the backend communication layer.
"""

# Document lifecycle
DOCUMENT_UPLOADED = "document.uploaded"
TEXT_EXTRACTED = "text.extracted"

# Intelligence pipeline
ENTITY_EXTRACTED = "entity.extracted"
EVENT_EXTRACTED = "event.extracted"
TIMELINE_UPDATED = "timeline.updated"
CONFLICT_DETECTED = "conflict.detected"
ANALYSIS_COMPLETED = "analysis.completed"

# Integrity
DOCUMENT_INTEGRITY_FAILED = "document.integrity_failed"
DOCUMENT_VERIFIED = "document.verified"

# Case lifecycle
CASE_CREATED = "case.created"
CASE_UPDATED = "case.updated"


EVENTS = frozenset({
    DOCUMENT_UPLOADED,
    TEXT_EXTRACTED,
    ENTITY_EXTRACTED,
    EVENT_EXTRACTED,
    TIMELINE_UPDATED,
    CONFLICT_DETECTED,
    ANALYSIS_COMPLETED,
    DOCUMENT_INTEGRITY_FAILED,
    DOCUMENT_VERIFIED,
    CASE_CREATED,
    CASE_UPDATED,
})