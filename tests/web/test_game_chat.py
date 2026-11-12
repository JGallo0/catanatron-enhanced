import os
import pytest

from catanatron.web import create_app
from catanatron.web.models import db


@pytest.fixture
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": os.environ.get(
                "CATANATRON_TEST_DATABASE_URL", "sqlite:///:memory:"
            ),
            "SECRET_KEY": "test-game-chat",
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


def test_solo_game_chat_post_and_incremental_fetch(client):
    game_res = client.post(
        "/api/games",
        json={"players": ["HUMAN", "CATANATRON"], "host_name": "Ana"},
    )
    assert game_res.status_code == 200
    game_id = game_res.get_json()["game_id"]

    empty_res = client.get(f"/api/games/{game_id}/messages")
    assert empty_res.status_code == 200
    assert empty_res.get_json()["messages"] == []

    bad_empty = client.post(f"/api/games/{game_id}/messages", json={"body": "   "})
    assert bad_empty.status_code == 400

    bad_long = client.post(f"/api/games/{game_id}/messages", json={"body": "x" * 241})
    assert bad_long.status_code == 400

    post_1 = client.post(
        f"/api/games/{game_id}/messages",
        json={"body": "Boa sorte!", "color": "RED"},
    )
    assert post_1.status_code == 201
    msg_1 = post_1.get_json()["message"]
    assert msg_1["sender_name"] == "Ana"
    assert msg_1["color"] == "RED"
    assert msg_1["kind"] == "CHAT"
    assert msg_1["body"] == "Boa sorte!"

    post_2 = client.post(
        f"/api/games/{game_id}/messages",
        json={"body": "Vamos trocar madeira?", "color": "RED"},
    )
    assert post_2.status_code == 201
    msg_2 = post_2.get_json()["message"]
    assert msg_2["id"] > msg_1["id"]

    inc = client.get(f"/api/games/{game_id}/messages?after_id={msg_1['id']}")
    assert inc.status_code == 200
    msgs = inc.get_json()["messages"]
    assert len(msgs) == 1
    assert msgs[0]["id"] == msg_2["id"]
    assert msgs[0]["body"] == "Vamos trocar madeira?"


def test_multiplayer_room_chat_authorizes_seat_tokens_and_blocks_spoofing(client):
    room_res = client.post(
        "/api/rooms",
        json={"host_name": "João", "players": ["HUMAN", "HUMAN"]},
    )
    room_data = room_res.get_json()
    code = room_data["room_code"]
    host_token = room_data["seat_token"]

    join_res = client.post(
        f"/api/rooms/{code}/join",
        json={"player_name": "Clara"},
    )
    guest_token = join_res.get_json()["seat_token"]

    start_res = client.post(f"/api/rooms/{code}/start", json={"token": host_token})
    game_id = start_res.get_json()["game_id"]

    # Unauthenticated stranger cannot post
    unauth = client.post(
        f"/api/games/{game_id}/messages",
        json={"body": "Intruso", "color": "RED"},
    )
    assert unauth.status_code == 403

    # Guest cannot impersonate host's RED seat
    spoof = client.post(
        f"/api/games/{game_id}/messages",
        json={"body": "Sou o host!", "color": "RED"},
        headers={"X-Seat-Token": guest_token},
    )
    assert spoof.status_code == 403

    # Host posts cleanly as RED, guest posts cleanly as BLUE
    m_host = client.post(
        f"/api/games/{game_id}/messages",
        json={"body": "Olá Clara!"},
        headers={"X-Seat-Token": host_token},
    )
    assert m_host.status_code == 201
    assert m_host.get_json()["message"]["color"] == "RED"
    assert m_host.get_json()["message"]["sender_name"] == "João"

    m_guest = client.post(
        f"/api/games/{game_id}/messages",
        json={"body": "Bela rolagem!", "kind": "TAUNT"},
        headers={"X-Seat-Token": guest_token},
    )
    assert m_guest.status_code == 201
    assert m_guest.get_json()["message"]["color"] == "BLUE"
    assert m_guest.get_json()["message"]["sender_name"] == "Clara"
    assert m_guest.get_json()["message"]["kind"] == "TAUNT"

    list_res = client.get(f"/api/games/{game_id}/messages")
    assert list_res.status_code == 200
    assert [m["sender_name"] for m in list_res.get_json()["messages"]] == [
        "João",
        "Clara",
    ]
