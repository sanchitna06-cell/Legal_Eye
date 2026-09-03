"""
app/core/event_bus.py
---------------------
The internal message bus for asynchronous module communication.
"""

import asyncio
from typing import Dict, List, Callable, Any, Awaitable
from app.core.events import EVENTS
from app.core.contracts import EventData

class EventBus:
    """Simple async event bus with validation."""
    
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[Any], Awaitable[None]]]] = {}
        self._event_types = EVENTS
    
    def subscribe(self, event_type: str, handler: Callable[[Any], Awaitable[None]]):
        """Register a handler for an event type."""
        if event_type not in self._event_types:
            raise ValueError(f"Unknown event type: {event_type}")
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        if handler not in self._subscribers[event_type]:
            self._subscribers[event_type].append(handler)
            print(f"✅ Subscribed handler to {event_type}")
    
    async def emit(self, event_type: str, payload: Any):
        """Emit an event to all registered handlers."""
        if event_type not in self._event_types:
            raise ValueError(f"Unknown event type: {event_type}")
        
        handlers = self._subscribers.get(event_type, [])
        if handlers:
            # Fire and forget (run concurrently)
            for handler in handlers:
                asyncio.create_task(handler(payload))
            print(f"📨 Emitted {event_type} to {len(handlers)} handlers")
        else:
            print(f"📨 Emitted {event_type} (no handlers)")
    
    def clear(self):
        """Clear all subscribers (useful for testing)."""
        self._subscribers.clear()

# Singleton instance
event_bus = EventBus()