"""
app/core/events.py
------------------
Defines all event types for the EventBus.
"""

# All registered events
EVENTS = {
    "document.uploaded",
    "text.extracted",
    "entity.extracted",
    "event.extracted",
    "timeline.updated",
    "conflict.detected",
    "analysis.completed",
    "document.integrity_failed",
    "document.verified",
    "case.created",
    "case.updated",
}


def register_all_events():
    """Placeholder to register events if needed."""
    print(f"📋 Registered {len(EVENTS)} event types.")
    return EVENTS