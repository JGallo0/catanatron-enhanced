import filecmp
import os
import tempfile

import pytest

from catanatron.models.player import Color
from catanatron.web import _load_dotenv_files, create_app
from catanatron.web.models import (
    BOT_AVATAR_BY_NAME,
    BOT_DIFFICULTY_TO_KEY,
    OFFICIAL_BOT_NAMES,
    OPEN_SEAT_NAME,
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


def test_room_close_leave_ownership_and_finished_filtering(app, client):
    import json
    from catanatron.web.models import StoredRoom

    # 1. Guest host creates two rooms: closes WAITING with DELETE and IN_PROGRESS with POST /close
    waiting_res = client.post(
        "/api/rooms",
        json={"host_name": "Visitante", "players": ["HUMAN", "HUMAN", "CATANATRON", "W"]},
    ).get_json()
    w_code = waiting_res["room_code"]
    w_tok = waiting_res["seat_token"]

    guest_join = client.post(
        f"/api/rooms/{w_code}/join",
        json={"player_name": "Convidado Azul"},
    )
    assert guest_join.status_code == 200
    g_tok = guest_join.get_json()["seat_token"]

    # Non-host gets 403 on DELETE and POST /close
    forbidden_del = client.delete(f"/api/rooms/{w_code}", headers={"X-Seat-Token": g_tok})
    assert forbidden_del.status_code == 403
    forbidden_post = client.post(
        f"/api/rooms/{w_code}/close", json={"token": g_tok}
    )
    assert forbidden_post.status_code == 403

    # Non-host leaves WAITING room cleanly
    left = client.post(f"/api/rooms/{w_code}/leave", json={"token": g_tok})
    assert left.status_code == 200
    assert left.get_json()["left"] is True
    assert left.get_json()["room"]["my_color"] is None

    # X-Room-Tokens identifies guest host in GET /api/rooms
    listed = client.get(
        "/api/rooms",
        headers={"X-Room-Tokens": json.dumps({w_code: w_tok})},
    ).get_json()["rooms"]
    assert listed[0]["room_code"] == w_code
    assert listed[0]["is_host"] is True

    # Host closes WAITING room via DELETE
    closed_w = client.delete(f"/api/rooms/{w_code}", headers={"X-Seat-Token": w_tok})
    assert closed_w.status_code == 200
    assert closed_w.get_json() == {"closed": True, "room_code": w_code, "game_id": None}
    assert client.get(f"/api/rooms/{w_code}").status_code == 404

    # Started room (IN_PROGRESS) can be closed via POST /close without deleting game state
    started_res = client.post(
        "/api/rooms",
        json={"host_name": "Visitante", "players": ["HUMAN", "HUMAN", "CATANATRON", "W"]},
    ).get_json()
    s_code = started_res["room_code"]
    s_tok = started_res["seat_token"]
    started = client.post(
        f"/api/rooms/{s_code}/start", json={"token": s_tok}
    ).get_json()
    s_game_id = started["game_id"]

    closed_s = client.post(f"/api/rooms/{s_code}/close", json={"token": s_tok})
    assert closed_s.status_code == 200
    assert closed_s.get_json() == {
        "closed": True,
        "room_code": s_code,
        "game_id": s_game_id,
    }
    assert client.get("/api/rooms").get_json()["rooms"] == []
    assert client.get(f"/api/games/{s_game_id}/states/latest").status_code == 200

    # 2. Logged-in host keeps ownership after session renewal & for legacy rows without host_username
    reg = client.post(
        "/api/auth/register",
        json={"username": "joao", "password": "pw_joao_1", "display_name": "João"},
    ).get_json()
    tok_1 = reg["auth_token"]

    owned = client.post(
        "/api/rooms",
        headers={"Authorization": f"Bearer {tok_1}"},
        json={"host_name": "João", "players": ["HUMAN", "HUMAN", "CATANATRON", "W"]},
    ).get_json()
    o_code = owned["room_code"]

    # New login issues fresh session token tok_2
    client.post("/api/auth/logout", headers={"Authorization": f"Bearer {tok_1}"})
    relogin = client.post(
        "/api/auth/login",
        json={"username": "joao", "password": "pw_joao_1"},
    ).get_json()
    tok_2 = relogin["auth_token"]
    assert tok_2 != tok_1

    rooms_relogin = client.get(
        "/api/rooms", headers={"Authorization": f"Bearer {tok_2}"}
    ).get_json()["rooms"]
    assert rooms_relogin[0]["room_code"] == o_code
    assert rooms_relogin[0]["is_host"] is True
    assert rooms_relogin[0]["my_color"] == "RED"

    assert (
        client.delete(
            f"/api/rooms/{o_code}",
            headers={"Authorization": f"Bearer {tok_2}"},
        ).status_code
        == 200
    )

    # Legacy room missing host_username in config_json still grants close via host seat username
    with app.app_context():
        db.session.add(
            StoredRoom(
                room_code="LEG123",
                host_token="legacy_dead_tok",
                status="IN_PROGRESS",
                config_json=json.dumps(
                    {
                        "map_template": "BASE",
                        "vps_to_win": 10,
                        "discard_limit": 7,
                        "friendly_robber": True,
                    }
                ),
                seats_json=json.dumps(
                    [
                        {
                            "color": "RED",
                            "player_key": "HUMAN",
                            "player_name": "João",
                            "seat_token": "legacy_dead_tok",
                            "seat_kind": "USER",
                            "username": "joao",
                            "avatar_config": {},
                        }
                    ]
                ),
                game_id=None,
            )
        )
        db.session.commit()

    legacy_list = client.get(
        "/api/rooms", headers={"Authorization": f"Bearer {tok_2}"}
    ).get_json()["rooms"]
    assert legacy_list[0]["room_code"] == "LEG123"
    assert legacy_list[0]["is_host"] is True
    assert (
        client.delete(
            "/api/rooms/LEG123",
            headers={"Authorization": f"Bearer {tok_2}"},
        ).status_code
        == 200
    )

    # 3. Finished room is omitted from GET /api/rooms automatically
    fin_room = client.post(
        "/api/rooms",
        headers={"Authorization": f"Bearer {tok_2}"},
        json={"host_name": "João", "players": ["HUMAN", "HUMAN", "CATANATRON", "W"]},
    ).get_json()
    f_code = fin_room["room_code"]
    f_start = client.post(
        f"/api/rooms/{f_code}/start",
        headers={"Authorization": f"Bearer {tok_2}"},
        json={"token": fin_room["seat_token"]},
    ).get_json()
    f_gid = f_start["game_id"]

    with app.app_context():
        game = get_game_state(f_gid)
        idx = game.state.color_to_index[Color.RED]
        game.state.player_state[f"P{idx}_ACTUAL_VICTORY_POINTS"] = game.vps_to_win
        game.state.player_state[f"P{idx}_VICTORY_POINTS"] = game.vps_to_win
        upsert_game_state(game)
        record_completed_match(game)

    assert client.get("/api/rooms").get_json()["rooms"] == []


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


def test_bot_difficulty_explicit_bot_names_and_assento_livre_flow(client):
    # 1. Solo game respects explicit seat_names (including specific bot profiles & host seat index)
    solo_res = client.post(
        "/api/games",
        json={
            "players": ["F", "HUMAN", "F", "F"],
            "seat_names": ["Angeleri", "João", "Creitu", "Jaó"],
            "host_seat_index": 1,
            "map_template": "TOURNAMENT",
        },
    )
    assert solo_res.status_code == 200
    solo_gid = solo_res.get_json()["game_id"]
    solo_view = client.get(f"/api/games/{solo_gid}/states/latest").get_json()
    assert solo_view["seat_names"]["RED"] == "Angeleri"
    assert solo_view["seat_names"]["BLUE"] == "João"
    assert solo_view["seat_names"]["ORANGE"] == "Creitu"
    assert solo_view["seat_names"]["WHITE"] == "Jaó"
    assert solo_view["seat_avatars"]["RED"]["avatar_config"] == BOT_AVATAR_BY_NAME["Angeleri"]

    # 2. Online room with open seat on Seat 3 (ORANGE), bots on BLUE & WHITE, single difficulty
    create_res = client.post(
        "/api/rooms",
        json={
            "host_name": "Host Lucas",
            "bot_difficulty": "easy",
            "seats": [
                {"player_key": "HUMAN", "is_host": True},
                {"player_key": BOT_DIFFICULTY_TO_KEY["easy"], "player_name": "Guiri"},
                {"player_key": "HUMAN"},
                {"player_key": BOT_DIFFICULTY_TO_KEY["easy"], "player_name": "Felire"},
            ],
        },
    )
    assert create_res.status_code == 200
    created = create_res.get_json()
    code = created["room_code"]
    host_tok = created["seat_token"]
    room = created["room"]
    assert room["config"]["bot_difficulty"] == "easy"

    seats_by_color = {s["color"]: s for s in room["seats"]}
    assert seats_by_color["RED"]["player_name"] == "Host Lucas"
    assert seats_by_color["BLUE"]["player_name"] == "Guiri"
    assert seats_by_color["BLUE"]["player_key"] == "W"
    assert seats_by_color["ORANGE"]["player_name"] == OPEN_SEAT_NAME
    assert seats_by_color["ORANGE"]["claimed"] is False
    assert seats_by_color["WHITE"]["player_name"] == "Felire"

    # Friend joins -> claims the open ORANGE ("Assento livre") seat and replaces label with their name
    join_res = client.post(
        f"/api/rooms/{code}/join",
        json={"player_name": "Marina"},
    )
    assert join_res.status_code == 200
    join_data = join_res.get_json()
    assert join_data["seat_color"] == "ORANGE"
    joined_orange = next(s for s in join_data["room"]["seats"] if s["color"] == "ORANGE")
    assert joined_orange["player_name"] == "Marina"
    assert joined_orange["claimed"] is True

    # Another friend cannot join once no "Assento livre" remains
    full_res = client.post(
        f"/api/rooms/{code}/join",
        json={"player_name": "Terceiro"},
    )
    assert full_res.status_code == 400
    assert "assentos livres" in full_res.get_json()["description"].lower()

    # Changing room difficulty updates all bot keys while preserving Guiri and Felire
    diff_res = client.patch(
        f"/api/rooms/{code}",
        json={"token": host_tok, "config": {"bot_difficulty": "hard"}},
    )
    assert diff_res.status_code == 200
    diff_room = diff_res.get_json()
    assert diff_room["config"]["bot_difficulty"] == "hard"
    diff_seats = {s["color"]: s for s in diff_room["seats"]}
    assert diff_seats["BLUE"]["player_key"] == "CATANATRON"
    assert diff_seats["BLUE"]["player_name"] == "Guiri"
    assert diff_seats["WHITE"]["player_key"] == "CATANATRON"
    assert diff_seats["WHITE"]["player_name"] == "Felire"
    assert diff_seats["ORANGE"]["player_name"] == "Marina"

    # Removing BLUE with source_color keeps Marina's claimed seat intact on new color ORANGE
    remove_res = client.patch(
        f"/api/rooms/{code}",
        json={
            "token": host_tok,
            "seats": [
                {"source_color": "RED", "color": "RED", "player_key": "HUMAN"},
                {
                    "source_color": "ORANGE",
                    "color": "BLUE",
                    "player_key": "HUMAN",
                },
                {
                    "source_color": "WHITE",
                    "color": "ORANGE",
                    "player_key": "CATANATRON",
                    "player_name": "Felire",
                },
            ],
        },
    )
    assert remove_res.status_code == 200
    rem_seats = {s["color"]: s for s in remove_res.get_json()["seats"]}
    assert rem_seats["BLUE"]["player_name"] == "Marina"
    assert rem_seats["BLUE"]["claimed"] is True
    assert rem_seats["ORANGE"]["player_name"] == "Felire"

    # Marina leaves -> seat reverts cleanly to "Assento livre"
    leave_res = client.post(
        f"/api/rooms/{code}/leave",
        json={"token": join_data["seat_token"]},
    )
    assert leave_res.status_code == 200
    left_blue = next(s for s in leave_res.get_json()["room"]["seats"] if s["color"] == "BLUE")
    assert left_blue["player_name"] == OPEN_SEAT_NAME
    assert left_blue["claimed"] is False

    # Starting match preserves exact host and bot profile names on board
    start_res = client.post(f"/api/rooms/{code}/start", json={"token": host_tok})
    assert start_res.status_code == 200
    gid = start_res.get_json()["game_id"]
    view = client.get(f"/api/games/{gid}/states/latest").get_json()
    assert view["seat_names"]["RED"] == "Host Lucas"
    assert view["seat_names"]["ORANGE"] == "Felire"
    assert view["seat_names"]["BLUE"] != OPEN_SEAT_NAME


def test_room_bot_speed_pre_match_config_and_game_exposure(client):
    # Default bot_speed is "normal", rejects invalid speeds on POST and PATCH
    bad_create = client.post(
        "/api/rooms",
        json={"host_name": "Ana", "bot_speed": "hyperspeed"},
    )
    assert bad_create.status_code == 400

    create_res = client.post(
        "/api/rooms",
        json={
            "host_name": "Ana",
            "players": ["HUMAN", "HUMAN", "F", "F"],
            "bot_speed": "fast",
        },
    )
    assert create_res.status_code == 200
    created = create_res.get_json()
    code = created["room_code"]
    tok = created["seat_token"]
    assert created["room"]["config"]["bot_speed"] == "fast"

    # Invalid PATCH rejected with 400
    bad_patch = client.patch(
        f"/api/rooms/{code}",
        json={"token": tok, "config": {"bot_speed": "snail"}},
    )
    assert bad_patch.status_code == 400

    # Valid PATCH updates room pre-match speed to slow
    good_patch = client.patch(
        f"/api/rooms/{code}",
        json={"token": tok, "config": {"bot_speed": "slow"}},
    )
    assert good_patch.status_code == 200
    assert good_patch.get_json()["config"]["bot_speed"] == "slow"

    # Start room -> live state view exposes locked bot_speed
    start_res = client.post(f"/api/rooms/{code}/start", json={"token": tok})
    assert start_res.status_code == 200
    gid = start_res.get_json()["game_id"]
    view = client.get(f"/api/games/{gid}/states/latest").get_json()
    assert view["room_code"] == code
    assert view["bot_speed"] == "slow"
