# Rule the Isle (Bloco 1): Login Persistente, Banco em Nuvem, Histórico de Partidas e Ranking Global — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema persistente de contas (Google OAuth + Usuário/Senha separados sem envio de e-mail), sessões multi-dispositivo, gravação automática idempotente de todas as partidas concluídas (incluindo vitórias de IA), Histórico de Partidas e Ranking Global exclusivo de humanos registrados (`vitórias` e `% de vitórias = vitórias / partidas jogadas pelo usuário`).

**Architecture:** O backend Flask (`catanatron.web`) continua como fonte única da verdade conectado ao PostgreSQL do Supabase via `DATABASE_URL` (com SQLite automático em desenvolvimento local e `_ensure_schema_columns` para migração segura de tabelas existentes). O cliente React (`apiClient.ts`) integra autenticação, hidratação automática de sessão, envio de token ao criar jogos/salas, espelho local offline (`localEngine.ts`) quando sem backend, e UI inicial em `HomePage.tsx` com abas **Entrar / Criar Conta**, botão **Entrar com Google** e modal de **Ranking & Histórico** em `pt-BR`.

**Tech Stack:** Python 3.11+ (`Flask 3`, `SQLAlchemy 2`, `Flask-SQLAlchemy`, `psycopg2-binary`), React 19, TypeScript 5.8, MUI v7, Vite 6, Vitest 3, pytest.

## Global Constraints

- Todo texto visível ao usuário deve estar **100% em Português Brasileiro (`pt-BR`)**, mantendo marca **Rule the Isle**.
- Zero envio de e-mail para autenticação (compatível com **Supabase Free** + **Vercel Free**).
- Convidados sem conta podem jogar normalmente, porém **apenas usuários humanos cadastrados aparecem no Ranking**.
- `% de vitórias` deve considerar **apenas partidas concluídas pelo respectivo usuário** (`0.0%` quando `games_played == 0`).
- Todas as partidas concluídas são salvas no histórico, **inclusive quando uma IA vence** (`winner_is_bot = True`, `winner_username = None`), enquanto partidas abandonadas em andamento **não** são gravadas.
- Chaves internas de engine (`"CATANATRON"`, `Color`, pacotes Python `catanatron.*`) permanecem intactas.
- Não fazer merge na `main` nem push automático para produção durante a execução sem validação explícita do usuário.

---

### Task 0: Limpar Working Tree (Commit do Rebrand & Spec) e Preparar `.venv` Python

**Files:**
- Stage/Commit pending rebrand + spec doc on branch `layout-topbar`
- Environment: `.venv` (gitignored)

- [ ] **Step 1: Commitar alterações pendentes do rebrand "Rule the Isle" e a especificação do Bloco 1**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add CONTEXTO_PROJETO.md README.md ui/index.html ui/public/manifest.json ui/src/components/LeftDrawer.scss ui/src/components/LeftDrawer.tsx ui/src/pages/GameScreen.scss ui/src/pages/GameScreen.tsx ui/src/pages/HomePage.scss ui/src/pages/HomePage.tsx ui/src/pages/ReplayScreen.tsx ui/src/pages/RoomLobbyPage.tsx ui/src/utils/apiClient.ts docs/superpowers/specs/2026-11-11-auth-history-ranking-design.md
git commit -m "feat(brand): rebrand to Rule the Isle with GPL-3.0 notices and Bloco 1 design spec"
```
Expected: clean working tree (`git status -s` shows nothing untracked/modified except `.pytest_cache` if ignored or removed).

- [ ] **Step 2: Criar `.venv` local para rodar testes Python web e validar baseline existente**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[web]" pytest
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_api.py -v
```
Expected: All existing tests in `tests/web/test_api.py` pass (`PASSED`).

---

### Task 1: Modelos de Usuário, Sessões Multi-Dispositivo, Hashing e Migração Idempotente de Schema

**Files:**
- Modify: `catanatron/catanatron/web/models.py:1-85,223-263`
- Modify: `catanatron/catanatron/web/__init__.py:41-53`
- Test: `tests/web/test_auth_and_ranking.py` (Create)

**Interfaces:**
- Produces em `catanatron/catanatron/web/models.py`:
  - `StoredUser`, `StoredSession`, `StoredGame.seat_metadata_json`
  - `ensure_schema_columns(engine) -> None`
  - `serialize_user(user: StoredUser, stats: dict | None = None) -> dict`
  - `register_user(username: str, password: str, display_name: str | None = None) -> tuple[StoredUser, StoredSession]`
  - `authenticate_user(username: str, password: str) -> tuple[StoredUser, StoredSession]`
  - `create_user_session(username: str) -> StoredSession`
  - `resolve_user_from_token(token: str | None) -> StoredUser | None`
  - `revoke_session_token(token: str | None) -> bool`
  - `update_user_profile(user: StoredUser, display_name: str | None = None, avatar_config: dict | None = None) -> StoredUser`

- [ ] **Step 1: Escrever testes falhando em `tests/web/test_auth_and_ranking.py` para schema, registro estrito, login multi-dispositivo e logout**

Create `tests/web/test_auth_and_ranking.py`:
```python
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
```

- [ ] **Step 2: Rodar o teste para confirmar que falha como esperado**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_auth_and_ranking.py -v
```
Expected: FAIL (`ImportError: cannot import name 'StoredSession' from 'catanatron.web.models'`).

- [ ] **Step 3: Atualizar `catanatron/catanatron/web/models.py` e `catanatron/catanatron/web/__init__.py`**

Replace top imports + models in `catanatron/catanatron/web/models.py` (preserve `StoredRoom`, game serialization functions cleanly):
```python
"""Persisting games as a document plus what happened to it, plus users, sessions, rooms & matches."""

import hashlib
import hmac
import json
import os
import random
import secrets
import time
import uuid
from contextlib import contextmanager

from catanatron.game import Game
from catanatron.models.player import Color
from catanatron.registry import REGISTRY
from catanatron.serialization import (
    SCHEMA_VERSION,
    action_record_from_json,
    action_record_to_json,
    state_from_json,
    state_to_json,
)
from catanatron.state_functions import get_actual_victory_points, get_state_index
from flask import abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
    inspect,
    text,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session

metadata = MetaData()
Base = declarative_base(metadata=metadata)

SEAT_COLORS = ["RED", "BLUE", "ORANGE", "WHITE"]
SESSION_TTL_SECONDS = 90 * 24 * 60 * 60


class StoredGame(Base):
    """A game: where it started, who is playing, and where its rng is now."""

    __tablename__ = "games"

    uuid = Column(String(64), primary_key=True)
    schema_version = Column(Integer, nullable=False)
    player_specs = Column(String, nullable=False)
    base_index = Column(Integer, nullable=False)
    base_state = Column(String, nullable=False)
    head_index = Column(Integer, nullable=False)
    head_state = Column(String, nullable=False)
    seat_metadata_json = Column(Text, nullable=True)


class StoredAction(Base):
    """One entry of a game's log: ``[action, result]`` as JSON."""

    __tablename__ = "game_actions"

    uuid = Column(String(64), ForeignKey("games.uuid"), primary_key=True)
    index = Column(Integer, primary_key=True)
    payload = Column(String, nullable=False)


class StoredRoom(Base):
    """A multiplayer lobby/room with shareable invite code and configurable human/bot seats."""

    __tablename__ = "rooms"

    room_code = Column(String(16), primary_key=True)
    host_token = Column(String(64), nullable=False)
    status = Column(String(24), nullable=False, default="WAITING")
    config_json = Column(String, nullable=False)
    seats_json = Column(String, nullable=False)
    game_id = Column(String(64), nullable=True)


class StoredUser(Base):
    """Persistent registered human account."""

    __tablename__ = "users"

    username = Column(String(32), primary_key=True)
    display_name = Column(String(48), nullable=False)
    pin_hash = Column(String(128), nullable=True)
    auth_token = Column(String(64), nullable=True)
    password_hash = Column(String(256), nullable=True)
    google_sub = Column(String(64), unique=True, index=True, nullable=True)
    email = Column(String(255), index=True, nullable=True)
    avatar_json = Column(Text, nullable=False, default="{}")
    created_at = Column(Integer, nullable=False, default=lambda: int(time.time()))


class StoredSession(Base):
    """Per-device session token allowing simultaneous logins and isolated logout."""

    __tablename__ = "user_sessions"

    token = Column(String(64), primary_key=True)
    username = Column(String(32), ForeignKey("users.username"), index=True, nullable=False)
    created_at = Column(Integer, nullable=False, default=lambda: int(time.time()))
    last_seen_at = Column(Integer, nullable=False, default=lambda: int(time.time()))
    expires_at = Column(
        Integer,
        nullable=False,
        default=lambda: int(time.time()) + SESSION_TTL_SECONDS,
    )
```

Add schema migration helper and auth functions in `catanatron/catanatron/web/models.py`:
```python
def ensure_schema_columns(engine) -> None:
    """Idempotently add new columns when upgrading an existing SQLite/Postgres DB."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    alter_statements: list[str] = []

    if "users" in tables:
        user_cols = {col["name"] for col in inspector.get_columns("users")}
        if "password_hash" not in user_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN password_hash VARCHAR(256)")
        if "google_sub" not in user_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN google_sub VARCHAR(64)")
        if "email" not in user_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN email VARCHAR(255)")
        if "avatar_json" not in user_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN avatar_json TEXT DEFAULT '{}'")
        if "created_at" not in user_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN created_at INTEGER DEFAULT 0")

    if "games" in tables:
        game_cols = {col["name"] for col in inspector.get_columns("games")}
        if "seat_metadata_json" not in game_cols:
            alter_statements.append("ALTER TABLE games ADD COLUMN seat_metadata_json TEXT")

    if alter_statements:
        with engine.begin() as conn:
            for stmt in alter_statements:
                conn.execute(text(stmt))
            if "users" in tables:
                conn.execute(
                    text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)")
                )


def _normalize_username(username: str) -> str:
    return "".join(
        ch for ch in (username or "").lower().strip() if ch.isalnum() or ch in ("_", "-")
    )[:24]


def _hash_legacy_pin(username: str, pin: str) -> str:
    payload = f"catanatron:{username.lower().strip()}:{pin.strip()}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(user: StoredUser, password: str) -> bool:
    if user.password_hash and user.password_hash.startswith("pbkdf2_sha256$"):
        try:
            _, salt, expected_digest = user.password_hash.split("$", 2)
        except ValueError:
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000
        ).hex()
        return hmac.compare_digest(actual, expected_digest)
    if user.pin_hash:
        expected_legacy = _hash_legacy_pin(user.username, password.strip())
        return hmac.compare_digest(user.pin_hash, expected_legacy)
    return False


def create_user_session(username: str, session_param=None) -> StoredSession:
    session = session_param or db.session
    now = int(time.time())
    sess = StoredSession(
        token=f"sess_{secrets.token_hex(24)}",
        username=username,
        created_at=now,
        last_seen_at=now,
        expires_at=now + SESSION_TTL_SECONDS,
    )
    session.add(sess)
    session.commit()
    return sess


def resolve_user_from_token(token: str | None, session_param=None) -> StoredUser | None:
    clean_token = (token or "").strip()
    if not clean_token:
        return None
    session = session_param or db.session
    now = int(time.time())
    sess = session.get(StoredSession, clean_token)
    if sess is not None:
        if sess.expires_at < now:
            session.delete(sess)
            session.commit()
            return None
        sess.last_seen_at = now
        session.commit()
        return session.get(StoredUser, sess.username)
    # Retrocompatibilidade com token legado único salvo em StoredUser.auth_token
    return session.query(StoredUser).filter_by(auth_token=clean_token).first()


def revoke_session_token(token: str | None, session_param=None) -> bool:
    clean_token = (token or "").strip()
    if not clean_token:
        return False
    session = session_param or db.session
    sess = session.get(StoredSession, clean_token)
    if sess is None:
        return False
    session.delete(sess)
    session.commit()
    return True


def serialize_user(user: StoredUser, stats: dict | None = None) -> dict:
    try:
        avatar_cfg = json.loads(user.avatar_json or "{}")
    except Exception:
        avatar_cfg = {}
    payload = {
        "username": user.username,
        "display_name": user.display_name,
        "has_google": bool(user.google_sub),
        "avatar_config": avatar_cfg if isinstance(avatar_cfg, dict) else {},
    }
    if stats is not None:
        payload["stats"] = stats
    return payload


def register_user(
    username: str, password: str, display_name: str | None = None
) -> tuple[StoredUser, StoredSession]:
    session = db.session
    clean_user = _normalize_username(username)
    if len(clean_user) < 2:
        abort(400, description="O usuário deve ter pelo menos 2 caracteres alfanuméricos")
    raw_password = password or ""
    if not 4 <= len(raw_password) <= 128:
        abort(400, description="A senha deve ter entre 4 e 128 caracteres")

    if session.get(StoredUser, clean_user) is not None:
        abort(409, description="Este nome de usuário já está cadastrado. Use a aba Entrar.")

    clean_display = (display_name or username).strip()[:32] or clean_user
    pw_hash = hash_password(raw_password)
    user = StoredUser(
        username=clean_user,
        display_name=clean_display,
        password_hash=pw_hash,
        pin_hash="",
        auth_token=secrets.token_hex(16),
        avatar_json="{}",
        created_at=int(time.time()),
    )
    session.add(user)
    session.commit()
    sess = create_user_session(clean_user, session)
    return user, sess


def authenticate_user(username: str, password: str) -> tuple[StoredUser, StoredSession]:
    session = db.session
    clean_user = _normalize_username(username)
    raw_password = password or ""
    if len(clean_user) < 2 or len(raw_password) < 3:
        abort(401, description="Usuário ou senha incorretos")

    user = session.get(StoredUser, clean_user)
    if user is None or not verify_password(user, raw_password):
        abort(401, description="Usuário ou senha incorretos")

    # Upgrade transparente de hash legado SHA-256 para PBKDF2 com salt aleatório
    if not user.password_hash:
        user.password_hash = hash_password(raw_password)
        session.commit()

    sess = create_user_session(clean_user, session)
    return user, sess


def update_user_profile(
    user: StoredUser, display_name: str | None = None, avatar_config: dict | None = None
) -> StoredUser:
    session = db.session
    if display_name is not None and display_name.strip():
        user.display_name = display_name.strip()[:32]
    if avatar_config is not None and isinstance(avatar_config, dict):
        user.avatar_json = json.dumps(avatar_config)
    session.commit()
    return user
```

Update `catanatron/catanatron/web/__init__.py` lines 41-47:
```python
    # ===== Initialize Database
    from catanatron.web.models import db, ensure_schema_columns

    db.init_app(app)
    with app.app_context():
        db.create_all()
        ensure_schema_columns(db.engine)
```

- [ ] **Step 4: Rodar os testes de `tests/web/test_auth_and_ranking.py` para confirmar sucesso**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_auth_and_ranking.py -v
```
Expected: `2 passed`.

- [ ] **Step 5: Commitar Task 1**

```powershell
git add catanatron/catanatron/web/models.py catanatron/catanatron/web/__init__.py tests/web/test_auth_and_ranking.py
git commit -m "feat(auth): add multi-device sessions, PBKDF2 password hashing, strict login/register and idempotent schema migration"
```

---

### Task 2: Endpoints HTTP de Auth (`/api/auth/*`) e Login com Google ID Token

**Files:**
- Modify: `catanatron/catanatron/web/models.py` (add `login_with_google_claims`)
- Modify: `catanatron/catanatron/web/api.py` (auth endpoints + `_extract_auth_token` + `_verify_google_id_token`)
- Test: `tests/web/test_auth_and_ranking.py`

**Interfaces:**
- Produces endpoints:
  - `GET /api/auth/config` -> `{ google_enabled: bool, google_client_id: str | None }`
  - `POST /api/auth/register` -> `{ username, display_name, auth_token, has_google, avatar_config, is_new: True }`
  - `POST /api/auth/login` -> `{ username, display_name, auth_token, has_google, avatar_config, is_new: False }`
  - `POST /api/auth/google` -> `{ username, display_name, auth_token, has_google: True, avatar_config, is_new: bool }`
  - `GET /api/auth/me` -> `{ ...serialize_user, stats: { wins, losses, games_played, win_rate } }`
  - `POST /api/auth/logout` -> `{ success: True }`
  - `PATCH /api/auth/profile` -> updated user payload

- [ ] **Step 1: Adicionar testes falhando de rotas HTTP `/api/auth/*` e Google OAuth mockado em `tests/web/test_auth_and_ranking.py`**

Append to `tests/web/test_auth_and_ranking.py`:
```python
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
```

- [ ] **Step 2: Rodar os novos testes para confirmar que falham**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_auth_and_ranking.py -v
```
Expected: FAIL (`404 Not Found` on `/api/auth/config` / `/api/auth/register`).

- [ ] **Step 3: Implementar `login_with_google_claims` em `models.py` e rotas `/api/auth/*` em `api.py`**

Add `login_with_google_claims` to `catanatron/catanatron/web/models.py`:
```python
def _unique_username_candidate(base_hint: str, session) -> str:
    base = _normalize_username(base_hint)
    if len(base) < 2:
        base = "jogador"
    candidate = base[:24]
    suffix = 1
    while session.get(StoredUser, candidate) is not None:
        tail = str(suffix)
        candidate = f"{base[: max(2, 24 - len(tail))]}{tail}"
        suffix += 1
    return candidate


def login_with_google_claims(claims: dict) -> tuple[StoredUser, StoredSession, bool]:
    session = db.session
    google_sub = str(claims.get("sub") or "").strip()[:64]
    email = str(claims.get("email") or "").strip().lower()[:255] or None
    display = str(claims.get("name") or (email.split("@")[0] if email else "Jogador")).strip()[:32]

    if not google_sub:
        abort(401, description="Token Google inválido (sub ausente)")

    user = session.query(StoredUser).filter_by(google_sub=google_sub).first()
    if user is not None:
        if email and not user.email:
            user.email = email
            session.commit()
        sess = create_user_session(user.username, session)
        return user, sess, False

    hint = email.split("@")[0] if email else display
    username = _unique_username_candidate(hint, session)
    user = StoredUser(
        username=username,
        display_name=display or username,
        password_hash=None,
        pin_hash=None,
        google_sub=google_sub,
        email=email,
        avatar_json="{}",
        auth_token=secrets.token_hex(16),
        created_at=int(time.time()),
    )
    session.add(user)
    session.commit()
    sess = create_user_session(username, session)
    return user, sess, True
```

Add imports + helper + auth routes in `catanatron/catanatron/web/api.py`:
```python
import os
import time
import urllib.error
import urllib.parse
import urllib.request
```
And helpers & endpoints:
```python
def _extract_auth_token() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        tok = auth_header[7:].strip()
        if tok:
            return tok
    body = request.get_json(silent=True) or {}
    tok = body.get("auth_token") or body.get("token") or request.args.get("token")
    return str(tok).strip() if tok else None


def _verify_google_id_token(credential: str, expected_client_id: str) -> dict:
    if not credential or len(credential) < 20:
        raise ValueError("Credencial Google ausente")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode(
        {"id_token": credential}
    )
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            claims = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ValueError("Falha ao validar token Google") from exc

    if claims.get("aud") != expected_client_id:
        raise ValueError("Client ID inválido")
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Emissor Google inválido")
    verified = str(claims.get("email_verified", "")).lower() == "true" or claims.get("email_verified") is True
    if not verified:
        raise ValueError("Conta Google sem e-mail verificado")
    exp = int(claims.get("exp") or 0)
    if exp <= int(time.time()):
        raise ValueError("Token Google expirado")
    return claims


@bp.route("/auth/config", methods=("GET",))
def get_auth_config_endpoint():
    client_id = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip() or None
    return jsonify({"google_enabled": bool(client_id), "google_client_id": client_id})


@bp.route("/auth/register", methods=("POST",))
def post_auth_register_endpoint():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or body.get("pin") or "")
    display_name = body.get("display_name")

    user, sess = register_user(
        username=username,
        password=password,
        display_name=str(display_name).strip() if display_name else None,
    )
    payload = serialize_user(user)
    payload.update({"auth_token": sess.token, "is_new": True})
    return jsonify(payload)


@bp.route("/auth/login", methods=("POST",))
def post_auth_login_endpoint():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or body.get("pin") or "")

    user, sess = authenticate_user(username=username, password=password)
    payload = serialize_user(user, get_user_stats(user.username))
    payload.update({"auth_token": sess.token, "is_new": False})
    return jsonify(payload)


@bp.route("/auth/google", methods=("POST",))
def post_auth_google_endpoint():
    client_id = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
    if not client_id:
        abort(503, description="Login com Google não configurado no servidor")
    body = request.get_json(silent=True) or {}
    credential = str(body.get("credential") or "").strip()
    try:
        claims = _verify_google_id_token(credential, client_id)
    except ValueError as err:
        abort(401, description=str(err))

    user, sess, is_new = login_with_google_claims(claims)
    payload = serialize_user(user, get_user_stats(user.username))
    payload.update({"auth_token": sess.token, "is_new": is_new})
    return jsonify(payload)


@bp.route("/auth/me", methods=("GET",))
def get_auth_me_endpoint():
    user = resolve_user_from_token(_extract_auth_token())
    if user is None:
        abort(401, description="Sessão inválida ou expirada")
    return jsonify(serialize_user(user, get_user_stats(user.username)))


@bp.route("/auth/logout", methods=("POST",))
def post_auth_logout_endpoint():
    revoke_session_token(_extract_auth_token())
    return jsonify({"success": True})


@bp.route("/auth/profile", methods=("PATCH",))
def patch_auth_profile_endpoint():
    user = resolve_user_from_token(_extract_auth_token())
    if user is None:
        abort(401, description="Autenticação necessária")
    body = request.get_json(silent=True) or {}
    update_user_profile(
        user,
        display_name=body.get("display_name"),
        avatar_config=body.get("avatar_config"),
    )
    return jsonify(serialize_user(user, get_user_stats(user.username)))
```

Also add the initial `get_user_stats` helper to `catanatron/catanatron/web/models.py` (to be backed by `match_participants` in Task 3):
```python
def get_user_stats(username: str) -> dict:
    return {
        "wins": 0,
        "losses": 0,
        "games_played": 0,
        "win_rate": 0.0,
    }
```

- [ ] **Step 4: Rodar os testes de Task 2 e `test_api.py`**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_auth_and_ranking.py tests/web/test_api.py -v
```
Expected: All tests in `test_auth_and_ranking.py` and `test_api.py` PASS.

- [ ] **Step 5: Commitar Task 2**

```powershell
git add catanatron/catanatron/web/models.py catanatron/catanatron/web/api.py tests/web/test_auth_and_ranking.py
git commit -m "feat(auth): implement /api/auth/register, /login, /google, /me, /logout, /profile endpoints"
```

---

### Task 3: Gravação Idempotente de Partidas (`matches` / `match_participants`) e Endpoints de Ranking & Histórico

**Files:**
- Modify: `catanatron/catanatron/web/models.py`
- Modify: `catanatron/catanatron/web/api.py`
- Test: `tests/web/test_auth_and_ranking.py`

**Interfaces:**
- Produces em `models.py`:
  - `StoredMatch`, `StoredMatchParticipant`
  - `build_seat_metadata(players: list, specs: list[str], auth_user: StoredUser | None, host_name: str | None) -> dict[str, dict]`
  - `upsert_game_state(game: Game, session_param=None, seat_metadata_by_color: dict | None = None)`
  - `record_completed_match(game: Game, session_param=None) -> StoredMatch | None`
  - `get_user_stats(username: str) -> dict`
  - `get_leaderboard(limit: int = 100) -> list[dict]`
  - `get_match_history(username: str | None = None, limit: int = 30) -> list[dict]`
- Produces endpoints em `api.py`:
  - `GET /api/leaderboard` -> `{ leaderboard: [...] }`
  - `GET /api/matches` -> `{ matches: [...] }`

- [ ] **Step 1: Escrever testes falhando em `tests/web/test_auth_and_ranking.py` cobrindo atribuição com shuffle, vitória IA vs humano, idempotência e Ranking**

Append to `tests/web/test_auth_and_ranking.py`:
```python
from catanatron.models.player import Color
from catanatron.web.models import StoredGame, StoredMatch, record_completed_match, get_game_state


def _force_win_and_record(app, game_id: str, winning_color: Color):
    with app.app_context():
        game = get_game_state(game_id)
        idx = game.state.color_to_index[winning_color]
        game.state.player_state[f"P{idx}_ACTUAL_VICTORY_POINTS"] = game.vps_to_win
        game.state.player_state[f"P{idx}_VICTORY_POINTS"] = game.vps_to_win
        upsert_game_state(game)
        assert game.winning_color() == winning_color
        # Chamar duas vezes para provar idempotência
        record_completed_match(game)
        record_completed_match(game)


def test_ranking_counts_only_registered_humans_and_history_records_ai_wins(app, client):
    joao_tok = client.post(
        "/api/auth/register",
        json={"username": "joao", "password": "pw1234", "display_name": "João"},
    ).get_json()["auth_token"]
    pedro_tok = client.post(
        "/api/auth/register",
        json={"username": "pedro", "password": "pw1234", "display_name": "Pedro"},
    ).get_json()["auth_token"]

    # 1. Partida Solo de João (HUMAN=RED) vs Bot (CATANATRON=BLUE): João vence
    g1 = client.post(
        "/api/games",
        headers={"Authorization": f"Bearer {joao_tok}"},
        json={"players": ["HUMAN", "CATANATRON"]},
    ).get_json()["game_id"]
    _force_win_and_record(app, g1, Color.RED)

    # 2. Partida Solo de João vs Bot: IA (BLUE) vence!
    g2 = client.post(
        "/api/games",
        headers={"Authorization": f"Bearer {joao_tok}"},
        json={"players": ["HUMAN", "CATANATRON"]},
    ).get_json()["game_id"]
    _force_win_and_record(app, g2, Color.BLUE)

    # 3. Partida em Sala Online com João (RED) e Convidado sem login (BLUE): Pedro (não jogou esta) fica 0/0; João vence
    # E partida separada com Pedro vencendo 1 de 1 (100%)
    g3 = client.post(
        "/api/games",
        headers={"Authorization": f"Bearer {pedro_tok}"},
        json={"players": ["HUMAN", "R"]},
    ).get_json()["game_id"]
    _force_win_and_record(app, g3, Color.RED)

    # Ranking: João tem 1 vitória / 2 jogos = 50.0%; Pedro tem 1 vitória / 1 jogo = 100.0%
    # Desempate por win_rate coloca Pedro em 1º e João em 2º; Bots não entram no ranking!
    lb = client.get("/api/leaderboard").get_json()["leaderboard"]
    assert [row["username"] for row in lb] == ["pedro", "joao"]
    assert lb[0]["rank"] == 1
    assert lb[0]["wins"] == 1
    assert lb[0]["games_played"] == 1
    assert lb[0]["win_rate"] == 100.0

    assert lb[1]["rank"] == 2
    assert lb[1]["wins"] == 1
    assert lb[1]["games_played"] == 2
    assert lb[1]["win_rate"] == 50.0

    # Histórico global tem as 3 partidas, incluindo a vitória do Bot!
    hist = client.get("/api/matches").get_json()["matches"]
    assert len(hist) == 3
    bot_win_match = next(m for m in hist if m["game_id"] == g2)
    assert bot_win_match["winner_is_bot"] is True
    assert bot_win_match["winner_username"] is None

    # /api/auth/me reflete estatísticas atualizadas
    me_joao = client.get("/api/auth/me", headers={"Authorization": f"Bearer {joao_tok}"}).get_json()
    assert me_joao["stats"] == {"wins": 1, "losses": 1, "games_played": 2, "win_rate": 50.0}
```

- [ ] **Step 2: Rodar testes para verificar falha**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_auth_and_ranking.py -v
```
Expected: FAIL (`ImportError: cannot import name 'StoredMatch' from 'catanatron.web.models'`).

- [ ] **Step 3: Implementar `StoredMatch`, `StoredMatchParticipant`, gravação idempotente e consultas em `models.py` + endpoints em `api.py`**

Add models and functions in `catanatron/catanatron/web/models.py`:
```python
class StoredMatch(Base):
    """Completed game outcome persisted once per finished game."""

    __tablename__ = "matches"

    game_id = Column(String(64), primary_key=True)
    room_code = Column(String(16), index=True, nullable=True)
    mode = Column(String(16), nullable=False, default="SOLO")
    map_template = Column(String(24), nullable=False, default="BASE")
    vps_to_win = Column(Integer, nullable=False, default=10)
    num_turns = Column(Integer, nullable=False, default=0)
    winning_color = Column(String(16), nullable=False)
    winner_name = Column(String(64), nullable=False)
    winner_username = Column(String(32), index=True, nullable=True)
    winner_is_bot = Column(Boolean, nullable=False, default=False)
    finished_at = Column(Integer, index=True, nullable=False, default=lambda: int(time.time()))


class StoredMatchParticipant(Base):
    """Per-seat participation record linking finished games back to registered users."""

    __tablename__ = "match_participants"
    __table_args__ = (
        UniqueConstraint("game_id", "color", name="uq_match_participant_game_color"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String(64), ForeignKey("matches.game_id"), index=True, nullable=False)
    color = Column(String(16), nullable=False)
    seat_kind = Column(String(16), nullable=False)  # "USER" | "GUEST" | "BOT"
    username = Column(String(32), ForeignKey("users.username"), index=True, nullable=True)
    player_key = Column(String(32), nullable=False)
    display_name = Column(String(64), nullable=False)
    victory_points = Column(Integer, nullable=False, default=0)
    is_winner = Column(Boolean, nullable=False, default=False)
```

Add `build_seat_metadata_for_game`, update `upsert_game_state`, and add match/ranking helpers:
```python
COLOR_LABELS_PT = {
    "RED": "Vermelho",
    "BLUE": "Azul",
    "ORANGE": "Laranja",
    "WHITE": "Branco",
}


def build_seat_metadata_for_game(
    player_keys: list,
    auth_user: StoredUser | None = None,
    host_name: str | None = None,
) -> dict[str, dict]:
    by_color: dict[str, dict] = {}
    human_assigned = False
    for idx, spec in enumerate(player_keys):
        color = SEAT_COLORS[idx]
        key = spec["key"].upper() if isinstance(spec, dict) else str(spec).split(":")[0].upper()
        if key == "HUMAN":
            if not human_assigned and auth_user is not None:
                human_assigned = True
                by_color[color] = {
                    "color": color,
                    "seat_kind": "USER",
                    "username": auth_user.username,
                    "player_key": "HUMAN",
                    "display_name": auth_user.display_name,
                }
            else:
                guest_label = (
                    (host_name or "").strip()[:32]
                    if not human_assigned and (host_name or "").strip()
                    else COLOR_LABELS_PT[color]
                )
                human_assigned = True
                by_color[color] = {
                    "color": color,
                    "seat_kind": "GUEST",
                    "username": None,
                    "player_key": "HUMAN",
                    "display_name": guest_label,
                }
        else:
            by_color[color] = {
                "color": color,
                "seat_kind": "BOT",
                "username": None,
                "player_key": key,
                "display_name": f"IA ({key})",
            }
    return by_color
```
Update `upsert_game_state(game: Game, session_param=None, seat_metadata_by_color: dict | None = None)` so when creating `StoredGame` for the first time:
```python
        stored = StoredGame(
            uuid=game.id,
            schema_version=SCHEMA_VERSION,
            player_specs=json.dumps(
                [REGISTRY.spec_of(player) for player in game.state.players]
            ),
            base_index=head,
            base_state=document,
            head_index=head,
            head_state=document,
            seat_metadata_json=(
                json.dumps(seat_metadata_by_color)
                if seat_metadata_by_color is not None
                else None
            ),
        )
```
And implement `record_completed_match`, `get_user_stats`, `get_leaderboard`, `get_match_history`:
```python
def _detect_map_template(game: Game) -> str:
    land_count = len(game.state.board.map.land_tiles)
    if land_count <= 7:
        return "MINI"
    return "BASE"


def record_completed_match(game: Game, session_param=None) -> StoredMatch | None:
    session = session_param or db.session
    winner = game.winning_color()
    if winner is None:
        return None

    existing = session.get(StoredMatch, game.id)
    if existing is not None:
        return existing

    stored_game = session.get(StoredGame, game.id)
    room = get_room_by_game_id(game.id)

    seat_meta: dict[str, dict] = {}
    if stored_game and stored_game.seat_metadata_json:
        try:
            seat_meta = json.loads(stored_game.seat_metadata_json)
        except Exception:
            seat_meta = {}
    elif room is not None:
        try:
            for seat in json.loads(room.seats_json):
                c = seat["color"]
                is_bot = seat.get("player_key", "HUMAN") != "HUMAN"
                uname = seat.get("username") if not is_bot else None
                seat_meta[c] = {
                    "color": c,
                    "seat_kind": "BOT" if is_bot else ("USER" if uname else "GUEST"),
                    "username": uname,
                    "player_key": seat.get("player_key", "HUMAN"),
                    "display_name": seat.get("player_name") or COLOR_LABELS_PT.get(c, c),
                }
        except Exception:
            seat_meta = {}

    win_color_str = winner.value
    participants_rows: list[StoredMatchParticipant] = []
    seen_usernames: set[str] = set()
    winner_name = COLOR_LABELS_PT.get(win_color_str, win_color_str)
    winner_username: str | None = None
    winner_is_bot = False
    human_count = 0

    for player in game.state.players:
        c = player.color.value
        meta = seat_meta.get(c, {})
        key = meta.get("player_key") or getattr(player, "registry_key", None) or ("HUMAN" if not player.is_bot else "BOT")
        seat_kind = meta.get("seat_kind") or ("BOT" if player.is_bot else "GUEST")
        uname = meta.get("username") if seat_kind == "USER" else None
        if uname and uname in seen_usernames:
            # Garante no máximo uma atribuição por usuário na mesma partida
            uname = None
            seat_kind = "GUEST"
        if uname:
            seen_usernames.add(uname)
        if not player.is_bot:
            human_count += 1

        dname = meta.get("display_name") or (
            f"IA ({key})" if player.is_bot else COLOR_LABELS_PT.get(c, c)
        )
        vps = int(get_actual_victory_points(game.state, player.color))
        is_win = c == win_color_str
        if is_win:
            winner_name = dname
            winner_username = uname
            winner_is_bot = bool(player.is_bot)

        participants_rows.append(
            StoredMatchParticipant(
                game_id=game.id,
                color=c,
                seat_kind=seat_kind,
                username=uname,
                player_key=str(key)[:32],
                display_name=str(dname)[:64],
                victory_points=vps,
                is_winner=is_win,
            )
        )

    mode = "MULTIPLAYER" if (room is not None or human_count >= 2) else "SOLO"
    map_template = _detect_map_template(game)
    if room is not None:
        try:
            map_template = json.loads(room.config_json).get("map_template", map_template)
        except Exception:
            pass

    match_row = StoredMatch(
        game_id=game.id,
        room_code=room.room_code if room is not None else None,
        mode=mode,
        map_template=str(map_template)[:24],
        vps_to_win=int(game.vps_to_win),
        num_turns=int(game.state.num_turns),
        winning_color=win_color_str,
        winner_name=str(winner_name)[:64],
        winner_username=winner_username,
        winner_is_bot=winner_is_bot,
        finished_at=int(time.time()),
    )

    try:
        session.add(match_row)
        session.flush()
        for row in participants_rows:
            session.add(row)
        session.commit()
        return match_row
    except IntegrityError:
        session.rollback()
        return session.get(StoredMatch, game.id)


def get_user_stats(username: str) -> dict:
    rows = (
        db.session.query(StoredMatchParticipant)
        .filter_by(username=username, seat_kind="USER")
        .all()
    )
    games_played = len(rows)
    wins = sum(1 for r in rows if r.is_winner)
    losses = max(0, games_played - wins)
    win_rate = round((wins / games_played) * 100.0, 1) if games_played > 0 else 0.0
    return {
        "wins": wins,
        "losses": losses,
        "games_played": games_played,
        "win_rate": win_rate,
    }


def get_leaderboard(limit: int = 100) -> list[dict]:
    users = db.session.query(StoredUser).all()
    participants = (
        db.session.query(StoredMatchParticipant)
        .filter_by(seat_kind="USER")
        .all()
    )
    counts: dict[str, list[int]] = {}
    for p in participants:
        if not p.username:
            continue
        bucket = counts.setdefault(p.username, [0, 0])  # [wins, games]
        bucket[1] += 1
        if p.is_winner:
            bucket[0] += 1

    board = []
    for u in users:
        wins, games_played = counts.get(u.username, [0, 0])
        losses = max(0, games_played - wins)
        win_rate = round((wins / games_played) * 100.0, 1) if games_played > 0 else 0.0
        try:
            avatar_cfg = json.loads(u.avatar_json or "{}")
        except Exception:
            avatar_cfg = {}
        board.append(
            {
                "username": u.username,
                "display_name": u.display_name,
                "avatar_config": avatar_cfg if isinstance(avatar_cfg, dict) else {},
                "wins": wins,
                "losses": losses,
                "games_played": games_played,
                "win_rate": win_rate,
            }
        )

    board.sort(
        key=lambda item: (
            -item["wins"],
            -item["win_rate"],
            -item["games_played"],
            item["username"],
        )
    )
    trimmed = board[:limit]
    for idx, entry in enumerate(trimmed, start=1):
        entry["rank"] = idx
    return trimmed


def get_match_history(username: str | None = None, limit: int = 30) -> list[dict]:
    query = db.session.query(StoredMatch)
    if username:
        clean_user = _normalize_username(username)
        game_ids = [
            r.game_id
            for r in db.session.query(StoredMatchParticipant.game_id)
            .filter_by(username=clean_user, seat_kind="USER")
            .all()
        ]
        if not game_ids:
            return []
        query = query.filter(StoredMatch.game_id.in_(game_ids))

    matches = query.order_by(StoredMatch.finished_at.desc()).limit(limit).all()
    if not matches:
        return []

    m_ids = [m.game_id for m in matches]
    all_parts = (
        db.session.query(StoredMatchParticipant)
        .filter(StoredMatchParticipant.game_id.in_(m_ids))
        .all()
    )
    parts_by_game: dict[str, list[dict]] = {}
    for p in all_parts:
        parts_by_game.setdefault(p.game_id, []).append(
            {
                "color": p.color,
                "seat_kind": p.seat_kind,
                "username": p.username,
                "player_key": p.player_key,
                "display_name": p.display_name,
                "victory_points": p.victory_points,
                "is_winner": p.is_winner,
            }
        )

    result = []
    for m in matches:
        parts = parts_by_game.get(m.game_id, [])
        parts.sort(key=lambda item: (-int(item["is_winner"]), -item["victory_points"]))
        result.append(
            {
                "game_id": m.game_id,
                "room_code": m.room_code,
                "mode": m.mode,
                "map_template": m.map_template,
                "vps_to_win": m.vps_to_win,
                "num_turns": m.num_turns,
                "winning_color": m.winning_color,
                "winner_name": m.winner_name,
                "winner_username": m.winner_username,
                "winner_is_bot": m.winner_is_bot,
                "finished_at": m.finished_at,
                "participants": parts,
            }
        )
    return result
```

Update `create_room` in `catanatron/catanatron/web/models.py` to accept `host_username: str | None = None`:
```python
def create_room(
    host_name: str = "Anfitrião",
    players: list[str] | None = None,
    map_template: str = "BASE",
    vps_to_win: int = 10,
    discard_limit: int = 7,
    friendly_robber: bool = True,
    host_token: str | None = None,
    host_username: str | None = None,
) -> tuple[StoredRoom, str]:
    session = db.session
    room_code = _generate_room_code(session)
    resolved_host_token = (host_token or "").strip() or uuid.uuid4().hex

    initial_keys = players if players and 2 <= len(players) <= 4 else ["HUMAN", "HUMAN", "CATANATRON", "CATANATRON"]
    seats = []
    host_seated = False
    for idx, p_key in enumerate(initial_keys):
        color = SEAT_COLORS[idx]
        if p_key == "HUMAN" and not host_seated:
            seats.append(
                {
                    "color": color,
                    "player_key": "HUMAN",
                    "player_name": host_name.strip() or "Anfitrião",
                    "seat_token": resolved_host_token,
                    "seat_kind": "USER" if host_username else "GUEST",
                    "username": host_username,
                }
            )
            host_seated = True
        elif p_key == "HUMAN":
            seats.append(
                {
                    "color": color,
                    "player_key": "HUMAN",
                    "player_name": "Aguardando Amigo...",
                    "seat_token": None,
                    "seat_kind": "GUEST",
                    "username": None,
                }
            )
        else:
            seats.append(
                {
                    "color": color,
                    "player_key": p_key,
                    "player_name": f"Bot ({p_key})",
                    "seat_token": None,
                    "seat_kind": "BOT",
                    "username": None,
                }
            )

    config = {
        "map_template": map_template,
        "vps_to_win": vps_to_win,
        "discard_limit": discard_limit,
        "friendly_robber": friendly_robber,
        "created_at": int(time.time()),
    }

    room = StoredRoom(
        room_code=room_code,
        host_token=resolved_host_token,
        status="WAITING",
        config_json=json.dumps(config),
        seats_json=json.dumps(seats),
        game_id=None,
    )
    session.add(room)
    session.commit()
    return room, resolved_host_token
```

Update `catanatron/catanatron/web/api.py` (`post_game_endpoint`, `post_room_endpoint`, `join_room_endpoint`, `patch_room_endpoint`, `start_room_endpoint`, `post_action_endpoint`, `/leaderboard`, `/matches`):
```python
    auth_user = resolve_user_from_token(_extract_auth_token())
    host_name = request.json.get("host_name")
    seat_meta = build_seat_metadata_for_game(
        player_keys,
        auth_user=auth_user,
        host_name=str(host_name).strip() if host_name else None,
    )
    upsert_game_state(game, seat_metadata_by_color=seat_meta)
    return jsonify({"game_id": game.id})
```
In `post_room_endpoint`:
```python
    auth_user = resolve_user_from_token(_extract_auth_token())
    if auth_user is not None:
        host_name = host_name if host_name and host_name != "Anfitrião" else auth_user.display_name
    room, resolved_token = create_room(
        host_name=host_name,
        players=players,
        map_template=map_template,
        vps_to_win=vps_to_win,
        discard_limit=discard_limit,
        friendly_robber=friendly_robber,
        host_token=host_token or _extract_auth_token(),
        host_username=auth_user.username if auth_user else None,
    )
```
In `join_room_endpoint` (whenever assigning `target` / `current_seat` / `open_seat`):
```python
    auth_user = resolve_user_from_token(body.get("token") or _extract_auth_token())
    seat_kind = "USER" if auth_user else "GUEST"
    seat_username = auth_user.username if auth_user else None
    # On vacated seat: current_seat["seat_token"] = None; current_seat["username"] = None; current_seat["seat_kind"] = "GUEST"
    # On claimed seat: seat["seat_kind"] = seat_kind; seat["username"] = seat_username
```
In `patch_room_endpoint`, preserve `seat_kind` and `username` from `prev` for claimed human seats (`prev.get("username")`, `prev.get("seat_kind", "GUEST")`), and set `username = None, seat_kind = "BOT"` for bots.

In `start_room_endpoint`:
```python
    seat_meta = {
        seat["color"]: {
            "color": seat["color"],
            "seat_kind": "BOT" if seat["player_key"] != "HUMAN" else ("USER" if seat.get("username") else "GUEST"),
            "username": seat.get("username") if seat["player_key"] == "HUMAN" else None,
            "player_key": seat["player_key"],
            "display_name": seat.get("player_name") or seat["color"],
        }
        for seat in seats
    }
    upsert_game_state(game, seat_metadata_by_color=seat_meta)
```
In `post_action_endpoint`:
```python
    if game.winning_color() is not None:
        record_completed_match(game)
        view = _enrich_view_with_room(game, web_view(game, _perspective(game)))
        return Response(response=json.dumps(view), status=200, mimetype="application/json")
    ...
    if game.winning_color() is not None:
        record_completed_match(game)
```
Add endpoints in `catanatron/catanatron/web/api.py`:
```python
@bp.route("/leaderboard", methods=("GET",))
def get_leaderboard_endpoint():
    limit = min(max(int(request.args.get("limit", 100)), 1), 200)
    return jsonify({"leaderboard": get_leaderboard(limit=limit)})


@bp.route("/matches", methods=("GET",))
def get_matches_endpoint():
    username = request.args.get("username")
    limit = min(max(int(request.args.get("limit", 30)), 1), 100)
    return jsonify({"matches": get_match_history(username=username, limit=limit)})
```

- [ ] **Step 4: Rodar todos os testes Python web**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v
```
Expected: All tests in `test_auth_and_ranking.py` AND `test_api.py` PASS.

- [ ] **Step 5: Commitar Task 3**

```powershell
git add catanatron/catanatron/web/models.py catanatron/catanatron/web/api.py tests/web/test_auth_and_ranking.py
git commit -m "feat(ranking): record completed matches idempotently and expose /api/leaderboard and /api/matches"
```

---

### Task 4: Frontend Types, Cliente HTTP de Auth/Ranking e Espelho Offline

**Files:**
- Modify: `ui/src/utils/api.types.ts`
- Modify: `ui/src/utils/apiClient.ts`
- Modify: `ui/src/utils/localEngine.ts`
- Test: `ui/src/utils/apiClient.test.ts` (Create)

**Interfaces:**
- Produces em `ui/src/utils/api.types.ts` & `apiClient.ts`:
  - `AccountStats`, `AuthConfig`, `LeaderboardEntry`, `MatchParticipant`, `MatchRecord`, `LeaderboardResponse`, `MatchHistoryResponse`
  - `getAuthConfig()`, `registerAccount()`, `loginAccount()`, `loginWithGoogle()`, `fetchCurrentAccount()`, `logoutAccount()`, `updateProfile()`
  - `getLeaderboard()`, `getMatchHistory(username?)`
  - Sends `Authorization: Bearer <token>` on `createGame`, `createRoom`, `joinRoom`, `updateRoom`.

- [ ] **Step 1: Escrever testes falhando em `ui/src/utils/apiClient.test.ts`**

Create `ui/src/utils/apiClient.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";

import {
  getLeaderboard,
  getMatchHistory,
  loginAccount,
  registerAccount,
} from "./apiClient";
import {
  localGetLeaderboard,
  localGetMatchHistory,
  localRecordCompletedMatch,
} from "./localEngine";

describe("local match history and leaderboard calculations", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("records AI wins in match history while ranking only registered human users", () => {
    localRecordCompletedMatch({
      game_id: "g-human-win",
      mode: "SOLO",
      map_template: "BASE",
      vps_to_win: 10,
      num_turns: 42,
      winning_color: "RED",
      winner_name: "João",
      winner_username: "joao",
      winner_is_bot: false,
      participants: [
        {
          color: "RED",
          seat_kind: "USER",
          username: "joao",
          player_key: "HUMAN",
          display_name: "João",
          victory_points: 10,
          is_winner: true,
        },
        {
          color: "BLUE",
          seat_kind: "BOT",
          username: null,
          player_key: "CATANATRON",
          display_name: "IA (CATANATRON)",
          victory_points: 6,
          is_winner: false,
        },
      ],
    });

    localRecordCompletedMatch({
      game_id: "g-bot-win",
      mode: "SOLO",
      map_template: "BASE",
      vps_to_win: 10,
      num_turns: 50,
      winning_color: "BLUE",
      winner_name: "IA (CATANATRON)",
      winner_username: null,
      winner_is_bot: true,
      participants: [
        {
          color: "RED",
          seat_kind: "USER",
          username: "joao",
          player_key: "HUMAN",
          display_name: "João",
          victory_points: 7,
          is_winner: false,
        },
        {
          color: "BLUE",
          seat_kind: "BOT",
          username: null,
          player_key: "CATANATRON",
          display_name: "IA (CATANATRON)",
          victory_points: 10,
          is_winner: true,
        },
      ],
    });

    const matches = localGetMatchHistory();
    expect(matches).toHaveLength(2);
    expect(matches.some((m) => m.winner_is_bot)).toBe(true);

    const lb = localGetLeaderboard([
      { username: "joao", display_name: "João" },
      { username: "ana", display_name: "Ana" },
    ]);
    expect(lb.map((e) => e.username)).toEqual(["joao", "ana"]);
    expect(lb[0]).toMatchObject({
      wins: 1,
      losses: 1,
      games_played: 2,
      win_rate: 50.0,
      rank: 1,
    });
    expect(lb[1]).toMatchObject({
      wins: 0,
      games_played: 0,
      win_rate: 0.0,
      rank: 2,
    });
  });

  test("registerAccount and loginAccount propagate backend errors instead of silently falling back on 401/409", async () => {
    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 409, data: { description: "Usuário já existe" } },
    });
    await expect(
      registerAccount({ username: "joao", password: "1234" })
    ).rejects.toBeDefined();

    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 401, data: { description: "Senha incorreta" } },
    });
    await expect(
      loginAccount({ username: "joao", password: "wrong" })
    ).rejects.toBeDefined();
  });

  test("getLeaderboard and getMatchHistory mark offline fallback when backend is unavailable", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("Network Error"));
    const lbRes = await getLeaderboard();
    expect(lbRes.is_offline_fallback).toBe(true);
    const matchRes = await getMatchHistory();
    expect(matchRes.is_offline_fallback).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar `npx vitest run src/utils/apiClient.test.ts` para confirmar que falha**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx vitest run src/utils/apiClient.test.ts
```
Expected: FAIL (`localGetLeaderboard`, `registerAccount`, etc. not exported).

- [ ] **Step 3: Atualizar `api.types.ts`, `apiClient.ts` e `localEngine.ts`**

Add types to `ui/src/utils/api.types.ts`:
```ts
export type AccountStats = {
  wins: number;
  losses: number;
  games_played: number;
  win_rate: number;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  display_name: string;
  avatar_config?: Record<string, unknown>;
  wins: number;
  losses: number;
  games_played: number;
  win_rate: number;
};

export type MatchParticipant = {
  color: Color;
  seat_kind: "USER" | "GUEST" | "BOT";
  username: string | null;
  player_key: string;
  display_name: string;
  victory_points: number;
  is_winner: boolean;
};

export type MatchRecord = {
  game_id: string;
  room_code?: string | null;
  mode: "SOLO" | "MULTIPLAYER";
  map_template: string;
  vps_to_win: number;
  num_turns: number;
  winning_color: Color;
  winner_name: string;
  winner_username: string | null;
  winner_is_bot: boolean;
  finished_at: number;
  participants: MatchParticipant[];
};
```

Update `PlayerAccount`, auth endpoints, bearer token headers and leaderboard/history functions in `ui/src/utils/apiClient.ts`:
```ts
import type {
  AccountStats,
  Color,
  GameAction,
  GameState,
  LeaderboardEntry,
  MatchRecord,
  RoomState,
} from "./api.types";
import {
  localCreateGame,
  localCreateRoom,
  localGetLeaderboard,
  localGetMatchHistory,
  localGetMctsAnalysis,
  localGetRoom,
  localGetState,
  localJoinRoom,
  localListActiveRooms,
  localLoginUser,
  localPostAction,
  localRegisterUser,
  localStartRoomGame,
  localUpdateRoom,
} from "./localEngine";

export type PlayerAccount = {
  username: string;
  display_name: string;
  auth_token: string;
  has_google?: boolean;
  avatar_config?: Record<string, unknown>;
  stats?: AccountStats;
  is_new?: boolean;
};

export type AuthConfig = {
  google_enabled: boolean;
  google_client_id: string | null;
};

function authHeaders(token?: string | null): Record<string, string> {
  const resolved = token ?? getSavedAccount()?.auth_token;
  return resolved ? { Authorization: `Bearer ${resolved}` } : {};
}

export async function getAuthConfig(): Promise<AuthConfig> {
  try {
    const response = await axios.get<AuthConfig>(`${API_URL}/api/auth/config`);
    if (response.data && typeof response.data.google_enabled === "boolean") {
      return response.data;
    }
  } catch {
    // Offline fallback: Google OAuth disabled
  }
  return { google_enabled: false, google_client_id: null };
}

export async function registerAccount(options: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<PlayerAccount> {
  try {
    const response = await axios.post<PlayerAccount>(
      `${API_URL}/api/auth/register`,
      {
        username: options.username,
        password: options.password,
        display_name: options.displayName,
      }
    );
    if (response.data?.username) {
      saveAccount(response.data);
      return response.data;
    }
  } catch (err: any) {
    if (err?.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
  }
  const fallback = localRegisterUser(options);
  saveAccount(fallback);
  return fallback;
}

export async function loginAccount(options: {
  username: string;
  password: string;
}): Promise<PlayerAccount> {
  try {
    const response = await axios.post<PlayerAccount>(
      `${API_URL}/api/auth/login`,
      {
        username: options.username,
        password: options.password,
      }
    );
    if (response.data?.username) {
      saveAccount(response.data);
      return response.data;
    }
  } catch (err: any) {
    if (err?.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
  }
  const fallback = localLoginUser(options);
  saveAccount(fallback);
  return fallback;
}

export async function loginWithGoogle(credential: string): Promise<PlayerAccount> {
  const response = await axios.post<PlayerAccount>(`${API_URL}/api/auth/google`, {
    credential,
  });
  saveAccount(response.data);
  return response.data;
}

export async function fetchCurrentAccount(): Promise<PlayerAccount | null> {
  const saved = getSavedAccount();
  if (!saved?.auth_token) return null;
  try {
    const response = await axios.get<PlayerAccount>(`${API_URL}/api/auth/me`, {
      headers: authHeaders(saved.auth_token),
    });
    if (response.data?.username) {
      const merged: PlayerAccount = {
        ...saved,
        ...response.data,
        auth_token: saved.auth_token,
      };
      saveAccount(merged);
      return merged;
    }
  } catch (err: any) {
    if (err?.response?.status === 401) {
      clearSavedAccount();
      return null;
    }
  }
  return saved;
}

export async function logoutAccount(): Promise<void> {
  const saved = getSavedAccount();
  clearSavedAccount();
  if (!saved?.auth_token) return;
  try {
    await axios.post(
      `${API_URL}/api/auth/logout`,
      {},
      { headers: authHeaders(saved.auth_token) }
    );
  } catch {
    // Ignore network failures on logout
  }
}

export async function getLeaderboard(): Promise<{
  leaderboard: LeaderboardEntry[];
  is_offline_fallback: boolean;
}> {
  try {
    const response = await axios.get<{ leaderboard: LeaderboardEntry[] }>(
      `${API_URL}/api/leaderboard`
    );
    if (response.data && Array.isArray(response.data.leaderboard)) {
      return { leaderboard: response.data.leaderboard, is_offline_fallback: false };
    }
  } catch {
    // Offline fallback
  }
  return { leaderboard: localGetLeaderboard(), is_offline_fallback: true };
}

export async function getMatchHistory(username?: string): Promise<{
  matches: MatchRecord[];
  is_offline_fallback: boolean;
}> {
  try {
    const response = await axios.get<{ matches: MatchRecord[] }>(
      `${API_URL}/api/matches`,
      { params: username ? { username } : {} }
    );
    if (response.data && Array.isArray(response.data.matches)) {
      return { matches: response.data.matches, is_offline_fallback: false };
    }
  } catch {
    // Offline fallback
  }
  return { matches: localGetMatchHistory(username), is_offline_fallback: true };
}
```
Also update `createGame`, `createRoom` and `joinRoom` in `ui/src/utils/apiClient.ts` to attach `headers: authHeaders()` (and pass `auth_token` + `host_name` in `createGame` body and `seatIdentities` to `localCreateGame`).

Add local offline mirrors in `ui/src/utils/localEngine.ts`:
```ts
const LOCAL_USERS_KEY = "rule_isle_local_users_v1";
const LOCAL_MATCHES_KEY = "rule_isle_local_matches_v1";

type LocalUserRecord = {
  username: string;
  display_name: string;
  password: string;
};

function loadLocalUsers(): Record<string, LocalUserRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function localRegisterUser(options: {
  username: string;
  password: string;
  displayName?: string;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  if (cleanUser.length < 2) {
    throw new Error("Usuário deve ter pelo menos 2 caracteres.");
  }
  const users = loadLocalUsers();
  if (users[cleanUser]) {
    throw new Error("Este usuário já está cadastrado localmente.");
  }
  const display_name = (options.displayName || options.username).trim() || cleanUser;
  users[cleanUser] = { username: cleanUser, display_name, password: options.password };
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  return {
    username: cleanUser,
    display_name,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    is_new: true,
  };
}

export function localLoginUser(options: {
  username: string;
  password: string;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  const users = loadLocalUsers();
  const existing = users[cleanUser];
  if (!existing || existing.password !== options.password) {
    throw new Error("Usuário ou senha incorretos.");
  }
  return {
    username: existing.username,
    display_name: existing.display_name,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    is_new: false,
  };
}

export function localRecordCompletedMatch(
  input: Omit<MatchRecord, "finished_at"> & { finished_at?: number }
): MatchRecord {
  const matches = localGetMatchHistory();
  const existing = matches.find((m) => m.game_id === input.game_id);
  if (existing) return existing;

  const entry: MatchRecord = {
    ...input,
    finished_at: input.finished_at ?? Math.floor(Date.now() / 1000),
  };
  const next = [entry, ...matches].slice(0, 100);
  try {
    localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage limits
  }
  return entry;
}

export function localGetMatchHistory(username?: string): MatchRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_MATCHES_KEY);
    const list: MatchRecord[] = raw ? JSON.parse(raw) : [];
    const filtered = username
      ? list.filter((m) =>
          m.participants.some(
            (p) => p.seat_kind === "USER" && p.username === username.toLowerCase().trim()
          )
        )
      : list;
    return filtered.sort((a, b) => b.finished_at - a.finished_at);
  } catch {
    return [];
  }
}

export function localGetLeaderboard(
  extraUsers?: Array<{ username: string; display_name: string }>
): LeaderboardEntry[] {
  const usersMap: Record<string, { username: string; display_name: string }> = {};
  for (const [k, u] of Object.entries(loadLocalUsers())) {
    usersMap[k] = { username: u.username, display_name: u.display_name };
  }
  for (const u of extraUsers || []) {
    usersMap[u.username] = u;
  }

  const counts: Record<string, { wins: number; games: number }> = {};
  for (const match of localGetMatchHistory()) {
    for (const p of match.participants) {
      if (p.seat_kind !== "USER" || !p.username) continue;
      if (!usersMap[p.username]) {
        usersMap[p.username] = { username: p.username, display_name: p.display_name };
      }
      const bucket = counts[p.username] || { wins: 0, games: 0 };
      bucket.games += 1;
      if (p.is_winner) bucket.wins += 1;
      counts[p.username] = bucket;
    }
  }

  const rows: LeaderboardEntry[] = Object.values(usersMap).map((u) => {
    const { wins, games } = counts[u.username] || { wins: 0, games: 0 };
    const losses = Math.max(0, games - wins);
    const win_rate = games > 0 ? Math.round((wins / games) * 1000) / 10 : 0.0;
    return {
      rank: 0,
      username: u.username,
      display_name: u.display_name,
      wins,
      losses,
      games_played: games,
      win_rate,
    };
  });

  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.win_rate - a.win_rate ||
      b.games_played - a.games_played ||
      a.username.localeCompare(b.username)
  );
  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}
```
And inside `applyActionToGame` in `ui/src/utils/localEngine.ts`, when `state.winning_color` becomes non-null right after `recomputeScoresAndPlayableActions(game)`, build participants from `game.seatMeta` (or fallback `"GUEST"`/`"BOT"`) and call `localRecordCompletedMatch(...)`.

- [ ] **Step 4: Rodar `npx tsc --noEmit` e `npx vitest run` em `ui/`**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run src/utils/apiClient.test.ts
```
Expected: `0` TypeScript errors and all tests in `apiClient.test.ts` PASS.

- [ ] **Step 5: Commitar Task 4**

```powershell
git add ui/src/utils/api.types.ts ui/src/utils/apiClient.ts ui/src/utils/localEngine.ts ui/src/utils/apiClient.test.ts
git commit -m "feat(ui-api): add typed auth, Google login, leaderboard and match history client with offline fallback"
```

---

### Task 5: Interface de Contas (Entrar / Criar Conta / Google) e Modal de Ranking & Histórico na `HomePage`

**Files:**
- Create: `ui/src/components/GoogleSignInButton.tsx`
- Create: `ui/src/components/LeaderboardModal.tsx`
- Create: `ui/src/components/LeaderboardModal.scss`
- Create: `ui/src/components/LeaderboardModal.test.tsx`
- Modify: `ui/src/pages/HomePage.tsx`
- Modify: `ui/src/pages/HomePage.scss`
- Modify: `ui/src/App.test.tsx`

- [ ] **Step 1: Escrever teste `ui/src/components/LeaderboardModal.test.tsx` e expandir `ui/src/App.test.tsx`**

Create `ui/src/components/LeaderboardModal.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import LeaderboardModal from "./LeaderboardModal";

vi.mock("../utils/apiClient", () => ({
  getLeaderboard: vi.fn().mockResolvedValue({
    is_offline_fallback: false,
    leaderboard: [
      {
        rank: 1,
        username: "pedro",
        display_name: "Pedro",
        wins: 4,
        losses: 1,
        games_played: 5,
        win_rate: 80.0,
      },
    ],
  }),
  getMatchHistory: vi.fn().mockResolvedValue({
    is_offline_fallback: false,
    matches: [
      {
        game_id: "g1",
        mode: "SOLO",
        map_template: "BASE",
        vps_to_win: 10,
        num_turns: 33,
        winning_color: "BLUE",
        winner_name: "IA (CATANATRON)",
        winner_username: null,
        winner_is_bot: true,
        finished_at: 1794340000,
        participants: [
          {
            color: "BLUE",
            seat_kind: "BOT",
            username: null,
            player_key: "CATANATRON",
            display_name: "IA (CATANATRON)",
            victory_points: 10,
            is_winner: true,
          },
          {
            color: "RED",
            seat_kind: "USER",
            username: "pedro",
            player_key: "HUMAN",
            display_name: "Pedro",
            victory_points: 8,
            is_winner: false,
          },
        ],
      },
    ],
  }),
}));

describe("LeaderboardModal", () => {
  test("renders ranking with wins and win_rate and switches to match history including AI wins", async () => {
    const user = userEvent.setup();
    render(<LeaderboardModal open={true} onClose={() => {}} currentUsername="pedro" />);

    expect(await screen.findByText("Pedro")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Histórico de Partidas/i }));
    expect(await screen.findByText(/IA \(CATANATRON\)/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar `npx vitest run src/components/LeaderboardModal.test.tsx` para confirmar falha**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx vitest run src/components/LeaderboardModal.test.tsx
```
Expected: FAIL (`Cannot find module './LeaderboardModal'`).

- [ ] **Step 3: Implementar `GoogleSignInButton.tsx`, `LeaderboardModal.tsx`/`.scss` e integrar na `HomePage.tsx`/`.scss`**

Create `ui/src/components/GoogleSignInButton.tsx`:
```tsx
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!clientId) return;

    const renderGsi = () => {
      const api = window.google?.accounts?.id;
      if (!api || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      api.initialize({
        client_id: clientId,
        callback: (resp) => {
          if (resp?.credential) onCredential(resp.credential);
        },
      });
      api.renderButton(containerRef.current, {
        theme: "filled_black",
        size: "large",
        text: "signin_with",
        shape: "pill",
        locale: "pt_BR",
      });
    };

    if (window.google?.accounts?.id) {
      renderGsi();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", renderGsi);
      return () => existing.removeEventListener("load", renderGsi);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGsi;
    document.head.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, [clientId, onCredential]);

  return <div ref={containerRef} className="google-signin-slot" />;
}
```

Create `ui/src/components/LeaderboardModal.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, Tab, Tabs, Button } from "@mui/material";
import { getLeaderboard, getMatchHistory } from "../utils/apiClient";
import type { LeaderboardEntry, MatchRecord } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import "./LeaderboardModal.scss";

export default function LeaderboardModal({
  open,
  onClose,
  currentUsername,
}: {
  open: boolean;
  onClose: () => void;
  currentUsername?: string;
}) {
  const [tab, setTab] = useState<"ranking" | "history">("ranking");
  const [onlyMine, setOnlyMine] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [offlineFallback, setOfflineFallback] = useState(false);

  useEffect(() => {
    if (!open) return;
    getLeaderboard()
      .then((res) => {
        setLeaderboard(res.leaderboard);
        setOfflineFallback((prev) => prev || res.is_offline_fallback);
      })
      .catch(() => {});
    getMatchHistory(onlyMine && currentUsername ? currentUsername : undefined)
      .then((res) => {
        setMatches(res.matches);
        setOfflineFallback((prev) => prev || res.is_offline_fallback);
      })
      .catch(() => {});
  }, [open, onlyMine, currentUsername]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ className: "catan-modal-paper leaderboard-modal-paper" }}
    >
      <DialogTitle className="catan-modal-title leaderboard-modal-header">
        <span>🏆 Ranking Global & Histórico</span>
        <Button size="small" onClick={onClose} className="leaderboard-close-btn">
          Fechar
        </Button>
      </DialogTitle>
      <DialogContent className="catan-modal-content">
        {offlineFallback && (
          <div className="leaderboard-offline-banner">
            ⚠️ Modo local offline: exibindo registros salvos apenas neste navegador.
          </div>
        )}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          className="leaderboard-tabs"
        >
          <Tab value="ranking" label="🏆 Ranking de Vitórias" />
          <Tab value="history" label="📜 Histórico de Partidas" />
        </Tabs>

        {tab === "ranking" ? (
          <div className="leaderboard-table-wrap">
            {leaderboard.length === 0 ? (
              <p className="leaderboard-empty">Nenhum usuário cadastrado ainda.</p>
            ) : (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jogador</th>
                    <th>Vitórias</th>
                    <th>Partidas</th>
                    <th>% Vitórias</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.username}
                      className={row.username === currentUsername ? "is-me" : ""}
                    >
                      <td>#{row.rank}</td>
                      <td>
                        <strong>{row.display_name}</strong>{" "}
                        <small>@{row.username}</small>
                      </td>
                      <td>{row.wins}</td>
                      <td>{row.games_played}</td>
                      <td>{row.win_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="match-history-wrap">
            {currentUsername && (
              <div className="match-history-filter">
                <Button
                  size="small"
                  variant={onlyMine ? "contained" : "outlined"}
                  onClick={() => setOnlyMine((v) => !v)}
                >
                  {onlyMine ? "Mostrando: Minhas Partidas" : "Filtrar: Só Minhas Partidas"}
                </Button>
              </div>
            )}
            {matches.length === 0 ? (
              <p className="leaderboard-empty">Nenhuma partida concluída registrada ainda.</p>
            ) : (
              matches.map((m) => (
                <div key={m.game_id} className="match-history-card">
                  <div className="match-history-card__top">
                    <span>
                      {m.winner_is_bot ? "🤖" : "👑"} Vencedor:{" "}
                      <strong>{m.winner_name}</strong>
                    </span>
                    <small>
                      {m.mode === "MULTIPLAYER" ? "Multiplayer" : "Solo vs IA"} • Mapa{" "}
                      {m.map_template} • {m.num_turns} turnos
                    </small>
                  </div>
                  <div className="match-history-card__seats">
                    {m.participants.map((p) => (
                      <span
                        key={p.color}
                        className={`match-seat-chip ${p.is_winner ? "winner" : ""}`}
                        style={{ borderColor: PLAYER_COLOR_META[p.color]?.primary }}
                      >
                        {p.display_name} — {p.victory_points} PV
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```
Create matching styles in `ui/src/components/LeaderboardModal.scss` following the dark slate + gold aesthetic (`#0f172a` / `#facc15`).

Update `ui/src/pages/HomePage.tsx` & `HomePage.scss`:
- Hydrate `getAuthConfig()` and `fetchCurrentAccount()` on mount.
- Replace the ambiguous single login form with **Entrar** vs **Criar Conta** tabs (`authMode: "login" | "register"`), separate `registerAccount(...)` vs `loginAccount(...)`, `<GoogleSignInButton />` when `authConfig.google_enabled`, display `account.stats` (`wins`, `win_rate%`, `games_played`) when logged in, call `logoutAccount()` on `Sair`, and add `"🏆 Ranking & Histórico"` button opening `<LeaderboardModal />`.
- Update `ui/src/App.test.tsx` to preserve every existing assertion (`Modelo do Mapa`, `Pontos para Vencer`, etc.) and verify presence of the **"Entrar"** / **"Criar Conta"** tabs and **"Ranking & Histórico"** button.

- [ ] **Step 4: Rodar `tsc --noEmit`, `vitest run` e `npm run build` em `ui/`**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run
npm run build
```
Expected: `0` TypeScript errors, all Vitest suites PASS, clean production Vite build.

- [ ] **Step 5: Commitar Task 5**

```powershell
git add ui/src/components/GoogleSignInButton.tsx ui/src/components/LeaderboardModal.tsx ui/src/components/LeaderboardModal.scss ui/src/components/LeaderboardModal.test.tsx ui/src/pages/HomePage.tsx ui/src/pages/HomePage.scss ui/src/App.test.tsx
git commit -m "feat(ui): separate login/register tabs, Google Sign-In button and Leaderboard + Match History modal"
```

---

### Task 6: Documentação Cross-Máquina e Checklist de Variáveis na Vercel/Supabase

**Files:**
- Modify: `CONTEXTO_PROJETO.md`

- [ ] **Step 1: Atualizar `CONTEXTO_PROJETO.md` com arquitetura final do Bloco 1 e instruções de `DATABASE_URL` (Supabase Pooler IPv4) e `GOOGLE_CLIENT_ID` na Vercel**

Include exact checklist in `CONTEXTO_PROJETO.md`:
- `DATABASE_URL`: String PostgreSQL do **Supabase Transaction/Session Pooler (IPv4)** na Vercel (`Settings -> Environment Variables`).
- `GOOGLE_CLIENT_ID`: Client ID OAuth 2.0 Web criado no Google Cloud Console (com domínios autorizados `http://localhost:5173` e domínio `*.vercel.app`).
- `SECRET_KEY`: Segredo aleatório da aplicação Flask em produção.

- [ ] **Step 2: Rodar suíte completa (Python web + Frontend TS/Vitest/Build)**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run
npm run build
```
Expected: All Python web tests pass, `0` TS errors, all frontend tests pass, production bundle builds cleanly.

- [ ] **Step 3: Commitar Task 6**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add CONTEXTO_PROJETO.md
git commit -m "docs: document Bloco 1 auth, match history, leaderboard and Supabase/Google env vars"
```
