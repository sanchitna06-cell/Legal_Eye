from fastapi import FastAPI
from app.routers import cases

from . import health

app = FastAPI()


@app.get("/")
def home():
    return {
        "message": "NyayaLens Backend is running"
    }


app.include_router(health.router)
app.include_router(cases.router)