"""add sighting details

Revision ID: 0009_add_sighting_details
Revises: 0008_add_incident_clustering
Create Date: 2026-09-02 20:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0009_add_sighting_details'
down_revision: Union[str, None] = '0008_add_incident_clustering'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('missing_person_sightings', sa.Column('clothing', sa.Text(), nullable=True))
    op.add_column('missing_person_sightings', sa.Column('direction', sa.String(length=255), nullable=True))
    op.add_column('missing_person_sightings', sa.Column('additional_information', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('missing_person_sightings', 'additional_information')
    op.drop_column('missing_person_sightings', 'direction')
    op.drop_column('missing_person_sightings', 'clothing')
