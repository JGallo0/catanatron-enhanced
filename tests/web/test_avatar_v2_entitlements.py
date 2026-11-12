import filecmp
import os

import pytest

from catanatron.models.player import Color
from catanatron.web import create_app
from catanatron.web.models import (
    AVATAR_UNLOCK_REQUIREMENTS,
    AVATAR_VALID_VALUES,
    StoredUserEntitlement,
    db,
    filter_unlocked_avatar_config,
    get_game_state,
    get_user_entitlements,
    grant_user_entitlement,
    record_completed_match,
    register_user,
    sanitize_avatar_config,
    upsert_game_state,
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


@pytest.fixture
def client(app):
    return app.test_client()


def _force_win_and_record(app, game_id: str, winning_color: Color):
    with app.app_context():
        game = get_game_state(game_id)
        idx = game.state.color_to_index[winning_color]
        game.state.player_state[f"P{idx}_ACTUAL_VICTORY_POINTS"] = game.vps_to_win
        game.state.player_state[f"P{idx}_VICTORY_POINTS"] = game.vps_to_win
        upsert_game_state(game)
        assert game.winning_color() == winning_color
        record_completed_match(game)


def test_v2_colors_snapshot_and_v1_compat_sanitization(app, client):
    with app.app_context():
        _, sess = register_user("ana", "senha123", "Ana")
        token = sess.token

    valid_snap = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA="
    res = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "avatar_config": {
                "version": 2,
                "bodyType": "athletic",
                "headShape": "oval",
                "eyeStyle": "noble",
                "browStyle": "arched",
                "noseStyle": "straight",
                "mouthStyle": "confident",
                "hair": "navigator",
                "beard": "captain_trimmed",
                "outfit": "settler",
                "legsBoots": "traveler",
                "cape": "traveler",
                "hat": "captain",
                "handProp": "spyglass",
                "backProp": "sheathed_sword",
                "pet": "none",
                "mount": "island_horse",
                "pedestal": "stone_wood",
                "aura": "none",
                "background": "ocean",
                "frame": "wood",
                "colors": {
                    "skin": "#e4b287",
                    "hair": "#2c1810",
                    "eyes": "#0284c7",
                    "outfitPrimary": "#1d4ed8",
                    "outfitSecondary": "javascript:alert(1)",
                    "outfitTrim": "#facc15",
                    "mount": "#e2e8f0",
                    "unknownColor": "#ffffff",
                },
                "portraitSnapshot": valid_snap,
                "__proto__": {"hack": True},
                "unknownSlot": "invalid",
            }
        },
    )
    assert res.status_code == 200
    body = res.get_json()
    cfg = body["avatar_config"]
    assert cfg["version"] == 2
    assert cfg["bodyType"] == "athletic"
    assert cfg["hair"] == "navigator"
    assert cfg["beard"] == "captain_trimmed"
    assert cfg["backProp"] == "sheathed_sword"
    assert cfg["mount"] == "island_horse"
    assert cfg["colors"]["skin"] == "#e4b287"
    assert cfg["colors"]["mount"] == "#e2e8f0"
    assert "outfitSecondary" not in cfg["colors"]
    assert "unknownColor" not in cfg["colors"]
    assert cfg["portraitSnapshot"] == valid_snap
    assert "__proto__" not in cfg
    assert "unknownSlot" not in cfg
    assert body["entitlements"] == []

    # Backward compatibility with V1 config & exports
    assert "skin" in AVATAR_VALID_VALUES
    assert "crown_gold" in AVATAR_UNLOCK_REQUIREMENTS["hat"]
    v1_clean = sanitize_avatar_config(
        {
            "skin": "warm",
            "eyes": "sharp",
            "hair": "short",
            "hairColor": "navy",
            "beard": "goatee",
            "hat": "captain",
            "outfit": "captain",
            "outfitColor": "royal",
            "background": "ocean",
            "frame": "wood",
        }
    )
    assert v1_clean["skin"] == "warm"
    assert v1_clean["outfitColor"] == "royal"

    # filter_unlocked_avatar_config backward compat with (raw, wins=0) and optional entitlements
    filtered = filter_unlocked_avatar_config(
        {"version": 2, "mount": "imperial_griffin", "cape": "navy_commander", "frame": "wood"},
        wins=0,
    )
    assert filtered == {"version": 2, "frame": "wood"}
    filtered_vip = filter_unlocked_avatar_config(
        {"version": 2, "mount": "imperial_griffin", "frame": "wood"},
        wins=0,
        entitlements={"mount:imperial_griffin"},
    )
    assert filtered_vip == {"version": 2, "mount": "imperial_griffin", "frame": "wood"}


def test_oversized_or_malicious_snapshot_is_dropped(app, client):
    with app.app_context():
        _, sess = register_user("carla", "senha123", "Carla")
        token = sess.token

    bad_snap = "data:image/svg+xml;base64,PHN2Zz4="
    newline_snap = "data:image/png;base64,iVBORw0KGgo=\n"
    huge_snap = "data:image/webp;base64," + ("A" * 70000)

    for candidate in (bad_snap, newline_snap, huge_snap):
        res = client.patch(
            "/api/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"avatar_config": {"version": 2, "portraitSnapshot": candidate}},
        )
        assert res.status_code == 200
        assert "portraitSnapshot" not in res.get_json()["avatar_config"]


def test_vip_403_and_grant_entitlement_unlocks_save_and_me(app, client):
    with app.app_context():
        _, sess = register_user("bruno", "senha123", "Bruno")
        token = sess.token

    # Equipping VIP mount without entitlement -> 403 with structured locked_items
    res_vip = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"avatar_config": {"version": 2, "mount": "imperial_griffin"}},
    )
    assert res_vip.status_code == 403
    err_data = res_vip.get_json()
    assert err_data["code"] == 403
    assert err_data["description"]
    assert any(
        item["slot"] == "mount"
        and item["id"] == "imperial_griffin"
        and item["tier"] == "vip"
        and item["sku"] == "vip_mount_griffin"
        for item in err_data["locked_items"]
    )

    # Grant entitlement in DB -> idempotent, exposed in /api/auth/me, allows 200 save
    with app.app_context():
        row1 = grant_user_entitlement(
            "bruno", "mount:imperial_griffin", source="PROMO", transaction_ref="promo_01"
        )
        row2 = grant_user_entitlement(
            "bruno", "mount:imperial_griffin", source="PROMO", transaction_ref="promo_01"
        )
        assert row1.id == row2.id
        assert db.session.query(StoredUserEntitlement).filter_by(username="bruno").count() == 1
        assert get_user_entitlements("bruno") == ["mount:imperial_griffin"]

    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert "mount:imperial_griffin" in res_me.get_json()["entitlements"]

    res_ok = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"avatar_config": {"version": 2, "mount": "imperial_griffin"}},
    )
    assert res_ok.status_code == 200
    assert res_ok.get_json()["avatar_config"]["mount"] == "imperial_griffin"
    assert "mount:imperial_griffin" in res_ok.get_json()["entitlements"]


def test_earnable_v2_item_403_then_200_after_wins(app, client):
    reg = client.post(
        "/api/auth/register",
        json={"username": "diego", "password": "pw_diego_1", "display_name": "Diego"},
    )
    assert reg.status_code == 200
    token = reg.get_json()["auth_token"]

    # cape:navy_commander requires 2 wins -> 403 at 0 wins
    locked = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"avatar_config": {"version": 2, "cape": "navy_commander"}},
    )
    assert locked.status_code == 403
    err = locked.get_json()
    assert "2 vitória" in err["description"]
    assert err["locked_items"] == [
        {
            "slot": "cape",
            "id": "navy_commander",
            "tier": "earnable",
            "required_wins": 2,
            "sku": None,
        }
    ]

    # Win 2 ranked games -> now 200
    for _ in range(2):
        gid = client.post(
            "/api/games",
            headers={"Authorization": f"Bearer {token}"},
            json={"players": ["HUMAN", "R"]},
        ).get_json()["game_id"]
        _force_win_and_record(app, gid, Color.RED)

    unlocked = client.patch(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"avatar_config": {"version": 2, "cape": "navy_commander"}},
    )
    assert unlocked.status_code == 200
    assert unlocked.get_json()["avatar_config"]["cape"] == "navy_commander"


def test_catalog_endpoint_and_mirror_parity(client):
    res = client.get("/api/avatar/catalog")
    assert res.status_code == 200
    data = res.get_json()
    assert data["version"] == 2
    items = data["items"]
    by_key = {(item["slot"], item["id"]): item for item in items}

    expected_slots = {
        "bodyType",
        "headShape",
        "eyeStyle",
        "browStyle",
        "noseStyle",
        "mouthStyle",
        "hair",
        "beard",
        "outfit",
        "legsBoots",
        "cape",
        "hat",
        "handProp",
        "backProp",
        "pet",
        "mount",
        "pedestal",
        "aura",
        "background",
        "frame",
    }
    assert {item["slot"] for item in items} == expected_slots
    assert by_key[("mount", "imperial_griffin")]["tier"] == "vip"
    assert by_key[("mount", "imperial_griffin")]["sku"] == "vip_mount_griffin"
    assert by_key[("mount", "imperial_griffin")]["price_brl_cents"] == 2990
    assert by_key[("cape", "navy_commander")]["required_wins"] == 2
    assert by_key[("frame", "vip_dragon")]["sku"] == "vip_frame_dragon"

    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for filename in ("avatar_catalog.py", "models.py", "api.py"):
        left = os.path.join(root, "catanatron", "catanatron", "web", filename)
        right = os.path.join(root, "api", "catanatron", "web", filename)
        assert filecmp.cmp(left, right, shallow=False), f"Mismatch in {filename}"
