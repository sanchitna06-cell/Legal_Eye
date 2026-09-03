from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("/ping")
async def ping():
    return {"status": "ok", "message": "pong"}

@router.get("/")
async def health_check():
    return {"status": "healthy", "service": "NyayaLens"}