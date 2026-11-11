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


@pytest.fixture
def client(app):
    return app.test_client()


def test_auth_http_register_login_me_profile_and_logout(client):
    cfg = client.get("/api/auth/config")
    assert cfg.status_code == 200
    assert cfg.get_json() == {"google_enabled": False, "google_client_id": None}

    reg = client.post(
        "/api/auth/register",
        json={"username": "ana", "password": "pw_ana_1", "display_name": "Ana Silva"},
    )
    assert reg.status_code == 200
    reg_body = reg.get_json()
    assert reg_body["username"] == "ana"
    assert reg_body["display_name"] == "Ana Silva"
    assert reg_body["auth_token"].startswith("sess_")
    assert reg_body["is_new"] is True

    dup = client.post(
        "/api/auth/register",
        json={"username": "ana", "password": "pw_ana_1"},
    )
    assert dup.status_code == 409

    bad_login = client.post(
        "/api/auth/login",
        json={"username": "ana", "password": "wrong"},
    )
    assert bad_login.status_code == 401

    good_login = client.post(
        "/api/auth/login",
        json={"username": "ana", "password": "pw_ana_1"},
    )
    assert good_login.status_code == 200
    token = good_login.get_json()["auth_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.get_json()["stats"] == {
        "wins": 0,
        "losses": 0,
        "games_played": 0,
        "win_rate": 0.0,
    }

    upd = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"display_name": "Ana Campeã"},
    )
    assert upd.status_code == 200
    assert upd.get_json()["display_name"] == "Ana Campeã"

    out = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert out.status_code == 200
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_google_auth_endpoint_creates_and_reuses_account(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    import catanatron.web.api as api_mod

    monkeypatch.setattr(
        api_mod,
        "_verify_google_id_token",
        lambda credential, client_id: {
            "sub": "google-sub-999",
            "email": "lucas.teste@gmail.com",
            "name": "Lucas Teste",
            "email_verified": True,
        },
    )

    first = client.post("/api/auth/google", json={"credential": "fake-jwt"})
    assert first.status_code == 200
    data1 = first.get_json()
    assert data1["is_new"] is True
    assert data1["has_google"] is True
    assert data1["display_name"] == "Lucas Teste"

    second = client.post("/api/auth/google", json={"credential": "fake-jwt"})
    assert second.status_code == 200
    data2 = second.get_json()
    assert data2["is_new"] is False
    assert data2["username"] == data1["username"]

    monkeypatch.setattr(
        api_mod,
        "_verify_google_id_token",
        lambda credential, client_id: (_ for _ in ()).throw(ValueError("bad token")),
    )
    rejected = client.post("/api/auth/google", json={"credential": "invalid"})
    assert rejected.status_code == 401
