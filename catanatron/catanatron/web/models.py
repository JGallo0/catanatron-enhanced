"""Persisting games as a document plus what happened to it, plus multiplayer rooms."""

import json
import os
import random
import string
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
from catanatron.state_functions import get_state_index
from sqlalchemy import Column, ForeignKey, Integer, MetaData, String, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session
from flask_sqlalchemy import SQLAlchemy
from flask import abort

metadata = MetaData()
Base = declarative_base(metadata=metadata)

SEAT_COLORS = ["RED", "BLUE", "ORANGE", "WHITE"]


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


def create_room(
    host_name: str = "Anfitrião",
    players: list[str] | None = None,
    map_template: str = "BASE",
    vps_to_win: int = 10,
    discard_limit: int = 7,
    friendly_robber: bool = True,
) -> tuple[StoredRoom, str]:
    session = db.session
    room_code = _generate_room_code(session)
    host_token = uuid.uuid4().hex

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
                    "seat_token": host_token,
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
    }

    room = StoredRoom(
        room_code=room_code,
        host_token=host_token,
        status="WAITING",
        config_json=json.dumps(config),
        seats_json=json.dumps(seats),
        game_id=None,
    )
    session.add(room)
    session.commit()
    return room, host_token


def get_room_by_game_id(game_id: str) -> StoredRoom | None:
    session = db.session
    return session.query(StoredRoom).filter_by(game_id=game_id).first()
