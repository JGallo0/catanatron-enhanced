import hashlib
import json
import os
import sqlite3
import tempfile

import pytest

from catanatron.web import create_app
from catanatron.web.models import (
    BOT_AVATAR_BY_NAME,
    OFFICIAL_BOT_NAMES,
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


from catanatron.models.player import Color
from catanatron.web.models import (
    StoredGame,
    StoredMatch,
    StoredMatchParticipant,
    get_game_state,
    record_completed_match,
    upsert_game_state,
)


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

    # 3. Pedro vence 1 de 1 (100%)
    g3 = client.post(
        "/api/games",
        headers={"Authorization": f"Bearer {pedro_tok}"},
        json={"players": ["HUMAN", "R"]},
    ).get_json()["game_id"]
    _force_win_and_record(app, g3, Color.RED)

    # Ranking: João 1/2 = 50.0%; Pedro 1/1 = 100.0%. Bots não entram no ranking.
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

    # Histórico global tem as 3 partidas, incluindo a vitória do Bot
    hist = client.get("/api/matches").get_json()["matches"]
    assert len(hist) == 3
    bot_win_match = next(m for m in hist if m["game_id"] == g2)
    assert bot_win_match["winner_is_bot"] is True
    assert bot_win_match["winner_username"] is None

    # Histórico filtrado por usuário
    hist_joao = client.get("/api/matches?username=joao").get_json()["matches"]
    assert {m["game_id"] for m in hist_joao} == {g1, g2}

    # /api/auth/me reflete estatísticas atualizadas
    me_joao = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {joao_tok}"}
    ).get_json()
    assert me_joao["stats"] == {
        "wins": 1,
        "losses": 1,
        "games_played": 2,
        "win_rate": 50.0,
    }

    # Idempotência: 1 StoredMatch e 2 participantes por jogo
    with app.app_context():
        assert db.session.query(StoredMatch).count() == 3
        assert db.session.query(StoredMatchParticipant).count() == 6


def test_logged_user_sits_on_human_chair_even_when_not_first(app, client):
    """O usuário logado deve ocupar a cadeira HUMAN, independente do embaralhamento da ordem de turnos."""
    tok = client.post(
        "/api/auth/register",
        json={"username": "carla", "password": "pw1234"},
    ).get_json()["auth_token"]
    game_id = client.post(
        "/api/games",
        headers={"Authorization": f"Bearer {tok}"},
        json={"players": ["CATANATRON", "HUMAN", "CATANATRON"]},
    ).get_json()["game_id"]

    with app.app_context():
        stored = db.session.get(StoredGame, game_id)
        meta = json.loads(stored.seat_metadata_json)
        game = get_game_state(game_id)
        human_colors = [
            p.color.value for p in game.state.players if not p.is_bot
        ]
        assert human_colors == ["BLUE"]
        assert meta["BLUE"]["seat_kind"] == "USER"
        assert meta["BLUE"]["username"] == "carla"
        assert meta["RED"]["seat_kind"] == "BOT"
        assert meta["ORANGE"]["seat_kind"] == "BOT"

    _force_win_and_record(app, game_id, Color.BLUE)
    with app.app_context():
        part = (
            db.session.query(StoredMatchParticipant)
            .filter_by(game_id=game_id, username="carla")
            .one()
        )
        assert part.color == "BLUE"
        assert part.is_winner is True
        assert part.player_key == "HUMAN"


def test_guest_game_is_recorded_but_not_ranked(app, client):
    game_id = client.post(
        "/api/games", json={"players": ["HUMAN", "CATANATRON"]}
    ).get_json()["game_id"]
    _force_win_and_record(app, game_id, Color.RED)
    assert client.get("/api/leaderboard").get_json()["leaderboard"] == []
    matches = client.get("/api/matches").get_json()["matches"]
    assert len(matches) == 1
    assert matches[0]["winner_username"] is None
    assert matches[0]["winner_is_bot"] is False


def test_avatar_unlock_requires_ranked_wins_and_returns_403_when_locked(app, client):
    reg = client.post(
        "/api/auth/register",
        json={"username": "bruno", "password": "pw_bruno_1", "display_name": "Bruno"},
    ).get_json()
    tok = reg["auth_token"]

    # Equipar item inicial gratuito (0 vitórias) funciona com 200
    ok_base = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "display_name": "Bruno Nauta",
            "avatar_config": {
                "skin": "warm",
                "hat": "captain",
                "outfit": "captain",
                "frame": "wood",
            },
        },
    )
    assert ok_base.status_code == 200
    assert ok_base.get_json()["avatar_config"]["frame"] == "wood"

    # Tentar equipar Moldura Prata (requer 3 vitórias) com 0 vitórias retorna 403
    locked_frame = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {tok}"},
        json={"avatar_config": {"frame": "silver"}},
    )
    assert locked_frame.status_code == 403
    assert "3 vitória" in locked_frame.get_json().get("description", "")

    # Tentar equipar Coroa Dourada (requer 7 vitórias) com 3 vitórias também retorna 403
    for _ in range(3):
        gid = client.post(
            "/api/games",
            headers={"Authorization": f"Bearer {tok}"},
            json={"players": ["HUMAN", "R"]},
        ).get_json()["game_id"]
        _force_win_and_record(app, gid, Color.RED)

    still_locked_crown = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {tok}"},
        json={"avatar_config": {"hat": "crown_gold"}},
    )
    assert still_locked_crown.status_code == 403

    # Com 3 vitórias, Moldura Prata (silver) agora desbloqueia e persiste mesclando campos antigos
    unlocked_silver = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {tok}"},
        json={"avatar_config": {"frame": "silver", "unknown_field": "hack"}},
    )
    assert unlocked_silver.status_code == 200
    cfg = unlocked_silver.get_json()["avatar_config"]
    assert cfg["frame"] == "silver"
    assert cfg["hat"] == "captain"
    assert "unknown_field" not in cfg


def test_game_state_and_room_serialize_user_seat_avatars(app, client):
    tok = client.post(
        "/api/auth/register",
        json={"username": "diana", "password": "pw_diana_1", "display_name": "Diana"},
    ).get_json()["auth_token"]

    client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "avatar_config": {
                "skin": "fair",
                "hair": "braids",
                "hat": "explorer",
                "background": "forest",
                "frame": "wood",
            }
        },
    )

    # 1. Partida Solo: Diana (HUMAN em BLUE) vs Bot (CATANATRON em RED)
    solo_gid = client.post(
        "/api/games",
        headers={"Authorization": f"Bearer {tok}"},
        json={"players": ["CATANATRON", "HUMAN"]},
    ).get_json()["game_id"]
    state_view = client.get(f"/api/games/{solo_gid}/states/latest").get_json()
    assert state_view["seat_names"]["BLUE"] == "Diana"
    assert state_view["seat_avatars"]["BLUE"]["seat_kind"] == "USER"
    assert state_view["seat_avatars"]["BLUE"]["username"] == "diana"
    assert state_view["seat_avatars"]["BLUE"]["avatar_config"]["hat"] == "explorer"
    assert state_view["seat_names"]["RED"] in OFFICIAL_BOT_NAMES
    assert state_view["seat_avatars"]["RED"]["seat_kind"] == "BOT"
    assert (
        state_view["seat_avatars"]["RED"]["avatar_config"]
        == BOT_AVATAR_BY_NAME[state_view["seat_names"]["RED"]]
    )

    # 2. Sala Multiplayer: serialize_room e start expõem avatar_config
    room_res = client.post(
        "/api/rooms",
        headers={"Authorization": f"Bearer {tok}"},
        json={"players": ["HUMAN", "CATANATRON"]},
    ).get_json()
    red_seat = next(s for s in room_res["room"]["seats"] if s["color"] == "RED")
    assert red_seat["seat_kind"] == "USER"
    assert red_seat["username"] == "diana"
    assert red_seat["avatar_config"]["background"] == "forest"

    started = client.post(
        f"/api/rooms/{room_res['room_code']}/start",
        headers={"Authorization": f"Bearer {tok}"},
        json={"token": room_res["seat_token"]},
    ).get_json()
    mp_view = client.get(f"/api/games/{started['game_id']}/states/latest").get_json()
    assert mp_view["room_code"] == room_res["room_code"]
    assert mp_view["seat_avatars"]["RED"]["seat_kind"] == "USER"
    assert mp_view["seat_avatars"]["RED"]["avatar_config"]["hair"] == "braids"


def test_auth_endpoints_expose_leaderboard_rank_without_altering_stats_keys(app, client):
    joao_reg = client.post(
        "/api/auth/register",
        json={"username": "joao_rank", "password": "pw1234", "display_name": "João"},
    )
    assert joao_reg.status_code == 200
    joao_payload = joao_reg.get_json()
    assert joao_payload["leaderboard_rank"] == 1
    assert set(joao_payload["stats"].keys()) == {
        "wins",
        "losses",
        "games_played",
        "win_rate",
    }

    maria_reg = client.post(
        "/api/auth/register",
        json={"username": "maria_rank", "password": "pw1234", "display_name": "Maria"},
    )
    assert maria_reg.status_code == 200
    maria_tok = maria_reg.get_json()["auth_token"]

    # Maria vence uma partida e assume o 1º lugar (#1); João cai para #2
    gid = client.post(
        "/api/games",
        headers={"Authorization": f"Bearer {maria_tok}"},
        json={"players": ["HUMAN", "R"]},
    ).get_json()["game_id"]
    _force_win_and_record(app, gid, Color.RED)

    maria_me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {maria_tok}"}
    ).get_json()
    assert maria_me["leaderboard_rank"] == 1
    assert maria_me["stats"] == {
        "wins": 1,
        "losses": 0,
        "games_played": 1,
        "win_rate": 100.0,
    }

    joao_login = client.post(
        "/api/auth/login",
        json={"username": "joao_rank", "password": "pw1234"},
    ).get_json()
    assert joao_login["leaderboard_rank"] == 2

