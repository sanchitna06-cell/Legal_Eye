import os
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash


load_dotenv()


# ============================================================
# CONFIGURATION
# ============================================================

def get_secret_key() -> str:
    secret_key = os.getenv("SECRET_KEY")

    if not secret_key:
        raise RuntimeError("SECRET_KEY is not configured")

    return secret_key


SECRET_KEY: str = get_secret_key()

ALGORITHM = os.getenv("ALGORITHM", "HS256")

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

REFRESH_TOKEN_EXPIRE_DAYS = int(
    os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/token"
)


# ============================================================
# PASSWORD HASHING
# ============================================================

pwd_context = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    return pwd_context.verify(
        plain_password,
        hashed_password,
    )


# ============================================================
# ACCESS TOKEN
# ============================================================

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:

    now = datetime.now(timezone.utc)

    expire = now + (
        expires_delta
        or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode = data.copy()

    to_encode.update({
        "iat": now,
        "exp": expire,
        "iss": "legallens-backend",
        "aud": "legallens-api",
        "type": "access",
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


# ============================================================
# REFRESH TOKEN
# ============================================================

def create_refresh_token(
    data: Dict[str, Any],
) -> str:

    now = datetime.now(timezone.utc)

    expire = now + timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )

    to_encode = data.copy()

    to_encode.update({
        "iat": now,
        "exp": expire,
        "iss": "legallens-backend",
        "aud": "legallens-api",
        "type": "refresh",
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


# ============================================================
# ACCESS TOKEN VERIFICATION
# ============================================================

def verify_token(token: str) -> Dict[str, Any]:

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            issuer="legallens-backend",
            audience="legallens-api",
        )

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        if payload.get("sub") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        if payload.get("user_id") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        if payload.get("role") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )


# ============================================================
# REFRESH TOKEN VERIFICATION
# ============================================================

def verify_refresh_token(
    token: str,
) -> Dict[str, Any]:

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            issuer="legallens-backend",
            audience="legallens-api",
        )

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        if payload.get("sub") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token payload",
            )

        if payload.get("user_id") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token payload",
            )

        if payload.get("role") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token payload",
            )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


# ============================================================
# AUTHENTICATION
# ============================================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> Dict[str, Any]:

    return verify_token(token)


async def get_current_active_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:

    return current_user


# ============================================================
# ROLE AUTHORIZATION
# ============================================================

async def get_current_investigator(
    current_user: Dict[str, Any] = Depends(
        get_current_active_user
    ),
) -> Dict[str, Any]:

    role = current_user.get("role")

    if role not in {
        "INVESTIGATOR",
        "SUPERVISOR",
        "ADMIN",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Investigator role required",
        )

    return current_user


async def get_current_supervisor(
    current_user: Dict[str, Any] = Depends(
        get_current_active_user
    ),
) -> Dict[str, Any]:

    role = current_user.get("role")

    if role not in {
        "SUPERVISOR",
        "ADMIN",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisor or Admin role required",
        )

    return current_user