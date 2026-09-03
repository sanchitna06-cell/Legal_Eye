from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import create_access_token, verify_password
from app.core.contracts import LoginRequest, LoginResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and return a JWT token."""
    auth_service = AuthService(db)
    user = await auth_service.authenticate_user(request.username, request.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    
    # Create JWT token
    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role.value,
        "full_name": user.full_name,
    }
    access_token = create_access_token(token_data)
    
    return LoginResponse(
        access_token=access_token,
        token_type="Bearer",
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
        }
    )