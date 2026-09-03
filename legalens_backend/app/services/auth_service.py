from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.core.security import verify_password

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def authenticate_user(self, username: str, password: str) -> User | None:
        """Check if username/password is correct."""
        stmt = select(User).where(User.username == username)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        return user