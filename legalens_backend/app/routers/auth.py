from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from app.core.contracts import LoginRequest, LoginResponse, RefreshTokenRequest
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
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
        }
    )
@router.post("/token")
async def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)

    user = await auth_service.authenticate_user(
        form_data.username,
        form_data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role.value,
    }

    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
@router.post("/refresh", response_model=LoginResponse)
async def refresh_access_token(
    request: RefreshTokenRequest,
):
    payload = verify_refresh_token(request.refresh_token)

    token_data = {
        "sub": payload["sub"],
        "user_id": payload["user_id"],
        "role": payload["role"],
        "full_name": payload["full_name"],
    }

    new_access_token = create_access_token(token_data)

    return LoginResponse(
        access_token=new_access_token,
        refresh_token=request.refresh_token,
        token_type="Bearer",
        user={
            "id": payload["user_id"],
            "username": payload["sub"],
            "full_name": payload["full_name"],
            "role": payload["role"],
        },
    )