"""
NyayaLens Internal Event Bus

The EventBus is used for controlled communication between backend modules.

It does NOT replace the database.

Database:
    Persistent source of truth.

EventBus:
    Internal communication and notification layer.

Security principles:
    - Only registered event types may be published.
    - Only async handlers may be subscribed.
    - Event names are part of the application's communication contract.
    - Invalid events are rejected before reaching subscribers.
"""

from collections import defaultdict
from typing import Any, Awaitable, Callable
from app.core.exceptions import InvalidEventPayloadError
import inspect
from wsgiref import handlers
from app.core.contracts import (
    DocumentData,
    TextData,
    EntityData,
    EventData,
    TimelineEvent,
    PotentialConflict,
)

from app.core.events import (
    DOCUMENT_UPLOADED,
    TEXT_EXTRACTED,
    ENTITY_EXTRACTED,
    EVENT_EXTRACTED,
    TIMELINE_UPDATED,
    CONFLICT_DETECTED,
    ANALYSIS_COMPLETED,
    DOCUMENT_INTEGRITY_FAILED,
)


EventHandler = Callable[[Any], Awaitable[None]]


ALLOWED_EVENTS = frozenset({
    DOCUMENT_UPLOADED,
    TEXT_EXTRACTED,
    ENTITY_EXTRACTED,
    EVENT_EXTRACTED,
    TIMELINE_UPDATED,
    CONFLICT_DETECTED,
    ANALYSIS_COMPLETED,
    DOCUMENT_INTEGRITY_FAILED,
})
EVENT_PAYLOAD_TYPES = {
    DOCUMENT_UPLOADED: DocumentData,
    TEXT_EXTRACTED: TextData,
    ENTITY_EXTRACTED: EntityData,
    EVENT_EXTRACTED: EventData,
    TIMELINE_UPDATED: TimelineEvent,
    CONFLICT_DETECTED: PotentialConflict,
}

class EventBus:

    def __init__(self):
        self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)

    def subscribe(
        self,
        event_name: str,
        handler: EventHandler
    ) -> None:

        if event_name not in ALLOWED_EVENTS:
            raise ValueError(
                f"Unknown event: {event_name}"
            )

        if not inspect.iscoroutinefunction(handler):
            raise TypeError(
                "Event handlers must be async functions"
            )

        if handler in self._subscribers[event_name]:
            raise ValueError(
                "Handler is already subscribed"
            )

        self._subscribers[event_name].append(handler)

    async def publish(
        self,
        event_name: str,
        data: Any
        ) -> None:

        if event_name not in ALLOWED_EVENTS:
            raise ValueError(
                f"Unknown event: {event_name}"
            )

        expected_type = EVENT_PAYLOAD_TYPES.get(event_name)

        if expected_type is None:
            raise ValueError(
                f"No payload contract defined for event: {event_name}"
            )

        if not isinstance(data, expected_type):
            raise InvalidEventPayloadError(
                event_name=event_name,
                expected=expected_type.__name__,
                received=type(data).__name__
            )

        handlers = self._subscribers.get(event_name, [])

        for handler in handlers:
            await handler(data)

event_bus = EventBus()