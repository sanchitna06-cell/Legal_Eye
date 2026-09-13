"""make case file upload timestamps timezone aware

Revision ID: 2cb2b7e5eae9
Revises: 29ded4a1998d
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "2cb2b7e5eae9"
down_revision: Union[str, Sequence[str], None] = "29ded4a1998d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Convert existing upload timestamps from naive UTC to timezone-aware UTC."""

    op.alter_column(
        "case_files",
        "uploaded_at",
        existing_type=sa.DateTime(),
        type_=postgresql.TIMESTAMP(timezone=True),
        existing_nullable=False,
        postgresql_using="uploaded_at AT TIME ZONE 'UTC'",
    )


def downgrade() -> None:
    """Convert upload timestamps back to naive UTC timestamps."""

    op.alter_column(
        "case_files",
        "uploaded_at",
        existing_type=postgresql.TIMESTAMP(timezone=True),
        type_=sa.DateTime(),
        existing_nullable=False,
        postgresql_using="uploaded_at AT TIME ZONE 'UTC'",
    )