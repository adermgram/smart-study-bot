"""course ownership

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "courses", sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.user_id"), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("courses", "owner_id")
