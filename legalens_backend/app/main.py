from fastapi import FastAPI

from app.routers import health, cases, entities

from app.core.exceptions import InvalidEventPayloadError
from app.core.error_handlers import invalid_event_payload_handler


app = FastAPI()

app.add_exception_handler(
    InvalidEventPayloadError,
    invalid_event_payload_handler
)


@app.get("/")
def home():
    return {
        "message": "NyayaLens Backend is running"
    }


app.include_router(health.router)
app.include_router(cases.router)
app.include_router(entities.router)