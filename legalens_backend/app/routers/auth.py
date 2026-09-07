from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_active_user_for_password_change,
)
from app.core.contracts import LoginRequest, LoginResponse, RefreshTokenRequest, ChangePasswordRequest
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService

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
    db: AsyncSession = Depends(get_db),
):
    payload = verify_refresh_token(request.refresh_token)

    user_id = payload["user_id"]

    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )

    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role.value,
    }

    new_access_token = create_access_token(token_data)

    return LoginResponse(
        access_token=new_access_token,
        refresh_token=request.refresh_token,
        token_type="Bearer",
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
        },
    )
@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_active_user_for_password_change),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.id == current_user["user_id"]
        )
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
        )

    was_forced_change = user.must_change_password

    auth_service = AuthService(db)

    changed = await auth_service.change_password(
        user=user,
        current_password=request.current_password,
        new_password=request.new_password,
    )

    if not changed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Current password is incorrect or "
                "new password is the same as the current password."
            ),
        )

    await AuditService.log(
        db,
        user_id=user.id,
        action="PASSWORD_CHANGED",
        details={
            "forced_change": was_forced_change,
        },
    )

    await db.commit()

    return {
        "message": "Password changed successfully.",
    }