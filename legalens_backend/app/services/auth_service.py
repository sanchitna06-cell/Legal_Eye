from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.core.security import verify_password, hash_password


class AuthService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate_user(
        self,
        username: str,
        password: str,
    ) -> User | None:
        """Check if username/password is correct."""

        stmt = select(User).where(User.username == username)

        result = await self.db.execute(stmt)

        user = result.scalar_one_or_none()

        if not user:
            return None

        if not verify_password(
            password,
            user.hashed_password,
        ):
            return None

        return user

    async def change_password(
        self,
        user: User,
        current_password: str,
        new_password: str,
    ) -> bool:
        """Verify the current password and replace it with a new one."""

        if not verify_password(
            current_password,
            user.hashed_password,
        ):
            return False

        if verify_password(
            new_password,
            user.hashed_password,
        ):
            return False

        user.hashed_password = hash_password(new_password)
        user.must_change_password = False

        await self.db.flush()

        return True