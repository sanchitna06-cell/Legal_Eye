"""make case timestamps timezone aware

Revision ID: 90e806564246
Revises: 2cb2b7e5eae9
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "90e806564246"
down_revision: Union[str, Sequence[str], None] = "2cb2b7e5eae9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Convert existing case timestamps from naive UTC to timezone-aware UTC."""

    op.alter_column(
        "cases",
        "created_at",
        existing_type=sa.DateTime(),
        type_=postgresql.TIMESTAMP(timezone=True),
        existing_nullable=False,
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )

    op.alter_column(
        "cases",
        "updated_at",
        existing_type=sa.DateTime(),
        type_=postgresql.TIMESTAMP(timezone=True),
        existing_nullable=False,
        postgresql_using="updated_at AT TIME ZONE 'UTC'",
    )


def downgrade() -> None:
    """Convert case timestamps back to naive UTC timestamps."""

    op.alter_column(
        "cases",
        "updated_at",
        existing_type=postgresql.TIMESTAMP(timezone=True),
        type_=sa.DateTime(),
        existing_nullable=False,
        postgresql_using="updated_at AT TIME ZONE 'UTC'",
    )

    op.alter_column(
        "cases",
        "created_at",
        existing_type=postgresql.TIMESTAMP(timezone=True),
        type_=sa.DateTime(),
        existing_nullable=False,
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )