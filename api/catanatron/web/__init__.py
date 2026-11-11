import os
import tempfile

from flask import Flask
from flask_cors import CORS

_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


def _strip_quotes(val: str) -> str:
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
        return val[1:-1]
    return val


def _load_dotenv_files(search_dirs=None) -> None:
    """Load .env and .env.local variables without overriding existing env vars."""
    dirs = (
        list(search_dirs)
        if search_dirs is not None
        else [_REPO_ROOT, os.path.join(_REPO_ROOT, "ui"), os.getcwd()]
    )
    seen_dirs: set[str] = set()
    parsed_vars: dict[str, str] = {}

    for directory in dirs:
        if not directory:
            continue
        norm_dir = os.path.abspath(directory)
        if norm_dir in seen_dirs or not os.path.isdir(norm_dir):
            continue
        seen_dirs.add(norm_dir)
        for filename in (".env", ".env.local"):
            path = os.path.join(norm_dir, filename)
            if not os.path.isfile(path):
                continue
            try:
                with open(path, encoding="utf-8") as fh:
                    for raw_line in fh:
                        line = raw_line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if line.startswith("export "):
                            line = line[7:].strip()
                        if "=" not in line:
                            continue
                        key, raw_val = line.split("=", 1)
                        clean_key = key.strip()
                        if not clean_key:
                            continue
                        clean_val = raw_val.strip()
                        if clean_val and clean_val[0] not in ('"', "'") and " #" in clean_val:
                            clean_val = clean_val.split(" #", 1)[0].strip()
                        parsed_vars[clean_key] = _strip_quotes(clean_val)
            except OSError:
                continue

    for key, value in parsed_vars.items():
        if key not in os.environ or not (os.environ.get(key) or "").strip():
            os.environ[key] = value


def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    _load_dotenv_files()
    app = Flask(__name__)
    CORS(app)

    @app.after_request
    def _apply_auth_headers(response):
        response.headers.setdefault(
            "Cross-Origin-Opener-Policy", "same-origin-allow-popups"
        )
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        return response

    # ===== Load base configuration (supports DATABASE_URL, POSTGRES_URL, and file SQLite in /tmp)
    tmp_dir = "/tmp" if os.path.isdir("/tmp") else tempfile.gettempdir()
    sqlite_path = os.path.join(tmp_dir, "catanatron.db").replace("\\", "/")
    default_sqlite = f"sqlite:///{sqlite_path}"

    database_url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or default_sqlite
    )
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    secret_key = os.environ.get("SECRET_KEY", "dev")
    engine_options = (
        {"pool_pre_ping": True, "pool_recycle": 300}
        if database_url.startswith("postgresql://")
        else {}
    )
    app.config.from_mapping(
        SECRET_KEY=secret_key,
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS=engine_options,
    )
    if test_config is not None:
        app.config.update(test_config)

    # ===== Initialize Database
    from catanatron.web.models import db, ensure_schema_columns

    db.init_app(app)
    with app.app_context():
        db.create_all()
        ensure_schema_columns(db.engine)

    # ===== Initialize Routes
    from . import api

    app.register_blueprint(api.bp)

    return app
