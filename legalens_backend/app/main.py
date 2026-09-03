"""
app/main.py
-----------
The entry point for the NyayaLens backend.
Runs the FastAPI server and registers all routers, event bus, and startup tasks.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.core.events import (
    DOCUMENT_UPLOADED,
    TEXT_EXTRACTED,
)

# Load environment variables
load_dotenv()

# Import routers
from app.routers import health, auth, cases, documents, blockchain, intelligence
from app.core.database import engine, Base
from app.core.event_bus import event_bus
from app.subscribers import text_extractor, entity_extractor, blockchain_subscriber

# =========================================================
# LIFECYCLE MANAGER (Startup / Shutdown)
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup and shutdown events.
    - Creates database tables.
    - Registers all event subscribers.
    """
    # --- STARTUP ---
    print("🚀 NyayaLens backend starting up...")
    
    # 1. Create database tables (if they don't exist)
    print("📊 Creating database tables...")
    async with engine.begin() as conn:
        # In production, use Alembic for migrations.
        # For SIH, we create tables automatically.
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables ready.")
    
    # 2. Register all events and subscribers
    print("🔌 Registering event subscribers...")
    
    # Explicitly subscribe modules
    event_bus.subscribe(
        DOCUMENT_UPLOADED,
        text_extractor.handle_document_uploaded
    )   

    event_bus.subscribe(
        TEXT_EXTRACTED,
        entity_extractor.handle_text_extracted
    )

    event_bus.subscribe(
        DOCUMENT_UPLOADED,
        blockchain_subscriber.handle_document_uploaded
    )   
    print("✅ Event subscribers registered.")
    
    yield  # The application runs here
    
    # --- SHUTDOWN ---
    print("👋 NyayaLens shutting down...")
    # Close database connections if needed
    await engine.dispose()


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="NyayaLens - MHA Secure Document Management",
    description="AI + Blockchain powered evidence management for the Ministry of Home Affairs.",
    version="1.0.0",
    lifespan=lifespan,
)

# =========================================================
# CORS (Allow your frontend to call this backend)
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "*"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# REGISTER ROUTERS
# =========================================================

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(documents.router)
app.include_router(blockchain.router)
app.include_router(intelligence.router)


# =========================================================
# ROOT ENDPOINT
# =========================================================

@app.get("/")
async def root():
    return {
        "message": "Welcome to NyayaLens API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


# =========================================================
# RUN (if executed directly)
# =========================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )