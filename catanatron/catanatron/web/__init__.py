import os
import tempfile

from flask import Flask
from flask_cors import CORS


def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__)
    CORS(app)

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
