# Bloco 5 — Ritmo de Tabuleiro com Dados Animados 2D6, Substituição por Bot em Abandono/Queda e Ordem Aleatória Garantida Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver all three Bloco 5 fronts cleanly across the Python backend (`catanatron` + `api/catanatron` Serverless mirror), offline engine (`localEngine.ts`), and React/TypeScript/SCSS UI:
1. **Classic Tabletop Pacing, Animated 2D6 Dice & Cross-Device Action Visibility:** Slow AI moves to a readable board-game cadence with a `Normal (1x)` / `Rápido (0.5x)` speed toggle (`catan_game_speed_v1`), animated 2D6 dice stage (`DiceRollOverlay` + `dice-widget-pill.is-rolling`), recent board build highlights (`node--recent` / `edge--recent`), dev-card purchase pulse, unified desktop+mobile `.action-spotlight-toast`, and multiplayer bot coordinator election (`?bot_only=1`).
2. **Serverless-Safe Multiplayer Bot Takeover & Seat Reclaim:** Add `10s` client heartbeat (`POST /api/games/<id>/heartbeat`), lazy `45s` timeout promotion (`maybe_promote_disconnected_seats`) on multiplayer rooms (`>= 2` original human seats; never solo or last live human), immediate abandon button **`🚪 Sair (Bot Assume)`** (`POST /api/games/<id>/abandon`), seat reclaim banner **`↩️ Retomar Meu Assento`** (`POST /api/games/<id>/reclaim`), ranking fairness in `record_completed_match`, and full `localEngine.ts` offline parity.
3. **Guaranteed Random Turn Order & Starting Player:** Fix `localCreateGame` to Fisher-Yates shuffle turn order via `crypto.getRandomValues` while preserving configured seat colors, pass explicit `secrets.randbits(63)` entropy seeds in `api.py` when `seed` is omitted, keep `PlayerTopBar` free of numeric order badges (`1º`, `2º`, ...), and announce who opens the match at `state_index === 0`.

**Architecture:** The engine (Python Flask + `localEngine.ts`) stays strictly stateless and executes 1 action per `POST /actions` without server-side sleeps. The frontend paces bot execution using a cancellation-safe visual schedule tied to each revealed `action_record`, immediately applying local human actions and multiplayer peer updates. Backend takeover swaps only `StoredGame.player_specs[idx]` (`"HUMAN"` <-> `"CATANATRON"`) and per-seat fields inside `StoredGame.seat_metadata_json`, keeping SQL schema unchanged and preserving player colors, hands, buildings, and original `<Name> (Bot)` avatars.

**Tech Stack:** Python 3.12 (Flask, SQLAlchemy, pytest), React 19, TypeScript, Vite 6, MUI v5/v6, SCSS, Vitest + Testing Library.

## Global Constraints
- Work strictly on branch `layout-topbar` inside `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1`; never push or merge to `main`.
- PowerShell command chaining uses `;` (never `&&`). Run backend tests via `.\.venv\Scripts\python.exe -m pytest -o addopts="" ...`.
- Official bot names remain strictly `("Creitu", "Felire", "Guiri", "Jaó", "Angeleri")`; human seats taken over by bots are named `"<OriginalName> (Bot)"` and keep their original human/guest avatar.
- **No** numeric turn-order badges (`1º`, `2º`, `3º`, `4º`) on `PlayerTopBar` cards — turn order is communicated strictly by card ordering (`colors`) and the opening turn announcement.
- Mirror every edit inside `catanatron/catanatron/` identically into `api/catanatron/` so `test_vercel_api_catanatron_mirrors_core_package` passes.

---

### Task 1: Backend Presence, Bot Takeover, Reclaim & Ranking Fairness

**Files:**
- Modify: `catanatron/catanatron/web/models.py:48-55,332-405,680-795,881-1015`
- Create: `tests/web/test_takeover_and_turn_order.py`

**Interfaces:**
- Consumes: `StoredGame`, `StoredRoom`, `StoredUser`, `StoredMatch`, `StoredMatchParticipant`, `get_game_state`, `get_room_by_game_id`, `build_seat_metadata_for_game`, `OFFICIAL_BOT_NAMES`, `COLOR_LABELS_PT`.
- Produces in `catanatron.web.models`:
  - `TAKEOVER_TIMEOUT_SECONDS = 45`
  - `TAKEOVER_BOT_SPEC = "CATANATRON"`
  - `init_presence_metadata(seat_meta, seat_tokens_by_color=None, now=None) -> dict[str, dict]`
  - `load_game_seat_metadata(stored_game) -> dict[str, dict]`
  - `is_multiplayer_game(stored_game, seat_meta) -> bool`
  - `authorize_seat_caller(stored_game, seat_meta, preferred_color=None, auth_user=None, seat_token=None) -> str | None`
  - `touch_seat_heartbeat(game_id, color, now=None) -> bool`
  - `promote_seat_to_bot(game_id, color, reason="DISCONNECTED", now=None) -> bool`
  - `reclaim_seat_from_bot(game_id, color, now=None) -> bool`
  - `maybe_promote_disconnected_seats(game_id, now=None, timeout_seconds=TAKEOVER_TIMEOUT_SECONDS) -> list[str]`

- [ ] **Step 1: Write failing unit/model tests for takeover, protections, reclaim, and ranking fairness**

Create `tests/web/test_takeover_and_turn_order.py`:

```python
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
```

- [ ] **Step 2: Run pytest on the new test file to confirm it fails**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_takeover_and_turn_order.py -v
```
Expected: `ImportError` (`cannot import name 'maybe_promote_disconnected_seats'`).

- [ ] **Step 3: Implement presence metadata helpers, takeover/reclaim state mutations, and ranking guards in `models.py`**

In `catanatron/catanatron/web/models.py`:

1. Near `SEAT_COLORS` (line 48), add constants:

```python
TAKEOVER_TIMEOUT_SECONDS = 45
TAKEOVER_BOT_SPEC = "CATANATRON"
```

2. Add presence helpers directly above `upsert_game_state` (around line 331):

```python
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
            or ("BOT" if player_key != "HUMAN" else ("USER" if meta.get("username") else "GUEST"))
        )
        uname = meta.get("username") if seat_kind == "USER" else None
        dname = str(meta.get("display_name") or COLOR_LABELS_PT.get(color, color))
        avatar = dict(meta.get("avatar_config") or {})
        tok = meta.get("seat_token")
        if tok is None and color in tokens:
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
                        "display_name": seat.get("player_name") or COLOR_LABELS_PT.get(c, c),
                        "avatar_config": seat.get("avatar_config") or {},
                        "seat_token": seat.get("seat_token"),
                    }
            except Exception:
                parsed = {}

    if not parsed:
        return {}
    return init_presence_metadata(parsed)


def is_multiplayer_game(stored_game: StoredGame, seat_meta: dict[str, dict]) -> bool:
    if get_room_by_game_id(stored_game.uuid) is not None:
        return True
    orig_human_count = sum(
        1
        for meta in seat_meta.values()
        if str(meta.get("original_player_key") or meta.get("player_key") or "") == "HUMAN"
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
    if seat_token and stored_tok and hmac.compare_digest(str(stored_tok), str(seat_token)):
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
        col = str(preferred_color).upper()
        meta = seat_meta.get(col)
        if meta and _seat_matches_caller(meta, auth_user, seat_token, allow_open_local_guest):
            return col
        return None

    for col, meta in seat_meta.items():
        if _seat_matches_caller(meta, auth_user, seat_token, allow_open_local_guest=False):
            return col

    if allow_open_local_guest:
        for col, meta in seat_meta.items():
            if _seat_matches_caller(meta, auth_user, seat_token, allow_open_local_guest=True):
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
            (int(ps.get(f"P{idx}_ACTUAL_VICTORY_POINTS", 0)) for idx in range(len(colors))),
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
    orig_avatar = dict(meta.get("original_avatar_config") or meta.get("avatar_config") or {})
    meta["original_player_key"] = meta.get("original_player_key") or meta.get("player_key") or "HUMAN"
    meta["original_seat_kind"] = meta.get("original_seat_kind") or meta.get("seat_kind") or "GUEST"
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
    col = str(color).upper()
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
    col = str(color).upper()
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
    col = str(color).upper()
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
    meta["username"] = meta.get("original_username") if meta["seat_kind"] == "USER" else None
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
```

3. Inside `upsert_game_state` (line 352-357), initialize presence fields whenever creating a `StoredGame`:

```python
            seat_metadata_json=(
                json.dumps(init_presence_metadata(seat_metadata_by_color))
                if seat_metadata_by_color is not None
                else None
            ),
```

4. Inside `record_completed_match` (lines 950-985), preserve `"<OrigName> (Bot)"` and `mode = "MULTIPLAYER"` even if a human seat finished under bot control:

```python
        if player.is_bot:
            if meta.get("taken_over_by_bot"):
                dname = str(
                    meta.get("display_name")
                    or f"{meta.get('original_display_name') or COLOR_LABELS_PT.get(c, c)} (Bot)"
                )
            else:
                candidate_name = meta.get("display_name")
                if candidate_name in OFFICIAL_BOT_NAMES:
                    dname = candidate_name
                else:
                    dname = pick_bot_names(1, exclude=used_bot_names)[0]
                    used_bot_names.add(dname)
        else:
            dname = meta.get("display_name") or "Explorador da Ilha"
```

And update lines 979-980 in `record_completed_match`:

```python
    orig_human_count = sum(
        1
        for meta in seat_meta.values()
        if str(meta.get("original_player_key") or meta.get("player_key") or "") == "HUMAN"
    )
    mode = (
        "MULTIPLAYER"
        if (room is not None or max(human_count, orig_human_count) >= 2)
        else "SOLO"
    )
```

- [ ] **Step 4: Run pytest on `tests/web/test_takeover_and_turn_order.py` and verify it passes**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_takeover_and_turn_order.py -v
```
Expected: `3 passed`.

- [ ] **Step 5: Commit Task 1**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add catanatron/catanatron/web/models.py tests/web/test_takeover_and_turn_order.py
git commit -m "feat(web-models): add serverless presence, bot takeover, reclaim and ranking fairness"
```

---

### Task 2: Backend API Endpoints (`/heartbeat`, `/abandon`, `/reclaim`, `?bot_only=1`), CSPRNG Seeds & Vercel Sync

**Files:**
- Modify: `catanatron/catanatron/web/api.py:1-215,603-715`
- Modify: `tests/web/test_takeover_and_turn_order.py`
- Sync: `api/catanatron/**` (mirror from `catanatron/catanatron/**`)

**Interfaces:**
- Consumes: Task 1 helpers from `catanatron.web.models`, `secrets.randbits`.
- Produces HTTP endpoints on `bp`:
  - `POST /api/games/<game_id>/heartbeat` -> `{ ok, bot_colors, taken_over_colors, my_seat_taken_over, promoted_colors }`
  - `POST /api/games/<game_id>/abandon` -> enriched `web_view`
  - `POST /api/games/<game_id>/reclaim` -> enriched `web_view` + `reclaimed_color`
  - Updated `_enrich_view_with_seats`: adds `taken_over_colors` and `seat_takeover` (never leaks `seat_token`), preserves `"<OrigName> (Bot)"` and original user/guest avatar for taken-over seats.
  - Updated `POST /api/games/<id>/actions`: touches caller heartbeat on explicit human action, runs `maybe_promote_disconnected_seats(game_id)` before `get_game_state(game_id)`, handles `?bot_only=1` safely.
  - Updated `GET /api/games/<id>/states/latest`: runs `maybe_promote_disconnected_seats(game_id)` before reading state.
  - Updated `post_game_endpoint` & `start_room_endpoint`: `seed = int(raw_seed)` if supplied else `secrets.randbits(63)`.

- [ ] **Step 1: Add failing API endpoint & turn-order randomness tests to `tests/web/test_takeover_and_turn_order.py`**

Append to `tests/web/test_takeover_and_turn_order.py`:

```python
def test_heartbeat_abandon_and_reclaim_http_endpoints(client, monkeypatch):
    u_host = client.post(
        "/api/auth/register",
        json={
            "username": "alice_mp",
            "password": "pw1234",
            "display_name": "Alice",
            "avatar_config": {"hat": "captain", "background": "ocean", "frame": "wood"},
        },
    ).get_json()
    room_res = client.post(
        "/api/rooms",
        json={"host_name": "Alice", "players": ["HUMAN", "HUMAN", "CATANATRON"]},
        headers={"Authorization": f"Bearer {u_host['auth_token']}"},
    ).get_json()
    code = room_res["room_code"]
    alice_seat_token = room_res["seat_token"]

    join_res = client.post(
        f"/api/rooms/{code}/join",
        json={
            "player_name": "Marcos",
            "avatar_config": {"hat": "explorer", "background": "sunset", "frame": "wood"},
        },
    ).get_json()
    marcos_seat_token = join_res["seat_token"]

    started = client.post(
        f"/api/rooms/{code}/start", json={"token": alice_seat_token}
    ).get_json()
    game_id = started["game_id"]

    # Wait past timeout: Alice heartbeats at t+60 while Marcos is silent -> Marcos promoted!
    base_time = 2_000_000_000
    monkeypatch.setattr("catanatron.web.models.time.time", lambda: base_time)
    hb0 = client.post(
        f"/api/games/{game_id}/heartbeat",
        json={"color": "RED"},
        headers={"X-Seat-Token": alice_seat_token},
    )
    assert hb0.status_code == 200
    client.post(
        f"/api/games/{game_id}/heartbeat",
        json={"color": "BLUE"},
        headers={"X-Seat-Token": marcos_seat_token},
    )

    monkeypatch.setattr("catanatron.web.models.time.time", lambda: base_time + 55)
    hb_alice = client.post(
        f"/api/games/{game_id}/heartbeat",
        json={"color": "RED"},
        headers={"X-Seat-Token": alice_seat_token},
    )
    assert hb_alice.status_code == 200
    hb_payload = hb_alice.get_json()
    assert "BLUE" in hb_payload["bot_colors"]
    assert hb_payload["taken_over_colors"] == ["BLUE"]

    # Enriched view hides seat_token and preserves Marcos (Bot) + Marcos original avatar
    view = client.get(f"/api/games/{game_id}/states/latest").get_json()
    assert "seat_token" not in json.dumps(view)
    assert view["seat_names"]["BLUE"] == "Marcos (Bot)"
    assert view["seat_avatars"]["BLUE"]["seat_kind"] == "BOT"
    assert view["seat_avatars"]["BLUE"]["avatar_config"]["hat"] == "explorer"
    assert view["seat_takeover"]["BLUE"]["taken_over"] is True
    assert view["seat_takeover"]["BLUE"]["reason"] == "DISCONNECTED"

    # Reclaim rejected without token/auth, allowed with Marcos seat_token
    unauth = client.post(f"/api/games/{game_id}/reclaim", json={"color": "BLUE"})
    assert unauth.status_code == 403

    reclaimed = client.post(
        f"/api/games/{game_id}/reclaim",
        json={"color": "BLUE"},
        headers={"X-Seat-Token": marcos_seat_token},
    )
    assert reclaimed.status_code == 200
    reclaimed_view = reclaimed.get_json()
    assert reclaimed_view["reclaimed_color"] == "BLUE"
    assert "BLUE" not in reclaimed_view["bot_colors"]
    assert reclaimed_view["seat_names"]["BLUE"] == "Marcos"

    # Explicit abandon promotes Alice immediately; bot_only only advances when bot active
    abandoned = client.post(
        f"/api/games/{game_id}/abandon",
        json={"color": "RED"},
        headers={"Authorization": f"Bearer {u_host['auth_token']}"},
    )
    assert abandoned.status_code == 200
    ab_view = abandoned.get_json()
    assert "RED" in ab_view["bot_colors"]
    assert ab_view["seat_names"]["RED"] == "Alice (Bot)"
    assert ab_view["seat_avatars"]["RED"]["avatar_config"]["hat"] == "captain"
    assert ab_view["seat_takeover"]["RED"]["reason"] == "ABANDONED"

    # If Marcos is current human turn, ?bot_only=1 must be a safe no-op
    if ab_view["current_color"] == "BLUE":
        noop = client.post(f"/api/games/{game_id}/actions?bot_only=1", json={})
        assert noop.status_code == 200
        assert noop.get_json()["state_index"] == ab_view["state_index"]


def test_turn_order_and_starting_player_are_randomized_across_games(client):
    starters_api = set()
    for _ in range(20):
        res = client.post("/api/games", json={"players": ["HUMAN", "CATANATRON", "F", "MCTS"]})
        gid = res.get_json()["game_id"]
        view = client.get(f"/api/games/{gid}/states/0").get_json()
        starters_api.add(view["colors"][0])
        assert view["current_color"] == view["colors"][0]
    assert len(starters_api) >= 2

    starters_room = set()
    for _ in range(16):
        r = client.post(
            "/api/rooms",
            json={"host_name": "Host", "players": ["HUMAN", "HUMAN", "CATANATRON"]},
        ).get_json()
        gid = client.post(
            f"/api/rooms/{r['room_code']}/start", json={"token": r["seat_token"]}
        ).get_json()["game_id"]
        view = client.get(f"/api/games/{gid}/states/0").get_json()
        starters_room.add(view["colors"][0])
    assert len(starters_room) >= 2
```

- [ ] **Step 2: Run pytest to verify the new API tests fail**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_takeover_and_turn_order.py -v
```
Expected: `404` on `/heartbeat`, `/reclaim`, `/abandon`.

- [ ] **Step 3: Update `catanatron/catanatron/web/api.py` and mirror into `api/catanatron/`**

In `catanatron/catanatron/web/api.py`:

1. Add `import secrets` at top of imports and import new helpers from `catanatron.web.models`:

```python
from catanatron.web.models import (
    BOT_AVATAR_BY_NAME,
    COLOR_LABELS_PT,
    OFFICIAL_BOT_NAMES,
    SEAT_COLORS,
    StoredGame,
    StoredRoom,
    _load_avatars_by_username,
    authenticate_user,
    authorize_seat_caller,
    build_seat_metadata_for_game,
    create_room,
    db,
    filter_unlocked_avatar_config,
    get_game_state,
    get_leaderboard,
    get_match_history,
    get_room_by_game_id,
    get_user_stats,
    init_presence_metadata,
    is_multiplayer_game,
    list_active_rooms,
    load_game_seat_metadata,
    login_with_google_claims,
    maybe_promote_disconnected_seats,
    pick_bot_names,
    promote_seat_to_bot,
    reclaim_seat_from_bot,
    record_completed_match,
    register_user,
    resolve_user_from_token,
    revoke_session_token,
    sanitize_avatar_config,
    serialize_room,
    serialize_user,
    touch_seat_heartbeat,
    update_user_profile,
    upsert_game_state,
)
```

2. Update `_enrich_view_with_seats(game: Game, view: dict) -> dict` so it:
   - Fetches avatars for BOTH `username` AND `original_username`.
   - Keeps `<OrigName> (Bot)` + original user/guest avatar when `meta.get("taken_over_by_bot")` is True.
   - Emits `view["taken_over_colors"]` and `view["seat_takeover"]` (filtering out `seat_token`).

```python
def _enrich_view_with_seats(game: Game, view: dict) -> dict:
    try:
        seat_meta: dict[str, dict] = {}
        stored_game = db.session.get(StoredGame, game.id)
        if stored_game is not None:
            seat_meta = load_game_seat_metadata(stored_game)

        room = get_room_by_game_id(game.id)
        if room is not None:
            view["room_code"] = room.room_code

        if seat_meta:
            usernames = list(
                {
                    u
                    for meta in seat_meta.values()
                    for u in (meta.get("username"), meta.get("original_username"))
                    if u
                }
            )
            avatars = _load_avatars_by_username(usernames)
            seat_names: dict[str, str] = {}
            seat_avatars: dict[str, dict] = {}
            taken_over_colors: list[str] = []
            seat_takeover: dict[str, dict] = {}
            used_bot_names = {
                meta.get("display_name")
                for meta in seat_meta.values()
                if meta.get("seat_kind") == "BOT"
                and not meta.get("taken_over_by_bot")
                and meta.get("display_name") in OFFICIAL_BOT_NAMES
            }
            for color, meta in seat_meta.items():
                seat_kind = meta.get("seat_kind") or "GUEST"
                uname = meta.get("username") if seat_kind == "USER" else None
                is_taken_over = bool(meta.get("taken_over_by_bot"))
                orig_player_key = str(
                    meta.get("original_player_key") or meta.get("player_key") or "HUMAN"
                )
                if is_taken_over:
                    taken_over_colors.append(color)
                    orig_name = str(
                        meta.get("original_display_name")
                        or COLOR_LABELS_PT.get(color, color)
                    )
                    seat_names[color] = str(
                        meta.get("display_name") or f"{orig_name} (Bot)"
                    )
                    orig_kind = str(meta.get("original_seat_kind") or "GUEST")
                    orig_uname = meta.get("original_username")
                    if orig_kind == "USER" and orig_uname and orig_uname in avatars:
                        seat_avatar = avatars[orig_uname]
                    else:
                        seat_avatar = filter_unlocked_avatar_config(
                            meta.get("original_avatar_config")
                            or meta.get("avatar_config"),
                            wins=0,
                        )
                    seat_kind = "BOT"
                    uname = None
                elif seat_kind == "BOT":
                    raw_bot_name = meta.get("display_name")
                    if raw_bot_name in OFFICIAL_BOT_NAMES:
                        bot_name = raw_bot_name
                    else:
                        bot_name = pick_bot_names(1, exclude=used_bot_names)[0]
                        used_bot_names.add(bot_name)
                    seat_names[color] = bot_name
                    seat_avatar = sanitize_avatar_config(meta.get("avatar_config")) or dict(
                        BOT_AVATAR_BY_NAME.get(bot_name) or {}
                    )
                elif seat_kind == "USER" and uname:
                    seat_names[color] = meta.get("display_name") or COLOR_LABELS_PT.get(
                        color, color
                    )
                    seat_avatar = avatars.get(uname, {})
                else:
                    seat_names[color] = meta.get("display_name") or "Explorador da Ilha"
                    seat_avatar = filter_unlocked_avatar_config(
                        meta.get("avatar_config"), wins=0
                    )

                seat_avatars[color] = {
                    "seat_kind": seat_kind,
                    "username": uname,
                    "avatar_config": seat_avatar,
                }
                if orig_player_key == "HUMAN":
                    seat_takeover[color] = {
                        "taken_over": is_taken_over,
                        "reason": meta.get("takeover_reason"),
                        "original_username": meta.get("original_username"),
                        "original_display_name": meta.get("original_display_name"),
                    }

            view["seat_names"] = seat_names
            view["seat_avatars"] = seat_avatars
            view["taken_over_colors"] = taken_over_colors
            view["seat_takeover"] = seat_takeover
    except Exception:
        pass
    return view
```

3. Update `post_game_endpoint` (`api.py:193-199`) to pass an explicit cryptographic `seed`:

```python
    raw_seed = request.json.get("seed")
    seed = (
        int(raw_seed)
        if raw_seed is not None and not isinstance(raw_seed, bool)
        else secrets.randbits(63)
    )
    game = Game(
        players=players,
        seed=seed,
        discard_limit=discard_limit,
        friendly_robber=friendly_robber,
        vps_to_win=vps_to_win,
        catan_map=catan_map,
    )
```

4. Update `start_room_endpoint` (`api.py:624-648`) to pass `secrets.randbits(63)` seed and attach `seat_tokens_by_color`:

```python
    catan_map = build_map(config.get("map_template", "BASE"))
    raw_seed = body.get("seed")
    seed = (
        int(raw_seed)
        if raw_seed is not None and not isinstance(raw_seed, bool)
        else secrets.randbits(63)
    )
    game = Game(
        players=players,
        seed=seed,
        discard_limit=int(config.get("discard_limit", 7)),
        friendly_robber=bool(config.get("friendly_robber", True)),
        vps_to_win=int(config.get("vps_to_win", 10)),
        catan_map=catan_map,
    )
    raw_meta = {
        seat["color"]: {
            "color": seat["color"],
            "seat_kind": (
                "BOT"
                if seat["player_key"] != "HUMAN"
                else ("USER" if seat.get("username") else "GUEST")
            ),
            "username": seat.get("username") if seat["player_key"] == "HUMAN" else None,
            "player_key": seat["player_key"],
            "display_name": seat.get("player_name") or seat["color"],
            "avatar_config": seat.get("avatar_config") or {},
        }
        for seat in seats
    }
    seat_tokens = {
        seat["color"]: seat.get("seat_token")
        for seat in seats
        if seat["player_key"] == "HUMAN"
    }
    seat_meta = init_presence_metadata(raw_meta, seat_tokens_by_color=seat_tokens)
    upsert_game_state(game, seat_metadata_by_color=seat_meta)
```

5. Add `_extract_seat_token()` helper and `/heartbeat`, `/abandon`, `/reclaim` endpoints, plus wire `maybe_promote_disconnected_seats` in `get_game_endpoint` and `post_action_endpoint`:

```python
def _extract_seat_token() -> str | None:
    hdr = request.headers.get("X-Seat-Token", "").strip()
    if hdr:
        return hdr
    body = request.get_json(silent=True) or {}
    if isinstance(body, dict):
        tok = body.get("seat_token") or body.get("token")
        if tok:
            return str(tok).strip()
    q_tok = request.args.get("seat_token")
    return str(q_tok).strip() if q_tok else None


@bp.route("/games/<string:game_id>/heartbeat", methods=("POST",))
def game_heartbeat_endpoint(game_id: str):
    stored = db.session.get(StoredGame, game_id)
    if stored is None:
        abort(404, description="Partida não encontrada")

    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        body = {}
    preferred_color = body.get("color") or body.get("seat") or request.args.get("as")
    auth_user = resolve_user_from_token(_extract_auth_token())
    seat_token = _extract_seat_token()
    seat_meta = load_game_seat_metadata(stored)

    caller_color = authorize_seat_caller(
        stored,
        seat_meta,
        preferred_color=str(preferred_color).upper() if preferred_color else None,
        auth_user=auth_user,
        seat_token=seat_token,
    )
    if caller_color is not None:
        touch_seat_heartbeat(game_id, caller_color)

    promoted = maybe_promote_disconnected_seats(game_id)
    fresh_meta = load_game_seat_metadata(db.session.get(StoredGame, game_id))
    bot_colors = [
        c for c, m in fresh_meta.items() if m.get("seat_kind") == "BOT"
    ]
    taken_over_colors = [
        c for c, m in fresh_meta.items() if m.get("taken_over_by_bot")
    ]
    target_color = caller_color or (str(preferred_color).upper() if preferred_color else None)
    my_seat_taken_over = bool(
        target_color and fresh_meta.get(target_color, {}).get("taken_over_by_bot")
    )
    return jsonify(
        {
            "ok": True,
            "bot_colors": bot_colors,
            "taken_over_colors": taken_over_colors,
            "my_seat_taken_over": my_seat_taken_over,
            "promoted_colors": promoted,
        }
    )


@bp.route("/games/<string:game_id>/abandon", methods=("POST",))
def abandon_game_endpoint(game_id: str):
    stored = db.session.get(StoredGame, game_id)
    if stored is None:
        abort(404, description="Partida não encontrada")

    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        body = {}
    preferred_color = body.get("color") or body.get("seat") or request.args.get("as")
    auth_user = resolve_user_from_token(_extract_auth_token())
    seat_token = _extract_seat_token()
    seat_meta = load_game_seat_metadata(stored)

    caller_color = authorize_seat_caller(
        stored,
        seat_meta,
        preferred_color=str(preferred_color).upper() if preferred_color else None,
        auth_user=auth_user,
        seat_token=seat_token,
    )
    if caller_color is None:
        abort(403, description="Sem permissão para abandonar este assento")
    if not is_multiplayer_game(stored, seat_meta):
        abort(400, description="Apenas partidas multiplayer permitem abandono para bot")

    promote_seat_to_bot(game_id, caller_color, reason="ABANDONED")
    game = get_game_state(game_id)
    view = _enrich_view_with_seats(game, web_view(game, _perspective(game)))
    return Response(response=json.dumps(view), status=200, mimetype="application/json")


@bp.route("/games/<string:game_id>/reclaim", methods=("POST",))
def reclaim_game_endpoint(game_id: str):
    stored = db.session.get(StoredGame, game_id)
    if stored is None:
        abort(404, description="Partida não encontrada")

    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        body = {}
    preferred_color = body.get("color") or body.get("seat") or request.args.get("as")
    auth_user = resolve_user_from_token(_extract_auth_token())
    seat_token = _extract_seat_token()
    seat_meta = load_game_seat_metadata(stored)

    caller_color = authorize_seat_caller(
        stored,
        seat_meta,
        preferred_color=str(preferred_color).upper() if preferred_color else None,
        auth_user=auth_user,
        seat_token=seat_token,
    )
    if caller_color is None:
        abort(403, description="Sem permissão para retomar este assento")

    if not reclaim_seat_from_bot(game_id, caller_color):
        abort(400, description="Este assento não está sob controle de bot")

    game = get_game_state(game_id)
    perspective = _perspective(game) or caller_color
    view = _enrich_view_with_seats(game, web_view(game, perspective))
    view["reclaimed_color"] = caller_color
    return Response(response=json.dumps(view), status=200, mimetype="application/json")
```

6. Update `get_game_endpoint` & `post_action_endpoint` (`api.py:656-715`):

```python
@bp.route("/games/<string:game_id>/states/<string:state_index>", methods=("GET",))
def get_game_endpoint(game_id, state_index):
    parsed_state_index = _parse_state_index(state_index)
    if parsed_state_index is None:
        maybe_promote_disconnected_seats(game_id)
    game = get_game_state(game_id, parsed_state_index)
    if game is None:
        abort(404, description="Resource not found")

    view = _enrich_view_with_seats(game, web_view(game, _perspective(game)))
    return Response(
        response=json.dumps(view),
        status=200,
        mimetype="application/json",
    )


@bp.route("/games/<string:game_id>/actions", methods=["POST"])
def post_action_endpoint(game_id):
    body_is_empty = (not request.data) or request.json is None or request.json == {}
    bot_only = request.args.get("bot_only") == "1"

    if not body_is_empty and isinstance(request.json, list) and len(request.json) >= 2:
        stored = db.session.get(StoredGame, game_id)
        if stored is not None:
            seat_meta = load_game_seat_metadata(stored)
            auth_user = resolve_user_from_token(_extract_auth_token())
            seat_token = _extract_seat_token()
            action_color = str(request.json[0]).upper()
            verified_color = authorize_seat_caller(
                stored,
                seat_meta,
                preferred_color=action_color,
                auth_user=auth_user,
                seat_token=seat_token,
            )
            if verified_color:
                touch_seat_heartbeat(game_id, verified_color)

    maybe_promote_disconnected_seats(game_id)
    game = get_game_state(game_id)
    if game is None:
        abort(404, description="Resource not found")

    if game.winning_color() is not None:
        record_completed_match(game)
        view = _enrich_view_with_seats(game, web_view(game, _perspective(game)))
        return Response(
            response=json.dumps(view),
            status=200,
            mimetype="application/json",
        )

    if bot_only and body_is_empty and not game.state.current_player().is_bot:
        view = _enrich_view_with_seats(game, web_view(game, _perspective(game)))
        return Response(
            response=json.dumps(view),
            status=200,
            mimetype="application/json",
        )

    if game.state.current_player().is_bot or body_is_empty:
        game.play_tick()
        upsert_game_state(game)
    else:
        action = action_from_json(request.json)
        game.execute(action)
        upsert_game_state(game)

    if game.winning_color() is not None:
        record_completed_match(game)

    view = _enrich_view_with_seats(game, web_view(game, _perspective(game)))
    return Response(
        response=json.dumps(view),
        status=200,
        mimetype="application/json",
    )
```

7. Mirror `catanatron/catanatron/web/models.py` and `catanatron/catanatron/web/api.py` into `api/catanatron/web/`:

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
Copy-Item "catanatron\catanatron\web\models.py" "api\catanatron\web\models.py" -Force
Copy-Item "catanatron\catanatron\web\api.py" "api\catanatron\web\api.py" -Force
```

- [ ] **Step 4: Run full web pytest suite (including parity check)**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v
```
Expected: All tests in `tests/web/` PASS, including `test_vercel_api_catanatron_mirrors_core_package` and `test_takeover_and_turn_order.py`.

- [ ] **Step 5: Commit Task 2**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add catanatron/catanatron/web/api.py api/catanatron/web/models.py api/catanatron/web/api.py tests/web/test_takeover_and_turn_order.py
git commit -m "feat(api): add heartbeat, abandon, reclaim, bot_only and CSPRNG game seed"
```

---

### Task 3: Frontend Types, Room-Token Mapping, `botCatalog` Takeover Guard & `localEngine` Shuffle + Presence

**Files:**
- Modify: `ui/src/utils/api.types.ts:180-258`
- Modify: `ui/src/config/botCatalog.ts:136-250`
- Modify: `ui/src/utils/apiClient.ts:740-842`
- Modify: `ui/src/pages/RoomLobbyPage.tsx:53-70,260-274,470-495`
- Modify: `ui/src/pages/HomePage.tsx:336-341`
- Modify: `ui/src/utils/localEngine.ts:185-195,434-556,1385-1425,1570-1825,2525-2579`
- Modify: `ui/src/utils/localEngineTrade.test.ts:36-152`
- Create: `ui/src/utils/localEngineBloco5.test.ts`

**Interfaces:**
- Produces in `ui/src/utils/api.types.ts`:
  - `SeatTakeoverInfo = { taken_over: boolean; reason: "ABANDONED" | "DISCONNECTED" | string | null; original_username?: string | null; original_display_name?: string | null }`
  - `GameState.taken_over_colors?: Color[]`
  - `GameState.seat_takeover?: Partial<Record<Color, SeatTakeoverInfo>>`
- Produces in `ui/src/utils/apiClient.ts`:
  - `postAction(gameId, action?, options?: { botOnly?: boolean })`
  - `sendGameHeartbeat(gameId, color?)`, `abandonGame(gameId, color?)`, `reclaimGame(gameId, color?)`
  - `saveGameRoomCode(gameId, roomCode)`, `getGameRoomCode(gameId)`, `getGameSeatToken(gameId, roomCode?)`
- Produces in `ui/src/utils/localEngine.ts`:
  - Fisher-Yates CSPRNG turn-order shuffle inside `localCreateGame` (preserving each seat's assigned color & metadata while randomizing `colors` order and `colors[0]`)
  - `localGameHeartbeat`, `localAbandonGame`, `localReclaimGame`

- [ ] **Step 1: Write failing tests for CSPRNG turn-order shuffle, `<Name> (Bot)` preservation, and local abandon/reclaim parity**

Create `ui/src/utils/localEngineBloco5.test.ts`:

```ts
import { afterEach, describe, expect, test } from "vitest";
import {
  BOT_AVATAR_PROFILES,
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { saveGuestProfile } from "../config/avatarCatalog";
import {
  localAbandonGame,
  localCreateGame,
  localCreateRoom,
  localGameHeartbeat,
  localGetState,
  localJoinRoom,
  localReclaimGame,
  localStartRoomGame,
} from "./localEngine";
import { makeGameState } from "../test/fixtures";

afterEach(() => {
  localStorage.clear();
});

describe("Bloco 5 turn order shuffle, takeover names and offline presence", () => {
  test("localCreateGame shuffles turn order and starter across games while keeping color assignments", () => {
    saveGuestProfile({
      displayName: "Navegante",
      avatarConfig: { hat: "explorer", background: "sunset", frame: "wood" },
    });

    const starters = new Set<string>();
    for (let i = 0; i < 30; i++) {
      localStorage.removeItem("catan_local_games_v1");
      const gid = localCreateGame({
        players: ["HUMAN", "CATANATRON", "F", "MCTS"],
        mapTemplate: "BASE",
        vpsToWin: 10,
        discardLimit: 7,
        friendlyRobber: true,
      });
      const st = localGetState(gid);
      starters.add(st.colors[0]);
      expect(st.current_color).toBe(st.colors[0]);
      expect(st.seat_names?.RED).toBe("Navegante");
      expect(st.bot_colors).not.toContain("RED");
      expect(st.bot_colors).toHaveLength(3);
    }

    expect(starters.size).toBeGreaterThanOrEqual(2);
  });

  test("taken-over seat keeps '<OrigName> (Bot)' name and original avatar instead of replacing with Creitu", () => {
    const st = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["BLUE"],
      taken_over_colors: ["BLUE"],
      seat_names: { RED: "Alice", BLUE: "João (Bot)" },
      seat_avatars: {
        RED: { seat_kind: "USER", username: "alice", avatar_config: {} },
        BLUE: {
          seat_kind: "BOT",
          username: null,
          avatar_config: { hat: "captain", background: "ocean", frame: "wood" },
        },
      },
      seat_takeover: {
        BLUE: {
          taken_over: true,
          reason: "ABANDONED",
          original_username: "joao",
          original_display_name: "João",
        },
      },
    });

    expect(resolvePlayerDisplayName(st, "BLUE", "Azul")).toBe("João (Bot)");
    const resolved = resolveSeatAvatarProps({
      color: "BLUE",
      isBot: true,
      isTakenOver: true,
      seatIndex: 1,
      seatName: "João (Bot)",
      seatAvatar: st.seat_avatars?.BLUE,
    });
    expect(resolved.config?.hat).toBe("captain");
    expect(resolved.username).toBe("joao");
    expect(resolved.config).not.toEqual(BOT_AVATAR_PROFILES.Creitu);
  });

  test("localAbandonGame and localReclaimGame toggle bot control while preserving board and hand", () => {
    const hostRoom = localCreateRoom({
      hostName: "Ana",
      players: ["HUMAN", "HUMAN"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    localJoinRoom(hostRoom.room_code, { playerName: "Beto" });
    const started = localStartRoomGame(hostRoom.room_code, hostRoom.seat_token);

    const before = localGetState(started.game_id);
    expect(before.bot_colors).toEqual([]);

    const abandoned = localAbandonGame(started.game_id, "BLUE");
    expect(abandoned.bot_colors).toContain("BLUE");
    expect(abandoned.seat_names?.BLUE).toBe("Beto (Bot)");
    expect(abandoned.seat_takeover?.BLUE?.taken_over).toBe(true);
    expect(abandoned.seat_takeover?.BLUE?.reason).toBe("ABANDONED");

    const hb = localGameHeartbeat(started.game_id, "RED");
    expect(hb.ok).toBe(true);
    expect(hb.bot_colors).toContain("BLUE");
    expect(hb.taken_over_colors).toContain("BLUE");

    const reclaimed = localReclaimGame(started.game_id, "BLUE");
    expect(reclaimed.bot_colors).not.toContain("BLUE");
    expect(reclaimed.seat_names?.BLUE).toBe("Beto");
    expect(reclaimed.seat_takeover?.BLUE?.taken_over).toBe(false);
  });
});
```

- [ ] **Step 2: Run Vitest on the new test to verify failure**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx vitest run src/utils/localEngineBloco5.test.ts
```
Expected: Fails (`localAbandonGame` not exported, `starters.size === 1`).

- [ ] **Step 3: Update `ui/src/utils/api.types.ts` and `ui/src/config/botCatalog.ts`**

1. In `ui/src/utils/api.types.ts`:
   - Add `SeatTakeoverInfo` before `GameState`:

```ts
export type SeatTakeoverInfo = {
  taken_over: boolean;
  reason: "ABANDONED" | "DISCONNECTED" | string | null;
  original_username?: string | null;
  original_display_name?: string | null;
};
```

   - Add to `GameState` (after `room_code?: string;`):

```ts
  taken_over_colors?: Color[];
  seat_takeover?: Partial<Record<Color, SeatTakeoverInfo>>;
```

2. In `ui/src/config/botCatalog.ts`:
   - Update `resolvePlayerDisplayName` and `resolveSeatAvatarProps` to preserve `"<Name> (Bot)"` and original user/guest avatar when taken over:

```ts
export function isTakenOverSeat(
  gameState: Pick<GameState, "taken_over_colors" | "seat_takeover" | "seat_names">,
  color: Color
): boolean {
  if ((gameState.taken_over_colors || []).includes(color)) return true;
  if (gameState.seat_takeover?.[color]?.taken_over) return true;
  const raw = gameState.seat_names?.[color]?.trim();
  return Boolean(raw && raw.endsWith(" (Bot)"));
}

export function resolvePlayerDisplayName(
  gameState: Pick<
    GameState,
    "colors" | "bot_colors" | "seat_names" | "taken_over_colors" | "seat_takeover"
  >,
  color: Color,
  fallbackColorLabel: string
): string {
  const isBot = (gameState.bot_colors || []).includes(color);
  const raw = gameState.seat_names?.[color]?.trim();
  if (isBot && isTakenOverSeat(gameState, color)) {
    const orig = gameState.seat_takeover?.[color]?.original_display_name;
    return raw || (orig ? `${orig} (Bot)` : `${fallbackColorLabel} (Bot)`);
  }
  if (isBot) {
    return resolveBotDisplayName(gameState, color);
  }
  if (raw && !LEGACY_COLOR_NAME_RE.test(raw)) {
    return raw;
  }
  return raw || fallbackColorLabel;
}
```

   - Inside `resolveSeatAvatarProps`, add `isTakenOver?: boolean` parameter and branch **before** normal `isBot`:

```ts
  isTakenOver = false,
```

```ts
  if ((isBot || seatAvatar?.seat_kind === "BOT") && isTakenOver) {
    const metaCfg = sanitizeAvatarConfig(seatAvatar?.avatar_config);
    const localAccountCfg = isMySeat ? sanitizeAvatarConfig(accountAvatar) : {};
    const localGuestCfg =
      isMySeat && !accountUsername ? sanitizeAvatarConfig(guestCustomAvatar) : {};
    const merged = { ...metaCfg, ...localGuestCfg, ...localAccountCfg };
    return {
      config: Object.keys(merged).length > 0 ? merged : undefined,
      username: seatAvatar?.username || accountUsername || seatName.replace(/ \(Bot\)$/, "") || color,
      isCustomUserOrGuest: Object.keys(merged).length > 0,
    };
  }
```

(Pass `originalUsername` optionally or let `PlayerTopBar` pass `seatTakeover?.original_username || accountUsername` — notice in our test `seatName: "João (Bot)"`, wait: let's add `originalUsername?: string | null` to `resolveSeatAvatarProps` options and return `seatTakeoverUsername || seatAvatar?.username || accountUsername || ...` -> guarantees exact `"joao"` when `seat_takeover.BLUE.original_username` is `"joao"`!). Add:
```ts
  originalUsername?: string | null;
```
to `resolveSeatAvatarProps` options, and in the taken-over branch set:
```ts
      username:
        originalUsername ||
        seatAvatar?.username ||
        accountUsername ||
        seatName.replace(/ \(Bot\)$/, "") ||
        color,
```

- [ ] **Step 4: Update `ui/src/utils/apiClient.ts`, `ui/src/pages/RoomLobbyPage.tsx`, and `ui/src/pages/HomePage.tsx`**

1. In `ui/src/utils/apiClient.ts`:
   - Import `localAbandonGame`, `localGameHeartbeat`, `localReclaimGame` from `./localEngine`.
   - Add game <-> room mapping and token helpers:

```ts
export function saveGameRoomCode(gameId: string, roomCode?: string | null) {
  try {
    if (gameId && roomCode) {
      localStorage.setItem(`catan_game_room_${gameId}`, roomCode.toUpperCase());
    }
  } catch {
    // ignore storage errors
  }
}

export function getGameRoomCode(gameId: string): string | null {
  try {
    return localStorage.getItem(`catan_game_room_${gameId}`);
  } catch {
    return null;
  }
}

export function getGameSeatToken(gameId: string, explicitRoomCode?: string | null): string | null {
  try {
    const code = explicitRoomCode?.toUpperCase() || getGameRoomCode(gameId);
    if (code) {
      const roomTok = localStorage.getItem(`catan_room_token_${code}`);
      if (roomTok) return roomTok;
    }
    return getSavedAccount()?.auth_token ?? null;
  } catch {
    return null;
  }
}

function presenceHeaders(gameId: string, roomCode?: string | null): Record<string, string> {
  const seatTok = getGameSeatToken(gameId, roomCode);
  return {
    ...authHeaders(),
    ...(seatTok ? { "X-Seat-Token": seatTok } : {}),
  };
}
```

   - Update `getState` (`if (response.data.room_code) saveGameRoomCode(gameId, response.data.room_code)`) and `postAction`:

```ts
/** action=undefined means bot action */
export async function postAction(
  gameId: string,
  action?: GameAction,
  options?: { botOnly?: boolean }
): Promise<GameState> {
  if (gameId.startsWith("local-")) {
    return localPostAction(gameId, action, options);
  }
  try {
    const params = {
      ...viewParams(),
      ...(options?.botOnly ? { bot_only: "1" } : {}),
    };
    const response = await axios.post<GameState>(
      `${API_URL}/api/games/${gameId}/actions`,
      action,
      { params, headers: presenceHeaders(gameId) }
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      Array.isArray(response.data.tiles)
    ) {
      if (response.data.room_code) {
        saveGameRoomCode(gameId, response.data.room_code);
      }
      return response.data;
    }
  } catch {
    // Fallback to local engine
  }
  return localPostAction(gameId, action, options);
}

export async function sendGameHeartbeat(
  gameId: string,
  color?: Color | null
): Promise<{
  ok: boolean;
  bot_colors: Color[];
  taken_over_colors: Color[];
  my_seat_taken_over: boolean;
}> {
  if (gameId.startsWith("local-")) {
    return localGameHeartbeat(gameId, color);
  }
  try {
    const response = await axios.post(
      `${API_URL}/api/games/${gameId}/heartbeat`,
      { color: color ?? undefined },
      { params: viewParams(), headers: presenceHeaders(gameId) }
    );
    if (response.data && response.data.ok) {
      return response.data;
    }
  } catch {
    // Ignore transient errors cleanly
  }
  return {
    ok: false,
    bot_colors: [],
    taken_over_colors: [],
    my_seat_taken_over: false,
  };
}

export async function abandonGame(
  gameId: string,
  color?: Color | null
): Promise<GameState> {
  if (gameId.startsWith("local-")) {
    return localAbandonGame(gameId, color);
  }
  const response = await axios.post<GameState>(
    `${API_URL}/api/games/${gameId}/abandon`,
    { color: color ?? undefined },
    { params: viewParams(), headers: presenceHeaders(gameId) }
  );
  return response.data;
}

export async function reclaimGame(
  gameId: string,
  color?: Color | null
): Promise<GameState> {
  if (gameId.startsWith("local-")) {
    return localReclaimGame(gameId, color);
  }
  const response = await axios.post<GameState>(
    `${API_URL}/api/games/${gameId}/reclaim`,
    { color: color ?? undefined },
    { params: viewParams(), headers: presenceHeaders(gameId) }
  );
  return response.data;
}
```

2. In `ui/src/pages/RoomLobbyPage.tsx` (`handleStartGame` line 264 and auto-navigate effect around line 480 — let's save `saveGameRoomCode(res.game_id, res.room.room_code)` whenever `saveGameSeat` runs!) and `ui/src/pages/HomePage.tsx` (inside `onOpenMatch` lines 336-340, save `saveGameSeat(gameId, myColor)` before navigating!).

Let's read lines 465-505 of `RoomLobbyPage.tsx` right now before finalizing the exact line note? Wait — no tool needed unless writing; we know `RoomLobbyPage.tsx` calls `saveGameSeat(room.game_id, room.my_color)` wherever it navigates to `/games/${room.game_id}`: inside `handleStartGame` and inside the `useEffect` watching `room.status === "IN_PROGRESS" && room.game_id`. Calling `saveGameRoomCode` alongside both covers 100% of room joins!

- [ ] **Step 5: Implement CSPRNG turn-order shuffle and offline takeover/reclaim in `ui/src/utils/localEngine.ts`, and update `localEngineTrade.test.ts`**

1. In `ui/src/utils/localEngine.ts`:
   - Upgrade `shuffle<T>(items: T[]): T[]` to use `crypto.getRandomValues` (falling back to `Math.random` only if `crypto` is unavailable):

```ts
function randomIndex(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const gCrypto =
    typeof globalThis !== "undefined" ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (gCrypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let val = 0;
    do {
      gCrypto.getRandomValues(arr);
      val = arr[0];
    } while (val >= limit);
    return val % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
```

   - Extend `LocalSeatMeta`:

```ts
export type LocalSeatMeta = {
  color: Color;
  seat_kind: "USER" | "GUEST" | "BOT";
  username: string | null;
  player_key: string;
  display_name: string;
  avatar_config?: Partial<AvatarConfig> | null;
  original_player_key?: string;
  original_seat_kind?: "USER" | "GUEST" | "BOT";
  original_username?: string | null;
  original_display_name?: string;
  original_avatar_config?: Partial<AvatarConfig> | null;
  last_seen_at?: number;
  taken_over_by_bot?: boolean;
  takeover_reason?: string | null;
};
```

   - Update `buildSeatViewsFromMeta(seatMeta)` to return `{ seatNames, seatAvatars, takenOverColors, seatTakeover }` and preserve `"<OrigName> (Bot)"` + original user/guest avatar when `meta.taken_over_by_bot === true`.
   - In `localCreateGame`:
     - Build paired entries `rawPairs = SEAT_COLORS.slice(0, count).map((color, idx) => ({ color, playerKey: options.players[idx] || "HUMAN" }))`.
     - Build `resolvedSeatMeta` over `rawPairs` (so user/guest remains on their configured color `RED` etc., while ensuring `original_*`, `last_seen_at`, `taken_over_by_bot: false`, `takeover_reason: null` are set on all entries).
     - Shuffle `seatPairs = shuffle(rawPairs)` cleanly!
     - Derive `colors = seatPairs.map((p) => p.color)` and `botColors = seatPairs.filter((p) => p.playerKey !== "HUMAN").map((p) => p.color)`.
     - Set `state.colors = colors`, `state.current_color = colors[0]`, `state.bot_colors = botColors`, and build `initialQueue` from `colors`.
   - In `localGetState` & `localPostAction`:
     - Attach `taken_over_colors` and `seat_takeover` onto the returned cloned `GameState`.
     - In `localPostAction(gameId, action, options)`: if `options?.botOnly && !action && !game.state.bot_colors.includes(game.state.current_color)`, return cloned state unchanged (no-op parity with backend `?bot_only=1`!).
   - In `applyActionToGame` match completion (`recordLocalMatchIfFinished` section, lines 1392-1420):
     - If `meta[c]?.taken_over_by_bot` is true, record `seat_kind: "BOT"`, `username: null`, `player_key: "CATANATRON"`, `display_name: meta[c].display_name`.
   - Add exported offline presence functions: `localGameHeartbeat`, `localAbandonGame`, `localReclaimGame`:

```ts
export function localGameHeartbeat(
  gameId: string,
  color?: Color | null
): {
  ok: boolean;
  bot_colors: Color[];
  taken_over_colors: Color[];
  my_seat_taken_over: boolean;
} {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game) {
    return {
      ok: true,
      bot_colors: [],
      taken_over_colors: [],
      my_seat_taken_over: false,
    };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (color && game.seatMeta?.[color] && !game.seatMeta[color].taken_over_by_bot) {
    game.seatMeta[color].last_seen_at = nowSec;
    saveGamesMap(map);
  }
  const takenOver = Object.entries(game.seatMeta || {})
    .filter(([, m]) => Boolean(m?.taken_over_by_bot))
    .map(([c]) => c as Color);
  return {
    ok: true,
    bot_colors: [...game.state.bot_colors],
    taken_over_colors: takenOver,
    my_seat_taken_over: Boolean(color && game.seatMeta?.[color]?.taken_over_by_bot),
  };
}

export function localAbandonGame(
  gameId: string,
  color?: Color | null
): GameState {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game) return localGetState(gameId, "latest");

  const targetColor =
    color ||
    game.state.colors.find((c) => !game.state.bot_colors.includes(c)) ||
    game.state.colors[0];

  if (!game.seatMeta) game.seatMeta = {} as Record<Color, LocalSeatMeta>;
  const existing = game.seatMeta[targetColor] || {
    color: targetColor,
    seat_kind: "GUEST",
    username: null,
    player_key: "HUMAN",
    display_name:
      game.state.seat_names?.[targetColor] || PLAYER_COLOR_META[targetColor].label,
    avatar_config: {},
  };
  const origName =
    existing.original_display_name ||
    existing.display_name ||
    PLAYER_COLOR_META[targetColor].label;
  game.seatMeta[targetColor] = {
    ...existing,
    original_player_key: existing.original_player_key || existing.player_key || "HUMAN",
    original_seat_kind: existing.original_seat_kind || existing.seat_kind || "GUEST",
    original_username:
      existing.original_username !== undefined
        ? existing.original_username
        : existing.username,
    original_display_name: origName,
    original_avatar_config:
      existing.original_avatar_config || existing.avatar_config || {},
    taken_over_by_bot: true,
    takeover_reason: "ABANDONED",
    player_key: "CATANATRON",
    seat_kind: "BOT",
    username: null,
    display_name: origName.endsWith(" (Bot)") ? origName : `${origName} (Bot)`,
  };
  if (!game.state.bot_colors.includes(targetColor)) {
    game.state.bot_colors = [...game.state.bot_colors, targetColor];
  }
  recomputeScoresAndPlayableActions(game);
  saveGamesMap(map);
  return localGetState(gameId, "latest");
}

export function localReclaimGame(
  gameId: string,
  color?: Color | null
): GameState {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game || !game.seatMeta) return localGetState(gameId, "latest");

  const targetColor =
    color ||
    (Object.keys(game.seatMeta).find(
      (c) => game.seatMeta?.[c as Color]?.taken_over_by_bot
    ) as Color | undefined);
  if (!targetColor || !game.seatMeta[targetColor]) {
    return localGetState(gameId, "latest");
  }

  const meta = game.seatMeta[targetColor];
  const origKey = meta.original_player_key || "HUMAN";
  const origKind = meta.original_seat_kind || "GUEST";
  game.seatMeta[targetColor] = {
    ...meta,
    taken_over_by_bot: false,
    takeover_reason: null,
    player_key: origKey,
    seat_kind: origKind,
    username: origKind === "USER" ? meta.original_username ?? null : null,
    display_name:
      meta.original_display_name || PLAYER_COLOR_META[targetColor].label,
    avatar_config: meta.original_avatar_config || meta.avatar_config || {},
    last_seen_at: Math.floor(Date.now() / 1000),
  };
  game.state.bot_colors = game.state.bot_colors.filter((c) => c !== targetColor);
  recomputeScoresAndPlayableActions(game);
  saveGamesMap(map);
  return localGetState(gameId, "latest");
}
```

2. Update `ui/src/utils/localEngineTrade.test.ts` so `advanceToPostRollHumanTurn` handles shuffled turn order (instead of assuming `RED` starts first at index 0!):

```ts
function advanceToPostRollHumanTurn(gameId: string): GameState {
  let state = localGetState(gameId);
  while (state.is_initial_build_phase) {
    state = state.bot_colors.includes(state.current_color)
      ? localPostAction(gameId)
      : localPostAction(gameId, state.current_playable_actions[0]);
  }
  let guard = 0;
  while (
    (state.current_color !== "RED" || state.current_prompt !== "PLAY_TURN") &&
    guard < 40
  ) {
    guard += 1;
    if (state.bot_colors.includes(state.current_color)) {
      state = localPostAction(gameId);
      continue;
    }
    const k = `P${state.colors.indexOf(state.current_color)}`;
    if (state.current_prompt === "PLAY_TURN" && !state.player_state[`${k}_HAS_ROLLED`]) {
      state = localPostAction(gameId, [state.current_color, "ROLL", null]);
    } else if (state.current_prompt === "MOVE_ROBBER") {
      state = localPostAction(gameId, state.current_playable_actions[0]);
    } else if (state.current_prompt === "DISCARD") {
      state = localPostAction(gameId, state.current_playable_actions[0]);
    } else {
      state = localPostAction(gameId, [state.current_color, "END_TURN", null]);
    }
  }
  const k = `P${state.colors.indexOf("RED")}`;
  if (state.current_prompt === "PLAY_TURN" && !state.player_state[`${k}_HAS_ROLLED`]) {
    state = localPostAction(gameId, ["RED", "ROLL", null]);
  }
  while (state.current_prompt === "DISCARD" || state.current_prompt === "MOVE_ROBBER") {
    state = state.bot_colors.includes(state.current_color)
      ? localPostAction(gameId)
      : localPostAction(gameId, state.current_playable_actions[0]);
  }
  return state;
}
```

And in test 1 (`ui/src/utils/localEngineTrade.test.ts:92-120`), look up bots dynamically relative to `state.colors` (`orderAfterRed` = `[1..n]` wrapping around from `redIdx`), `redIdx = state.colors.indexOf("RED")`, `blueIdx = state.colors.indexOf("BLUE")`, checking `state.acceptees[blueIdx] === true`, `state.player_state[`P${redIdx}_BRICK_IN_HAND`]`, and `state.player_state[`P${blueIdx}_WHEAT_IN_HAND`]`; and similarly in test 2 (`P${blueIdx}_ORE_IN_HAND`).

- [ ] **Step 6: Run Vitest unit tests (`localEngineBloco5`, `localEngineTrade`, `apiClient`) and typecheck**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run src/utils/localEngineBloco5.test.ts src/utils/localEngineTrade.test.ts src/utils/apiClient.test.ts
```
Expected: All type checks and Vitest specs PASS cleanly.

- [ ] **Step 7: Commit Task 3**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/utils/api.types.ts ui/src/config/botCatalog.ts ui/src/utils/apiClient.ts ui/src/pages/RoomLobbyPage.tsx ui/src/pages/HomePage.tsx ui/src/utils/localEngine.ts ui/src/utils/localEngineTrade.test.ts ui/src/utils/localEngineBloco5.test.ts
git commit -m "feat(frontend-core): add CSPRNG turn shuffle, seat token routing and localEngine takeover parity"
```

---

### Task 4: Tabletop Pacing Module & Animated 2D6 Dice Overlay / Console Pill

**Files:**
- Create: `ui/src/utils/tabletopPacing.ts`
- Create: `ui/src/components/DiceRollOverlay.tsx`
- Create: `ui/src/components/DiceRollOverlay.scss`
- Modify: `ui/src/pages/ActionsToolbar.tsx:85-95,611-634`
- Modify: `ui/src/pages/ActionsToolbar.scss:302-345`
- Create: `ui/src/utils/tabletopPacing.test.ts`
- Create: `ui/src/components/DiceRollOverlay.test.tsx`

**Interfaces:**
- Produces in `ui/src/utils/tabletopPacing.ts`:
  - `GameSpeed = "normal" | "fast"`
  - `GAME_SPEED_STORAGE_KEY = "catan_game_speed_v1"`
  - `getSavedGameSpeed()`, `saveGameSpeed(speed)`, `getSpeedMultiplier(speed)`
  - `getRollSpinDurationMs(speed): number` (`550` normal / `275` fast)
  - `getActionDelayMs(record, speed, options?: { requiresLocalHumanPrompt?: boolean }): number`
  - `extractTransitionVisuals(record): { recentNodeId: number | null; recentEdgeId: string | null; boughtDevColor: Color | null; rollDice: [number, number] | null; rollColor: Color | null; actionIcon: string }`
  - `electBotCoordinator(gameState, mySeatColor): boolean`
- Produces in `ui/src/components/DiceRollOverlay.tsx`:
  - `<DiceRollOverlay open rolling dice rollerName rollerColor />`

- [ ] **Step 1: Write failing tests for pacing delays, coordinator election, and animated 2D6 dice stage**

Create `ui/src/utils/tabletopPacing.test.ts`:

```ts
import { afterEach, describe, expect, test } from "vitest";
import {
  electBotCoordinator,
  extractTransitionVisuals,
  getActionDelayMs,
  getRollSpinDurationMs,
  getSavedGameSpeed,
  saveGameSpeed,
} from "./tabletopPacing";
import { makeGameState } from "../test/fixtures";

afterEach(() => {
  localStorage.clear();
});

describe("tabletopPacing", () => {
  test("persists normal (default) and fast (0.5x) speed multipliers", () => {
    expect(getSavedGameSpeed()).toBe("normal");
    expect(getActionDelayMs([["RED", "ROLL", null], [3, 5]], "normal")).toBe(1800);
    expect(getRollSpinDurationMs("normal")).toBe(550);

    saveGameSpeed("fast");
    expect(getSavedGameSpeed()).toBe("fast");
    expect(getActionDelayMs([["RED", "ROLL", null], [3, 5]], "fast")).toBe(900);
    expect(getRollSpinDurationMs("fast")).toBe(275);
    expect(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "normal")).toBe(1200);
    expect(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "fast")).toBe(600);
    expect(getActionDelayMs([["RED", "END_TURN", null], null], "normal")).toBe(650);
    expect(getActionDelayMs([["RED", "DISCARD_RESOURCE", "WOOD"], "WOOD"], "normal")).toBe(400);
    expect(
      getActionDelayMs([["RED", "OFFER_TRADE", [1,0,0,0,0,0,1,0,0,0]], null], "normal", {
        requiresLocalHumanPrompt: true,
      })
    ).toBeLessThanOrEqual(400);
  });

  test("extracts canonical recent node, edge, dev card and roll metadata", () => {
    expect(
      extractTransitionVisuals([["BLUE", "BUILD_ROAD", [9, 3]], null])
    ).toMatchObject({
      recentNodeId: null,
      recentEdgeId: "3,9",
      boughtDevColor: null,
    });
    expect(
      extractTransitionVisuals([["RED", "BUILD_CITY", 14], null])
    ).toMatchObject({
      recentNodeId: 14,
      recentEdgeId: null,
    });
    expect(
      extractTransitionVisuals([["ORANGE", "BUY_DEVELOPMENT_CARD", null], "KNIGHT"])
    ).toMatchObject({
      boughtDevColor: "ORANGE",
    });
    expect(
      extractTransitionVisuals([["RED", "ROLL", null], [2, 6]])
    ).toMatchObject({
      rollDice: [2, 6],
      rollColor: "RED",
    });
  });

  test("elects only first active non-bot human seat as multiplayer bot coordinator", () => {
    const mpState = makeGameState({
      room_code: "ROOM42",
      colors: ["RED", "BLUE", "ORANGE"],
      bot_colors: ["RED"],
    });
    expect(electBotCoordinator(mpState, "BLUE")).toBe(true);
    expect(electBotCoordinator(mpState, "ORANGE")).toBe(false);
    expect(electBotCoordinator(mpState, null)).toBe(false);

    const soloState = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["RED"],
    });
    expect(electBotCoordinator(soloState, "BLUE")).toBe(true);
    expect(electBotCoordinator(soloState, null)).toBe(true);
  });
});
```

Create `ui/src/components/DiceRollOverlay.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import DiceRollOverlay from "./DiceRollOverlay";

afterEach(() => {
  vi.useRealTimers();
});

describe("DiceRollOverlay", () => {
  test("animates cycling dice faces while rolling and settles cleanly on the rolled sum", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <DiceRollOverlay
        open
        rolling
        dice={[4, 4]}
        rollerName="Creitu"
        rollerColor="RED"
      />
    );

    expect(screen.getByText(/Creitu/i)).toBeInTheDocument();
    expect(screen.getByText(/Rolando/i)).toBeInTheDocument();
    expect(screen.queryByText(/Total 8/i)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender(
      <DiceRollOverlay
        open
        rolling={false}
        dice={[4, 4]}
        rollerName="Creitu"
        rollerColor="RED"
      />
    );

    expect(screen.getByText(/Total 8/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Dado 4/i)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run Vitest to confirm failures before implementation**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx vitest run src/utils/tabletopPacing.test.ts src/components/DiceRollOverlay.test.tsx
```
Expected: Import failures because files do not exist yet.

- [ ] **Step 3: Implement `ui/src/utils/tabletopPacing.ts`**

Write `ui/src/utils/tabletopPacing.ts`:

```ts
import type { Color, GameActionRecord, GameState } from "./api.types";

export type GameSpeed = "normal" | "fast";

export const GAME_SPEED_STORAGE_KEY = "catan_game_speed_v1";

export function getSavedGameSpeed(): GameSpeed {
  try {
    return localStorage.getItem(GAME_SPEED_STORAGE_KEY) === "fast"
      ? "fast"
      : "normal";
  } catch {
    return "normal";
  }
}

export function saveGameSpeed(speed: GameSpeed): void {
  try {
    localStorage.setItem(GAME_SPEED_STORAGE_KEY, speed);
  } catch {
    // ignore storage errors
  }
}

export function getSpeedMultiplier(speed: GameSpeed): number {
  return speed === "fast" ? 0.5 : 1;
}

export function getRollSpinDurationMs(speed: GameSpeed): number {
  return Math.round(550 * getSpeedMultiplier(speed));
}

export function getActionDelayMs(
  record: GameActionRecord | undefined,
  speed: GameSpeed,
  options?: { requiresLocalHumanPrompt?: boolean }
): number {
  const mult = getSpeedMultiplier(speed);
  if (options?.requiresLocalHumanPrompt) {
    return Math.round(250 * mult);
  }
  if (!record || !record[0]) {
    return Math.round(650 * mult);
  }
  switch (record[0][1]) {
    case "ROLL":
      return Math.round(1800 * mult);
    case "END_TURN":
      return Math.round(650 * mult);
    case "DISCARD_RESOURCE":
      return Math.round(400 * mult);
    case "OFFER_TRADE":
    case "ACCEPT_TRADE":
    case "REJECT_TRADE":
    case "CONFIRM_TRADE":
    case "CANCEL_TRADE":
      return Math.round(950 * mult);
    default:
      return Math.round(1200 * mult);
  }
}

export type TransitionVisuals = {
  recentNodeId: number | null;
  recentEdgeId: string | null;
  boughtDevColor: Color | null;
  rollDice: [number, number] | null;
  rollColor: Color | null;
  actionIcon: string;
};

export function extractTransitionVisuals(
  record?: GameActionRecord
): TransitionVisuals {
  if (!record || !record[0]) {
    return {
      recentNodeId: null,
      recentEdgeId: null,
      boughtDevColor: null,
      rollDice: null,
      rollColor: null,
      actionIcon: "🎲",
    };
  }
  const [action, result] = record;
  const [color, actionType, value] = action;
  switch (actionType) {
    case "ROLL": {
      const pair =
        Array.isArray(result) && result.length === 2
          ? ([Number(result[0]), Number(result[1])] as [number, number])
          : null;
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: pair,
        rollColor: color,
        actionIcon: "🎲",
      };
    }
    case "BUILD_SETTLEMENT":
      return {
        recentNodeId: Number(value),
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🏠",
      };
    case "BUILD_CITY":
      return {
        recentNodeId: Number(value),
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🏰",
      };
    case "BUILD_ROAD": {
      const pair = Array.isArray(value) ? value : [0, 0];
      const u = Math.min(Number(pair[0]), Number(pair[1]));
      const v = Math.max(Number(pair[0]), Number(pair[1]));
      return {
        recentNodeId: null,
        recentEdgeId: `${u},${v}`,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🛤️",
      };
    }
    case "BUY_DEVELOPMENT_CARD":
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: color,
        rollDice: null,
        rollColor: null,
        actionIcon: "🃏",
      };
    case "MOVE_ROBBER":
    case "PLAY_KNIGHT_CARD":
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🥷",
      };
    case "OFFER_TRADE":
    case "ACCEPT_TRADE":
    case "REJECT_TRADE":
    case "CONFIRM_TRADE":
    case "CANCEL_TRADE":
    case "MARITIME_TRADE":
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "⚖️",
      };
    case "END_TURN":
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "⏭️",
      };
    default:
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🧭",
      };
  }
}

export function electBotCoordinator(
  gameState: Pick<
    GameState,
    "room_code" | "colors" | "bot_colors" | "seat_takeover"
  >,
  mySeatColor: Color | null
): boolean {
  const activeHumans = gameState.colors.filter(
    (c) => !gameState.bot_colors.includes(c)
  );
  const origHumanCount = new Set([
    ...activeHumans,
    ...Object.keys(gameState.seat_takeover || {}),
  ]).size;
  const isMultiplayer = Boolean(gameState.room_code) || origHumanCount >= 2;

  if (!isMultiplayer) {
    if (activeHumans.length === 0) return true;
    return mySeatColor === null || activeHumans.includes(mySeatColor);
  }
  if (activeHumans.length === 0) {
    return false;
  }
  return mySeatColor !== null && mySeatColor === activeHumans[0];
}
```

- [ ] **Step 4: Create `ui/src/components/DiceRollOverlay.tsx` + `DiceRollOverlay.scss` and update `ActionsToolbar.tsx`/`.scss`**

1. Write `ui/src/components/DiceRollOverlay.tsx`:

```tsx
import { useEffect, useState } from "react";
import cn from "classnames";
import type { Color } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { DiceFaceSvg } from "./icons/GameIcons";
import "./DiceRollOverlay.scss";

export type DiceRollOverlayProps = {
  open: boolean;
  rolling: boolean;
  dice: [number, number] | null;
  rollerName: string;
  rollerColor: Color;
};

export default function DiceRollOverlay({
  open,
  rolling,
  dice,
  rollerName,
  rollerColor,
}: DiceRollOverlayProps) {
  const [spinFaces, setSpinFaces] = useState<[number, number]>([1, 6]);

  useEffect(() => {
    if (!open || !rolling) return;
    let step = 0;
    const iv = setInterval(() => {
      step += 1;
      setSpinFaces([((step * 2) % 6) + 1, ((step * 5 + 1) % 6) + 1]);
    }, 85);
    return () => clearInterval(iv);
  }, [open, rolling]);

  if (!open || !dice) return null;

  const shownDice = rolling ? spinFaces : dice;
  const sum = dice[0] + dice[1];
  const isHot = !rolling && (sum === 6 || sum === 8);
  const isSeven = !rolling && sum === 7;
  const palette = PLAYER_COLOR_META[rollerColor];

  return (
    <div
      className={cn("tabletop-dice-stage", {
        "is-rolling": rolling,
        "is-settled": !rolling,
        "is-hot": isHot,
        "is-seven": isSeven,
      })}
      style={{ borderColor: palette.primary }}
      role="status"
      aria-live="polite"
    >
      <div className="tabletop-dice-stage__header">
        <span
          className="tabletop-dice-stage__dot"
          style={{ background: palette.primary }}
        />
        <span className="tabletop-dice-stage__roller">{rollerName}</span>
      </div>
      <div className="tabletop-dice-stage__faces">
        <span className="tabletop-dice-stage__die">
          <DiceFaceSvg value={shownDice[0]} size={42} isHot={isHot || isSeven} />
        </span>
        <span className="tabletop-dice-stage__die tabletop-dice-stage__die--second">
          <DiceFaceSvg value={shownDice[1]} size={42} isHot={isHot || isSeven} />
        </span>
      </div>
      <div className="tabletop-dice-stage__footer">
        {rolling ? (
          <span>🎲 Rolando...</span>
        ) : isSeven ? (
          <strong>Total 7 — Ladrão!</strong>
        ) : (
          <strong>Total {sum}</strong>
        )}
      </div>
    </div>
  );
}
```

2. Write `ui/src/components/DiceRollOverlay.scss`:

```scss
.tabletop-dice-stage {
  position: fixed;
  top: 52%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 42;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 18px;
  background: radial-gradient(circle at top, rgba(30, 41, 59, 0.94), rgba(9, 13, 22, 0.96));
  border: 2px solid #facc15;
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.72),
    0 0 24px rgba(250, 204, 21, 0.25);
  backdrop-filter: blur(10px);
  animation: tabletop-dice-enter 0.2s cubic-bezier(0.22, 1, 0.36, 1);

  &.is-seven {
    box-shadow:
      0 18px 40px rgba(0, 0, 0, 0.78),
      0 0 28px rgba(239, 68, 68, 0.45);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  &__dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__faces {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &.is-rolling &__die {
    display: inline-flex;
    animation: dice-tumble 0.26s ease-in-out infinite alternate;
  }

  &.is-rolling &__die--second {
    animation-direction: alternate-reverse;
  }

  &.is-settled &__die {
    display: inline-flex;
    animation: dice-land 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &__footer {
    font-size: 0.85rem;
    color: #fde047;
    letter-spacing: 0.02em;
  }

  &.is-seven &__footer {
    color: #fca5a5;
  }
}

@keyframes tabletop-dice-enter {
  from {
    opacity: 0;
    transform: translate(-50%, -44%) scale(0.86);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes dice-tumble {
  0% {
    transform: rotate(-14deg) translateY(-3px) scale(1.06);
  }
  100% {
    transform: rotate(14deg) translateY(3px) scale(0.96);
  }
}

@keyframes dice-land {
  from {
    transform: scale(1.18);
  }
  to {
    transform: scale(1);
  }
}
```

3. Update `ui/src/pages/ActionsToolbar.tsx`:
   - Accept optional `isRollingDice?: boolean` prop (default `false`).
   - Add face-cycling local state (`pillSpinFaces`) while `isRollingDice` is true.
   - Add `is-rolling` class on `.dice-widget-pill` (`className={cn("dice-widget-pill", { "is-rolling": isRollingDice })}`), display `isRollingDice ? "..." : \`Σ ${diceSum}\``.

4. Update `ui/src/pages/ActionsToolbar.scss` around `.dice-widget-pill`:

```scss
  &.is-rolling {
    border-color: #facc15;
    box-shadow: 0 0 14px rgba(250, 204, 21, 0.45);

    .dice-widget-pill__faces svg {
      animation: dice-pill-wobble 0.22s ease-in-out infinite alternate;
    }
  }
```
with:
```scss
@keyframes dice-pill-wobble {
  from {
    transform: rotate(-12deg) scale(1.05);
  }
  to {
    transform: rotate(12deg) scale(0.95);
  }
}
```

- [ ] **Step 5: Run Vitest on pacing and overlay tests**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run src/utils/tabletopPacing.test.ts src/components/DiceRollOverlay.test.tsx
```
Expected: Both PASS cleanly.

- [ ] **Step 6: Commit Task 4**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/utils/tabletopPacing.ts ui/src/components/DiceRollOverlay.tsx ui/src/components/DiceRollOverlay.scss ui/src/pages/ActionsToolbar.tsx ui/src/pages/ActionsToolbar.scss ui/src/utils/tabletopPacing.test.ts ui/src/components/DiceRollOverlay.test.tsx
git commit -m "feat(ui): add tabletop pacing helpers, speed settings and animated 2D6 dice stage"
```

---

### Task 5: Board/TopBar Visual Highlights, Unified Spotlight Toast, Paced Bot Coordinator Loop & Abandon/Reclaim HUD

**Files:**
- Modify: `ui/src/pages/Node.tsx:53-114`
- Modify: `ui/src/pages/Edge.tsx:31-80`
- Modify: `ui/src/pages/Board.tsx:44-170`
- Modify: `ui/src/pages/ZoomableBoard.tsx:90-96,249-266`
- Modify: `ui/src/pages/Board.scss:82-155`
- Modify: `ui/src/components/PlayerTopBar.tsx:169-279,320-415,457-520`
- Modify: `ui/src/components/PlayerTopBar.scss:50-125,205-255`
- Modify: `ui/src/pages/GameScreen.tsx:1-338`
- Modify: `ui/src/pages/GameScreen.scss:74-225`
- Modify: `ui/src/components/PlayerTopBar.test.tsx`
- Modify: `ui/src/pages/Board.test.tsx`
- Modify: `ui/src/pages/GameScreen.test.tsx`

**Interfaces:**
- Consumes: `tabletopPacing.ts`, `DiceRollOverlay.tsx`, `sendGameHeartbeat`, `abandonGame`, `reclaimGame`, `postAction(..., { botOnly: true })`, `humanizeActionRecordPt`.
- Produces optional props cleanly (preserving backwards compatibility with unit tests):
  - `Node`: `isRecent?: boolean` -> adds `.node--recent`
  - `Edge`: `isRecent?: boolean` -> adds `.edge--recent`
  - `Board`: `recentNodeId?: number | null`, `recentEdgeId?: string | null`
  - `ZoomableBoard`: `recentNodeId?: number | null`, `recentEdgeId?: string | null`
  - `PlayerTopBar`: `recentDevColor?: Color | null` -> adds `.cu-stat--recent` pulse on dev card cell; displays subtle `"🤖 Bot assumiu"` tag only when taken over (`isTakenOverSeat`); renders in `gameState.colors` order **without** `1º/2º` position numbers.
  - `GameScreen`:
    - Unified `.action-spotlight-toast` visible in Desktop (`>=600px`) & Mobile (`<600px`)
    - Speed toggle button (`Normal (1x)` / `Rápido (0.5x)`)
    - Opening turn announcement at `state_index === 0` (`🎲 Ordem sorteada: <Nome> inicia a partida!`)
    - Coordinated `?bot_only=1` pacing loop (`getActionDelayMs`, immediate human cancellation, `700ms` multiplayer polling)
    - `10s` multiplayer heartbeat, **`🚪 Sair (Bot Assume)`** dialog + **`↩️ Retomar Meu Assento`** banner.

- [ ] **Step 1: Add failing UI/screen tests for Task 5 behaviors**

1. Add tests to `ui/src/components/PlayerTopBar.test.tsx`:
   - Renders `João (Bot)` with `"Bot assumiu"` indicator and original custom avatar when taken over.
   - Asserts NO numeric turn-order badges (`1º`, `2º`, `3º`, `4º`) appear inside `.cu-player-top-bar`.

2. Add test to `ui/src/pages/Board.test.tsx`:
   - Passing `recentNodeId={0}` and `recentEdgeId="0,1"` renders `.node--recent` and `.edge--recent`.

3. Update & expand `ui/src/pages/GameScreen.test.tsx`:
   - Add mock exports `sendGameHeartbeat: vi.fn().mockResolvedValue({ ok: true, bot_colors: [], taken_over_colors: [], my_seat_taken_over: false })`, `abandonGame: vi.fn()`, `reclaimGame: vi.fn()` to the `vi.mock("../utils/apiClient", ...)` block.
   - Update line 117 expectation to `expect(postAction).toHaveBeenCalledWith("game-123", undefined, { botOnly: true })`.
   - Add Bloco 5 tests in `GameScreen.test.tsx`:
     - Renders speed toggle switching between `Normal (1x)` and `Rápido (0.5x)` and persists `catan_game_speed_v1`.
     - Shows opening starter announcement at `state_index === 0` (`Ordem sorteada: ... inicia a partida`).
     - Shows animated `DiceRollOverlay` (`Total 8`) + `.action-spotlight-toast` when a `ROLL` transition arrives.
     - Shows `Sair (Bot Assume)` confirmation modal in multiplayer, calls `abandonGame`, and shows `Retomar Meu Assento` banner when `seat_takeover[mySeat].taken_over` is `true` (calling `reclaimGame` on click).

- [ ] **Step 2: Run targeted Vitest suites to confirm expected failures**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx vitest run src/components/PlayerTopBar.test.tsx src/pages/Board.test.tsx src/pages/GameScreen.test.tsx
```
Expected: New Bloco 5 assertions fail as expected.

- [ ] **Step 3: Implement `Node.tsx`, `Edge.tsx`, `Board.tsx`, `ZoomableBoard.tsx`, `Board.scss`, `PlayerTopBar.tsx`, `PlayerTopBar.scss`**

1. In `ui/src/pages/Node.tsx`: add optional `isRecent?: boolean` to `NodeProps` and add `"node--recent": !!isRecent` inside `className={cn("node", ...)}`.
2. In `ui/src/pages/Edge.tsx`: add optional `isRecent?: boolean` to `EdgeProps` and add `"edge--recent": !!isRecent` inside `className={cn("edge", direction, ...)}`.
3. In `ui/src/pages/Board.tsx` and `ZoomableBoard.tsx`: accept `recentNodeId?: number | null` and `recentEdgeId?: string | null`; forward `isRecent={recentNodeId === id}` to `<Node />` and normalized `isRecent={recentEdgeId === `${Math.min(id[0], id[1])},${Math.max(id[0], id[1])}`}` to `<Edge />`.
4. In `ui/src/pages/Board.scss`: add halo/pop highlight keyframes:

```scss
.node--recent {
  z-index: 15;
  .building-piece {
    filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.95));
    animation: recent-piece-flash 0.55s ease-in-out 3;
  }
}

.edge--recent {
  z-index: 14;
  .road {
    box-shadow:
      0 0 0 2px #fef08a,
      0 0 16px rgba(250, 204, 21, 0.95) !important;
    animation: recent-piece-flash 0.55s ease-in-out 3;
  }
}

@keyframes recent-piece-flash {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.22);
  }
}
```

5. In `ui/src/components/PlayerTopBar.tsx` + `.scss`:
   - Strictly **DO NOT** render `1º`, `2º`, `3º`, `4º` position badges.
   - Compute `isTakenOver = isTakenOverSeat(gameState, color)`, pass `isTakenOver` and `originalUsername: gameState.seat_takeover?.[color]?.original_username` into `resolveSeatAvatarProps`.
   - Accept optional `recentDevColor?: Color | null` prop on `PlayerTopBar`; add `.cu-stat--recent` pulse when `seat.color === recentDevColor` on `.cu-stat--devcards`.
   - When `seat.isTakenOver`, show a subtle pill inside `.cu-player-card__stats-col` / name tooltip (`🤖 Bot assumiu` badge `.cu-player-card__takeover-chip`) and `"Substituto IA"` tag inside the inspector dialog.

- [ ] **Step 4: Implement `GameScreen.tsx` and `GameScreen.scss`**

In `ui/src/pages/GameScreen.tsx`:
- Add `SPEED` state (`useState<GameSpeed>(() => getSavedGameSpeed())`) and `toggleGameSpeed`.
- Determine `mySeatColor`:
  1. explicit `?seat=` or `getSavedGameSeat(gameId)` or `state.perspective`
  2. fallback match against logged user (`getSavedAccount()?.username`) in `seat_avatars[c]?.username` OR `seat_takeover[c]?.original_username`
  3. fallback single active human seat in non-multiplayer games.
- Determine `isMultiplayerGame = Boolean(gs.room_code) || originalHumansCount >= 2` and `isMySeatTakenOver = Boolean(mySeatColor && gs.seat_takeover?.[mySeatColor]?.taken_over)`.
- Track reaction presentation state on `state.gameState` transitions (`useEffect` comparing `gs.state_index` with `prevStateIndexRef`):
  - On initial load at `state_index === 0`: show opening announcement toast (`"🎲 Ordem sorteada: Você inicia a partida!"` if `gs.current_color === mySeatColor && !gs.bot_colors.includes(gs.current_color)` else `"🎲 Ordem sorteada: ${starterName} inicia a partida!"`).
  - Whenever `gs.state_index > prevStateIndexRef.current`:
    - `latestRecord = gs.action_records?.[gs.action_records.length - 1]`
    - Call `playActionRecordSound(latestRecord)` and `if (getHumanColor(gs, state.perspective)) dispatchSnackbar(enqueueSnackbar, closeSnackbar, gs)`!
    - Extract visuals via `extractTransitionVisuals(latestRecord)`:
      - If `rollDice`: set `diceStage = { open: true, rolling: true, dice: rollDice, rollerName, rollerColor }`, after `getRollSpinDurationMs(gameSpeed)` switch `rolling: false`, and clear `diceStage` after `getActionDelayMs(latestRecord, gameSpeed)`.
      - Set `.action-spotlight-toast` (`{ text: humanizeActionRecordPt(gs, latestRecord), color: latestRecord[0][0], icon: visuals.actionIcon }`), clearing after `2200ms`.
      - Set `recentNodeId`, `recentEdgeId`, `recentDevColor` timers for `2200ms`.
- Paced bot execution effect (`nextBotReadyAtRef`, `botGenerationRef`):
  - Only runs when `!replayMode && !gs.winning_color && gs.bot_colors.includes(gs.current_color) && electBotCoordinator(gs, mySeatColor)`.
  - Computes remaining hold (`Math.max(0, nextBotReadyAtRef.current - Date.now())`).
  - When `remainingHold === 0` (such as initial mount or immediately when prior hold already elapsed), invokes `postAction(gameId, undefined, { botOnly: true })` right away (`setIsBotThinking(true)`); otherwise schedules `setTimeout` cleanly and cleans up on unmount or human action (`botGenerationRef.current += 1`).
  - When `postAction` resolves and generation still matches and game isn't already ahead:
    - Computes `holdMs = getActionDelayMs(returnedLastRecord, gameSpeed, { requiresLocalHumanPrompt })` and writes `nextBotReadyAtRef.current = Date.now() + holdMs`.
    - Immediately dispatches `dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState })` so the user sees the bot's roll/build/move live on the board while the hold runs!
- Multiplayer polling (`700ms` interval when `isMultiplayerGame && !gs.winning_color && (isBotTurn || isAnotherHumanTurn || isMySeatTakenOver)`) and `10_000ms` heartbeat interval when `isMultiplayerGame && !gs.winning_color && mySeatColor && !isMySeatTakenOver && !hasAbandonedRef.current`. Also if heartbeat detects `bot_colors` changed vs current `gs.bot_colors`, immediately fetches `getState(gameId, "latest")` and dispatches `SET_GAME_STATE` so newly promoted bots appear promptly!
- Render HUD speed toggle (`🐢 1x` / `⚡ 0.5x`), **`🚪 Sair (Bot Assume)`** button + confirmation `<Dialog>`, **`↩️ Retomar Meu Assento`** banner, `<DiceRollOverlay ... />`, `<div className="action-spotlight-toast">` (visible both Desktop & Mobile), and pass `recentDevColor` to `<PlayerTopBar>`, `recentNodeId` / `recentEdgeId` to `<ZoomableBoard>`, `isRollingDice` to `<ActionsToolbar>`.

- [ ] **Step 5: Run all Vitest tests and TypeScript check**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run
```
Expected: `tsc --noEmit` exits 0 and 100% of Vitest specs PASS.

- [ ] **Step 6: Commit Task 5**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/pages/Node.tsx ui/src/pages/Edge.tsx ui/src/pages/Board.tsx ui/src/pages/ZoomableBoard.tsx ui/src/pages/Board.scss ui/src/components/PlayerTopBar.tsx ui/src/components/PlayerTopBar.scss ui/src/pages/GameScreen.tsx ui/src/pages/GameScreen.scss ui/src/components/PlayerTopBar.test.tsx ui/src/pages/Board.test.tsx ui/src/pages/GameScreen.test.tsx
git commit -m "feat(ui): add paced tabletop turn replay, recent highlights, spotlight toast and multiplayer abandon/reclaim HUD"
```

---

### Task 6: Sync Docs, Full End-to-End Test Verification & Build Gate

**Files:**
- Modify: `CONTEXTO_PROJETO.md`
- Verify mirror: `catanatron/catanatron/` == `api/catanatron/`

- [ ] **Step 1: Update `CONTEXTO_PROJETO.md`**

Document the Bloco 5 changes concisely (pacing toggle `1x`/`0.5x`, animated 2D6 dice stage & recent board highlights, unified desktop+mobile action toast, `?bot_only=1` coordinator election, `/heartbeat` + `/abandon` + `/reclaim` endpoints & 45s multiplayer takeover rules, CSPRNG turn-order shuffle in `localEngine.ts` + `secrets.randbits(63)` web seeds, and test counts).

- [ ] **Step 2: Run full backend pytest suite**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests -v
```
Expected: 100% PASS, zero skipped/out-of-sync mirror errors.

- [ ] **Step 3: Run full frontend typecheck, Vitest suite, and production Vite build**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit; npx vitest run; npm run build
```
Expected: Clean exit 0 across TypeScript, all Vitest suites, and `vite build`.

- [ ] **Step 4: Restart live Flask + Vite test check and commit docs**

Run smoke check via browser or curl against running `127.0.0.1:5001` / `localhost:3000` (if restarting Flask daemon is needed so `5001` serves Bloco 5 routes), then commit `CONTEXTO_PROJETO.md`:

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add CONTEXTO_PROJETO.md
git commit -m "docs: update CONTEXTO_PROJETO.md with Bloco 5 delivery"
```
