import os

from flask import Flask
from flask_cors import CORS


def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__)
    CORS(app)

    # ===== Load base configuration (supports DATABASE_URL and Vercel POSTGRES_URL)
    default_sqlite = (
        "sqlite:////tmp/catanatron.db"
        if os.environ.get("VERCEL")
        else "sqlite:///:memory:"
    )
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
    from catanatron.web.models import db

    with app.app_context():
        db.init_app(app)
        db.create_all()

    # ===== Initialize Routes
    from . import api

    app.register_blueprint(api.bp)

    return app
