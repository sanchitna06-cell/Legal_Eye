from fastapi import APIRouter

router = APIRouter(
    prefix="/intelligence",
    tags=["Intelligence"],
)


@router.get("/health")
async def intelligence_health():
    return {
        "status": "ok",
        "service": "intelligence",
    }