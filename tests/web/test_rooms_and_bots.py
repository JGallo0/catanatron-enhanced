import filecmp
import os
import tempfile

import pytest

from catanatron.models.player import Color
from catanatron.web import _load_dotenv_files, create_app
from catanatron.web.models import (
    BOT_AVATAR_BY_NAME,
    OFFICIAL_BOT_NAMES,
    db,
    get_game_state,
    record_completed_match,
    upsert_game_state,
)


COLOR_NAMES = {"Vermelho", "Azul", "Laranja", "Branco", "RED", "BLUE", "ORANGE", "WHITE"}


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


@pytest.fixture
def client(app):
    return app.test_client()


def test_coop_headers_and_google_env_aliases(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "alias-client.apps.googleusercontent.com")

    res = client.get("/api/auth/config")
    assert res.status_code == 200
    assert res.headers.get("Cross-Origin-Opener-Policy") == "same-origin-allow-popups"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert res.get_json() == {
        "google_enabled": True,
        "google_client_id": "alias-client.apps.googleusercontent.com",
    }

    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_ID", raising=False)
    monkeypatch.setenv("VITE_GOOGLE_CLIENT_ID", "vite-client.apps.googleusercontent.com")
    res2 = client.get("/api/auth/config")
    assert res2.get_json() == {
        "google_enabled": True,
        "google_client_id": "vite-client.apps.googleusercontent.com",
    }


def test_dotenv_autoload_respects_existing_env_vars(monkeypatch):
    with tempfile.TemporaryDirectory() as tmpdir:
        env_local = os.path.join(tmpdir, ".env.local")
        with open(env_local, "w", encoding="utf-8") as fh:
            fh.write(
                'GOOGLE_CLIENT_ID="from-dotenv.apps.googleusercontent.com"\n'
                "EXISTING_VAR=should-not-overwrite\n"
            )
        monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
        monkeypatch.setenv("EXISTING_VAR", "already-set")

        _load_dotenv_files([tmpdir])

        assert os.environ["GOOGLE_CLIENT_ID"] == "from-dotenv.apps.googleusercontent.com"
        assert os.environ["EXISTING_VAR"] == "already-set"


def test_register_and_google_carry_unlocked_guest_avatar_safely(client, monkeypatch):
    # Register carrying valid + locked items -> locked fields stripped silently, signup succeeds!
    reg = client.post(
        "/api/auth/register",
        json={
            "username": "marina",
            "password": "pw_marina_1",
            "display_name": "Marina",
            "avatar_config": {
                "skin": "warm",
                "hat": "explorer",
                "frame": "imperial",  # requires 10 wins -> stripped safely on signup
                "background": "ocean",
            },
        },
    )
    assert reg.status_code == 200
    avatar = reg.get_json()["avatar_config"]
    assert avatar["hat"] == "explorer"
    assert avatar["background"] == "ocean"
    assert "frame" not in avatar

    # Google first login carries unlocked items; subsequent login preserves saved user avatar
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    import catanatron.web.api as api_mod

    monkeypatch.setattr(
        api_mod,
        "_verify_google_id_token",
        lambda credential, client_id: {
            "sub": "google-sub-avatar-1",
            "email": "rafael@gmail.com",
            "name": "Rafael",
            "email_verified": True,
        },
    )
    g1 = client.post(
        "/api/auth/google",
        json={
            "credential": "fake-jwt",
            "avatar_config": {
                "skin": "tan",
                "hair": "wavy",
                "hat": "crown_gold",  # locked -> stripped
                "frame": "wood",
            },
        },
    )
    assert g1.status_code == 200
    g1_data = g1.get_json()
    assert g1_data["avatar_config"]["hair"] == "wavy"
    assert g1_data["avatar_config"]["frame"] == "wood"
    assert "hat" not in g1_data["avatar_config"]

    # Second Google login must NOT overwrite stored user avatar with guest config
    g2 = client.post(
        "/api/auth/google",
        json={
            "credential": "fake-jwt",
            "avatar_config": {"hair": "none", "frame": "wood"},
        },
    )
    assert g2.status_code == 200
    assert g2.get_json()["avatar_config"]["hair"] == "wavy"


def test_solo_game_uses_official_unique_bot_names_and_guest_avatar(app, client):
    guest_avatar = {
        "skin": "fair",
        "hair": "braids",
        "hat": "bandana",
        "outfit": "settler",
        "outfitColor": "emerald",
        "background": "forest",
        "frame": "wood",
    }
    res = client.post(
        "/api/games",
        json={
            "players": ["HUMAN", "CATANATRON", "W", "R"],
            "host_name": "Visitante Alfa",
            "avatar_config": guest_avatar,
        },
    )
    assert res.status_code == 200
    game_id = res.get_json()["game_id"]

    view = client.get(f"/api/games/{game_id}/states/latest").get_json()
    assert view["seat_names"]["RED"] == "Visitante Alfa"
    assert view["seat_avatars"]["RED"]["seat_kind"] == "GUEST"
    assert view["seat_avatars"]["RED"]["avatar_config"]["hat"] == "bandana"

    bot_names = [view["seat_names"][c] for c in ("BLUE", "ORANGE", "WHITE")]
    assert len(set(bot_names)) == 3
    for color, name in zip(("BLUE", "ORANGE", "WHITE"), bot_names):
        assert name in OFFICIAL_BOT_NAMES
        assert name not in COLOR_NAMES
        assert "IA (" not in name and "Bot (" not in name
        assert view["seat_avatars"][color]["seat_kind"] == "BOT"
        assert view["seat_avatars"][color]["avatar_config"] == BOT_AVATAR_BY_NAME[name]

    # Completed match history preserves official bot names too
    with app.app_context():
        game = get_game_state(game_id)
        idx = game.state.color_to_index[Color.BLUE]
        game.state.player_state[f"P{idx}_ACTUAL_VICTORY_POINTS"] = game.vps_to_win
        game.state.player_state[f"P{idx}_VICTORY_POINTS"] = game.vps_to_win
        upsert_game_state(game)
        record_completed_match(game)

    matches = client.get("/api/matches").get_json()["matches"]
    assert matches[0]["winner_is_bot"] is True
    assert matches[0]["winner_name"] in OFFICIAL_BOT_NAMES
    assert matches[0]["winner_name"] not in COLOR_NAMES


def test_multiplayer_rooms_official_bot_names_and_guest_avatars(client):
    create_res = client.post(
        "/api/rooms",
        json={
            "host_name": "Capitão Visitante",
            "players": ["HUMAN", "HUMAN", "CATANATRON", "W"],
            "avatar_config": {"skin": "warm", "hat": "captain", "frame": "wood"},
        },
    )
    assert create_res.status_code == 200
    room_payload = create_res.get_json()
    code = room_payload["room_code"]
    seats = room_payload["room"]["seats"]

    bot_seats = [s for s in seats if s["is_bot"]]
    assert len(bot_seats) == 2
    assert len({s["player_name"] for s in bot_seats}) == 2
    for s in bot_seats:
        assert s["player_name"] in OFFICIAL_BOT_NAMES
        assert s["avatar_config"] == BOT_AVATAR_BY_NAME[s["player_name"]]

    red_seat = next(s for s in seats if s["color"] == "RED")
    assert red_seat["seat_kind"] == "GUEST"
    assert red_seat["avatar_config"]["hat"] == "captain"

    # Second guest joins with their own interactive SVG avatar
    join_res = client.post(
        f"/api/rooms/{code}/join",
        json={
            "player_name": "Convidada Bia",
            "avatar_config": {"skin": "deep", "hat": "explorer", "frame": "wood"},
        },
    )
    assert join_res.status_code == 200
    joined_seats = join_res.get_json()["room"]["seats"]
    blue_seat = next(s for s in joined_seats if s["color"] == "BLUE")
    assert blue_seat["seat_kind"] == "GUEST"
    assert blue_seat["avatar_config"]["hat"] == "explorer"

    # Patching room preserves official bot names and never introduces "Bot (...)"
    patch_res = client.patch(
        f"/api/rooms/{code}",
        json={
            "token": room_payload["seat_token"],
            "seats": [
                {"player_key": "HUMAN"},
                {"player_key": "CATANATRON"},
                {"player_key": "W"},
                {"player_key": "AB"},
            ],
        },
    )
    assert patch_res.status_code == 200
    patched_bots = [s for s in patch_res.get_json()["seats"] if s["is_bot"]]
    assert len(patched_bots) == 3
    assert len({s["player_name"] for s in patched_bots}) == 3
    assert all(s["player_name"] in OFFICIAL_BOT_NAMES for s in patched_bots)

    # Start room -> live state view inherits guest & bot avatars
    started = client.post(
        f"/api/rooms/{code}/start",
        json={"token": room_payload["seat_token"]},
    ).get_json()
    state_view = client.get(f"/api/games/{started['game_id']}/states/latest").get_json()
    assert state_view["seat_avatars"]["RED"]["avatar_config"]["hat"] == "captain"
    for b in patched_bots:
        assert state_view["seat_names"][b["color"]] == b["player_name"]
        assert (
            state_view["seat_avatars"][b["color"]]["avatar_config"]
            == BOT_AVATAR_BY_NAME[b["player_name"]]
        )


def test_vercel_api_catanatron_mirrors_core_package():
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    core_dir = os.path.join(root, "catanatron", "catanatron")
    api_dir = os.path.join(root, "api", "catanatron")

    def _assert_tree_equal(dcmp):
        # Ignore bytecode caches and markdown readmes
        relevant_left_only = [f for f in dcmp.left_only if f != "__pycache__"]
        relevant_right_only = [f for f in dcmp.right_only if f != "__pycache__"]
        relevant_diff = [f for f in dcmp.diff_files if not f.endswith(".pyc")]
        assert not relevant_left_only, f"Missing in api/catanatron ({dcmp.left}): {relevant_left_only}"
        assert not relevant_right_only, f"Extra in api/catanatron ({dcmp.right}): {relevant_right_only}"
        assert not relevant_diff, f"Out of sync between catanatron/ and api/catanatron/: {relevant_diff}"
        for sub_name, sub_dcmp in dcmp.subdirs.items():
            if sub_name == "__pycache__":
                continue
            _assert_tree_equal(sub_dcmp)

    _assert_tree_equal(filecmp.dircmp(core_dir, api_dir))
