import sys
import os

from app.core.config import AI_DIR, CORE_DIR, BASE_DIR


def configure_legacy_import_paths() -> None:
    """Allow existing parser modules to keep their current local imports."""
    os.chdir(BASE_DIR)

    for path in (AI_DIR, CORE_DIR):
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)
