from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.contracts import (
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventUpdate,
)
from app.core.database import get_db
from app.core.security import get_current_lawyer
from app.services.calendar_service import CalendarService


router = APIRouter(
    prefix="/calendar",
    tags=["Calendar"],
)


def event_to_response(event) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=event.id,
        lawyer_id=event.lawyer_id,
        case_id=event.case_id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        start_at=event.start_at,
        end_at=event.end_at,
        all_day=event.all_day,
        reminder_minutes=event.reminder_minutes,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.post(
    "/events",
    response_model=CalendarEventResponse,
)
async def create_calendar_event(
    event: CalendarEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_lawyer),
):
    created = await CalendarService.create_event(
        db,
        lawyer_id=current_user["user_id"],
        title=event.title,
        description=event.description,
        event_type=event.event_type.value,
        start_at=event.start_at,
        end_at=event.end_at,
        all_day=event.all_day,
        reminder_minutes=event.reminder_minutes,
        case_id=event.case_id,
    )

    return event_to_response(created)


@router.get(
    "/events",
    response_model=list[CalendarEventResponse],
)
async def get_calendar_events(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_lawyer),
):
    events = await CalendarService.get_events(
        db,
        lawyer_id=current_user["user_id"],
        start=start,
        end=end,
    )

    return [
        event_to_response(event)
        for event in events
    ]


@router.get(
    "/events/{event_id}",
    response_model=CalendarEventResponse,
)
async def get_calendar_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_lawyer),
):
    event = await CalendarService.get_event(
        db,
        event_id,
        current_user["user_id"],
    )

    return event_to_response(event)


@router.patch(
    "/events/{event_id}",
    response_model=CalendarEventResponse,
)
async def update_calendar_event(
    event_id: str,
    event: CalendarEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_lawyer),
):
    updates = event.model_dump(
        exclude_unset=True
    )

    if "event_type" in updates and updates["event_type"] is not None:
        updates["event_type"] = updates["event_type"].value

    updated = await CalendarService.update_event(
        db,
        event_id,
        current_user["user_id"],
        **updates,
    )

    return event_to_response(updated)


@router.delete(
    "/events/{event_id}",
)
async def delete_calendar_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_lawyer),
):
    await CalendarService.delete_event(
        db,
        event_id,
        current_user["user_id"],
    )

    return {
        "message": "Calendar event deleted successfully"
    }