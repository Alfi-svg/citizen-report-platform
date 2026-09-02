import os
from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_config_and_revisions():
    alembic_ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    assert os.path.exists(alembic_ini_path)

    config = Config(alembic_ini_path)
    script_directory = ScriptDirectory.from_config(config)

    # Verify head revision is discoverable
    heads = script_directory.get_heads()
    assert len(heads) == 1
    assert heads[0] == "0001_initial_database_foundation"
