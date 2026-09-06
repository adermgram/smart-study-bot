"""topic tag source split (questions vs quiz performance)

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

topic_tag_source = sa.Enum("questions", "quiz", name="topic_tag_source")


def upgrade() -> None:
    topic_tag_source.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "topic_tags",
        sa.Column("source", topic_tag_source, nullable=False, server_default="questions"),
    )
    op.alter_column("topic_tags", "question_count", nullable=True)
    op.add_column("topic_tags", sa.Column("avg_quiz_score_pct", sa.Float(), nullable=True))
    op.add_column("topic_tags", sa.Column("quiz_attempt_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("topic_tags", "quiz_attempt_count")
    op.drop_column("topic_tags", "avg_quiz_score_pct")
    op.alter_column("topic_tags", "question_count", nullable=False)
    op.drop_column("topic_tags", "source")
    topic_tag_source.drop(op.get_bind(), checkfirst=True)
