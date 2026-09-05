import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole


async def create_user(
    db,
    username: str,
    full_name: str,
    role: UserRole,
):
    result = await db.execute(
        select(User).where(User.username == username)
    )

    if result.scalar_one_or_none() is not None:
        print(f"{username} already exists.")
        return

    user = User(
        username=username,
        hashed_password=hash_password("TestPassword123!"),
        full_name=full_name,
        role=role,
        is_active=True,
    )

    db.add(user)
    print(f"Created {username} ({role.value})")


async def main():
    async with AsyncSessionLocal() as db:

        await create_user(
            db,
            "test_lawyer_b",
            "Test Lawyer B",
            UserRole.LAWYER,
        )

        await create_user(
            db,
            "testadmin",
            "Test Admin",
            UserRole.ADMIN,
        )

        await db.commit()

        print("Test accounts ready.")


asyncio.run(main())