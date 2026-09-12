from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar_event import CalendarEvent
from app.models.case import Case


class CalendarService:

    @staticmethod
    async def verify_case_access(
        db: AsyncSession,
        case_id: str,
        lawyer_id: str,
    ) -> Case:
        result = await db.execute(
            select(Case).where(
                Case.id == case_id,
                Case.created_by == lawyer_id,
            )
        )

        case = result.scalar_one_or_none()

        if case is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Case not found",
            )

        return case

    @staticmethod
    async def create_event(
        db: AsyncSession,
        lawyer_id: str,
        *,
        title: str,
        description: str | None,
        event_type: str,
        start_at: datetime,
        end_at: datetime | None,
        all_day: bool,
        reminder_minutes: int | None,
        case_id: str | None,
    ) -> CalendarEvent:

        if end_at is not None and end_at < start_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event end time cannot be before start time",
            )

        if case_id is not None:
            await CalendarService.verify_case_access(
                db,
                case_id,
                lawyer_id,
            )

        event = CalendarEvent(
            lawyer_id=lawyer_id,
            case_id=case_id,
            title=title,
            description=description,
            event_type=event_type,
            start_at=start_at,
            end_at=end_at,
            all_day=all_day,
            reminder_minutes=reminder_minutes,
        )

        db.add(event)

        await db.commit()
        await db.refresh(event)

        return event

    @staticmethod
    async def get_event(
        db: AsyncSession,
        event_id: str,
        lawyer_id: str,
    ) -> CalendarEvent:

        result = await db.execute(
            select(CalendarEvent).where(
                CalendarEvent.id == event_id,
                CalendarEvent.lawyer_id == lawyer_id,
            )
        )

        event = result.scalar_one_or_none()

        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Calendar event not found",
            )

        return event

    @staticmethod
    async def get_events(
        db: AsyncSession,
        lawyer_id: str,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[CalendarEvent]:

        query = select(CalendarEvent).where(
            CalendarEvent.lawyer_id == lawyer_id
        )

        if start is not None:
            query = query.where(
                CalendarEvent.start_at >= start
            )

        if end is not None:
            query = query.where(
                CalendarEvent.start_at <= end
            )

        query = query.order_by(
            CalendarEvent.start_at.asc()
        )

        result = await db.execute(query)

        return list(result.scalars().all())

    @staticmethod
    async def update_event(
        db: AsyncSession,
        event_id: str,
        lawyer_id: str,
        **updates,
    ) -> CalendarEvent:

        event = await CalendarService.get_event(
            db,
            event_id,
            lawyer_id,
        )

        if "case_id" in updates:
            case_id = updates["case_id"]

            if case_id is not None:
                await CalendarService.verify_case_access(
                    db,
                    case_id,
                    lawyer_id,
                )

            for field, value in updates.items():
                setattr(event, field, value)

        if event.end_at is not None and event.end_at < event.start_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event end time cannot be before start time",
            )

        await db.commit()
        await db.refresh(event)

        return event

    @staticmethod
    async def delete_event(
        db: AsyncSession,
        event_id: str,
        lawyer_id: str,
    ) -> None:

        event = await CalendarService.get_event(
            db,
            event_id,
            lawyer_id,
        )

        await db.delete(event)
        await db.commit()