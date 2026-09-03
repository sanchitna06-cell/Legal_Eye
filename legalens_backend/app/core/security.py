"""
app/core/security.py
--------------------
The Gatekeeper of NyayaLens.
Handles password hashing, JWT creation, and role-based access control.
"""

import os
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    import secrets
    SECRET_KEY = secrets.token_urlsafe(32)
    print(f"⚠️  WARNING: SECRET_KEY generated: {SECRET_KEY}")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Password hashing
pwd_context = PasswordHash.recommended()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    payload = verify_token(token)
    if payload.get("sub") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return payload

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return current_user

async def get_current_supervisor(current_user: Dict[str, Any] = Depends(get_current_active_user)) -> Dict[str, Any]:
    role = current_user.get("role")
    if role not in ["SUPERVISOR", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor or Admin role required")
    return current_user

async def get_current_investigator(current_user: Dict[str, Any] = Depends(get_current_active_user)) -> Dict[str, Any]:
    role = current_user.get("role")
    if role not in ["INVESTIGATOR", "SUPERVISOR", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Investigator role required")
    return current_user

if __name__ == "__main__":
    import secrets
    print("🔑 New SECRET_KEY:", secrets.token_urlsafe(32))