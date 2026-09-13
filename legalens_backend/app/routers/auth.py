from fastapi import APIRouter, Depends, HTTPException, Request, status
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
from app.core.contracts import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    ChangePasswordRequest,
)
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.security_event_service import SecurityEventService


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ============================================================
# LOGIN
# ============================================================

@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a user and return JWT tokens."""

    auth_service = AuthService(db)

    client_ip = SecurityEventService.get_client_ip(
        http_request
    )

    endpoint = http_request.url.path

    user = await auth_service.authenticate_user(
        request.username,
        request.password,
    )

    # --------------------------------------------------------
    # Authentication failure
    # --------------------------------------------------------

    if not user:
        await SecurityEventService.record(
            db,
            event_type="AUTH_FAILURE",
            severity="medium",
            ip_address=client_ip,
            endpoint=endpoint,
            details={
                "reason": "invalid_credentials",
                "username": request.username,
            },
        )

        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # --------------------------------------------------------
    # Disabled account
    # --------------------------------------------------------

    if not user.is_active:
        await SecurityEventService.record(
            db,
            event_type="ACCOUNT_DISABLED",
            severity="high",
            user_id=user.id,
            ip_address=client_ip,
            endpoint=endpoint,
            details={
                "reason": "inactive_account_login_attempt",
                "username": user.username,
            },
        )

        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # --------------------------------------------------------
    # Successful authentication
    # --------------------------------------------------------

    await SecurityEventService.record(
        db,
        event_type="AUTH_SUCCESS",
        severity="low",
        user_id=user.id,
        ip_address=client_ip,
        endpoint=endpoint,
        details={
            "method": "password",
        },
    )

    # --------------------------------------------------------
    # Create JWT tokens
    # --------------------------------------------------------

    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role.value,
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    await db.commit()

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
            "must_change_password": user.must_change_password,
        },
    )


# ============================================================
# SWAGGER / OAUTH2 LOGIN
# ============================================================

@router.post("/token")
async def login_for_swagger(
    http_request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2-compatible login endpoint used by Swagger."""

    auth_service = AuthService(db)

    client_ip = (
        SecurityEventService.get_client_ip(http_request)
        if http_request is not None
        else None
    )

    endpoint = (
        http_request.url.path
        if http_request is not None
        else "/auth/token"
    )

    user = await auth_service.authenticate_user(
        form_data.username,
        form_data.password,
    )

    if not user:
        await SecurityEventService.record(
            db,
            event_type="AUTH_FAILURE",
            severity="medium",
            ip_address=client_ip,
            endpoint=endpoint,
            details={
                "reason": "invalid_credentials",
                "username": form_data.username,
                "method": "oauth2",
            },
        )

        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        await SecurityEventService.record(
            db,
            event_type="ACCOUNT_DISABLED",
            severity="high",
            user_id=user.id,
            ip_address=client_ip,
            endpoint=endpoint,
            details={
                "reason": "inactive_account_login_attempt",
                "method": "oauth2",
                "username": user.username,
            },
        )

        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    await SecurityEventService.record(
        db,
        event_type="AUTH_SUCCESS",
        severity="low",
        user_id=user.id,
        ip_address=client_ip,
        endpoint=endpoint,
        details={
            "method": "oauth2",
        },
    )

    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role.value,
    }

    access_token = create_access_token(token_data)

    await db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ============================================================
# REFRESH TOKEN
# ============================================================

@router.post("/refresh", response_model=LoginResponse)
async def refresh_access_token(
    request: RefreshTokenRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Validate a refresh token and issue a new access token."""

    client_ip = SecurityEventService.get_client_ip(
        http_request
    )

    endpoint = http_request.url.path

    payload = verify_refresh_token(
        request.refresh_token
    )

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

    if not user.is_active:
        await SecurityEventService.record(
            db,
            event_type="ACCOUNT_DISABLED",
            severity="high",
            user_id=user.id,
            ip_address=client_ip,
            endpoint=endpoint,
            details={
                "reason": "inactive_account_token_refresh",
                "username": user.username,
            },
        )

        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role.value,
    }

    new_access_token = create_access_token(
        token_data
    )

    await db.commit()

    return LoginResponse(
        access_token=new_access_token,
        refresh_token=request.refresh_token,
        token_type="Bearer",
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
            "must_change_password": user.must_change_password,
        },
    )


# ============================================================
# CHANGE PASSWORD
# ============================================================

@router.post("/change-password")
async def change_password(
    http_request: Request,
    request: ChangePasswordRequest,
    current_user: dict = Depends(
        get_current_active_user_for_password_change
    ),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's password."""

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

    client_ip = (
        SecurityEventService.get_client_ip(http_request)
        if http_request is not None
        else None
    )

    await AuditService.log(
        db,
        user_id=user.id,
        action="PASSWORD_CHANGED",
        details={
            "forced_change": was_forced_change,
        },
        ip_address=client_ip,
        request_id=None,
    )

    await db.commit()

    return {
        "message": "Password changed successfully.",
    }