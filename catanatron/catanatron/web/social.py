"""Authenticated public profiles and mutual friendships. No private account fields."""

import json

from flask import Blueprint, abort, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from catanatron.web.api import _extract_auth_token
from catanatron.web.avatar_catalog import sanitize_avatar_config
from catanatron.web.models import (
    StoredFriendship, StoredUser, db, get_user_rank, get_user_stats,
    resolve_user_from_token,
)

bp = Blueprint("social", __name__, url_prefix="/api/social")


@bp.errorhandler(HTTPException)
def social_error(error):
    return jsonify({"message": error.description}), error.code


def _viewer():
    user = resolve_user_from_token(_extract_auth_token())
    if user is None:
        abort(401, description="Entre na sua conta para acessar seus amigos.")
    return user


def _target(username):
    user = db.session.get(StoredUser, username.strip().lstrip("@").lower())
    if user is None:
        abort(404, description="Jogador não encontrado.")
    return user


def _pair(viewer, target):
    if viewer.username == target.username:
        abort(400, description="Você não pode adicionar a si mesmo.")
    return tuple(sorted((viewer.username, target.username)))


def _relationship(row, viewer, target):
    if viewer == target:
        return "self"
    if row is None:
        return "none"
    if row.status == "accepted":
        return "friends"
    return "outgoing" if row.requested_by == viewer else "incoming"


def _summary(user, viewer, row=None):
    try:
        avatar = sanitize_avatar_config(json.loads(user.avatar_json or "{}"))
    except (ValueError, TypeError):
        avatar = {}
    # Deliberate allowlist: never serialize sessions, email, login provider or entitlements.
    return {
        "username": user.username,
        "display_name": user.display_name,
        "avatar_config": avatar,
        "relationship": _relationship(row, viewer, user.username),
    }


def _connections(username):
    return db.session.query(StoredFriendship).filter(or_(
        StoredFriendship.user_low == username, StoredFriendship.user_high == username,
    ))


def _other(row, username):
    return row.user_high if row.user_low == username else row.user_low


@bp.get("/players")
def search_players():
    viewer = _viewer()
    query = request.args.get("q", "").strip().lstrip("@")
    if not 2 <= len(query) <= 32:
        return jsonify({"players": []})
    # Treat SQL wildcard characters as literal text, not an unrestricted search.
    pattern = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    users = db.session.query(StoredUser).filter(
        StoredUser.username != viewer.username,
        or_(StoredUser.username.ilike(pattern, escape="\\"), StoredUser.display_name.ilike(pattern, escape="\\")),
    ).order_by(StoredUser.username).limit(20).all()
    names = [user.username for user in users]
    rows = _connections(viewer.username).filter(or_(
        StoredFriendship.user_low.in_(names), StoredFriendship.user_high.in_(names),
    )).all() if names else []
    connections = {_other(row, viewer.username): row for row in rows}
    return jsonify({"players": [_summary(user, viewer.username, connections.get(user.username)) for user in users]})


@bp.get("/profiles/<username>")
def player_profile(username):
    viewer = _viewer()
    target = _target(username)
    row = db.session.get(StoredFriendship, tuple(sorted((viewer.username, target.username)))) if viewer.username != target.username else None
    result = _summary(target, viewer.username, row)
    result.update({
        "stats": get_user_stats(target.username),
        "leaderboard_rank": get_user_rank(target.username),
        "member_since": target.created_at,
    })
    return jsonify(result)


@bp.get("/friends")
def friends():
    viewer = _viewer()
    rows = _connections(viewer.username).order_by(StoredFriendship.created_at.desc()).all()
    names = [_other(row, viewer.username) for row in rows]
    users = {u.username: u for u in db.session.query(StoredUser).filter(StoredUser.username.in_(names)).all()} if names else {}
    result = {"friends": [], "incoming": [], "outgoing": []}
    for row in rows:
        user = users.get(_other(row, viewer.username))
        if user is None:
            continue
        item = _summary(user, viewer.username, row)
        result[item["relationship"]].append(item)
    return jsonify(result)


@bp.route("/friendships/<username>", methods=("POST", "PATCH", "DELETE"))
def friendship(username):
    viewer = _viewer()
    target = _target(username)
    low, high = _pair(viewer, target)
    row = db.session.query(StoredFriendship).filter_by(user_low=low, user_high=high).with_for_update().first()
    if request.method == "POST":
        if row is None:
            row = StoredFriendship(user_low=low, user_high=high, requested_by=viewer.username, status="pending")
            db.session.add(row)
            try:
                db.session.commit()
            except IntegrityError:
                # Another device submitted the same pair: return its current state.
                db.session.rollback()
                row = db.session.get(StoredFriendship, (low, high))
                if row is None:
                    abort(409, description="A solicitação mudou. Atualize a lista e tente novamente.")
        if row.status == "pending" and row.requested_by != viewer.username:
            abort(409, description="Este jogador já enviou um pedido. Aceite-o na aba Pedidos.")
    elif request.method == "PATCH":
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or body.get("action") != "accept":
            abort(400, description="Escolha uma ação válida para o pedido.")
        if row is None:
            abort(404, description="Este pedido não está mais disponível.")
        if row.requested_by == viewer.username:
            abort(403, description="Somente quem recebeu o pedido pode aceitá-lo.")
        row.status = "accepted"
        db.session.commit()
    else:
        if row is not None:
            db.session.delete(row)
            db.session.commit()
        row = None
    return jsonify(_summary(target, viewer.username, row))
