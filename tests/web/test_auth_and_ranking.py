import hashlib
import json
import os
import sqlite3
import tempfile

import pytest

from catanatron.web import create_app
from catanatron.web.models import (
    StoredSession,
    StoredUser,
    authenticate_user,
    db,
    register_user,
    resolve_user_from_token,
    revoke_session_token,
)


@pytest.fixture
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-secret",
        }
    )
    with app.app_context():
        db.create_all()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


def test_register_login_multi_session_and_logout(app):
    with app.app_context():
        user, sess_desktop = register_user("joao", "segredo123", "João Gallo")
        assert user.username == "joao"
        assert user.display_name == "João Gallo"
        assert user.password_hash != "segredo123"
        assert json.loads(user.avatar_json) == {}

        # Registro duplicado bloqueado
        with pytest.raises(Exception) as dup_exc:
            register_user("joao", "outrasenha")
        assert getattr(dup_exc.value, "code", None) == 409

        # Login com senha errada falha com 401 e não cria conta
        with pytest.raises(Exception) as bad_pw:
            authenticate_user("joao", "errada")
        assert getattr(bad_pw.value, "code", None) == 401

        with pytest.raises(Exception) as ghost_user:
            authenticate_user("joao_typo", "segredo123")
        assert getattr(ghost_user.value, "code", None) == 401

        # Segundo login (ex: celular) cria sessão separada sem derrubar desktop
        user2, sess_mobile = authenticate_user("joao", "segredo123")
        assert user2.username == "joao"
        assert sess_desktop.token != sess_mobile.token
        assert resolve_user_from_token(sess_desktop.token).username == "joao"
        assert resolve_user_from_token(sess_mobile.token).username == "joao"

        # Logout revoga apenas a sessão mobile
        assert revoke_session_token(sess_mobile.token) is True
        assert resolve_user_from_token(sess_mobile.token) is None
        assert resolve_user_from_token(sess_desktop.token).username == "joao"


def test_legacy_pin_hash_upgrades_and_schema_migration_adds_missing_columns():
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        conn = sqlite3.connect(db_path)
        conn.execute(
            "CREATE TABLE users (username VARCHAR(32) PRIMARY KEY, display_name VARCHAR(48) NOT NULL, pin_hash VARCHAR(128) NOT NULL, auth_token VARCHAR(64) NOT NULL)"
        )
        legacy_hash = hashlib.sha256(b"catanatron:maria:1234").hexdigest()
        conn.execute(
            "INSERT INTO users (username, display_name, pin_hash, auth_token) VALUES (?, ?, ?, ?)",
            ("maria", "Maria", legacy_hash, "tok_legado_maria"),
        )
        conn.execute(
            "CREATE TABLE games (uuid VARCHAR(64) PRIMARY KEY, schema_version INTEGER NOT NULL, player_specs VARCHAR NOT NULL, base_index INTEGER NOT NULL, base_state VARCHAR NOT NULL, head_index INTEGER NOT NULL, head_state VARCHAR NOT NULL)"
        )
        conn.commit()
        conn.close()

        app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
                "SECRET_KEY": "test",
            }
        )
        with app.app_context():
            # Token legado ainda resolve
            resolved = resolve_user_from_token("tok_legado_maria")
            assert resolved is not None and resolved.username == "maria"

            # Login com PIN legado valida e faz upgrade para password_hash PBKDF2
            upgraded_user, sess = authenticate_user("maria", "1234")
            assert upgraded_user.password_hash.startswith("pbkdf2_sha256$")
            assert resolve_user_from_token(sess.token).username == "maria"
            assert db.session.get(StoredSession, sess.token) is not None
            db.session.remove()
            db.engine.dispose()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
