import pytest

from catanatron.web import create_app
from catanatron.web.models import StoredFriendship, StoredUser, db, register_user


@pytest.fixture
def social():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "SECRET_KEY": "test"})
    with app.app_context():
        headers = {}
        for name in ("alice", "bruno", "carla"):
            _, session = register_user(name, "test-password", name.title())
            headers[name] = {"Authorization": f"Bearer {session.token}"}
    yield app, app.test_client(), headers
    with app.app_context():
        db.session.remove()
        db.drop_all()


def test_mutual_friendship_lifecycle_and_idempotence(social):
    app, client, headers = social
    path = "/api/social/friendships/bruno"
    for _ in range(2):
        assert client.post(path, headers=headers["alice"]).json["relationship"] == "outgoing"
    with app.app_context():
        assert db.session.query(StoredFriendship).count() == 1
    assert client.get("/api/social/friends", headers=headers["alice"]).json["outgoing"][0]["username"] == "bruno"
    assert client.get("/api/social/friends", headers=headers["bruno"]).json["incoming"][0]["username"] == "alice"
    # Neither the sender nor a third party can accept the request.
    assert client.patch(path, json={"action": "accept"}, headers=headers["alice"]).status_code == 403
    assert client.patch(path, json={"action": "accept"}, headers=headers["carla"]).status_code == 404
    assert client.post("/api/social/friendships/alice", headers=headers["bruno"]).status_code == 409
    assert client.patch("/api/social/friendships/alice", json={"action": "accept"}, headers=headers["bruno"]).json["relationship"] == "friends"
    for viewer, other in (("alice", "bruno"), ("bruno", "alice")):
        result = client.get("/api/social/friends", headers=headers[viewer]).json
        assert [p["username"] for p in result["friends"]] == [other]
        assert not result["incoming"] and not result["outgoing"]
    assert client.get("/api/social/friends", headers=headers["carla"]).json == {"friends": [], "incoming": [], "outgoing": []}
    # An unrelated DELETE cannot affect Alice and Bruno.
    client.delete(path, headers=headers["carla"])
    assert client.get("/api/social/friends", headers=headers["alice"]).json["friends"]
    assert client.delete(path, headers=headers["alice"]).json["relationship"] == "none"
    assert not client.get("/api/social/friends", headers=headers["bruno"]).json["friends"]


@pytest.mark.parametrize("actor,target", [("alice", "bruno"), ("bruno", "alice")])
def test_cancel_or_decline_pending_request(social, actor, target):
    _, client, headers = social
    client.post("/api/social/friendships/bruno", headers=headers["alice"])
    for _ in range(2):
        assert client.delete(f"/api/social/friendships/{target}", headers=headers[actor]).status_code == 200
    assert client.patch("/api/social/friendships/alice", json={"action": "accept"}, headers=headers["bruno"]).status_code == 404


def test_profiles_search_privacy_and_relationship(social):
    app, client, headers = social
    with app.app_context():
        user = db.session.get(StoredUser, "bruno")
        user.email = "private@example.test"
        db.session.commit()
    client.post("/api/social/friendships/bruno", headers=headers["alice"])
    profile = client.get("/api/social/profiles/bruno", headers=headers["alice"]).json
    assert set(profile) == {"username", "display_name", "avatar_config", "relationship", "stats", "leaderboard_rank", "member_since"}
    assert profile["relationship"] == "outgoing"
    assert profile["stats"]["games_played"] == 0
    assert "private@example.test" not in str(profile)
    result = client.get("/api/social/players?q=@BRU", headers=headers["alice"]).json["players"]
    assert len(result) == 1 and result[0]["relationship"] == "outgoing"
    for query in ("a", "alice", "%_", "x" * 33):
        assert client.get("/api/social/players", query_string={"q": query}, headers=headers["alice"]).json["players"] == []
    assert client.get("/api/social/profiles/alice", headers=headers["alice"]).json["relationship"] == "self"


@pytest.mark.parametrize("method,path", [("get", "/friends"), ("get", "/players?q=br"), ("get", "/profiles/bruno"), ("post", "/friendships/bruno"), ("patch", "/friendships/bruno"), ("delete", "/friendships/bruno")])
def test_requires_authentication(social, method, path):
    _, client, _ = social
    assert getattr(client, method)("/api/social" + path).status_code == 401


def test_invalid_friendship_actions(social):
    _, client, headers = social
    for method in ("post", "patch", "delete"):
        assert getattr(client, method)("/api/social/friendships/alice", headers=headers["alice"]).status_code == 400
    assert client.post("/api/social/friendships/missing", headers=headers["alice"]).status_code == 404
    assert client.patch("/api/social/friendships/bruno", json=["accept"], headers=headers["alice"]).status_code == 400
