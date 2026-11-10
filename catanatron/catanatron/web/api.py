import json
import logging
import traceback
import uuid

from flask import Response, Blueprint, jsonify, abort, request

from catanatron.web.models import (
    SEAT_COLORS,
    StoredRoom,
    create_room,
    db,
    get_game_state,
    get_room_by_game_id,
    serialize_room,
    upsert_game_state,
)
from catanatron.serialization import action_from_json, web_view
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


def _enrich_view_with_room(game: Game, view: dict) -> dict:
    try:
        room = get_room_by_game_id(game.id)
        if room is not None:
            seats = json.loads(room.seats_json)
            view["seat_names"] = {
                seat["color"]: seat["player_name"] for seat in seats
            }
            view["room_code"] = room.room_code
    except Exception:
        pass
    return view


@bp.route("/players", methods=("GET",))
def get_players_endpoint():
    """List the players this server can seat, and the params each accepts."""
    return jsonify([describe(key, REGISTRY[key]) for key in sorted(REGISTRY)])


@bp.route("/games", methods=("POST",))
def post_game_endpoint():
    if not request.is_json or request.json is None or "players" not in request.json:
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
    if not isinstance(discard_limit, int) or not 5 <= discard_limit <= 20:
        abort(400, description="'discard_limit' must be an integer between 5 and 20")

    vps_to_win = request.json.get("vps_to_win", 10)
    if not isinstance(vps_to_win, int) or not 3 <= vps_to_win <= 20:
        abort(400, description="'vps_to_win' must be an integer between 3 and 20")

    friendly_robber = request.json.get("friendly_robber", False)
    if not isinstance(friendly_robber, bool):
        abort(400, description="'friendly_robber' must be a boolean")

    try:
        players = REGISTRY.build_all(player_keys)
    except SpecError as error:
        abort(400, description=str(error))
    catan_map = build_map(map_template)

    game = Game(
        players=players,
        discard_limit=discard_limit,
        friendly_robber=friendly_robber,
        vps_to_win=vps_to_win,
        catan_map=catan_map,
    )
    upsert_game_state(game)
    return jsonify({"game_id": game.id})


# ===== Private Rooms & Invite Links =====
@bp.route("/rooms", methods=("POST",))
def post_room_endpoint():
    body = request.get_json(silent=True) or {}
    host_name = str(body.get("host_name") or "Anfitrião").strip()[:32]
    players = body.get("players")
    map_template = body.get("map_template", "BASE")
    if map_template not in VALID_MAP_TEMPLATES:
        abort(400, description="'map_template' must be one of BASE, MINI, or TOURNAMENT")

    vps_to_win = int(body.get("vps_to_win", 10))
    discard_limit = int(body.get("discard_limit", 7))
    friendly_robber = bool(body.get("friendly_robber", True))

    room, host_token = create_room(
        host_name=host_name,
        players=players,
        map_template=map_template,
        vps_to_win=vps_to_win,
        discard_limit=discard_limit,
        friendly_robber=friendly_robber,
    )
    return jsonify(
        {
            "room_code": room.room_code,
            "seat_token": host_token,
            "room": serialize_room(room, host_token),
        }
    )


@bp.route("/rooms/<string:room_code>", methods=("GET",))
def get_room_endpoint(room_code: str):
    room = db.session.get(StoredRoom, room_code.upper())
    if room is None:
        abort(404, description="Sala não encontrada")
    token = request.args.get("token")
    return jsonify(serialize_room(room, token))


@bp.route("/rooms/<string:room_code>/join", methods=("POST",))
def join_room_endpoint(room_code: str):
    room = db.session.get(StoredRoom, room_code.upper())
    if room is None:
        abort(404, description="Sala não encontrada")

    body = request.get_json(silent=True) or {}
    player_name = str(body.get("player_name") or "Jogador").strip()[:32]
    preferred_color = body.get("preferred_color")
    token = body.get("token") or uuid.uuid4().hex

    seats = json.loads(room.seats_json)

    # If caller already holds a seat, allow switching to another open HUMAN seat or updating name
    current_seat = next(
        (s for s in seats if s.get("seat_token") and s.get("seat_token") == token),
        None,
    )

    if preferred_color:
        target = next((s for s in seats if s["color"] == preferred_color), None)
        if target is None:
            abort(400, description="Cor inválida")
        if target["player_key"] == "HUMAN" and (
            not target.get("seat_token") or target.get("seat_token") == token
        ):
            if current_seat and current_seat is not target:
                current_seat["seat_token"] = None
                current_seat["player_name"] = "Aguardando Amigo..."
            target["seat_token"] = token
            target["player_name"] = player_name
            room.seats_json = json.dumps(seats)
            db.session.commit()
            return jsonify(
                {
                    "seat_token": token,
                    "seat_color": target["color"],
                    "room": serialize_room(room, token),
                }
            )

    if current_seat is not None:
        current_seat["player_name"] = player_name
        room.seats_json = json.dumps(seats)
        db.session.commit()
        return jsonify(
            {
                "seat_token": token,
                "seat_color": current_seat["color"],
                "room": serialize_room(room, token),
            }
        )

    # Otherwise claim the first open HUMAN seat
    open_seat = next(
        (s for s in seats if s["player_key"] == "HUMAN" and not s.get("seat_token")),
        None,
    )
    if open_seat is None:
        abort(400, description="Não há assentos humanos vagos nesta sala")

    open_seat["seat_token"] = token
    open_seat["player_name"] = player_name
    room.seats_json = json.dumps(seats)
    db.session.commit()

    return jsonify(
        {
            "seat_token": token,
            "seat_color": open_seat["color"],
            "room": serialize_room(room, token),
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

    if "seats" in body and isinstance(body["seats"], list):
        raw_seats = body["seats"]
        if not 2 <= len(raw_seats) <= 4:
            abort(400, description="A sala deve ter entre 2 e 4 assentos")
        updated_seats = []
        old_by_color = {s["color"]: s for s in seats}
        for idx, item in enumerate(raw_seats):
            color = SEAT_COLORS[idx]
            prev = old_by_color.get(color, {})
            p_key = str(item.get("player_key", "HUMAN"))
            if p_key == "HUMAN":
                was_human = prev.get("player_key") == "HUMAN"
                seat_token = prev.get("seat_token") if was_human else None
                default_name = (
                    prev.get("player_name")
                    if (was_human and seat_token)
                    else "Aguardando Amigo..."
                )
                updated_seats.append(
                    {
                        "color": color,
                        "player_key": "HUMAN",
                        "player_name": item.get("player_name") or default_name,
                        "seat_token": seat_token,
                    }
                )
            else:
                # Validate bot spec
                try:
                    REGISTRY.lookup(p_key.split(":")[0])
                except SpecError as err:
                    abort(400, description=str(err))
                bot_label = item.get("player_name") or f"Bot ({p_key})"
                updated_seats.append(
                    {
                        "color": color,
                        "player_key": p_key,
                        "player_name": bot_label,
                        "seat_token": None,
                    }
                )
        seats = updated_seats

    room.config_json = json.dumps(config)
    room.seats_json = json.dumps(seats)
    db.session.commit()
    return jsonify(serialize_room(room, token))


@bp.route("/rooms/<string:room_code>/start", methods=("POST",))
def start_room_endpoint(room_code: str):
    room = db.session.get(StoredRoom, room_code.upper())
    if room is None:
        abort(404, description="Sala não encontrada")

    body = request.get_json(silent=True) or {}
    token = body.get("token") or request.args.get("token")

    if room.game_id:
        return jsonify({"game_id": room.game_id, "room": serialize_room(room, token)})

    config = json.loads(room.config_json)
    seats = json.loads(room.seats_json)
    player_keys = [seat["player_key"] for seat in seats]

    try:
        players = REGISTRY.build_all(player_keys)
    except SpecError as error:
        abort(400, description=str(error))

    catan_map = build_map(config.get("map_template", "BASE"))
    game = Game(
        players=players,
        discard_limit=int(config.get("discard_limit", 7)),
        friendly_robber=bool(config.get("friendly_robber", True)),
        vps_to_win=int(config.get("vps_to_win", 10)),
        catan_map=catan_map,
    )
    upsert_game_state(game)

    room.game_id = game.id
    room.status = "IN_PROGRESS"
    db.session.commit()

    return jsonify({"game_id": game.id, "room": serialize_room(room, token)})


@bp.route("/games/<string:game_id>/states/<string:state_index>", methods=("GET",))
def get_game_endpoint(game_id, state_index):
    parsed_state_index = _parse_state_index(state_index)
    game = get_game_state(game_id, parsed_state_index)
    if game is None:
        abort(404, description="Resource not found")

    view = _enrich_view_with_room(game, web_view(game, _perspective(game)))
    return Response(
        response=json.dumps(view),
        status=200,
        mimetype="application/json",
    )


@bp.route("/games/<string:game_id>/actions", methods=["POST"])
def post_action_endpoint(game_id):
    game = get_game_state(game_id)
    if game is None:
        abort(404, description="Resource not found")

    if game.winning_color() is not None:
        view = _enrich_view_with_room(game, web_view(game, _perspective(game)))
        return Response(
            response=json.dumps(view),
            status=200,
            mimetype="application/json",
        )

    body_is_empty = (not request.data) or request.json is None or request.json == {}
    bot_only = request.args.get("bot_only") == "1"

    if bot_only and body_is_empty and not game.state.current_player().is_bot:
        # Another client in a multiplayer room already advanced the bot turn
        view = _enrich_view_with_room(game, web_view(game, _perspective(game)))
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

    view = _enrich_view_with_room(game, web_view(game, _perspective(game)))
    return Response(
        response=json.dumps(view),
        status=200,
        mimetype="application/json",
    )


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
