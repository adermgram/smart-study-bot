"""quiz answer key and nullable score

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quiz_attempts", sa.Column("total_questions", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("quiz_attempts", "total_questions", server_default=None)
    op.add_column(
        "quiz_attempts", sa.Column("generated_quiz", postgresql.JSONB(), nullable=False, server_default="{}")
    )
    op.alter_column("quiz_attempts", "generated_quiz", server_default=None)
    op.alter_column("quiz_attempts", "score", nullable=True)


def downgrade() -> None:
    op.alter_column("quiz_attempts", "score", nullable=False)
    op.drop_column("quiz_attempts", "generated_quiz")
    op.drop_column("quiz_attempts", "total_questions")
