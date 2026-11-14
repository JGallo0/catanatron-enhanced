import json
import logging
import os
import secrets
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid

from flask import Response, Blueprint, current_app, jsonify, abort, request
from werkzeug.exceptions import HTTPException

from catanatron.web.avatar_catalog import AVATAR_CATALOG_ITEMS
from catanatron.web.models import (
    BOT_AVATAR_BY_NAME,
    BOT_DIFFICULTY_TO_KEY,
    COLOR_LABELS_PT,
    LEGACY_OPEN_SEAT_NAMES,
    OFFICIAL_BOT_NAMES,
    OPEN_SEAT_NAME,
    SEAT_COLORS,
    LockedAvatarItemsError,
    StoredGame,
    StoredRoom,
    _load_avatars_by_username,
    authenticate_user,
    authorize_seat_caller,
    build_seat_metadata_for_game,
    close_room,
    create_game_message,
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
    leave_room,
    list_active_rooms,
    list_game_messages,
    load_game_seat_metadata,
    login_with_google_claims,
    maybe_promote_disconnected_seats,
    normalize_bot_difficulty,
    normalize_bot_speed,
    pick_bot_names,
    prescan_requested_bot_names,
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
from catanatron.serialization import action_from_json, web_view
from catanatron.state import VALID_DICE_MODES
from catanatron.models.player import Color
from catanatron.game import Game
from catanatron.models.map import build_map
from catanatron.players.minimax import AlphaBetaPlayer
from catanatron.registry import REGISTRY, describe, SpecError
from catanatron.web.players import register_web_players
from catanatron.web.mcts_analysis import GameAnalyzer

bp = Blueprint("api", __name__, url_prefix="/api")
VALID_MAP_TEMPLATES = {"BASE", "MINI", "TOURNAMENT"}

register_web_players()


@bp.app_errorhandler(HTTPException)
def handle_http_exception(exc: HTTPException):
    return (
        jsonify(
            {
                "code": exc.code,
                "name": exc.name,
                "description": exc.description,
            }
        ),
        exc.code or 500,
    )


@bp.app_errorhandler(LockedAvatarItemsError)
def handle_locked_avatar_items(exc: LockedAvatarItemsError):
    return (
        jsonify(
            {
                "code": 403,
                "name": "Forbidden",
                "description": exc.message,
                "locked_items": exc.locked_items,
            }
        ),
        403,
    )


def _enrich_view_with_seats(game: Game, view: dict) -> dict:
    try:
        seat_meta: dict[str, dict] = {}
        stored_game = db.session.get(StoredGame, game.id)
        if stored_game is not None:
            seat_meta = load_game_seat_metadata(stored_game)

        room = get_room_by_game_id(game.id)
        if room is not None:
            view["room_code"] = room.room_code
            try:
                room_cfg = json.loads(room.config_json)
            except Exception:
                room_cfg = {}
            view["bot_speed"] = normalize_bot_speed(room_cfg.get("bot_speed")) or "normal"

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


def _parse_seed(raw_seed) -> int:
    if raw_seed is None:
        return secrets.randbits(63)
    if isinstance(raw_seed, bool):
        abort(400, description="'seed' must be an integer")
    if isinstance(raw_seed, int):
        return raw_seed
    if isinstance(raw_seed, str):
        stripped = raw_seed.strip()
        if stripped and (
            stripped.isdigit()
            or (stripped[0] in ("+", "-") and stripped[1:].isdigit())
        ):
            return int(stripped)
    abort(400, description="'seed' must be an integer")


@bp.route("/players", methods=("GET",))
def get_players_endpoint():
    """List the players this server can seat, and the params each accepts."""
    return jsonify([describe(key, REGISTRY[key]) for key in sorted(REGISTRY)])


@bp.route("/games", methods=("POST",))
def post_game_endpoint():
    if (
        not request.is_json
        or not isinstance(request.json, dict)
        or "players" not in request.json
    ):
        abort(400, description="Missing or invalid JSON body: 'players' key required")

    player_keys = request.json["players"]
    if not isinstance(player_keys, list) or not 2 <= len(player_keys) <= 4:
        abort(400, description="'players' must be a list with 2 to 4 entries")

    map_template = request.json.get("map_template", "BASE")
    if map_template not in VALID_MAP_TEMPLATES:
        abort(
            400,
            description="'map_template' must be one of BASE, MINI, or TOURNAMENT",
        )

    discard_limit = request.json.get("discard_limit", 7)
    if (
        isinstance(discard_limit, bool)
        or not isinstance(discard_limit, int)
        or not 5 <= discard_limit <= 20
    ):
        abort(400, description="'discard_limit' must be an integer between 5 and 20")

    vps_to_win = request.json.get("vps_to_win", 10)
    if (
        isinstance(vps_to_win, bool)
        or not isinstance(vps_to_win, int)
        or not 3 <= vps_to_win <= 20
    ):
        abort(400, description="'vps_to_win' must be an integer between 3 and 20")

    friendly_robber = request.json.get("friendly_robber", False)
    if not isinstance(friendly_robber, bool):
        abort(400, description="'friendly_robber' must be a boolean")

    dice_mode = request.json.get("dice_mode", "random")
    if dice_mode not in VALID_DICE_MODES:
        abort(400, description="'dice_mode' must be 'random' or 'balanced'")

    try:
        players = REGISTRY.build_all(player_keys)
    except SpecError as error:
        abort(400, description=str(error))
    catan_map = build_map(map_template)
    seed = _parse_seed(request.json.get("seed"))

    game = Game(
        players=players,
        seed=seed,
        discard_limit=discard_limit,
        friendly_robber=friendly_robber,
        vps_to_win=vps_to_win,
        catan_map=catan_map,
        dice_mode=dice_mode,
    )
    auth_user = resolve_user_from_token(_extract_auth_token())
    host_name = request.json.get("host_name")
    host_avatar = request.json.get("avatar_config")
    seat_names = request.json.get("seat_names")
    if seat_names is not None and not isinstance(seat_names, (list, dict)):
        seat_names = None
    raw_host_seat_index = request.json.get("host_seat_index")
    host_seat_index = (
        raw_host_seat_index
        if isinstance(raw_host_seat_index, int)
        and not isinstance(raw_host_seat_index, bool)
        else None
    )
    seat_meta = build_seat_metadata_for_game(
        player_keys,
        auth_user=auth_user,
        host_name=str(host_name).strip() if host_name else None,
        host_avatar_config=host_avatar if isinstance(host_avatar, dict) else None,
        seat_names=seat_names,
        host_seat_index=host_seat_index,
    )
    upsert_game_state(game, seat_metadata_by_color=seat_meta)
    return jsonify({"game_id": game.id})


# ===== Player Accounts & Online Rooms =====
def _extract_auth_token() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        tok = auth_header[7:].strip()
        if tok:
            return tok
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        body = {}
    tok = body.get("auth_token") or body.get("token") or request.args.get("token")
    return str(tok).strip() if tok else None


def _verify_google_id_token(credential: str, expected_client_id: str) -> dict:
    if not credential or len(credential) < 20:
        raise ValueError("Credencial Google ausente")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode(
        {"id_token": credential}
    )
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            claims = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ValueError("Falha ao validar token Google") from exc

    if claims.get("aud") != expected_client_id:
        raise ValueError("Client ID inválido")
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Emissor Google inválido")
    verified = (
        str(claims.get("email_verified", "")).lower() == "true"
        or claims.get("email_verified") is True
    )
    if not verified:
        raise ValueError("Conta Google sem e-mail verificado")
    exp = int(claims.get("exp") or 0)
    if exp <= int(time.time()):
        raise ValueError("Token Google expirado")
    return claims


def _get_google_client_id() -> str | None:
    for env_key in (
        "GOOGLE_CLIENT_ID",
        "GOOGLE_OAUTH_CLIENT_ID",
        "VITE_GOOGLE_CLIENT_ID",
    ):
        value = (os.environ.get(env_key) or "").strip()
        if value:
            return value
    return None


@bp.route("/health", methods=("GET",))
def get_health_endpoint():
    backend = current_app.config.get("CATAN_DB_BACKEND", "sqlite")
    persistent = bool(current_app.config.get("CATAN_DB_PERSISTENT", True))
    is_vercel = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
    return jsonify(
        {
            "ok": True,
            "database_backend": backend,
            "persistent_storage": persistent,
            "ephemeral_vercel_sqlite": bool(is_vercel and backend == "sqlite"),
        }
    )


@bp.route("/avatar/catalog", methods=("GET",))
def get_avatar_catalog_endpoint():
    return jsonify({"version": 2, "items": AVATAR_CATALOG_ITEMS})


@bp.route("/auth/config", methods=("GET",))
def get_auth_config_endpoint():
    client_id = _get_google_client_id()
    return jsonify({"google_enabled": bool(client_id), "google_client_id": client_id})


@bp.route("/auth/register", methods=("POST",))
def post_auth_register_endpoint():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or body.get("pin") or "")
    display_name = body.get("display_name")
    avatar_config = body.get("avatar_config")

    user, sess = register_user(
        username=username,
        password=password,
        display_name=str(display_name).strip() if display_name else None,
        avatar_config=avatar_config if isinstance(avatar_config, dict) else None,
    )
    payload = serialize_user(user, get_user_stats(user.username))
    payload.update({"auth_token": sess.token, "is_new": True})
    return jsonify(payload)


@bp.route("/auth/login", methods=("POST",))
def post_auth_login_endpoint():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or body.get("pin") or "")

    user, sess = authenticate_user(username=username, password=password)
    payload = serialize_user(user, get_user_stats(user.username))
    payload.update({"auth_token": sess.token, "is_new": False})
    return jsonify(payload)


@bp.route("/auth/google", methods=("POST",))
def post_auth_google_endpoint():
    client_id = _get_google_client_id()
    if not client_id:
        abort(503, description="Login com Google não configurado no servidor")
    body = request.get_json(silent=True) or {}
    credential = str(body.get("credential") or "").strip()
    avatar_config = body.get("avatar_config")
    try:
        claims = _verify_google_id_token(credential, client_id)
    except ValueError as err:
        abort(401, description=str(err))

    user, sess, is_new = login_with_google_claims(
        claims,
        avatar_config=avatar_config if isinstance(avatar_config, dict) else None,
    )
    payload = serialize_user(user, get_user_stats(user.username))
    payload.update({"auth_token": sess.token, "is_new": is_new})
    return jsonify(payload)


@bp.route("/auth/me", methods=("GET",))
def get_auth_me_endpoint():
    user = resolve_user_from_token(_extract_auth_token())
    if user is None:
        abort(401, description="Sessão inválida ou expirada")
    return jsonify(serialize_user(user, get_user_stats(user.username)))


@bp.route("/auth/logout", methods=("POST",))
def post_auth_logout_endpoint():
    revoke_session_token(_extract_auth_token())
    return jsonify({"success": True})


@bp.route("/auth/profile", methods=("PATCH",))
def patch_auth_profile_endpoint():
    user = resolve_user_from_token(_extract_auth_token())
    if user is None:
        abort(401, description="Autenticação necessária")
    body = request.get_json(silent=True) or {}
    update_user_profile(
        user,
        display_name=body.get("display_name"),
        avatar_config=body.get("avatar_config"),
    )
    return jsonify(serialize_user(user, get_user_stats(user.username)))


def _extract_room_tokens_map() -> dict[str, str]:
    raw = request.headers.get("X-Room-Tokens", "").strip()
    if not raw or len(raw) > 8192:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    if not isinstance(parsed, dict):
        return {}
    out: dict[str, str] = {}
    for code, tok in parsed.items():
        if isinstance(code, str) and isinstance(tok, str):
            clean_code = code.strip().upper()[:16]
            clean_tok = tok.strip()[:128]
            if clean_code and clean_tok:
                out[clean_code] = clean_tok
    return out


def _extract_caller_room_tokens(room_code: str | None = None) -> list[str]:
    seen: set[str] = set()
    tokens: list[str] = []

    def _add(val: object):
        if val is None:
            return
        clean = str(val).strip()
        if clean and clean not in seen:
            seen.add(clean)
            tokens.append(clean)

    _add(request.args.get("token"))
    _add(request.args.get("seat_token"))
    _add(request.headers.get("X-Seat-Token"))
    _add(_extract_auth_token())
    body = request.get_json(silent=True) or {}
    if isinstance(body, dict):
        _add(body.get("token"))
        _add(body.get("seat_token"))
        _add(body.get("auth_token"))
    if room_code:
        tokens_map = _extract_room_tokens_map()
        _add(tokens_map.get(room_code.strip().upper()))
    return tokens


@bp.route("/rooms", methods=("GET",))
def list_rooms_endpoint():
    auth_user = resolve_user_from_token(_extract_auth_token())
    token = request.args.get("token") or _extract_auth_token()
    tokens_map = _extract_room_tokens_map()
    return jsonify(
        {
            "rooms": list_active_rooms(
                caller_token=token,
                auth_user=auth_user,
                caller_tokens_by_room=tokens_map,
            )
        }
    )


@bp.route("/rooms", methods=("POST",))
def post_room_endpoint():
    body = request.get_json(silent=True) or {}
    host_name = str(body.get("host_name") or "Anfitrião").strip()[:32]
    host_token = body.get("token")
    players = body.get("players")
    seats = body.get("seats")
    seat_names = body.get("seat_names")
    raw_difficulty = body.get("bot_difficulty")
    if raw_difficulty is not None and normalize_bot_difficulty(raw_difficulty) is None:
        abort(400, description="'bot_difficulty' must be one of easy, medium, or hard")
    bot_difficulty = normalize_bot_difficulty(raw_difficulty)

    if seats is not None:
        if not isinstance(seats, list) or not 2 <= len(seats) <= 4:
            abort(400, description="'seats' must be a list with 2 to 4 entries")
        for item in seats:
            if not isinstance(item, dict):
                abort(400, description="Each seat entry must be an object")
            p_key = str(item.get("player_key") or "HUMAN")
            if p_key != "HUMAN":
                try:
                    REGISTRY.lookup(p_key.split(":")[0])
                except SpecError as err:
                    abort(400, description=str(err))
    if players is not None:
        if not isinstance(players, list) or not 2 <= len(players) <= 4:
            abort(400, description="'players' must be a list with 2 to 4 entries")
        for p_key in players:
            if str(p_key) != "HUMAN":
                try:
                    REGISTRY.lookup(str(p_key).split(":")[0])
                except SpecError as err:
                    abort(400, description=str(err))

    map_template = body.get("map_template", "BASE")
    if map_template not in VALID_MAP_TEMPLATES:
        abort(400, description="'map_template' must be one of BASE, MINI, or TOURNAMENT")

    vps_to_win = int(body.get("vps_to_win", 10))
    discard_limit = int(body.get("discard_limit", 7))
    friendly_robber = bool(body.get("friendly_robber", True))
    dice_mode = body.get("dice_mode", "random")
    if dice_mode not in VALID_DICE_MODES:
        abort(400, description="'dice_mode' must be 'random' or 'balanced'")

    raw_bot_speed = body.get("bot_speed")
    if raw_bot_speed is not None and normalize_bot_speed(raw_bot_speed) is None:
        abort(400, description="'bot_speed' must be one of slow, normal, fast, or turbo")
    bot_speed = normalize_bot_speed(raw_bot_speed) or "normal"

    auth_user = resolve_user_from_token(_extract_auth_token())
    if auth_user is not None:
        host_name = (
            host_name
            if host_name and host_name != "Anfitrião"
            else auth_user.display_name
        )
    host_avatar = body.get("avatar_config")
    room, resolved_token = create_room(
        host_name=host_name,
        players=players,
        map_template=map_template,
        vps_to_win=vps_to_win,
        discard_limit=discard_limit,
        friendly_robber=friendly_robber,
        host_token=host_token or _extract_auth_token(),
        host_username=auth_user.username if auth_user else None,
        host_avatar_config=host_avatar if isinstance(host_avatar, dict) else None,
        seats=seats,
        seat_names=seat_names if isinstance(seat_names, (list, dict)) else None,
        bot_difficulty=bot_difficulty,
        dice_mode=dice_mode,
        bot_speed=bot_speed,
    )
    return jsonify(
        {
            "room_code": room.room_code,
            "seat_token": resolved_token,
            "room": serialize_room(room, resolved_token, auth_user=auth_user),
        }
    )


@bp.route("/rooms/<string:room_code>", methods=("GET",))
def get_room_endpoint(room_code: str):
    room = db.session.get(StoredRoom, room_code.upper())
    if room is None:
        abort(404, description="Sala não encontrada")
    auth_user = resolve_user_from_token(_extract_auth_token())
    caller_tokens = _extract_caller_room_tokens(room_code)
    return jsonify(
        serialize_room(
            room,
            caller_token=caller_tokens[0] if caller_tokens else None,
            auth_user=auth_user,
            caller_tokens=caller_tokens,
        )
    )


@bp.route("/rooms/<string:room_code>", methods=("DELETE",))
def delete_room_endpoint(room_code: str):
    auth_user = resolve_user_from_token(_extract_auth_token())
    caller_tokens = _extract_caller_room_tokens(room_code)
    return jsonify(
        close_room(room_code, caller_tokens=caller_tokens, auth_user=auth_user)
    )


@bp.route("/rooms/<string:room_code>/close", methods=("POST",))
def close_room_endpoint(room_code: str):
    auth_user = resolve_user_from_token(_extract_auth_token())
    caller_tokens = _extract_caller_room_tokens(room_code)
    return jsonify(
        close_room(room_code, caller_tokens=caller_tokens, auth_user=auth_user)
    )


@bp.route("/rooms/<string:room_code>/leave", methods=("POST",))
def leave_room_endpoint(room_code: str):
    auth_user = resolve_user_from_token(_extract_auth_token())
    caller_tokens = _extract_caller_room_tokens(room_code)
    return jsonify(
        leave_room(room_code, caller_tokens=caller_tokens, auth_user=auth_user)
    )


@bp.route("/rooms/<string:room_code>/join", methods=("POST",))
def join_room_endpoint(room_code: str):
    room = db.session.get(StoredRoom, room_code.upper())
    if room is None:
        abort(404, description="Sala não encontrada")

    body = request.get_json(silent=True) or {}
    player_name = str(body.get("player_name") or "Jogador").strip()[:32]
    preferred_color = body.get("preferred_color")
    auth_user = resolve_user_from_token(_extract_auth_token())
    caller_tokens = _extract_caller_room_tokens(room_code)
    token = body.get("token") or request.headers.get("X-Seat-Token") or None
    seat_kind = "USER" if auth_user else "GUEST"
    seat_username = auth_user.username if auth_user else None
    guest_avatar = (
        {}
        if auth_user
        else filter_unlocked_avatar_config(body.get("avatar_config"), wins=0)
    )

    seats = json.loads(room.seats_json)

    # If caller already holds a seat (by token or authenticated user), allow updating/switching
    current_seat = next(
        (
            s
            for s in seats
            if s.get("seat_token")
            and (
                (token and s.get("seat_token") == token)
                or s.get("seat_token") in caller_tokens
            )
        ),
        None,
    )
    if current_seat is None and auth_user is not None:
        current_seat = next(
            (
                s
                for s in seats
                if s.get("player_key") == "HUMAN"
                and s.get("seat_kind") == "USER"
                and s.get("username") == auth_user.username
            ),
            None,
        )
    if not token:
        if current_seat and current_seat.get("seat_token"):
            token = current_seat["seat_token"]
        else:
            token = uuid.uuid4().hex

    if preferred_color:
        target = next((s for s in seats if s["color"] == preferred_color), None)
        if target is None:
            abort(400, description="Cor inválida")
        if target is current_seat:
            target["player_name"] = player_name
            target["seat_kind"] = seat_kind
            target["username"] = seat_username
            target["avatar_config"] = guest_avatar
            effective_token = target.get("seat_token") or token
            target["seat_token"] = effective_token
            room.seats_json = json.dumps(seats)
            db.session.commit()
            return jsonify(
                {
                    "seat_token": effective_token,
                    "seat_color": target["color"],
                    "room": serialize_room(
                        room,
                        effective_token,
                        auth_user=auth_user,
                        caller_tokens=caller_tokens,
                    ),
                }
            )
        if target["player_key"] == "HUMAN" and not target.get("seat_token"):
            effective_token = (
                (current_seat.get("seat_token") if current_seat else None) or token
            )
            if current_seat and current_seat is not target:
                current_seat["seat_token"] = None
                current_seat["player_name"] = OPEN_SEAT_NAME
                current_seat["username"] = None
                current_seat["seat_kind"] = "GUEST"
                current_seat["avatar_config"] = {}
            target["seat_token"] = effective_token
            target["player_name"] = player_name
            target["seat_kind"] = seat_kind
            target["username"] = seat_username
            target["avatar_config"] = guest_avatar
            room.seats_json = json.dumps(seats)
            db.session.commit()
            return jsonify(
                {
                    "seat_token": effective_token,
                    "seat_color": target["color"],
                    "room": serialize_room(
                        room,
                        effective_token,
                        auth_user=auth_user,
                        caller_tokens=caller_tokens,
                    ),
                }
            )
        abort(400, description="Este assento não está livre.")

    if current_seat is not None:
        effective_token = current_seat.get("seat_token") or token
        current_seat["seat_token"] = effective_token
        current_seat["player_name"] = player_name
        current_seat["seat_kind"] = seat_kind
        current_seat["username"] = seat_username
        current_seat["avatar_config"] = guest_avatar
        room.seats_json = json.dumps(seats)
        db.session.commit()
        return jsonify(
            {
                "seat_token": effective_token,
                "seat_color": current_seat["color"],
                "room": serialize_room(
                    room,
                    effective_token,
                    auth_user=auth_user,
                    caller_tokens=caller_tokens,
                ),
            }
        )

    # Otherwise claim the first open HUMAN seat ("Assento livre")
    open_seat = next(
        (s for s in seats if s["player_key"] == "HUMAN" and not s.get("seat_token")),
        None,
    )
    if open_seat is None:
        abort(400, description="Não há assentos livres nesta sala")

    open_seat["seat_token"] = token
    open_seat["player_name"] = player_name
    open_seat["seat_kind"] = seat_kind
    open_seat["username"] = seat_username
    open_seat["avatar_config"] = guest_avatar
    room.seats_json = json.dumps(seats)
    db.session.commit()

    return jsonify(
        {
            "seat_token": token,
            "seat_color": open_seat["color"],
            "room": serialize_room(
                room,
                token,
                auth_user=auth_user,
                caller_tokens=caller_tokens,
            ),
        }
    )


@bp.route("/rooms/<string:room_code>", methods=("PATCH",))
def patch_room_endpoint(room_code: str):
    room = db.session.get(StoredRoom, room_code.upper())
    if room is None:
        abort(404, description="Sala não encontrada")
    if room.status != "WAITING":
        abort(400, description="A partida já foi iniciada")

    body = request.get_json(silent=True) or {}
    auth_user = resolve_user_from_token(_extract_auth_token())
    caller_tokens = _extract_caller_room_tokens(room_code)
    token = body.get("token") or request.args.get("token")

    config = json.loads(room.config_json)
    seats = json.loads(room.seats_json)

    if "config" in body and isinstance(body["config"], dict):
        cfg = body["config"]
        if "map_template" in cfg and cfg["map_template"] in VALID_MAP_TEMPLATES:
            config["map_template"] = cfg["map_template"]
        if "vps_to_win" in cfg and 3 <= int(cfg["vps_to_win"]) <= 20:
            config["vps_to_win"] = int(cfg["vps_to_win"])
        if "discard_limit" in cfg and 5 <= int(cfg["discard_limit"]) <= 20:
            config["discard_limit"] = int(cfg["discard_limit"])
        if "friendly_robber" in cfg:
            config["friendly_robber"] = bool(cfg["friendly_robber"])
        if "dice_mode" in cfg:
            if cfg["dice_mode"] not in VALID_DICE_MODES:
                abort(400, description="'dice_mode' must be 'random' or 'balanced'")
            config["dice_mode"] = cfg["dice_mode"]
        if "bot_difficulty" in cfg:
            norm_diff = normalize_bot_difficulty(cfg["bot_difficulty"])
            if norm_diff is None:
                abort(400, description="'bot_difficulty' deve ser easy, medium ou hard")
            config["bot_difficulty"] = norm_diff
            if "seats" not in body:
                target_key = BOT_DIFFICULTY_TO_KEY[norm_diff]
                for s in seats:
                    if s.get("player_key") != "HUMAN":
                        s["player_key"] = target_key
        if "bot_speed" in cfg:
            norm_speed = normalize_bot_speed(cfg["bot_speed"])
            if norm_speed is None:
                abort(400, description="'bot_speed' deve ser slow, normal, fast ou turbo")
            config["bot_speed"] = norm_speed

    if "seats" in body and isinstance(body["seats"], list):
        raw_seats = body["seats"]
        if not 2 <= len(raw_seats) <= 4:
            abort(400, description="A sala deve ter entre 2 e 4 assentos")
        updated_seats = []
        old_by_color = {s["color"]: s for s in seats}
        prescan_entries: list[tuple[str, str | None]] = []
        for idx, item in enumerate(raw_seats):
            color = SEAT_COLORS[idx]
            prev = old_by_color.get(str(item.get("source_color") or color), {})
            p_key = str(item.get("player_key", "HUMAN"))
            if p_key != "HUMAN":
                try:
                    REGISTRY.lookup(p_key.split(":")[0])
                except SpecError as err:
                    abort(400, description=str(err))
            req_name = (
                item.get("player_name")
                or (
                    prev.get("player_name")
                    if prev.get("player_key") != "HUMAN"
                    else None
                )
            )
            prescan_entries.append((p_key, req_name))

        explicit_bots, used_bot_names = prescan_requested_bot_names(prescan_entries)

        for idx, item in enumerate(raw_seats):
            color = SEAT_COLORS[idx]
            prev = old_by_color.get(str(item.get("source_color") or color), {})
            p_key = str(item.get("player_key", "HUMAN"))
            if p_key == "HUMAN":
                release_claim = bool(item.get("release_claim"))
                was_human = prev.get("player_key") == "HUMAN"
                seat_token = (
                    None
                    if release_claim
                    else (prev.get("seat_token") if was_human else None)
                )
                if seat_token:
                    requested_human = str(item.get("player_name") or "").strip()
                    prev_human = str(prev.get("player_name") or "").strip()
                    resolved_human = (
                        requested_human
                        if requested_human
                        and requested_human not in LEGACY_OPEN_SEAT_NAMES
                        else (prev_human or "Jogador")
                    )
                else:
                    resolved_human = OPEN_SEAT_NAME
                updated_seats.append(
                    {
                        "color": color,
                        "player_key": "HUMAN",
                        "player_name": resolved_human,
                        "seat_token": seat_token,
                        "seat_kind": (
                            prev.get("seat_kind", "GUEST") if seat_token else "GUEST"
                        ),
                        "username": prev.get("username") if seat_token else None,
                        "avatar_config": (
                            prev.get("avatar_config", {}) if seat_token else {}
                        ),
                    }
                )
            else:
                if idx in explicit_bots:
                    bot_label = explicit_bots[idx]
                else:
                    bot_label = pick_bot_names(1, exclude=used_bot_names)[0]
                    used_bot_names.add(bot_label)
                updated_seats.append(
                    {
                        "color": color,
                        "player_key": p_key,
                        "player_name": bot_label,
                        "seat_token": None,
                        "seat_kind": "BOT",
                        "username": None,
                        "avatar_config": dict(BOT_AVATAR_BY_NAME.get(bot_label) or {}),
                    }
                )
        seats = updated_seats

    room.config_json = json.dumps(config)
    room.seats_json = json.dumps(seats)
    db.session.commit()
    return jsonify(
        serialize_room(
            room,
            token,
            auth_user=auth_user,
            caller_tokens=caller_tokens,
        )
    )


@bp.route("/rooms/<string:room_code>/start", methods=("POST",))
def start_room_endpoint(room_code: str):
    room = db.session.get(StoredRoom, room_code.upper())
    if room is None:
        abort(404, description="Sala não encontrada")

    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        body = {}
    auth_user = resolve_user_from_token(_extract_auth_token())
    caller_tokens = _extract_caller_room_tokens(room_code)
    token = body.get("token") or request.args.get("token")

    if room.game_id:
        return jsonify(
            {
                "game_id": room.game_id,
                "room": serialize_room(
                    room,
                    token,
                    auth_user=auth_user,
                    caller_tokens=caller_tokens,
                ),
            }
        )

    config = json.loads(room.config_json)
    seats = json.loads(room.seats_json)
    player_keys = [seat["player_key"] for seat in seats]

    try:
        players = REGISTRY.build_all(player_keys)
    except SpecError as error:
        abort(400, description=str(error))

    catan_map = build_map(config.get("map_template", "BASE"))
    seed = _parse_seed(body.get("seed"))
    dice_mode = config.get("dice_mode", "random")
    if dice_mode not in VALID_DICE_MODES:
        dice_mode = "random"
    game = Game(
        players=players,
        seed=seed,
        discard_limit=int(config.get("discard_limit", 7)),
        friendly_robber=bool(config.get("friendly_robber", True)),
        vps_to_win=int(config.get("vps_to_win", 10)),
        catan_map=catan_map,
        dice_mode=dice_mode,
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
            "display_name": (
                COLOR_LABELS_PT.get(seat["color"], seat["color"])
                if seat["player_key"] == "HUMAN"
                and not seat.get("seat_token")
                and str(seat.get("player_name") or "").strip() in LEGACY_OPEN_SEAT_NAMES
                else (seat.get("player_name") or seat["color"])
            ),
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

    room.game_id = game.id
    room.status = "IN_PROGRESS"
    db.session.commit()

    return jsonify(
        {
            "game_id": game.id,
            "room": serialize_room(
                room,
                token,
                auth_user=auth_user,
                caller_tokens=caller_tokens,
            ),
        }
    )


def _extract_seat_token() -> str | None:
    hdr = request.headers.get("X-Seat-Token", "").strip()
    if hdr:
        return hdr
    body = request.get_json(silent=True) or {}
    if isinstance(body, dict):
        tok = body.get("seat_token") or body.get("token")
        if tok is not None:
            clean = str(tok).strip()
            if clean:
                return clean
    q_tok = request.args.get("seat_token")
    if q_tok is not None:
        clean = str(q_tok).strip()
        if clean:
            return clean
    return None


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

    normalized_preferred = (
        str(preferred_color).strip().upper()
        if preferred_color is not None and str(preferred_color).strip()
        else None
    )
    caller_color = authorize_seat_caller(
        stored,
        seat_meta,
        preferred_color=normalized_preferred,
        auth_user=auth_user,
        seat_token=seat_token,
    )
    if caller_color is not None:
        touch_seat_heartbeat(game_id, caller_color)

    promoted = maybe_promote_disconnected_seats(game_id)
    fresh_stored = db.session.get(StoredGame, game_id)
    fresh_meta = load_game_seat_metadata(fresh_stored) if fresh_stored is not None else {}
    bot_colors = [
        c for c, m in fresh_meta.items() if m.get("seat_kind") == "BOT"
    ]
    taken_over_colors = [
        c for c, m in fresh_meta.items() if m.get("taken_over_by_bot")
    ]
    target_color = caller_color or normalized_preferred
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

    normalized_preferred = (
        str(preferred_color).strip().upper()
        if preferred_color is not None and str(preferred_color).strip()
        else None
    )
    caller_color = authorize_seat_caller(
        stored,
        seat_meta,
        preferred_color=normalized_preferred,
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

    normalized_preferred = (
        str(preferred_color).strip().upper()
        if preferred_color is not None and str(preferred_color).strip()
        else None
    )
    caller_color = authorize_seat_caller(
        stored,
        seat_meta,
        preferred_color=normalized_preferred,
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
    parsed_json = request.get_json(silent=True)
    body_is_empty = (not request.data) or parsed_json is None or parsed_json == {}
    bot_only = request.args.get("bot_only") == "1"

    if not body_is_empty and isinstance(parsed_json, list) and len(parsed_json) >= 2:
        stored = db.session.get(StoredGame, game_id)
        if stored is not None:
            seat_meta = load_game_seat_metadata(stored)
            auth_user = resolve_user_from_token(_extract_auth_token())
            seat_token = _extract_seat_token()
            action_color = str(parsed_json[0]).strip().upper()
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
        # Another client in a multiplayer room already advanced the bot turn
        view = _enrich_view_with_seats(game, web_view(game, _perspective(game)))
        return Response(
            response=json.dumps(view),
            status=200,
            mimetype="application/json",
        )

    # The proposer may withdraw an offer while the current responder is a bot.
    is_cancel_request = (
        isinstance(parsed_json, list)
        and len(parsed_json) == 3
        and parsed_json[1] == "CANCEL_TRADE"
    )
    if body_is_empty or (game.state.current_player().is_bot and not is_cancel_request):
        game.play_tick()
        upsert_game_state(game)
    else:
        action = action_from_json(parsed_json)
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


@bp.route("/games/<string:game_id>/messages", methods=("GET",))
def list_game_messages_endpoint(game_id: str):
    stored = db.session.get(StoredGame, game_id)
    if stored is None:
        abort(404, description="Partida não encontrada")
    after_id = request.args.get("after_id", 0, type=int) or 0
    limit = request.args.get("limit", 100, type=int) or 100
    return jsonify(
        {
            "messages": list_game_messages(
                game_id, after_id=max(0, after_id), limit=limit
            )
        }
    )


@bp.route("/games/<string:game_id>/messages", methods=("POST",))
def post_game_message_endpoint(game_id: str):
    stored = db.session.get(StoredGame, game_id)
    if stored is None:
        abort(404, description="Partida não encontrada")

    body_json = request.get_json(silent=True) or {}
    if not isinstance(body_json, dict):
        abort(400, description="Corpo inválido")

    raw_body = body_json.get("body")
    if not isinstance(raw_body, str) or not raw_body.strip():
        abort(400, description="A mensagem não pode ficar vazia")
    clean_body = raw_body.strip()
    if len(clean_body) > 240:
        abort(400, description="Mensagem muito longa (máx. 240 caracteres)")

    raw_kind = str(body_json.get("kind") or "CHAT").strip().upper()
    if raw_kind not in ("CHAT", "TAUNT"):
        abort(400, description="Tipo de mensagem inválido")

    preferred_color = body_json.get("color") or body_json.get("seat") or request.args.get("as")
    normalized_preferred = (
        str(preferred_color).strip().upper()
        if preferred_color is not None and str(preferred_color).strip()
        else None
    )
    auth_user = resolve_user_from_token(_extract_auth_token())
    seat_token = _extract_seat_token()
    seat_meta = load_game_seat_metadata(stored)

    if seat_meta:
        caller_color = authorize_seat_caller(
            stored,
            seat_meta,
            preferred_color=normalized_preferred,
            auth_user=auth_user,
            seat_token=seat_token,
        )
    else:
        try:
            doc = json.loads(stored.head_state)
            colors = [str(c).upper() for c in doc.get("colors", [])]
        except Exception:
            colors = []
        if normalized_preferred and normalized_preferred in colors:
            caller_color = normalized_preferred
        elif colors and not normalized_preferred:
            caller_color = colors[0]
        else:
            caller_color = None

    if caller_color is None:
        abort(403, description="Sem permissão para enviar mensagem nesta partida")

    if seat_meta:
        touch_seat_heartbeat(game_id, caller_color)
    meta = seat_meta.get(caller_color, {})
    sender_name = str(
        meta.get("original_display_name")
        or meta.get("display_name")
        or COLOR_LABELS_PT.get(caller_color, caller_color)
    )
    created = create_game_message(
        game_id=game_id,
        color=caller_color,
        sender_name=sender_name,
        body=clean_body,
        kind=raw_kind,
    )
    return jsonify({"message": created}), 201


@bp.route("/leaderboard", methods=("GET",))
def get_leaderboard_endpoint():
    limit = min(max(request.args.get("limit", 100, type=int), 1), 200)
    return jsonify({"leaderboard": get_leaderboard(limit=limit)})


@bp.route("/matches", methods=("GET",))
def get_matches_endpoint():
    username = request.args.get("username")
    limit = min(max(request.args.get("limit", 30, type=int), 1), 100)
    return jsonify({"matches": get_match_history(username=username, limit=limit)})


@bp.route("/stress-test", methods=["GET"])
def stress_test_endpoint():
    params = AlphaBetaPlayer.Params(depth=2, prunning=True)
    players = [AlphaBetaPlayer(color, params) for color in Color]
    game = Game(players=players)
    game.play_tick()
    return Response(
        response=json.dumps(web_view(game)),
        status=200,
        mimetype="application/json",
    )


@bp.route(
    "/games/<string:game_id>/states/<string:state_index>/mcts-analysis", methods=["GET"]
)
def mcts_analysis_endpoint(game_id, state_index):
    """Get MCTS analysis for specific game state."""
    logging.info(f"MCTS analysis request for game {game_id} at state {state_index}")

    parsed_state_index = _parse_state_index(state_index)
    try:
        game = get_game_state(game_id, parsed_state_index)
        if game is None:
            logging.error(f"Game/state not found: {game_id}/{state_index}")
            abort(404, description="Game state not found")

        analyzer = GameAnalyzer(num_simulations=100)
        probabilities = analyzer.analyze_win_probabilities(game)

        return Response(
            response=json.dumps(
                {
                    "success": True,
                    "probabilities": probabilities,
                    "state_index": (
                        parsed_state_index
                        if parsed_state_index is not None
                        else len(game.state.action_records)
                    ),
                }
            ),
            status=200,
            mimetype="application/json",
        )

    except Exception as e:
        logging.error(f"Error in MCTS analysis endpoint: {str(e)}")
        logging.error(traceback.format_exc())
        return Response(
            response=json.dumps(
                {"success": False, "error": str(e), "trace": traceback.format_exc()}
            ),
            status=500,
            mimetype="application/json",
        )


def _perspective(game):
    """The seat whose eyes to see the table through, from ``?as=RED``."""
    color = request.args.get("as")
    if color is None:
        return None
    seated = [c.value for c in game.state.colors]
    if color.upper() not in seated:
        abort(400, description=f"'as' must be one of {', '.join(seated)}")
    return color.upper()


def _parse_state_index(state_index_str: str):
    """Helper function to parse and validate state_index."""
    if state_index_str == "latest":
        return None
    try:
        return int(state_index_str)
    except ValueError:
        abort(
            400,
            description="Invalid state_index format. state_index must be an integer or 'latest'.",
        )
