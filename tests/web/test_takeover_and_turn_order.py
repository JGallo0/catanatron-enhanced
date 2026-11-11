import json
import os
import pytest

from catanatron.models.player import Color
from catanatron.web import create_app
from catanatron.web.models import (
    StoredGame,
    StoredMatchParticipant,
    db,
    get_game_state,
    get_user_stats,
    maybe_promote_disconnected_seats,
    promote_seat_to_bot,
    reclaim_seat_from_bot,
    record_completed_match,
    touch_seat_heartbeat,
)


@pytest.fixture
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": os.environ.get(
                "CATANATRON_TEST_DATABASE_URL", "sqlite:///:memory:"
            ),
            "SECRET_KEY": "test-bloco5",
        }
    )
    with app.app_context():
        db.create_all()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def test_solo_game_never_auto_promotes_on_timeout(client):
    res = client.post(
        "/api/games",
        json={"players": ["HUMAN", "CATANATRON"], "host_name": "SoloPlayer"},
    )
    game_id = res.get_json()["game_id"]

    with client.application.app_context():
        import time

        future = int(time.time()) + 300
        promoted = maybe_promote_disconnected_seats(game_id, now=future)
        assert promoted == []
        game = get_game_state(game_id)
        assert [p.is_bot for p in game.state.players].count(False) == 1


def test_multiplayer_timeout_promotes_absent_peer_but_never_last_live_human(client):
    room_res = client.post(
        "/api/rooms",
        json={"host_name": "Ana", "players": ["HUMAN", "HUMAN"]},
    )
    room_data = room_res.get_json()
    code = room_data["room_code"]
    ana_token = room_data["seat_token"]

    join_res = client.post(
        f"/api/rooms/{code}/join",
        json={"player_name": "Beto"},
    )
    beto_token = join_res.get_json()["seat_token"]
    assert beto_token

    start_res = client.post(
        f"/api/rooms/{code}/start",
        json={"token": ana_token},
    )
    game_id = start_res.get_json()["game_id"]

    with client.application.app_context():
        import time

        t0 = int(time.time()) + 10
        assert touch_seat_heartbeat(game_id, "RED", now=t0) is True
        assert touch_seat_heartbeat(game_id, "BLUE", now=t0) is True

        # Only RED stays alive; BLUE expires (+50s)
        t_ana_only = t0 + 50
        assert touch_seat_heartbeat(game_id, "RED", now=t_ana_only) is True
        promoted = maybe_promote_disconnected_seats(game_id, now=t_ana_only)
        assert promoted == ["BLUE"]

        stored = db.session.get(StoredGame, game_id)
        meta = json.loads(stored.seat_metadata_json)
        assert meta["BLUE"]["taken_over_by_bot"] is True
        assert meta["BLUE"]["takeover_reason"] == "DISCONNECTED"
        assert meta["BLUE"]["display_name"] == "Beto (Bot)"

        game = get_game_state(game_id)
        blue_player = next(p for p in game.state.players if p.color == Color.BLUE)
        assert blue_player.is_bot is True

        # Now RED also expires (+120s), leaving zero live humans -> must NOT promote last human!
        promoted_last = maybe_promote_disconnected_seats(game_id, now=t_ana_only + 120)
        assert promoted_last == []
        game_still = get_game_state(game_id)
        red_player = next(p for p in game_still.state.players if p.color == Color.RED)
        assert red_player.is_bot is False

        # BLUE reclaims seat -> returns to HUMAN with original name
        assert reclaim_seat_from_bot(game_id, "BLUE", now=t_ana_only + 130) is True
        reclaimed_game = get_game_state(game_id)
        blue_human = next(
            p for p in reclaimed_game.state.players if p.color == Color.BLUE
        )
        assert blue_human.is_bot is False
        meta_after = json.loads(db.session.get(StoredGame, game_id).seat_metadata_json)
        assert meta_after["BLUE"]["taken_over_by_bot"] is False
        assert meta_after["BLUE"]["display_name"] == "Beto"


def test_abandoned_taken_over_user_gets_no_ranking_credit_unless_reclaimed(client):
    u1 = client.post(
        "/api/auth/register",
        json={"username": "carlos", "password": "pw1234", "display_name": "Carlos"},
    ).get_json()
    u2 = client.post(
        "/api/auth/register",
        json={"username": "diana", "password": "pw1234", "display_name": "Diana"},
    ).get_json()

    room = client.post(
        "/api/rooms",
        json={"host_name": "Carlos", "players": ["HUMAN", "HUMAN"]},
        headers={"Authorization": f"Bearer {u1['auth_token']}"},
    ).get_json()
    code = room["room_code"]
    client.post(
        f"/api/rooms/{code}/join",
        json={"player_name": "Diana"},
        headers={"Authorization": f"Bearer {u2['auth_token']}"},
    )
    game_id = client.post(
        f"/api/rooms/{code}/start",
        json={"token": room["seat_token"]},
    ).get_json()["game_id"]

    with client.application.app_context():
        assert promote_seat_to_bot(game_id, "BLUE", reason="ABANDONED") is True
        game = get_game_state(game_id)
        # Force BLUE victory under bot takeover
        blue_idx = game.state.color_to_index[Color.BLUE]
        game.state.player_state[f"P{blue_idx}_ACTUAL_VICTORY_POINTS"] = 10
        assert game.winning_color() == Color.BLUE

        match = record_completed_match(game)
        assert match is not None
        assert match.winner_is_bot is True
        assert match.winner_username is None
        assert match.winner_name == "Diana (Bot)"
        assert match.mode == "MULTIPLAYER"

        diana_part = (
            db.session.query(StoredMatchParticipant)
            .filter_by(game_id=game_id, color="BLUE")
            .one()
        )
        assert diana_part.seat_kind == "BOT"
        assert diana_part.username is None
        assert diana_part.display_name == "Diana (Bot)"
        assert get_user_stats("diana")["wins"] == 0
        assert get_user_stats("carlos")["games_played"] == 1
