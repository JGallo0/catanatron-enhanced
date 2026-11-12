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
from catanatron.models.map import TOURNAMENT_MAP, build_map
from catanatron.models.player import Color
from catanatron.registry import REGISTRY, SpecError
from catanatron.serialization import (
    SCHEMA_VERSION,
    action_record_from_json,
    action_record_to_json,
    state_from_json,
    state_to_json,
)
from catanatron.state import VALID_DICE_MODES
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
TAKEOVER_TIMEOUT_SECONDS = 45
TAKEOVER_BOT_SPEC = "CATANATRON"

AVATAR_VALID_VALUES: dict[str, tuple[str, ...]] = {
    "skin": ("porcelain", "fair", "warm", "tan", "brown", "deep"),
    "eyes": ("calm", "cheerful", "sharp", "wise"),
    "hair": ("none", "short", "wavy", "bun", "braids", "curly", "long"),
    "hairColor": ("brown", "black", "blonde", "red", "silver", "navy"),
    "beard": ("none", "goatee", "full", "mustache"),
    "hat": ("none", "captain", "explorer", "bandana", "helm", "crown_gold"),
    "outfit": ("settler", "captain", "armor", "merchant"),
    "outfitColor": ("crimson", "royal", "emerald", "amber", "slate"),
    "background": ("ocean", "sunset", "forest", "mountain", "gold", "crimson"),
    "frame": ("wood", "bronze", "silver", "gold", "imperial"),
}

AVATAR_UNLOCK_REQUIREMENTS: dict[str, dict[str, int]] = {
    "frame": {"bronze": 1, "silver": 3, "gold": 5, "imperial": 10},
    "hat": {"crown_gold": 7},
}

OFFICIAL_BOT_NAMES: tuple[str, ...] = (
    "Creitu",
    "Felire",
    "Guiri",
    "Jaó",
    "Angeleri",
)

OPEN_SEAT_NAME = "Assento livre"
LEGACY_OPEN_SEAT_NAMES: tuple[str, ...] = (
    "Assento livre",
    "Aguardando Amigo...",
    "Vaga Aberta",
    "Vaga para Amigo",
    "",
)

BOT_DIFFICULTY_TO_KEY: dict[str, str] = {
    "easy": "W",
    "medium": "F",
    "hard": "CATANATRON",
}

VALID_BOT_SPEEDS: tuple[str, ...] = ("normal", "fast", "turbo")


def normalize_bot_speed(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    clean = raw.strip().lower()
    return clean if clean in VALID_BOT_SPEEDS else None


def normalize_bot_difficulty(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    clean = raw.strip().lower()
    return clean if clean in BOT_DIFFICULTY_TO_KEY else None


def infer_bot_difficulty_from_key(player_key: str | None) -> str:
    key = str(player_key or "").split(":")[0].strip().upper()
    if key in ("W", "WEIGHTED_RANDOM", "R", "RANDOM"):
        return "easy"
    if key in ("CATANATRON", "AB", "SAB"):
        return "hard"
    return "medium"


def prescan_requested_bot_names(
    entries: list[tuple[str, str | None]],
) -> tuple[dict[int, str], set[str]]:
    """Reserve explicit valid official bot names first so fallback draws never collide."""
    chosen: dict[int, str] = {}
    used: set[str] = set()
    for idx, (player_key, requested_name) in enumerate(entries):
        if str(player_key).split(":")[0].strip().upper() == "HUMAN":
            continue
        clean = str(requested_name or "").strip()
        if clean in OFFICIAL_BOT_NAMES and clean not in used:
            chosen[idx] = clean
            used.add(clean)
    return chosen, used

BOT_AVATAR_BY_NAME: dict[str, dict[str, str]] = {
    "Creitu": {
        "skin": "warm",
        "eyes": "sharp",
        "hair": "short",
        "hairColor": "navy",
        "beard": "goatee",
        "hat": "captain",
        "outfit": "captain",
        "outfitColor": "royal",
        "background": "ocean",
        "frame": "bronze",
    },
    "Felire": {
        "skin": "fair",
        "eyes": "cheerful",
        "hair": "wavy",
        "hairColor": "red",
        "beard": "none",
        "hat": "explorer",
        "outfit": "settler",
        "outfitColor": "emerald",
        "background": "forest",
        "frame": "bronze",
    },
    "Guiri": {
        "skin": "tan",
        "eyes": "wise",
        "hair": "curly",
        "hairColor": "brown",
        "beard": "mustache",
        "hat": "bandana",
        "outfit": "merchant",
        "outfitColor": "amber",
        "background": "sunset",
        "frame": "bronze",
    },
    "Jaó": {
        "skin": "brown",
        "eyes": "sharp",
        "hair": "short",
        "hairColor": "silver",
        "beard": "full",
        "hat": "helm",
        "outfit": "armor",
        "outfitColor": "slate",
        "background": "mountain",
        "frame": "silver",
    },
    "Angeleri": {
        "skin": "porcelain",
        "eyes": "calm",
        "hair": "braids",
        "hairColor": "blonde",
        "beard": "none",
        "hat": "none",
        "outfit": "merchant",
        "outfitColor": "crimson",
        "background": "gold",
        "frame": "silver",
    },
}


def pick_bot_names(
    count: int, exclude: set[str] | list[str] | tuple[str, ...] | None = None
) -> list[str]:
    """Return unique official AI bot names without color labels."""
    used = {name for name in (exclude or ()) if isinstance(name, str)}
    available = [name for name in OFFICIAL_BOT_NAMES if name not in used]
    random.shuffle(available)
    chosen: list[str] = []
    while len(chosen) < count:
        if not available:
            fallback = list(OFFICIAL_BOT_NAMES)
            random.shuffle(fallback)
            available.extend(fallback)
        pick = available.pop(0)
        chosen.append(pick)
        used.add(pick)
    return chosen


def sanitize_avatar_config(raw: dict | None) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    sanitized: dict[str, str] = {}
    for field, allowed in AVATAR_VALID_VALUES.items():
        val = raw.get(field)
        if isinstance(val, str) and val in allowed:
            sanitized[field] = val
    return sanitized


def filter_unlocked_avatar_config(
    raw: dict | None, wins: int = 0
) -> dict[str, str]:
    """Sanitize avatar config and silently drop items above current win count."""
    clean = sanitize_avatar_config(raw)
    unlocked: dict[str, str] = {}
    for field, val in clean.items():
        required = AVATAR_UNLOCK_REQUIREMENTS.get(field, {}).get(val, 0)
        if wins >= required:
            unlocked[field] = val
    return unlocked


def _load_avatars_by_username(usernames: list[str]) -> dict[str, dict[str, str]]:
    clean = sorted({u for u in usernames if isinstance(u, str) and u})
    if not clean:
        return {}
    users = db.session.query(StoredUser).filter(StoredUser.username.in_(clean)).all()
    by_user: dict[str, dict[str, str]] = {}
    for u in users:
        try:
            parsed = json.loads(u.avatar_json or "{}")
        except Exception:
            parsed = {}
        by_user[u.username] = sanitize_avatar_config(parsed)
    return by_user


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


class StoredGameMessage(Base):
    """In-match chat and taunt event persisted per game."""

    __tablename__ = "game_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(
        String(64), ForeignKey("games.uuid"), index=True, nullable=False
    )
    color = Column(String(16), nullable=False)
    sender_name = Column(String(64), nullable=False)
    kind = Column(String(16), nullable=False, default="CHAT")
    body = Column(String(280), nullable=False)
    created_at = Column(Integer, nullable=False, default=lambda: int(time.time()))


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
    finished_at = Column(
        Integer, index=True, nullable=False, default=lambda: int(time.time())
    )


class StoredMatchParticipant(Base):
    """Per-seat participation record linking finished games back to registered users."""

    __tablename__ = "match_participants"
    __table_args__ = (
        UniqueConstraint("game_id", "color", name="uq_match_participant_game_color"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(
        String(64), ForeignKey("matches.game_id"), index=True, nullable=False
    )
    color = Column(String(16), nullable=False)
    seat_kind = Column(String(16), nullable=False)  # "USER" | "GUEST" | "BOT"
    username = Column(
        String(32), ForeignKey("users.username"), index=True, nullable=True
    )
    player_key = Column(String(32), nullable=False)
    display_name = Column(String(64), nullable=False)
    victory_points = Column(Integer, nullable=False, default=0)
    is_winner = Column(Boolean, nullable=False, default=False)


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


def init_presence_metadata(
    seat_meta: dict[str, dict],
    seat_tokens_by_color: dict[str, str | None] | None = None,
    now: int | None = None,
) -> dict[str, dict]:
    """Attach presence, ownership, and original identity fields per color seat."""
    ts = int(now if now is not None else time.time())
    tokens = seat_tokens_by_color or {}
    enriched: dict[str, dict] = {}
    for color, raw in seat_meta.items():
        meta = dict(raw or {})
        player_key = str(meta.get("player_key") or "HUMAN")
        seat_kind = str(
            meta.get("seat_kind")
            or (
                "BOT"
                if player_key != "HUMAN"
                else ("USER" if meta.get("username") else "GUEST")
            )
        )
        uname = meta.get("username") if seat_kind == "USER" else None
        dname = str(meta.get("display_name") or COLOR_LABELS_PT.get(color, color))
        avatar = dict(meta.get("avatar_config") or {})
        tok = meta.get("seat_token")
        if not tok and color in tokens:
            tok = tokens.get(color)

        meta.setdefault("color", color)
        meta["seat_kind"] = seat_kind
        meta["username"] = uname
        meta["player_key"] = player_key
        meta["display_name"] = dname
        meta["avatar_config"] = avatar
        if tok:
            meta["seat_token"] = str(tok)
        elif "seat_token" in meta:
            meta["seat_token"] = None

        meta.setdefault("original_player_key", player_key)
        meta.setdefault("original_seat_kind", seat_kind)
        meta.setdefault("original_username", uname)
        meta.setdefault("original_display_name", dname)
        meta.setdefault("original_avatar_config", dict(avatar))
        meta.setdefault("last_seen_at", ts)
        meta.setdefault("taken_over_by_bot", False)
        meta.setdefault("takeover_reason", None)
        enriched[color] = meta
    return enriched


def load_game_seat_metadata(stored_game: StoredGame) -> dict[str, dict]:
    """Load per-color metadata for a StoredGame, falling back to its StoredRoom if needed."""
    parsed: dict[str, dict] = {}
    if stored_game.seat_metadata_json:
        try:
            raw = json.loads(stored_game.seat_metadata_json)
            if isinstance(raw, dict):
                parsed = raw
        except Exception:
            parsed = {}

    seat_tokens_by_color: dict[str, str | None] | None = None
    if not parsed:
        room = get_room_by_game_id(stored_game.uuid)
        if room is not None:
            try:
                for seat in json.loads(room.seats_json):
                    c = seat["color"]
                    p_key = seat.get("player_key", "HUMAN")
                    is_bot = p_key != "HUMAN"
                    uname = seat.get("username") if not is_bot else None
                    parsed[c] = {
                        "color": c,
                        "seat_kind": "BOT" if is_bot else ("USER" if uname else "GUEST"),
                        "username": uname,
                        "player_key": p_key,
                        "display_name": seat.get("player_name")
                        or COLOR_LABELS_PT.get(c, c),
                        "avatar_config": seat.get("avatar_config") or {},
                        "seat_token": seat.get("seat_token"),
                    }
            except Exception:
                parsed = {}
    elif any(
        isinstance(m, dict)
        and str(m.get("original_player_key") or m.get("player_key") or "") == "HUMAN"
        and not m.get("seat_token")
        for m in parsed.values()
    ):
        room = get_room_by_game_id(stored_game.uuid)
        if room is not None:
            try:
                seat_tokens_by_color = {
                    seat["color"]: seat.get("seat_token")
                    for seat in json.loads(room.seats_json)
                    if seat.get("player_key") == "HUMAN"
                }
            except Exception:
                seat_tokens_by_color = None

    if not parsed:
        return {}
    return init_presence_metadata(parsed, seat_tokens_by_color=seat_tokens_by_color)


def is_multiplayer_game(stored_game: StoredGame, seat_meta: dict[str, dict]) -> bool:
    if get_room_by_game_id(stored_game.uuid) is not None:
        return True
    orig_human_count = sum(
        1
        for meta in seat_meta.values()
        if str(meta.get("original_player_key") or meta.get("player_key") or "")
        == "HUMAN"
    )
    return orig_human_count >= 2


def _seat_matches_caller(
    meta: dict,
    auth_user: StoredUser | None,
    seat_token: str | None,
    allow_open_local_guest: bool,
) -> bool:
    if str(meta.get("original_player_key") or meta.get("player_key") or "") != "HUMAN":
        return False
    orig_uname = meta.get("original_username") or meta.get("username")
    if auth_user is not None and orig_uname and orig_uname == auth_user.username:
        return True
    stored_tok = meta.get("seat_token")
    if (
        seat_token
        and stored_tok
        and hmac.compare_digest(
            str(stored_tok).encode("utf-8"), str(seat_token).encode("utf-8")
        )
    ):
        return True
    if allow_open_local_guest and not stored_tok and orig_uname is None:
        return True
    return False


def authorize_seat_caller(
    stored_game: StoredGame,
    seat_meta: dict[str, dict],
    preferred_color: str | None = None,
    auth_user: StoredUser | None = None,
    seat_token: str | None = None,
) -> str | None:
    """Resolve which seat color the caller is authorized to manage."""
    has_room = get_room_by_game_id(stored_game.uuid) is not None
    any_tokens = any(bool(m.get("seat_token")) for m in seat_meta.values())
    allow_open_local_guest = (not has_room) and (not any_tokens)

    if preferred_color:
        col = str(preferred_color).strip().upper()
        meta = seat_meta.get(col)
        if meta and _seat_matches_caller(
            meta, auth_user, seat_token, allow_open_local_guest
        ):
            return col
        return None

    for col, meta in seat_meta.items():
        if _seat_matches_caller(
            meta, auth_user, seat_token, allow_open_local_guest=False
        ):
            return col

    if allow_open_local_guest:
        for col, meta in seat_meta.items():
            if _seat_matches_caller(
                meta, auth_user, seat_token, allow_open_local_guest=True
            ):
                return col
    return None


def _stored_game_is_finished(stored_game: StoredGame) -> bool:
    if db.session.get(StoredMatch, stored_game.uuid) is not None:
        return True
    try:
        doc = json.loads(stored_game.head_state)
        vps_to_win = int(doc.get("game", {}).get("vps_to_win", 10))
        ps = doc.get("player_state", {})
        colors = doc.get("colors", [])
        max_vp = max(
            (
                int(ps.get(f"P{idx}_ACTUAL_VICTORY_POINTS", 0))
                for idx in range(len(colors))
            ),
            default=0,
        )
        if max_vp < vps_to_win:
            return False
        game = get_game_state(stored_game.uuid)
        return game is not None and game.winning_color() is not None
    except Exception:
        return False


def _apply_takeover_to_seat(meta: dict, reason: str, now: int) -> None:
    orig_name = str(
        meta.get("original_display_name")
        or meta.get("display_name")
        or COLOR_LABELS_PT.get(meta.get("color", ""), "Jogador")
    )
    if orig_name.endswith(" (Bot)"):
        orig_name = orig_name[:-6]
    orig_avatar = dict(
        meta.get("original_avatar_config") or meta.get("avatar_config") or {}
    )
    meta["original_player_key"] = (
        meta.get("original_player_key") or meta.get("player_key") or "HUMAN"
    )
    meta["original_seat_kind"] = (
        meta.get("original_seat_kind") or meta.get("seat_kind") or "GUEST"
    )
    if "original_username" not in meta:
        meta["original_username"] = meta.get("username")
    meta["original_display_name"] = orig_name
    meta["original_avatar_config"] = orig_avatar
    meta["taken_over_by_bot"] = True
    meta["takeover_reason"] = reason
    meta["player_key"] = TAKEOVER_BOT_SPEC
    meta["seat_kind"] = "BOT"
    meta["username"] = None
    meta["display_name"] = f"{orig_name[:42]} (Bot)"
    meta["avatar_config"] = orig_avatar
    meta.setdefault("last_seen_at", now)


def touch_seat_heartbeat(
    game_id: str, color: str, now: int | None = None
) -> bool:
    stored = db.session.get(StoredGame, game_id)
    if stored is None:
        return False
    seat_meta = load_game_seat_metadata(stored)
    col = str(color).strip().upper()
    meta = seat_meta.get(col)
    if not meta:
        return False
    if meta.get("taken_over_by_bot"):
        return False
    if str(meta.get("original_player_key") or meta.get("player_key") or "") != "HUMAN":
        return False
    ts = int(now if now is not None else time.time())
    meta["last_seen_at"] = ts
    stored.seat_metadata_json = json.dumps(seat_meta)
    db.session.commit()
    return True


def promote_seat_to_bot(
    game_id: str,
    color: str,
    reason: str = "DISCONNECTED",
    now: int | None = None,
) -> bool:
    stored = db.session.get(StoredGame, game_id)
    if stored is None or _stored_game_is_finished(stored):
        return False
    seat_meta = load_game_seat_metadata(stored)
    col = str(color).strip().upper()
    meta = seat_meta.get(col)
    if not meta:
        return False
    if str(meta.get("original_player_key") or meta.get("player_key") or "") != "HUMAN":
        return False
    if meta.get("taken_over_by_bot"):
        return False

    doc = json.loads(stored.head_state)
    colors = doc.get("colors", [])
    if col not in colors:
        return False
    idx = colors.index(col)
    specs = json.loads(stored.player_specs)
    specs[idx] = TAKEOVER_BOT_SPEC

    ts = int(now if now is not None else time.time())
    _apply_takeover_to_seat(meta, reason=reason, now=ts)

    stored.player_specs = json.dumps(specs)
    stored.seat_metadata_json = json.dumps(seat_meta)
    db.session.commit()
    return True


def reclaim_seat_from_bot(
    game_id: str, color: str, now: int | None = None
) -> bool:
    stored = db.session.get(StoredGame, game_id)
    if stored is None or _stored_game_is_finished(stored):
        return False
    seat_meta = load_game_seat_metadata(stored)
    col = str(color).strip().upper()
    meta = seat_meta.get(col)
    if not meta or not meta.get("taken_over_by_bot"):
        return False

    doc = json.loads(stored.head_state)
    colors = doc.get("colors", [])
    if col not in colors:
        return False
    idx = colors.index(col)
    specs = json.loads(stored.player_specs)
    orig_key = str(meta.get("original_player_key") or "HUMAN")
    specs[idx] = orig_key

    ts = int(now if now is not None else time.time())
    meta["taken_over_by_bot"] = False
    meta["takeover_reason"] = None
    meta["player_key"] = orig_key
    meta["seat_kind"] = str(meta.get("original_seat_kind") or "GUEST")
    meta["username"] = (
        meta.get("original_username") if meta["seat_kind"] == "USER" else None
    )
    meta["display_name"] = str(
        meta.get("original_display_name") or COLOR_LABELS_PT.get(col, col)
    )
    meta["avatar_config"] = dict(meta.get("original_avatar_config") or {})
    meta["last_seen_at"] = ts

    stored.player_specs = json.dumps(specs)
    stored.seat_metadata_json = json.dumps(seat_meta)
    db.session.commit()
    return True


def maybe_promote_disconnected_seats(
    game_id: str,
    now: int | None = None,
    timeout_seconds: int = TAKEOVER_TIMEOUT_SECONDS,
) -> list[str]:
    """Lazily promote timed-out multiplayer seats only when >= 1 live human remains online."""
    stored = db.session.get(StoredGame, game_id)
    if stored is None or _stored_game_is_finished(stored):
        return []
    seat_meta = load_game_seat_metadata(stored)
    if not seat_meta or not is_multiplayer_game(stored, seat_meta):
        return []

    ts = int(now if now is not None else time.time())
    active_humans = [
        c
        for c, m in seat_meta.items()
        if str(m.get("original_player_key") or m.get("player_key") or "") == "HUMAN"
        and not m.get("taken_over_by_bot")
    ]
    live_humans = [
        c
        for c in active_humans
        if (ts - int(seat_meta[c].get("last_seen_at") or ts)) < timeout_seconds
    ]
    stale_humans = [
        c
        for c in active_humans
        if (ts - int(seat_meta[c].get("last_seen_at") or ts)) >= timeout_seconds
    ]
    if not live_humans or not stale_humans:
        return []

    doc = json.loads(stored.head_state)
    colors = doc.get("colors", [])
    specs = json.loads(stored.player_specs)
    promoted: list[str] = []
    for col in stale_humans:
        if col not in colors:
            continue
        idx = colors.index(col)
        specs[idx] = TAKEOVER_BOT_SPEC
        _apply_takeover_to_seat(seat_meta[col], reason="DISCONNECTED", now=ts)
        promoted.append(col)

    if promoted:
        stored.player_specs = json.dumps(specs)
        stored.seat_metadata_json = json.dumps(seat_meta)
        db.session.commit()
    return promoted


def upsert_game_state(
    game: Game, session_param=None, seat_metadata_by_color: dict | None = None
):
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
            seat_metadata_json=(
                json.dumps(init_presence_metadata(seat_metadata_by_color))
                if seat_metadata_by_color is not None
                else None
            ),
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


def _tokens_equal(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return False
    return hmac.compare_digest(str(left).encode("utf-8"), str(right).encode("utf-8"))


def _collect_candidate_tokens(
    caller_token: str | None = None,
    caller_tokens: list[str] | tuple[str, ...] | set[str] | None = None,
) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for raw in ([caller_token] if caller_token else []) + list(caller_tokens or ()):
        clean = str(raw).strip() if raw is not None else ""
        if clean and clean not in seen:
            seen.add(clean)
            ordered.append(clean)
    return ordered


def _is_room_host(
    room: StoredRoom,
    caller_tokens: list[str] | tuple[str, ...] | set[str] | None = None,
    auth_user: StoredUser | None = None,
    raw_config: dict | None = None,
    seats: list[dict] | None = None,
) -> bool:
    tokens = _collect_candidate_tokens(caller_tokens=caller_tokens)
    if any(_tokens_equal(tok, room.host_token) for tok in tokens):
        return True
    if auth_user is None:
        return False

    cfg = raw_config if raw_config is not None else json.loads(room.config_json)
    host_uname = cfg.get("host_username")
    if host_uname and host_uname == auth_user.username:
        return True

    parsed_seats = seats if seats is not None else json.loads(room.seats_json)
    for seat in parsed_seats:
        if _tokens_equal(seat.get("seat_token"), room.host_token):
            if seat.get("username") == auth_user.username:
                return True
    return False


def serialize_room(
    room: StoredRoom,
    caller_token: str | None = None,
    auth_user: StoredUser | None = None,
    caller_tokens: list[str] | tuple[str, ...] | set[str] | None = None,
) -> dict:
    raw_config = json.loads(room.config_json)
    config = {k: v for k, v in raw_config.items() if k != "host_username"}
    if config.get("dice_mode") not in VALID_DICE_MODES:
        config["dice_mode"] = "random"
    config["bot_speed"] = normalize_bot_speed(config.get("bot_speed")) or "normal"
    seats = json.loads(room.seats_json)
    if not normalize_bot_difficulty(config.get("bot_difficulty")):
        first_bot = next((s for s in seats if s.get("player_key") != "HUMAN"), None)
        config["bot_difficulty"] = (
            infer_bot_difficulty_from_key(first_bot.get("player_key"))
            if first_bot
            else "medium"
        )
    tokens = _collect_candidate_tokens(caller_token, caller_tokens)
    my_color = None
    token_matched_color = None
    is_host = _is_room_host(
        room,
        caller_tokens=tokens,
        auth_user=auth_user,
        raw_config=raw_config,
        seats=seats,
    )

    user_names = [
        s.get("username")
        for s in seats
        if s.get("player_key") == "HUMAN" and s.get("username")
    ]
    avatars = _load_avatars_by_username(user_names)

    public_seats = []
    used_bot_names = {
        s.get("player_name")
        for s in seats
        if s.get("player_key") != "HUMAN"
        and s.get("player_name") in OFFICIAL_BOT_NAMES
    }
    for seat in seats:
        is_bot = seat["player_key"] != "HUMAN"
        uname = seat.get("username") if not is_bot else None
        seat_kind = (
            "BOT"
            if is_bot
            else (seat.get("seat_kind") or ("USER" if uname else "GUEST"))
        )
        matched_by_token = bool(
            seat.get("seat_token")
            and any(_tokens_equal(seat.get("seat_token"), tok) for tok in tokens)
        )
        matched_by_user = bool(
            auth_user is not None
            and not is_bot
            and seat_kind == "USER"
            and uname == auth_user.username
        )
        is_me = matched_by_token or matched_by_user
        if matched_by_token:
            token_matched_color = seat["color"]
            my_color = seat["color"]
        elif matched_by_user and token_matched_color is None and my_color is None:
            my_color = seat["color"]

        if is_bot:
            raw_name = seat.get("player_name")
            if raw_name in OFFICIAL_BOT_NAMES:
                resolved_name = raw_name
            else:
                resolved_name = pick_bot_names(1, exclude=used_bot_names)[0]
                used_bot_names.add(resolved_name)
            seat_avatar = sanitize_avatar_config(seat.get("avatar_config")) or dict(
                BOT_AVATAR_BY_NAME.get(resolved_name) or {}
            )
        elif seat_kind == "USER" and uname:
            resolved_name = seat["player_name"]
            seat_avatar = avatars.get(uname, {})
        else:
            raw_human_name = str(seat.get("player_name") or "").strip()
            if not seat.get("seat_token") and raw_human_name in LEGACY_OPEN_SEAT_NAMES:
                resolved_name = OPEN_SEAT_NAME
            else:
                resolved_name = raw_human_name or OPEN_SEAT_NAME
            seat_avatar = filter_unlocked_avatar_config(
                seat.get("avatar_config"), wins=0
            )

        public_seats.append(
            {
                "color": seat["color"],
                "player_key": seat["player_key"],
                "player_name": resolved_name,
                "is_bot": is_bot,
                "claimed": bool(seat.get("seat_token")) or is_bot,
                "is_me": is_me,
                "seat_kind": seat_kind,
                "username": uname,
                "avatar_config": seat_avatar,
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
        "avatar_config": sanitize_avatar_config(avatar_cfg),
    }
    if stats is not None:
        payload["stats"] = stats
        payload["leaderboard_rank"] = get_user_rank(user.username)
    return payload


def register_user(
    username: str,
    password: str,
    display_name: str | None = None,
    avatar_config: dict | None = None,
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
    initial_avatar = filter_unlocked_avatar_config(avatar_config, wins=0)
    user = StoredUser(
        username=clean_user,
        display_name=clean_display,
        password_hash=hash_password(raw_password),
        pin_hash="",
        auth_token=secrets.token_hex(16),
        avatar_json=json.dumps(initial_avatar),
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
    if avatar_config is not None:
        if not isinstance(avatar_config, dict):
            abort(400, description="Configuração de avatar inválida.")
        try:
            existing_cfg = sanitize_avatar_config(json.loads(user.avatar_json or "{}"))
        except Exception:
            existing_cfg = {}
        incoming_cfg = sanitize_avatar_config(avatar_config)
        merged_cfg = {**existing_cfg, **incoming_cfg}

        wins = get_user_stats(user.username)["wins"]
        for field, rules in AVATAR_UNLOCK_REQUIREMENTS.items():
            chosen = merged_cfg.get(field)
            if chosen in rules and wins < rules[chosen]:
                required = rules[chosen]
                abort(
                    403,
                    description=(
                        f"Este item requer {required} vitória(s) no Ranking para ser "
                        f"desbloqueado (você tem {wins})."
                    ),
                )
        user.avatar_json = json.dumps(merged_cfg)

    if display_name is not None and str(display_name).strip():
        user.display_name = str(display_name).strip()[:32]
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


def login_with_google_claims(
    claims: dict, avatar_config: dict | None = None
) -> tuple[StoredUser, StoredSession, bool]:
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
    initial_avatar = filter_unlocked_avatar_config(avatar_config, wins=0)
    user = StoredUser(
        username=username,
        display_name=display or username,
        password_hash=None,
        # "" (não None): bancos migrados de versões antigas têm pin_hash NOT NULL
        pin_hash="",
        google_sub=google_sub,
        email=email,
        avatar_json=json.dumps(initial_avatar),
        auth_token=secrets.token_hex(16),
        created_at=int(time.time()),
    )
    session.add(user)
    session.commit()
    sess = create_user_session(username, session)
    return user, sess, True


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
    host_avatar_config: dict | None = None,
    seat_names: list | dict | None = None,
    host_seat_index: int | None = None,
) -> dict[str, dict]:
    """Seat metadata keyed by color.

    ``REGISTRY.build_all`` pairs the i-th spec with the i-th ``Color``, so the
    i-th spec sits on ``SEAT_COLORS[i]``. ``State.__init__`` only shuffles the
    turn order (``state.players``); each player keeps its color, so metadata
    keyed by color stays correct regardless of the shuffle.
    """
    by_color: dict[str, dict] = {}
    parsed_keys = [
        str(spec["key"]).upper()
        if isinstance(spec, dict)
        else str(spec).split(":")[0].upper()
        for spec in player_keys
    ]

    def _requested_name_for(idx: int, color: str) -> str | None:
        if isinstance(seat_names, dict):
            val = seat_names.get(color)
        elif isinstance(seat_names, list) and idx < len(seat_names):
            val = seat_names[idx]
        else:
            val = None
        if val is None:
            return None
        clean = str(val).strip()[:32]
        return clean or None

    explicit_bots, used_bot_names = prescan_requested_bot_names(
        [
            (key, _requested_name_for(idx, SEAT_COLORS[idx]))
            for idx, key in enumerate(parsed_keys)
        ]
    )
    remaining_bots = sum(
        1
        for idx, k in enumerate(parsed_keys)
        if k != "HUMAN" and idx not in explicit_bots
    )
    bot_names_iter = iter(pick_bot_names(remaining_bots, exclude=used_bot_names))

    resolved_host_idx: int | None = None
    if (
        isinstance(host_seat_index, int)
        and 0 <= host_seat_index < len(parsed_keys)
        and parsed_keys[host_seat_index] == "HUMAN"
    ):
        resolved_host_idx = host_seat_index
    else:
        for idx, k in enumerate(parsed_keys):
            if k == "HUMAN":
                resolved_host_idx = idx
                break

    extra_guest_index = 1
    for idx, key in enumerate(parsed_keys):
        color = SEAT_COLORS[idx]
        if key == "HUMAN":
            req_human_name = _requested_name_for(idx, color)
            clean_req_human = (
                req_human_name
                if req_human_name and req_human_name not in LEGACY_OPEN_SEAT_NAMES
                else None
            )
            if idx == resolved_host_idx and auth_user is not None:
                try:
                    user_avatar = sanitize_avatar_config(
                        json.loads(auth_user.avatar_json or "{}")
                    )
                except Exception:
                    user_avatar = {}
                by_color[color] = {
                    "color": color,
                    "seat_kind": "USER",
                    "username": auth_user.username,
                    "player_key": "HUMAN",
                    "display_name": clean_req_human or auth_user.display_name,
                    "avatar_config": user_avatar,
                }
            else:
                if idx == resolved_host_idx:
                    guest_label = (
                        clean_req_human
                        or (host_name or "").strip()[:32]
                        or "Explorador da Ilha"
                    )
                    guest_avatar = filter_unlocked_avatar_config(
                        host_avatar_config, wins=0
                    )
                else:
                    extra_guest_index += 1
                    guest_label = clean_req_human or f"Convidado {extra_guest_index}"
                    guest_avatar = {}
                by_color[color] = {
                    "color": color,
                    "seat_kind": "GUEST",
                    "username": None,
                    "player_key": "HUMAN",
                    "display_name": guest_label,
                    "avatar_config": guest_avatar,
                }
        else:
            bot_name = explicit_bots.get(idx) or next(bot_names_iter)
            by_color[color] = {
                "color": color,
                "seat_kind": "BOT",
                "username": None,
                "player_key": key,
                "display_name": bot_name,
                "avatar_config": dict(BOT_AVATAR_BY_NAME.get(bot_name) or {}),
            }
    return by_color


def _detect_map_template(game: Game) -> str:
    land_tiles = game.state.board.map.land_tiles
    if len(land_tiles) <= 7:
        return "MINI"
    tournament_lands = TOURNAMENT_MAP.land_tiles
    if len(land_tiles) == len(tournament_lands) and all(
        coord in land_tiles
        and land_tiles[coord].resource == ref_tile.resource
        and land_tiles[coord].number == ref_tile.number
        for coord, ref_tile in tournament_lands.items()
    ):
        return "TOURNAMENT"
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
                    "display_name": seat.get("player_name")
                    or COLOR_LABELS_PT.get(c, c),
                }
        except Exception:
            seat_meta = {}

    win_color_str = winner.value
    participants_rows: list[StoredMatchParticipant] = []
    seen_usernames: set[str] = set()
    used_bot_names: set[str] = {
        meta.get("display_name")
        for meta in seat_meta.values()
        if meta.get("seat_kind") == "BOT"
        and not meta.get("taken_over_by_bot")
        and meta.get("display_name") in OFFICIAL_BOT_NAMES
    }
    winner_name = COLOR_LABELS_PT.get(win_color_str, win_color_str)
    winner_username: str | None = None
    winner_is_bot = False
    human_count = 0

    for player in game.state.players:
        c = player.color.value
        meta = seat_meta.get(c, {})
        is_taken_over = bool(meta.get("taken_over_by_bot"))
        is_bot_seat = bool(player.is_bot or is_taken_over)
        key = (
            meta.get("player_key")
            or getattr(player, "registry_key", None)
            or ("HUMAN" if not is_bot_seat else "BOT")
        )
        seat_kind = (
            "BOT"
            if is_taken_over
            else (meta.get("seat_kind") or ("BOT" if is_bot_seat else "GUEST"))
        )
        uname = meta.get("username") if seat_kind == "USER" else None
        if uname and uname in seen_usernames:
            # Garante no máximo uma atribuição por usuário na mesma partida
            uname = None
            seat_kind = "GUEST"
        if uname:
            seen_usernames.add(uname)
        if not is_bot_seat:
            human_count += 1

        if is_bot_seat:
            if is_taken_over:
                orig_label = str(
                    meta.get("original_display_name") or COLOR_LABELS_PT.get(c, c)
                )
                if orig_label.endswith(" (Bot)"):
                    orig_label = orig_label[:-6]
                dname = str(meta.get("display_name") or f"{orig_label[:42]} (Bot)")
            else:
                candidate_name = meta.get("display_name")
                if candidate_name in OFFICIAL_BOT_NAMES:
                    dname = candidate_name
                else:
                    dname = pick_bot_names(1, exclude=used_bot_names)[0]
                    used_bot_names.add(dname)
        else:
            dname = meta.get("display_name") or "Explorador da Ilha"
        vps = int(get_actual_victory_points(game.state, player.color))
        is_win = c == win_color_str
        if is_win:
            winner_name = dname
            winner_username = uname
            winner_is_bot = bool(is_bot_seat)

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

    orig_human_count = sum(
        1
        for meta in seat_meta.values()
        if str(meta.get("original_player_key") or meta.get("player_key") or "")
        == "HUMAN"
    )
    mode = (
        "MULTIPLAYER"
        if (room is not None or max(human_count, orig_human_count) >= 2)
        else "SOLO"
    )
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


def _build_leaderboard_rows() -> list[dict]:
    users = db.session.query(StoredUser).all()
    participants = (
        db.session.query(StoredMatchParticipant).filter_by(seat_kind="USER").all()
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
        win_rate = (
            round((wins / games_played) * 100.0, 1) if games_played > 0 else 0.0
        )
        try:
            avatar_cfg = sanitize_avatar_config(json.loads(u.avatar_json or "{}"))
        except Exception:
            avatar_cfg = {}
        board.append(
            {
                "username": u.username,
                "display_name": u.display_name,
                "avatar_config": avatar_cfg,
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
    for idx, entry in enumerate(board, start=1):
        entry["rank"] = idx
    return board


def get_leaderboard(limit: int = 100) -> list[dict]:
    return _build_leaderboard_rows()[:limit]


def get_user_rank(username: str) -> int | None:
    clean = _normalize_username(username)
    if not clean:
        return None
    for row in _build_leaderboard_rows():
        if row["username"] == clean:
            return int(row["rank"])
    return None


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


def create_room(
    host_name: str = "Anfitrião",
    players: list[str] | None = None,
    map_template: str = "BASE",
    vps_to_win: int = 10,
    discard_limit: int = 7,
    friendly_robber: bool = True,
    host_token: str | None = None,
    host_username: str | None = None,
    host_avatar_config: dict | None = None,
    seats: list[dict] | None = None,
    seat_names: list | dict | None = None,
    bot_difficulty: str | None = None,
    dice_mode: str = "random",
    bot_speed: str = "normal",
) -> tuple[StoredRoom, str]:
    session = db.session
    room_code = _generate_room_code(session)
    resolved_host_token = (host_token or "").strip() or uuid.uuid4().hex

    normalized_diff = normalize_bot_difficulty(bot_difficulty)
    default_bot_key = BOT_DIFFICULTY_TO_KEY[normalized_diff or "medium"]

    initial_specs: list[dict] = []
    if seats and 2 <= len(seats) <= 4:
        for idx, item in enumerate(seats):
            if not isinstance(item, dict):
                continue
            raw_key = str(item.get("player_key") or "HUMAN").strip() or "HUMAN"
            if raw_key != "HUMAN" and normalized_diff is not None and item.get("use_room_difficulty"):
                raw_key = default_bot_key
            initial_specs.append(
                {
                    "player_key": raw_key,
                    "player_name": (
                        str(item.get("player_name")).strip()[:32]
                        if item.get("player_name") is not None
                        else None
                    ),
                    "is_host": bool(item.get("is_host")),
                }
            )
    if not 2 <= len(initial_specs) <= 4:
        fallback_keys = (
            players
            if players and 2 <= len(players) <= 4
            else ["HUMAN", "HUMAN", default_bot_key, default_bot_key]
        )
        for idx, p_key in enumerate(fallback_keys):
            color = SEAT_COLORS[idx]
            req_name = None
            if isinstance(seat_names, dict):
                req_name = seat_names.get(color)
            elif isinstance(seat_names, list) and idx < len(seat_names):
                req_name = seat_names[idx]
            initial_specs.append(
                {
                    "player_key": str(p_key),
                    "player_name": (
                        str(req_name).strip()[:32] if req_name is not None else None
                    ),
                    "is_host": False,
                }
            )

    host_idx = next(
        (
            idx
            for idx, sp in enumerate(initial_specs)
            if sp["player_key"] == "HUMAN" and sp.get("is_host")
        ),
        None,
    )
    if host_idx is None:
        host_idx = next(
            (idx for idx, sp in enumerate(initial_specs) if sp["player_key"] == "HUMAN"),
            0,
        )
    if initial_specs[host_idx]["player_key"] != "HUMAN":
        initial_specs[host_idx]["player_key"] = "HUMAN"

    explicit_bots, used_bot_names = prescan_requested_bot_names(
        [(sp["player_key"], sp.get("player_name")) for sp in initial_specs]
    )
    remaining_bots = sum(
        1
        for idx, sp in enumerate(initial_specs)
        if sp["player_key"] != "HUMAN" and idx not in explicit_bots
    )
    bot_names_iter = iter(pick_bot_names(remaining_bots, exclude=used_bot_names))

    safe_guest_avatar = (
        {} if host_username else filter_unlocked_avatar_config(host_avatar_config, wins=0)
    )
    resolved_seats = []
    first_bot_key: str | None = None
    for idx, sp in enumerate(initial_specs):
        color = SEAT_COLORS[idx]
        p_key = sp["player_key"]
        if p_key == "HUMAN" and idx == host_idx:
            resolved_seats.append(
                {
                    "color": color,
                    "player_key": "HUMAN",
                    "player_name": host_name.strip() or "Anfitrião",
                    "seat_token": resolved_host_token,
                    "seat_kind": "USER" if host_username else "GUEST",
                    "username": host_username,
                    "avatar_config": safe_guest_avatar,
                }
            )
        elif p_key == "HUMAN":
            resolved_seats.append(
                {
                    "color": color,
                    "player_key": "HUMAN",
                    "player_name": OPEN_SEAT_NAME,
                    "seat_token": None,
                    "seat_kind": "GUEST",
                    "username": None,
                    "avatar_config": {},
                }
            )
        else:
            if first_bot_key is None:
                first_bot_key = p_key
            bot_name = explicit_bots.get(idx) or next(bot_names_iter)
            resolved_seats.append(
                {
                    "color": color,
                    "player_key": p_key,
                    "player_name": bot_name,
                    "seat_token": None,
                    "seat_kind": "BOT",
                    "username": None,
                    "avatar_config": dict(BOT_AVATAR_BY_NAME.get(bot_name) or {}),
                }
            )

    resolved_difficulty = normalized_diff or (
        infer_bot_difficulty_from_key(first_bot_key) if first_bot_key else "medium"
    )
    resolved_dice_mode = dice_mode if dice_mode in VALID_DICE_MODES else "random"
    resolved_bot_speed = normalize_bot_speed(bot_speed) or "normal"
    config = {
        "map_template": map_template,
        "vps_to_win": vps_to_win,
        "discard_limit": discard_limit,
        "friendly_robber": friendly_robber,
        "bot_difficulty": resolved_difficulty,
        "bot_speed": resolved_bot_speed,
        "dice_mode": resolved_dice_mode,
        "created_at": int(time.time()),
    }
    if host_username:
        config["host_username"] = host_username

    room = StoredRoom(
        room_code=room_code,
        host_token=resolved_host_token,
        status="WAITING",
        config_json=json.dumps(config),
        seats_json=json.dumps(resolved_seats),
        game_id=None,
    )
    session.add(room)
    session.commit()
    return room, resolved_host_token


def close_room(
    room_code: str,
    caller_tokens: list[str] | tuple[str, ...] | set[str] | None = None,
    auth_user: StoredUser | None = None,
) -> dict:
    code = (room_code or "").strip().upper()
    room = db.session.get(StoredRoom, code)
    if room is None:
        abort(404, description="Sala não encontrada")
    if not _is_room_host(room, caller_tokens=caller_tokens, auth_user=auth_user):
        abort(403, description="Apenas o anfitrião pode encerrar esta sala.")

    closed_game_id = room.game_id
    db.session.delete(room)
    db.session.commit()
    return {
        "closed": True,
        "room_code": code,
        "game_id": closed_game_id,
    }


def leave_room(
    room_code: str,
    caller_tokens: list[str] | tuple[str, ...] | set[str] | None = None,
    auth_user: StoredUser | None = None,
) -> dict:
    code = (room_code or "").strip().upper()
    room = db.session.get(StoredRoom, code)
    if room is None:
        abort(404, description="Sala não encontrada")
    if room.status != "WAITING":
        abort(
            400,
            description="A partida já foi iniciada. Peça ao anfitrião para encerrar a sala ou use Sair (Bot Assume) na mesa.",
        )

    tokens = _collect_candidate_tokens(caller_tokens=caller_tokens)
    if _is_room_host(room, caller_tokens=tokens, auth_user=auth_user):
        abort(
            400,
            description="Você é o anfitrião desta sala. Use Encerrar Sala para fechá-la.",
        )

    seats = json.loads(room.seats_json)
    released = False
    for seat in seats:
        if seat.get("player_key") != "HUMAN":
            continue
        seat_tok = seat.get("seat_token")
        tok_match = bool(seat_tok and any(_tokens_equal(seat_tok, tok) for tok in tokens))
        user_match = bool(
            auth_user is not None
            and seat.get("seat_kind") == "USER"
            and seat.get("username") == auth_user.username
        )
        if tok_match or user_match:
            seat["seat_token"] = None
            seat["player_name"] = OPEN_SEAT_NAME
            seat["seat_kind"] = "GUEST"
            seat["username"] = None
            seat["avatar_config"] = {}
            released = True

    if not released:
        abort(403, description="Você não ocupa nenhum assento nesta sala.")

    room.seats_json = json.dumps(seats)
    db.session.commit()
    return {
        "left": True,
        "room": serialize_room(room, auth_user=auth_user, caller_tokens=tokens),
    }


def list_active_rooms(
    caller_token: str | None = None,
    limit: int = 20,
    auth_user: StoredUser | None = None,
    caller_tokens_by_room: dict[str, str] | None = None,
) -> list[dict]:
    session = db.session
    rooms = session.query(StoredRoom).limit(60).all()
    active_candidates = [r for r in rooms if r.status != "CLOSED"]

    game_ids = [r.game_id for r in active_candidates if r.game_id]
    finished_game_ids: set[str] = set()
    if game_ids:
        finished_game_ids = {
            row.game_id
            for row in session.query(StoredMatch.game_id)
            .filter(StoredMatch.game_id.in_(game_ids))
            .all()
        }
        remaining_ids = [gid for gid in game_ids if gid not in finished_game_ids]
        if remaining_ids:
            stored_games = (
                session.query(StoredGame)
                .filter(StoredGame.uuid.in_(remaining_ids))
                .all()
            )
            for sg in stored_games:
                if _stored_game_is_finished(sg):
                    finished_game_ids.add(sg.uuid)

    tokens_map = caller_tokens_by_room or {}
    serialized = []
    for r in active_candidates:
        if r.game_id and r.game_id in finished_game_ids:
            continue
        room_tok = tokens_map.get(r.room_code)
        extra_tokens = [room_tok] if room_tok else None
        serialized.append(
            serialize_room(
                r,
                caller_token=caller_token,
                auth_user=auth_user,
                caller_tokens=extra_tokens,
            )
        )

    # Sort so host/seated rooms come first, then WAITING rooms, then newest created_at
    serialized.sort(
        key=lambda item: (
            1 if (item.get("is_host") or item.get("my_color")) else 0,
            1 if item.get("status") == "WAITING" else 0,
            int(item.get("config", {}).get("created_at", 0)),
        ),
        reverse=True,
    )
    return serialized[:limit]


def get_room_by_game_id(game_id: str) -> StoredRoom | None:
    session = db.session
    return session.query(StoredRoom).filter_by(game_id=game_id).first()


def serialize_game_message(msg: StoredGameMessage) -> dict:
    return {
        "id": int(msg.id),
        "game_id": msg.game_id,
        "color": msg.color,
        "sender_name": msg.sender_name,
        "kind": msg.kind or "CHAT",
        "body": msg.body,
        "created_at": int(msg.created_at),
    }


def list_game_messages(
    game_id: str, after_id: int = 0, limit: int = 100
) -> list[dict]:
    safe_after = max(0, int(after_id or 0))
    safe_limit = min(max(1, int(limit or 100)), 200)
    rows = (
        db.session.query(StoredGameMessage)
        .filter(
            StoredGameMessage.game_id == game_id,
            StoredGameMessage.id > safe_after,
        )
        .order_by(StoredGameMessage.id.asc())
        .limit(safe_limit)
        .all()
    )
    return [serialize_game_message(row) for row in rows]


def create_game_message(
    game_id: str,
    color: str,
    sender_name: str,
    body: str,
    kind: str = "CHAT",
) -> dict:
    clean_kind = str(kind or "CHAT").strip().upper()
    if clean_kind not in ("CHAT", "TAUNT"):
        clean_kind = "CHAT"
    clean_color = str(color or "RED").strip().upper()[:16]
    clean_sender = (
        str(sender_name or "").strip()
        or COLOR_LABELS_PT.get(clean_color, clean_color)
    )[:64]
    clean_body = str(body or "").strip()[:240]
    row = StoredGameMessage(
        game_id=game_id,
        color=clean_color,
        sender_name=clean_sender,
        kind=clean_kind,
        body=clean_body,
        created_at=int(time.time()),
    )
    db.session.add(row)
    db.session.commit()
    return serialize_game_message(row)
