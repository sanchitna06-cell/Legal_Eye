"""add entity extraction source

Revision ID: 724fd174dc8b
Revises: 90e806564246
Create Date: 2026-09-14 09:55:58.636392

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '724fd174dc8b'
down_revision: Union[str, Sequence[str], None] = '90e806564246'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    entity_extraction_source = sa.Enum(
        "DETERMINISTIC",
        "AI",
        name="entity_extraction_source",
    )
    entity_extraction_source.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "entities",
        sa.Column(
            "extraction_source",
            entity_extraction_source,
            nullable=True,
        ),
    )

    op.execute(
        "UPDATE entities "
        "SET extraction_source = 'AI' "
        "WHERE extraction_source IS NULL"
    )

    op.alter_column(
        "entities",
        "extraction_source",
        existing_type=entity_extraction_source,
        nullable=False,
    )
def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("entities", "extraction_source")

    entity_extraction_source = sa.Enum(
        "DETERMINISTIC",
        "AI",
        name="entity_extraction_source",
    )
    entity_extraction_source.drop(op.get_bind(), checkfirst=True)