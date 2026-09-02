import os
from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_config_and_revisions():
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
    assert os.path.exists(alembic_ini_path)

    config = Config(alembic_ini_path)
    config.set_main_option("script_location", os.path.join(backend_dir, "migrations"))

    script_directory = ScriptDirectory.from_config(config)

    # Verify head revision is discoverable
    heads = script_directory.get_heads()
    assert len(heads) == 1
    assert heads[0] == "0003_add_comments_and_reactions"

