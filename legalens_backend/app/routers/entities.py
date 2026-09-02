from fastapi import APIRouter

from app.core.contracts import EntityData
from app.core.event_bus import event_bus
from app.core.events import ENTITY_EXTRACTED

router = APIRouter()


@router.post("/cases/{case_id}/entities")
async def create_entity(case_id: int, entity: EntityData):

    await event_bus.publish(
        ENTITY_EXTRACTED,
        entity
    )

    return {
        "message": "Entity received",
        "entity": entity
    }