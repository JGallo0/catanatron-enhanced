"""Persisting games as a document plus what happened to it, plus multiplayer rooms."""

import hashlib
import hmac
import json
import os
import random
import secrets
import string
import time
import uuid
from contextlib import contextmanager

from catanatron.game import Game
from catanatron.models.map import build_map
from catanatron.models.player import Color
from catanatron.registry import REGISTRY, SpecError
from catanatron.serialization import (
    SCHEMA_VERSION,
    action_record_from_json,
    action_record_to_json,
    state_from_json,
    state_to_json,
)
from catanatron.state_functions import get_actual_victory_points, get_state_index
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
    inspect,
    text,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session
from flask_sqlalchemy import SQLAlchemy
from flask import abort

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
    username = Column(
        String(32), ForeignKey("users.username"), index=True, nullable=False
    )
    created_at = Column(Integer, nullable=False, default=lambda: int(time.time()))
    last_seen_at = Column(Integer, nullable=False, default=lambda: int(time.time()))
    expires_at = Column(
        Integer,
        nullable=False,
        default=lambda: int(time.time()) + SESSION_TTL_SECONDS,
    )


db = SQLAlchemy(metadata=metadata)


@contextmanager
def database_session():
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://catanatron:victorypoint@127.0.0.1:5432/catanatron_db",
    )
    engine = create_engine(database_url)
    session = Session(engine)
    try:
        yield session
    finally:
        session.expunge_all()
        session.close()


def upsert_game_state(game: Game, session_param=None):
    """Save a game: create its row the first time, then append what is new."""
    session = session_param or db.session
    head = get_state_index(game.state)
    document = json.dumps(state_to_json(game))
    stored = session.get(StoredGame, game.id)

    if stored is None:
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
        )
        session.add(stored)

    for index in range(stored.head_index, head):
        record = game.state.action_records[index]
        session.add(
            StoredAction(
                uuid=game.id,
                index=index,
                payload=json.dumps(action_record_to_json(record)),
            )
        )

    stored.head_index = head
    stored.head_state = document
    session.commit()
    return stored


def get_game_state(game_id, state_index=None) -> Game | None:
    """Materialize a game at ``state_index``, or at its latest state."""
    session = db.session
    stored = session.get(StoredGame, game_id)
    if stored is None:
        abort(404)
    if stored.schema_version != SCHEMA_VERSION:
        abort(410, description=f"game was stored by schema v{stored.schema_version}")

    target = stored.head_index if state_index is None else state_index
    if not stored.base_index <= target <= stored.head_index:
        abort(404)

    at_head = target == stored.head_index
    document = json.loads(stored.head_state if at_head else stored.base_state)

    specs = json.loads(stored.player_specs)
    colors = [Color[c] for c in document["colors"]]
    players = [REGISTRY.build(spec, color) for spec, color in zip(specs, colors)]
    game = state_from_json(document, players)
    if at_head:
        return game

    log = (
        session.query(StoredAction)
        .filter(
            StoredAction.uuid == game_id,
            StoredAction.index >= stored.base_index,
            StoredAction.index < target,
        )
        .order_by(StoredAction.index)
        .all()
    )
    session.commit()
    if len(log) != target - stored.base_index:
        abort(500, description=f"game {game_id} is missing actions before {target}")

    for entry in log:
        record = action_record_from_json(json.loads(entry.payload))
        game.execute(record.action, validate_action=False, action_record=record)
    return game


# ===== Multiplayer Room Helpers =====
def _generate_room_code(session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(20):
        code = "".join(random.choices(alphabet, k=6))
        if session.get(StoredRoom, code) is None:
            return code
    return uuid.uuid4().hex[:6].upper()


def serialize_room(room: StoredRoom, caller_token: str | None = None) -> dict:
    config = json.loads(room.config_json)
    seats = json.loads(room.seats_json)
    my_color = None
    is_host = bool(caller_token and caller_token == room.host_token)

    public_seats = []
    for seat in seats:
        if caller_token and seat.get("seat_token") == caller_token:
            my_color = seat["color"]
        public_seats.append(
            {
                "color": seat["color"],
                "player_key": seat["player_key"],
                "player_name": seat["player_name"],
                "is_bot": seat["player_key"] != "HUMAN",
                "claimed": bool(seat.get("seat_token")) or seat["player_key"] != "HUMAN",
                "is_me": bool(caller_token and seat.get("seat_token") == caller_token),
            }
        )

    return {
        "room_code": room.room_code,
        "status": room.status,
        "game_id": room.game_id,
        "is_host": is_host,
        "my_color": my_color,
        "config": config,
        "seats": public_seats,
    }


def ensure_schema_columns(engine) -> None:
    """Idempotently add new columns when upgrading an existing SQLite/Postgres DB."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    alter_statements: list[str] = []

    if "users" in tables:
        user_cols = {col["name"] for col in inspector.get_columns("users")}
        if "password_hash" not in user_cols:
            alter_statements.append(
                "ALTER TABLE users ADD COLUMN password_hash VARCHAR(256)"
            )
        if "google_sub" not in user_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN google_sub VARCHAR(64)")
        if "email" not in user_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN email VARCHAR(255)")
        if "avatar_json" not in user_cols:
            alter_statements.append(
                "ALTER TABLE users ADD COLUMN avatar_json TEXT DEFAULT '{}'"
            )
        if "created_at" not in user_cols:
            alter_statements.append(
                "ALTER TABLE users ADD COLUMN created_at INTEGER DEFAULT 0"
            )

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
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)"
                    )
                )


def _normalize_username(username: str) -> str:
    return "".join(
        ch
        for ch in (username or "").lower().strip()
        if ch.isalnum() or ch in ("_", "-")
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
    user = StoredUser(
        username=clean_user,
        display_name=clean_display,
        password_hash=hash_password(raw_password),
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
    display = str(
        claims.get("name") or (email.split("@")[0] if email else "Jogador")
    ).strip()[:32]

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
        # "" (não None): bancos migrados de versões antigas têm pin_hash NOT NULL
        pin_hash="",
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


def get_user_stats(username: str) -> dict:
    return {
        "wins": 0,
        "losses": 0,
        "games_played": 0,
        "win_rate": 0.0,
    }


def create_room(
    host_name: str = "Anfitrião",
    players: list[str] | None = None,
    map_template: str = "BASE",
    vps_to_win: int = 10,
    discard_limit: int = 7,
    friendly_robber: bool = True,
    host_token: str | None = None,
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
                }
            )
        else:
            seats.append(
                {
                    "color": color,
                    "player_key": p_key,
                    "player_name": f"Bot ({p_key})",
                    "seat_token": None,
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


def list_active_rooms(caller_token: str | None = None, limit: int = 20) -> list[dict]:
    session = db.session
    rooms = session.query(StoredRoom).limit(60).all()
    serialized = [serialize_room(r, caller_token) for r in rooms]
    # Sort so rooms where caller is seated come first, then WAITING rooms, then newest created_at
    serialized.sort(
        key=lambda item: (
            1 if item.get("my_color") else 0,
            1 if item.get("status") == "WAITING" else 0,
            int(item.get("config", {}).get("created_at", 0)),
        ),
        reverse=True,
    )
    return serialized[:limit]


def get_room_by_game_id(game_id: str) -> StoredRoom | None:
    session = db.session
    return session.query(StoredRoom).filter_by(game_id=game_id).first()
