# Rule the Isle (Bloco 2): Criador Modular de Avatar, Perfil e Molduras por Mérito — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema completo de Avatar SVG modular em camadas (com 6 arquétipos prontos e sorteio aleatório), progressão de molduras e Coroa Dourada desbloqueadas por vitórias no Ranking Global (validação dupla em servidor e offline), Studio de Perfil (`AvatarStudioModal`) e exibição universal dos avatares na Home, Sala Multiplayer, Ranking e barra superior `PlayerTopBar` da partida.

**Architecture:** O backend Flask (`models.py` e `api.py`) valida e sanitiza `AvatarConfig` em `PATCH /api/auth/profile` bloqueando itens não conquistados com HTTP `403`, além de propagar `seat_kind`, `username` e `avatar_config` em uma única query batch (`_load_avatars_by_username`) tanto em salas (`serialize_room`) quanto em estados de jogo Solo/Multiplayer (`_enrich_view_with_seats`). No frontend (`ui/src/`), `avatarCatalog.ts` concentra catálogo, fallback determinístico (`resolveAvatarConfig`), presets e metas de vitórias; `PlayerAvatar.tsx` renderiza o SVG estratificado; `AvatarStudioModal.tsx` oferece edição em 2 colunas com 5 abas; e `localEngine.ts` espelha a mesma validação/propagação para o modo offline.

**Tech Stack:** Python 3.11+ (`Flask 3`, `SQLAlchemy 2`, `Flask-SQLAlchemy`, `pytest`), React 19, TypeScript 5.8, MUI v7, Vite 6, Vitest 3 + React Testing Library, SCSS.

## Global Constraints

- Todo texto visível ao usuário deve estar **100% em Português Brasileiro (`pt-BR`)**, mantendo a marca **Rule the Isle**.
- Todos os traços de personagem, roupas, fundos e acessórios base (`captain`, `explorer`, `bandana`, `helm`, `wood`) são gratuitos desde `0` vitórias.
- Regras oficiais de desbloqueio por vitórias no Ranking Global:
  - `0` vitórias: `frame: "wood"` (**Moldura Madeira de Colono**)
  - `1` vitória: `frame: "bronze"` (**Moldura Bronze de Navegador**)
  - `3` vitórias: `frame: "silver"` (**Moldura Prata da Guilda**)
  - `5` vitórias: `frame: "gold"` (**Moldura Ouro Real**)
  - `7` vitórias: `hat: "crown_gold"` (**Coroa Dourada do Soberano**)
  - `10` vitórias: `frame: "imperial"` (**Moldura Imperial da Ilha**)
- Tentativa de equipar item bloqueado retorna **HTTP `403`** no servidor e lança erro equivalente no fallback offline (`localEngine.ts`).
- `PlayerTopBar` exibe o SVG `<PlayerAvatar />` para assentos `seat_kind === "USER"` e preserva os retratos clássicos `.webp` da ilha (`/assets/illustrations/avatars/{red,blue,orange,white}.webp`) para Bots (`BOT`) e convidados sem conta (`GUEST`).
- Nenhuma nova dependência NPM ou PyPI externa deve ser adicionada para o criador de avatares (SVG puro + SCSS).
- Zero queries N+1 em salas, partidas ou leaderboard; usar sempre carga em lote por `username`.
- Preservar todos os testes Python e Vitest existentes verdes na branch `layout-topbar`; **não** fazer merge na `main` nem push automático.

---

### File Structure

| Arquivo | Responsabilidade |
|---|---|
| Modify: `catanatron/catanatron/web/models.py` | Constantes `AVATAR_VALID_VALUES` e `AVATAR_UNLOCK_REQUIREMENTS`, `sanitize_avatar_config`, verificação `403` em `update_user_profile`, `_load_avatars_by_username`, enriquecimento em `serialize_room`. |
| Modify: `catanatron/catanatron/web/api.py` | Substituir `_enrich_view_with_room` por `_enrich_view_with_seats(game, view)` lendo `StoredGame.seat_metadata_json` + `StoredRoom` para enviar `seat_names` e `seat_avatars` em jogos Solo e Multiplayer. |
| Modify: `tests/web/test_auth_and_ranking.py` | Testes `pytest` para bloqueio `403` de item bloqueado, desbloqueio `200` após vitórias e propagação de `seat_avatars` em jogos e salas. |
| Modify: `ui/src/utils/api.types.ts` | Tipos estritos `AvatarConfig`, `SeatAvatarMeta` e campos `seat_kind`/`username`/`avatar_config`/`seat_avatars` em `RoomSeat`, `GameState`, `LeaderboardEntry`. |
| Create: `ui/src/config/avatarCatalog.ts` | Paletas, opções, 6 arquétipos (*Modelos da Ilha*), regras de desbloqueio e funções puras (`resolveAvatarConfig`, `getAvatarItemRequirement`, `isAvatarItemUnlocked`, `randomizeUnlockedAvatar`, `sanitizeAvatarConfig`). |
| Create: `ui/src/config/avatarCatalog.test.ts` | Testes unitários das regras do catálogo, fallback determinístico e randomização segura. |
| Modify: `ui/src/utils/apiClient.ts` | Tipagem de `updateProfile` com propagação estrita de erros `4xx` e fallback `localUpdateProfile` em falha de rede/`5xx`; envio de `authHeaders()` em `joinRoom`. |
| Modify: `ui/src/utils/localEngine.ts` | Persistência de `avatar_config` em `LocalUserRecord`, `localUpdateProfile` com trava por vitórias, enriquecimento de `avatar_config` e `seat_avatars` em leaderboard/salas/jogos locais. |
| Modify: `ui/src/utils/apiClient.test.ts` | Testes para `updateProfile` (propagação de `403`, fallback offline com trava de vitórias e propagação em `localGetLeaderboard` / `localCreateGame`). |
| Create: `ui/src/components/PlayerAvatar.tsx` & `ui/src/components/PlayerAvatar.scss` | Renderizador SVG em camadas (`background`, `outfit`, pele/pescoço/rosto, `eyes`, `beard`, `hair`, `hat`) e 5 molduras estilizadas com brilho animado para `imperial`. |
| Create: `ui/src/components/AvatarStudioModal.tsx` & `ui/src/components/AvatarStudioModal.scss` | Modal de 2 colunas com preview `120px`, `Apelido na Mesa`, botão `🎲 Aleatório`, 6 presets, 5 abas e badges de cadeado 🔒. |
| Create: `ui/src/components/AvatarStudioModal.test.tsx` | Testes do Studio (abas, bloqueio com cadeado, preset, randomizador e submissão `updateProfile`). |
| Modify: `ui/src/pages/HomePage.tsx` & `.scss` | Avatar clicável `52px` + botão `🎨 Personalizar Avatar` na barra logada e abertura do `AvatarStudioModal`. |
| Modify: `ui/src/pages/RoomLobbyPage.tsx` & `.scss` | Exibição de `<PlayerAvatar />` em assentos `USER`, retrato clássico `.webp` para Bots/Convidados e botão `🎨 Editar Meu Avatar` com sincronização imediata no lobby. |
| Modify: `ui/src/components/LeaderboardModal.tsx` & `.scss` | Mini `<PlayerAvatar size={34} />` em cada linha do Ranking Global. |
| Modify: `ui/src/components/PlayerTopBar.tsx` & `.scss` | Renderização de `<PlayerAvatar size={54} />` quando `seat_avatars?.[color]?.seat_kind === "USER"`, mantendo `.webp` clássico para `BOT`/`GUEST`. |
| Modify: `ui/src/components/LeaderboardModal.test.tsx`, `ui/src/pages/GameScreen.test.tsx`, `ui/src/App.test.tsx` | Asserções de renderização de `PlayerAvatar` no Ranking e no `PlayerTopBar` de usuários mantendo Bots com `.webp`. |
| Modify: `CONTEXTO_PROJETO.md` | Documentar arquitetura do Bloco 2 e corrigir comando dev (`npm start` na porta `3000`). |

---

### Task 1: Regras de Desbloqueio de Avatar, Sanitização e Propagação Zero-N+1 no Backend

**Files:**
- Modify: `catanatron/catanatron/web/models.py:505-516`, `catanatron/catanatron/web/models.py:282-312`, `catanatron/catanatron/web/models.py:778-827`
- Modify: `catanatron/catanatron/web/api.py:13-64`, `catanatron/catanatron/web/api.py:520-580`
- Test: `tests/web/test_auth_and_ranking.py`

**Interfaces:**
- Produces em `catanatron/catanatron/web/models.py`:
  - `AVATAR_VALID_VALUES: dict[str, tuple[str, ...]]`
  - `AVATAR_UNLOCK_REQUIREMENTS: dict[str, dict[str, int]]`
  - `sanitize_avatar_config(raw: dict | None) -> dict[str, str]`
  - `_load_avatars_by_username(usernames: list[str]) -> dict[str, dict[str, str]]`
  - `update_user_profile(user: StoredUser, display_name: str | None = None, avatar_config: dict | None = None) -> StoredUser` (levanta HTTP `400` se tipo inválido ou HTTP `403` se item requer mais vitórias)
  - `serialize_room(room: StoredRoom, caller_token: str | None = None) -> dict` (inclui `seat_kind`, `username`, `avatar_config` em cada item de `seats`)
- Produces em `catanatron/catanatron/web/api.py`:
  - `_enrich_view_with_seats(game: Game, view: dict) -> dict` (popula `view["seat_names"]` e `view["seat_avatars"]`, e `view["room_code"]` quando houver sala)

- [ ] **Step 1: Escrever testes falhando em `tests/web/test_auth_and_ranking.py` para desbloqueio de molduras/coroa e propagação de `seat_avatars` em jogos e salas**

Append at the end of `tests/web/test_auth_and_ranking.py`:
```python
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
    assert state_view["seat_avatars"]["RED"]["seat_kind"] == "BOT"
    assert state_view["seat_avatars"]["RED"]["avatar_config"] == {}

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
```

- [ ] **Step 2: Rodar os novos testes Python e verificar que falham**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_auth_and_ranking.py -k "avatar" -v
```
Expected: FAIL (`403` expected on locked frame but currently returns `200`, and `seat_avatars` missing from `/api/games/.../states/latest` and `serialize_room`).

- [ ] **Step 3: Implementar constantes de avatar, sanitização, trava `403`, `_load_avatars_by_username` e enriquecimento em `models.py` e `api.py`**

In `catanatron/catanatron/web/models.py`:
Add right after `SESSION_TTL_SECONDS = 90 * 24 * 60 * 60` (around line 50):
```python
AVATAR_VALID_VALUES: dict[str, tuple[str, ...]] = {
    "skin": ("porcelain", "fair", "warm", "tan", "brown", "deep"),
    "eyes": ("calm", "cheerful", "sharp", "wise"),
    "hair": ("none", "short", "wavy", "bun", "braids", "curly", "long"),
    "hairColor": ("brown", "black", "blonde", "red", "silver", "navy"),
    "beard": ("none", "goatee", "full", "mustache"),
    "hat": ("none", "captain", "explorer", "bandana", "helm", "crown_gold"),
    "outfit": ("settler", "captain", "armor", "merchant"),
    "outfitColor": ("crimson", "royal", "emerald", "amber", "slate"),
    "background": ("ocean", "sunset", "forest", "mountain", "gold", "crimson"),
    "frame": ("wood", "bronze", "silver", "gold", "imperial"),
}

AVATAR_UNLOCK_REQUIREMENTS: dict[str, dict[str, int]] = {
    "frame": {"bronze": 1, "silver": 3, "gold": 5, "imperial": 10},
    "hat": {"crown_gold": 7},
}


def sanitize_avatar_config(raw: dict | None) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    sanitized: dict[str, str] = {}
    for field, allowed in AVATAR_VALID_VALUES.items():
        val = raw.get(field)
        if isinstance(val, str) and val in allowed:
            sanitized[field] = val
    return sanitized


def _load_avatars_by_username(usernames: list[str]) -> dict[str, dict[str, str]]:
    clean = sorted({u for u in usernames if isinstance(u, str) and u})
    if not clean:
        return {}
    users = db.session.query(StoredUser).filter(StoredUser.username.in_(clean)).all()
    by_user: dict[str, dict[str, str]] = {}
    for u in users:
        try:
            parsed = json.loads(u.avatar_json or "{}")
        except Exception:
            parsed = {}
        by_user[u.username] = sanitize_avatar_config(parsed)
    return by_user
```

Update `serialize_room` in `catanatron/catanatron/web/models.py` (lines 282-312):
```python
def serialize_room(room: StoredRoom, caller_token: str | None = None) -> dict:
    config = json.loads(room.config_json)
    seats = json.loads(room.seats_json)
    my_color = None
    is_host = bool(caller_token and caller_token == room.host_token)

    user_names = [
        s.get("username")
        for s in seats
        if s.get("player_key") == "HUMAN" and s.get("username")
    ]
    avatars = _load_avatars_by_username(user_names)

    public_seats = []
    for seat in seats:
        if caller_token and seat.get("seat_token") == caller_token:
            my_color = seat["color"]
        is_bot = seat["player_key"] != "HUMAN"
        uname = seat.get("username") if not is_bot else None
        seat_kind = (
            "BOT"
            if is_bot
            else (seat.get("seat_kind") or ("USER" if uname else "GUEST"))
        )
        public_seats.append(
            {
                "color": seat["color"],
                "player_key": seat["player_key"],
                "player_name": seat["player_name"],
                "is_bot": is_bot,
                "claimed": bool(seat.get("seat_token")) or is_bot,
                "is_me": bool(caller_token and seat.get("seat_token") == caller_token),
                "seat_kind": seat_kind,
                "username": uname,
                "avatar_config": (
                    avatars.get(uname, {}) if (seat_kind == "USER" and uname) else {}
                ),
            }
        )

    return {
        "room_code": room.room_code,
        "status": room.status,
        "game_id": room.game_id,
        "is_host": is_host,
        "my_color": my_color,
        "config": config,
        "seats": public_seats,
    }
```

Update `serialize_user` (lines 440-454) so it also returns sanitized `avatar_config`:
```python
def serialize_user(user: StoredUser, stats: dict | None = None) -> dict:
    try:
        avatar_cfg = json.loads(user.avatar_json or "{}")
    except Exception:
        avatar_cfg = {}
    payload = {
        "username": user.username,
        "display_name": user.display_name,
        "has_google": bool(user.google_sub),
        "avatar_config": sanitize_avatar_config(avatar_cfg),
    }
    if stats is not None:
        payload["stats"] = stats
    return payload
```

Update `update_user_profile` in `catanatron/catanatron/web/models.py` (lines 506-516):
```python
def update_user_profile(
    user: StoredUser, display_name: str | None = None, avatar_config: dict | None = None
) -> StoredUser:
    session = db.session
    if avatar_config is not None:
        if not isinstance(avatar_config, dict):
            abort(400, description="Configuração de avatar inválida.")
        try:
            existing_cfg = sanitize_avatar_config(json.loads(user.avatar_json or "{}"))
        except Exception:
            existing_cfg = {}
        incoming_cfg = sanitize_avatar_config(avatar_config)
        merged_cfg = {**existing_cfg, **incoming_cfg}

        wins = get_user_stats(user.username)["wins"]
        for field, rules in AVATAR_UNLOCK_REQUIREMENTS.items():
            chosen = merged_cfg.get(field)
            if chosen in rules and wins < rules[chosen]:
                required = rules[chosen]
                abort(
                    403,
                    description=(
                        f"Este item requer {required} vitória(s) no Ranking para ser "
                        f"desbloqueado (você tem {wins})."
                    ),
                )
        user.avatar_json = json.dumps(merged_cfg)

    if display_name is not None and str(display_name).strip():
        user.display_name = str(display_name).strip()[:32]
    session.commit()
    return user
```

Update `get_leaderboard` in `catanatron/catanatron/web/models.py` (lines 799-807) to use `sanitize_avatar_config`:
```python
        try:
            avatar_cfg = sanitize_avatar_config(json.loads(u.avatar_json or "{}"))
        except Exception:
            avatar_cfg = {}
        board.append(
            {
                "username": u.username,
                "display_name": u.display_name,
                "avatar_config": avatar_cfg,
                "wins": wins,
                "losses": losses,
                "games_played": games_played,
                "win_rate": win_rate,
            }
        )
```

In `catanatron/catanatron/web/api.py`:
Update imports from `catanatron.web.models` to also import `COLOR_LABELS_PT`, `StoredGame`, and `_load_avatars_by_username`:
```python
from catanatron.web.models import (
    COLOR_LABELS_PT,
    SEAT_COLORS,
    StoredGame,
    StoredRoom,
    _load_avatars_by_username,
    authenticate_user,
    build_seat_metadata_for_game,
    create_room,
    db,
    get_game_state,
    get_leaderboard,
    get_match_history,
    get_room_by_game_id,
    get_user_stats,
    list_active_rooms,
    login_with_google_claims,
    record_completed_match,
    register_user,
    resolve_user_from_token,
    revoke_session_token,
    serialize_room,
    serialize_user,
    update_user_profile,
    upsert_game_state,
)
```

Replace `_enrich_view_with_room` with `_enrich_view_with_seats` (lines 51-63):
```python
def _enrich_view_with_seats(game: Game, view: dict) -> dict:
    try:
        seat_meta: dict[str, dict] = {}
        stored_game = db.session.get(StoredGame, game.id)
        if stored_game and stored_game.seat_metadata_json:
            parsed = json.loads(stored_game.seat_metadata_json)
            if isinstance(parsed, dict):
                seat_meta = parsed

        room = get_room_by_game_id(game.id)
        if room is not None:
            view["room_code"] = room.room_code
            if not seat_meta:
                for seat in json.loads(room.seats_json):
                    c = seat["color"]
                    is_bot = seat.get("player_key", "HUMAN") != "HUMAN"
                    uname = seat.get("username") if not is_bot else None
                    seat_meta[c] = {
                        "color": c,
                        "seat_kind": "BOT" if is_bot else ("USER" if uname else "GUEST"),
                        "username": uname,
                        "player_key": seat.get("player_key", "HUMAN"),
                        "display_name": seat.get("player_name")
                        or COLOR_LABELS_PT.get(c, c),
                    }

        if seat_meta:
            usernames = [
                meta.get("username")
                for meta in seat_meta.values()
                if meta.get("seat_kind") == "USER" and meta.get("username")
            ]
            avatars = _load_avatars_by_username(usernames)
            seat_names: dict[str, str] = {}
            seat_avatars: dict[str, dict] = {}
            for color, meta in seat_meta.items():
                seat_kind = meta.get("seat_kind") or "GUEST"
                uname = meta.get("username") if seat_kind == "USER" else None
                seat_names[color] = meta.get("display_name") or COLOR_LABELS_PT.get(
                    color, color
                )
                seat_avatars[color] = {
                    "seat_kind": seat_kind,
                    "username": uname,
                    "avatar_config": avatars.get(uname, {}) if uname else {},
                }
            view["seat_names"] = seat_names
            view["seat_avatars"] = seat_avatars
    except Exception:
        pass
    return view
```

Replace all 4 calls to `_enrich_view_with_room(...)` in `get_game_endpoint` (line 527) and `post_action_endpoint` (lines 543, 555, 573) with `_enrich_view_with_seats(...)`.

- [ ] **Step 4: Rodar suíte Python completa (`tests/web`) para garantir tudo verde**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v
```
Expected: All existing + new tests in `tests/web` PASS (`41 passed`).

- [ ] **Step 5: Commitar Task 1**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add catanatron/catanatron/web/models.py catanatron/catanatron/web/api.py tests/web/test_auth_and_ranking.py
git commit -m "feat(avatar-api): validate unlockable avatar rewards and batch-propagate seat avatars"
```

---

### Task 2: Catálogo de Avatar (`avatarCatalog.ts`), Tipos TS, Cliente `updateProfile` e Espelho Offline

**Files:**
- Modify: `ui/src/utils/api.types.ts`
- Create: `ui/src/config/avatarCatalog.ts`
- Create: `ui/src/config/avatarCatalog.test.ts`
- Modify: `ui/src/utils/apiClient.ts`
- Modify: `ui/src/utils/localEngine.ts`
- Modify: `ui/src/utils/apiClient.test.ts`

**Interfaces:**
- Produces em `ui/src/utils/api.types.ts`:
  - `AvatarSkin`, `AvatarEyes`, `AvatarHair`, `AvatarHairColor`, `AvatarBeard`, `AvatarHat`, `AvatarOutfit`, `AvatarOutfitColor`, `AvatarBackground`, `AvatarFrame`, `AvatarConfig`, `SeatAvatarMeta`
  - `RoomSeat` inclui `seat_kind?: "USER" | "GUEST" | "BOT"`, `username?: string | null`, `avatar_config?: Partial<AvatarConfig> | null`
  - `GameState` inclui `seat_avatars?: Partial<Record<Color, SeatAvatarMeta>>`
  - `LeaderboardEntry.avatar_config?: Partial<AvatarConfig>`
- Produces em `ui/src/config/avatarCatalog.ts`:
  - `AVATAR_VALID_VALUES`, `AVATAR_UNLOCK_REQUIREMENTS`, arrays `*_OPTIONS`, `AVATAR_PRESETS` (6 arquétipos)
  - `getAvatarItemRequirement(field: keyof AvatarConfig, value: string): number`
  - `isAvatarItemUnlocked(field: keyof AvatarConfig, value: string, wins?: number): boolean`
  - `sanitizeAvatarConfig(raw?: Record<string, unknown> | null): Partial<AvatarConfig>`
  - `resolveAvatarConfig(raw?: Partial<AvatarConfig> | Record<string, unknown> | null, username?: string | null): AvatarConfig`
  - `randomizeUnlockedAvatar(wins?: number): AvatarConfig`
- Produces em `ui/src/utils/apiClient.ts` & `ui/src/utils/localEngine.ts`:
  - `PlayerAccount.avatar_config?: Partial<AvatarConfig>`
  - `updateProfile(payload: { displayName?: string; avatarConfig?: Partial<AvatarConfig> }): Promise<PlayerAccount>`
  - `localUpdateProfile(options: { username: string; displayName?: string; avatarConfig?: Partial<AvatarConfig> | null }): PlayerAccount`

- [ ] **Step 1: Escrever testes unitários falhando em `ui/src/config/avatarCatalog.test.ts` e expandir `ui/src/utils/apiClient.test.ts`**

Create `ui/src/config/avatarCatalog.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  AVATAR_PRESETS,
  getAvatarItemRequirement,
  isAvatarItemUnlocked,
  randomizeUnlockedAvatar,
  resolveAvatarConfig,
} from "./avatarCatalog";

describe("avatarCatalog", () => {
  test("resolveAvatarConfig generates deterministic unlocked defaults from username when raw config is empty", () => {
    const first = resolveAvatarConfig({}, "joao_gallo");
    const second = resolveAvatarConfig(undefined, "joao_gallo");
    const other = resolveAvatarConfig({}, "maria_isle");

    expect(first).toEqual(second);
    expect(first.frame).toBe("wood");
    expect(isAvatarItemUnlocked("frame", first.frame, 0)).toBe(true);
    expect(isAvatarItemUnlocked("hat", first.hat, 0)).toBe(true);
    expect(first).not.toEqual(other);
  });

  test("enforces ranked win unlock thresholds accurately", () => {
    expect(getAvatarItemRequirement("frame", "wood")).toBe(0);
    expect(getAvatarItemRequirement("frame", "bronze")).toBe(1);
    expect(getAvatarItemRequirement("frame", "silver")).toBe(3);
    expect(getAvatarItemRequirement("frame", "gold")).toBe(5);
    expect(getAvatarItemRequirement("hat", "crown_gold")).toBe(7);
    expect(getAvatarItemRequirement("frame", "imperial")).toBe(10);

    expect(isAvatarItemUnlocked("frame", "bronze", 0)).toBe(false);
    expect(isAvatarItemUnlocked("frame", "bronze", 1)).toBe(true);
    expect(isAvatarItemUnlocked("hat", "crown_gold", 6)).toBe(false);
    expect(isAvatarItemUnlocked("hat", "crown_gold", 7)).toBe(true);
    expect(isAvatarItemUnlocked("frame", "imperial", 9)).toBe(false);
    expect(isAvatarItemUnlocked("frame", "imperial", 10)).toBe(true);
  });

  test("all 6 presets are unlocked at 0 wins", () => {
    expect(AVATAR_PRESETS).toHaveLength(6);
    for (const preset of AVATAR_PRESETS) {
      expect(isAvatarItemUnlocked("frame", preset.config.frame, 0)).toBe(true);
      expect(isAvatarItemUnlocked("hat", preset.config.hat, 0)).toBe(true);
    }
  });

  test("randomizeUnlockedAvatar never selects locked items", () => {
    for (let i = 0; i < 40; i++) {
      const cfg = randomizeUnlockedAvatar(0);
      expect(isAvatarItemUnlocked("frame", cfg.frame, 0)).toBe(true);
      expect(isAvatarItemUnlocked("hat", cfg.hat, 0)).toBe(true);
    }
  });
});
```

Replace the imports at the top of `ui/src/utils/apiClient.test.ts` (lines 4-14):
```ts
import {
  getLeaderboard,
  getMatchHistory,
  loginAccount,
  registerAccount,
  updateProfile,
} from "./apiClient";
import {
  localCreateGame,
  localGetLeaderboard,
  localGetMatchHistory,
  localGetState,
  localRecordCompletedMatch,
  localUpdateProfile,
} from "./localEngine";
```

And append this test inside `describe("local match history and leaderboard calculations", ...)` in `ui/src/utils/apiClient.test.ts`:
```ts
  test("updateProfile propagates 403 error and offline mirror enforces unlock thresholds and updates leaderboard/games", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Offline"));
    const acct = await registerAccount({
      username: "helena",
      password: "pw1234",
      displayName: "Helena",
    });

    // 403 vindo do backend deve propagar e NÃO cair silenciosamente no offline
    vi.spyOn(axios, "patch").mockRejectedValueOnce({
      response: {
        status: 403,
        data: {
          description:
            "Este item requer 3 vitória(s) no Ranking para ser desbloqueado (você tem 0).",
        },
      },
    });
    await expect(
      updateProfile({ displayName: "Helena", avatarConfig: { frame: "silver" } })
    ).rejects.toMatchObject({ response: { status: 403 } });

    // Offline fallback valida bloqueio de moldura com 0 vitórias
    vi.spyOn(axios, "patch").mockRejectedValue(new Error("Network Error"));
    await expect(
      updateProfile({ displayName: "Helena", avatarConfig: { frame: "bronze" } })
    ).rejects.toBeDefined();

    // Atualizar item gratuito offline funciona e aparece no leaderboard e localCreateGame
    const updated = await updateProfile({
      displayName: "Cap. Helena",
      avatarConfig: { frame: "wood", hat: "captain", background: "ocean" },
    });
    expect(updated.display_name).toBe("Cap. Helena");
    expect(updated.avatar_config?.hat).toBe("captain");
    expect(acct.username).toBe("helena");

    const lb = localGetLeaderboard();
    const helenaRow = lb.find((r) => r.username === "helena");
    expect(helenaRow?.avatar_config?.hat).toBe("captain");

    const localGameId = localCreateGame({
      players: ["HUMAN", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const st = localGetState(localGameId);
    expect(st.seat_avatars?.RED?.seat_kind).toBe("USER");
    expect(st.seat_avatars?.RED?.avatar_config?.hat).toBe("captain");
    expect(st.seat_avatars?.BLUE?.seat_kind).toBe("BOT");

    // Verificar também chamada direta a localUpdateProfile
    expect(() =>
      localUpdateProfile({
        username: "helena",
        avatarConfig: { hat: "crown_gold" },
      })
    ).toThrow(/7 vitória/);
  });
```

- [ ] **Step 2: Rodar os testes novos para verificar falha esperada**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx vitest run src/config/avatarCatalog.test.ts src/utils/apiClient.test.ts
```
Expected: FAIL (`Cannot find module './avatarCatalog'`, `localUpdateProfile` not exported).

- [ ] **Step 3: Atualizar `api.types.ts`, criar `avatarCatalog.ts`, atualizar `apiClient.ts` e `localEngine.ts`**

In `ui/src/utils/api.types.ts`:
Add the avatar union types and `AvatarConfig` + `SeatAvatarMeta` above `RoomSeat`:
```ts
export type AvatarSkin = "porcelain" | "fair" | "warm" | "tan" | "brown" | "deep";
export type AvatarEyes = "calm" | "cheerful" | "sharp" | "wise";
export type AvatarHair = "none" | "short" | "wavy" | "bun" | "braids" | "curly" | "long";
export type AvatarHairColor = "brown" | "black" | "blonde" | "red" | "silver" | "navy";
export type AvatarBeard = "none" | "goatee" | "full" | "mustache";
export type AvatarHat = "none" | "captain" | "explorer" | "bandana" | "helm" | "crown_gold";
export type AvatarOutfit = "settler" | "captain" | "armor" | "merchant";
export type AvatarOutfitColor = "crimson" | "royal" | "emerald" | "amber" | "slate";
export type AvatarBackground = "ocean" | "sunset" | "forest" | "mountain" | "gold" | "crimson";
export type AvatarFrame = "wood" | "bronze" | "silver" | "gold" | "imperial";

export type AvatarConfig = {
  skin: AvatarSkin;
  eyes: AvatarEyes;
  hair: AvatarHair;
  hairColor: AvatarHairColor;
  beard: AvatarBeard;
  hat: AvatarHat;
  outfit: AvatarOutfit;
  outfitColor: AvatarOutfitColor;
  background: AvatarBackground;
  frame: AvatarFrame;
};

export type SeatAvatarMeta = {
  seat_kind: "USER" | "GUEST" | "BOT";
  username: string | null;
  avatar_config?: Partial<AvatarConfig> | null;
};
```
Update `RoomSeat`, `GameState`, and `LeaderboardEntry` in `ui/src/utils/api.types.ts`:
```ts
export type RoomSeat = {
  color: Color;
  player_key: string;
  player_name: string;
  is_bot: boolean;
  claimed: boolean;
  is_me: boolean;
  seat_kind?: "USER" | "GUEST" | "BOT";
  username?: string | null;
  avatar_config?: Partial<AvatarConfig> | null;
};
```
In `GameState` add:
```ts
  seat_names?: Partial<Record<Color, string>>;
  seat_avatars?: Partial<Record<Color, SeatAvatarMeta>>;
  room_code?: string;
```
In `LeaderboardEntry` replace `avatar_config?: Record<string, unknown>;` with:
```ts
  avatar_config?: Partial<AvatarConfig>;
```

Create `ui/src/config/avatarCatalog.ts`:
```ts
import type {
  AvatarBackground,
  AvatarBeard,
  AvatarConfig,
  AvatarEyes,
  AvatarFrame,
  AvatarHair,
  AvatarHairColor,
  AvatarHat,
  AvatarOutfit,
  AvatarOutfitColor,
  AvatarSkin,
} from "../utils/api.types";

export type AvatarOption<T extends string = string> = {
  value: T;
  label: string;
  swatch?: string;
  secondarySwatch?: string;
  requiredWins?: number;
  subtitle?: string;
};

export const AVATAR_SKIN_OPTIONS: AvatarOption<AvatarSkin>[] = [
  { value: "porcelain", label: "Porcelana", swatch: "#fbe2d1", secondarySwatch: "#e7b99e" },
  { value: "fair", label: "Clara", swatch: "#f3cfb3", secondarySwatch: "#d8a47f" },
  { value: "warm", label: "Dourada", swatch: "#e4b287", secondarySwatch: "#c58958" },
  { value: "tan", label: "Bronzeada", swatch: "#c98b5b", secondarySwatch: "#a46539" },
  { value: "brown", label: "Castanha", swatch: "#995c37", secondarySwatch: "#764021" },
  { value: "deep", label: "Ébano", swatch: "#633722", secondarySwatch: "#432111" },
];

export const AVATAR_EYES_OPTIONS: AvatarOption<AvatarEyes>[] = [
  { value: "calm", label: "Sereno" },
  { value: "cheerful", label: "Sorriso" },
  { value: "sharp", label: "Estrategista" },
  { value: "wise", label: "Sábio" },
];

export const AVATAR_HAIR_OPTIONS: AvatarOption<AvatarHair>[] = [
  { value: "none", label: "Careca" },
  { value: "short", label: "Curto" },
  { value: "wavy", label: "Ondulado" },
  { value: "bun", label: "Coque" },
  { value: "braids", label: "Tranças" },
  { value: "curly", label: "Cacheado" },
  { value: "long", label: "Longo" },
];

export const AVATAR_HAIR_COLOR_OPTIONS: AvatarOption<AvatarHairColor>[] = [
  { value: "brown", label: "Castanho", swatch: "#5a3821", secondarySwatch: "#3b2313" },
  { value: "black", label: "Preto", swatch: "#1f242d", secondarySwatch: "#0d1117" },
  { value: "blonde", label: "Loiro", swatch: "#eab308", secondarySwatch: "#a16207" },
  { value: "red", label: "Ruivo", swatch: "#c2410c", secondarySwatch: "#7c2d12" },
  { value: "silver", label: "Prateado", swatch: "#cbd5e1", secondarySwatch: "#64748b" },
  { value: "navy", label: "Marinho", swatch: "#1e40af", secondarySwatch: "#1e3a8a" },
];

export const AVATAR_BEARD_OPTIONS: AvatarOption<AvatarBeard>[] = [
  { value: "none", label: "Sem Barba" },
  { value: "goatee", label: "Cavanhaque" },
  { value: "full", label: "Barba Cheia" },
  { value: "mustache", label: "Bigode" },
];

export const AVATAR_HAT_OPTIONS: AvatarOption<AvatarHat>[] = [
  { value: "none", label: "Sem Chapéu", requiredWins: 0 },
  { value: "captain", label: "Tricórnio de Capitão", requiredWins: 0 },
  { value: "explorer", label: "Chapéu Explorador", requiredWins: 0 },
  { value: "bandana", label: "Bandana Marítima", requiredWins: 0 },
  { value: "helm", label: "Elmo de Ferro", requiredWins: 0 },
  {
    value: "crown_gold",
    label: "Coroa Dourada do Soberano",
    requiredWins: 7,
    subtitle: "Prestígio Real",
  },
];

export const AVATAR_OUTFIT_OPTIONS: AvatarOption<AvatarOutfit>[] = [
  { value: "settler", label: "Túnica de Colono" },
  { value: "captain", label: "Casaco de Capitão" },
  { value: "armor", label: "Armadura Medieval" },
  { value: "merchant", label: "Manto de Mercador" },
];

export const AVATAR_OUTFIT_COLOR_OPTIONS: AvatarOption<AvatarOutfitColor>[] = [
  { value: "crimson", label: "Carmesim", swatch: "#dc2626", secondarySwatch: "#7f1d1d" },
  { value: "royal", label: "Azul Real", swatch: "#2563eb", secondarySwatch: "#1e3a8a" },
  { value: "emerald", label: "Esmeralda", swatch: "#059669", secondarySwatch: "#064e3b" },
  { value: "amber", label: "Âmbar", swatch: "#d97706", secondarySwatch: "#78350f" },
  { value: "slate", label: "Ardósia", swatch: "#475569", secondarySwatch: "#1e293b" },
];

export const AVATAR_BACKGROUND_OPTIONS: AvatarOption<AvatarBackground>[] = [
  { value: "ocean", label: "Oceano", swatch: "#0e4d7a", secondarySwatch: "#06213c" },
  { value: "sunset", label: "Pôr do Sol", swatch: "#ea580c", secondarySwatch: "#581c87" },
  { value: "forest", label: "Floresta", swatch: "#15803d", secondarySwatch: "#052e16" },
  { value: "mountain", label: "Montanhas", swatch: "#334155", secondarySwatch: "#0f172a" },
  { value: "gold", label: "Campos de Trigo", swatch: "#ca8a04", secondarySwatch: "#713f12" },
  { value: "crimson", label: "Fortaleza", swatch: "#991b1b", secondarySwatch: "#450a0a" },
];

export const AVATAR_FRAME_OPTIONS: AvatarOption<AvatarFrame>[] = [
  {
    value: "wood",
    label: "Madeira de Colono",
    swatch: "#925d30",
    secondarySwatch: "#5a3618",
    requiredWins: 0,
    subtitle: "Inicial",
  },
  {
    value: "bronze",
    label: "Bronze de Navegador",
    swatch: "#d97736",
    secondarySwatch: "#7c3b15",
    requiredWins: 1,
    subtitle: "1 Vitória",
  },
  {
    value: "silver",
    label: "Prata da Guilda",
    swatch: "#e2e8f0",
    secondarySwatch: "#64748b",
    requiredWins: 3,
    subtitle: "3 Vitórias",
  },
  {
    value: "gold",
    label: "Ouro Real",
    swatch: "#facc15",
    secondarySwatch: "#b45309",
    requiredWins: 5,
    subtitle: "5 Vitórias",
  },
  {
    value: "imperial",
    label: "Imperial da Ilha",
    swatch: "#10b981",
    secondarySwatch: "#facc15",
    requiredWins: 10,
    subtitle: "10 Vitórias",
  },
];

export const AVATAR_VALID_VALUES: Record<keyof AvatarConfig, readonly string[]> = {
  skin: AVATAR_SKIN_OPTIONS.map((o) => o.value),
  eyes: AVATAR_EYES_OPTIONS.map((o) => o.value),
  hair: AVATAR_HAIR_OPTIONS.map((o) => o.value),
  hairColor: AVATAR_HAIR_COLOR_OPTIONS.map((o) => o.value),
  beard: AVATAR_BEARD_OPTIONS.map((o) => o.value),
  hat: AVATAR_HAT_OPTIONS.map((o) => o.value),
  outfit: AVATAR_OUTFIT_OPTIONS.map((o) => o.value),
  outfitColor: AVATAR_OUTFIT_COLOR_OPTIONS.map((o) => o.value),
  background: AVATAR_BACKGROUND_OPTIONS.map((o) => o.value),
  frame: AVATAR_FRAME_OPTIONS.map((o) => o.value),
};

export const AVATAR_UNLOCK_REQUIREMENTS: Partial<
  Record<keyof AvatarConfig, Record<string, number>>
> = {
  frame: { bronze: 1, silver: 3, gold: 5, imperial: 10 },
  hat: { crown_gold: 7 },
};

export type AvatarPreset = {
  id: string;
  label: string;
  config: AvatarConfig;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "sea_captain",
    label: "Capitão dos Mares",
    config: {
      skin: "warm",
      eyes: "sharp",
      hair: "short",
      hairColor: "brown",
      beard: "full",
      hat: "captain",
      outfit: "captain",
      outfitColor: "royal",
      background: "ocean",
      frame: "wood",
    },
  },
  {
    id: "north_explorer",
    label: "Exploradora do Norte",
    config: {
      skin: "fair",
      eyes: "cheerful",
      hair: "braids",
      hairColor: "red",
      beard: "none",
      hat: "explorer",
      outfit: "settler",
      outfitColor: "emerald",
      background: "forest",
      frame: "wood",
    },
  },
  {
    id: "hill_knight",
    label: "Cavaleiro da Colina",
    config: {
      skin: "tan",
      eyes: "sharp",
      hair: "short",
      hairColor: "black",
      beard: "goatee",
      hat: "helm",
      outfit: "armor",
      outfitColor: "slate",
      background: "mountain",
      frame: "wood",
    },
  },
  {
    id: "wheat_merchant",
    label: "Mercador de Trigo",
    config: {
      skin: "warm",
      eyes: "cheerful",
      hair: "wavy",
      hairColor: "blonde",
      beard: "mustache",
      hat: "none",
      outfit: "merchant",
      outfitColor: "amber",
      background: "gold",
      frame: "wood",
    },
  },
  {
    id: "mountain_artificer",
    label: "Artífice das Montanhas",
    config: {
      skin: "brown",
      eyes: "wise",
      hair: "short",
      hairColor: "silver",
      beard: "goatee",
      hat: "none",
      outfit: "settler",
      outfitColor: "crimson",
      background: "crimson",
      frame: "wood",
    },
  },
  {
    id: "sun_navigator",
    label: "Navegadora do Sol",
    config: {
      skin: "deep",
      eyes: "calm",
      hair: "bun",
      hairColor: "black",
      beard: "none",
      hat: "bandana",
      outfit: "settler",
      outfitColor: "royal",
      background: "sunset",
      frame: "wood",
    },
  },
];

export function getAvatarItemRequirement(
  field: keyof AvatarConfig,
  value: string
): number {
  return AVATAR_UNLOCK_REQUIREMENTS[field]?.[value] ?? 0;
}

export function isAvatarItemUnlocked(
  field: keyof AvatarConfig,
  value: string,
  wins = 0
): boolean {
  return wins >= getAvatarItemRequirement(field, value);
}

export function sanitizeAvatarConfig(
  raw?: Partial<AvatarConfig> | Record<string, unknown> | null
): Partial<AvatarConfig> {
  if (!raw || typeof raw !== "object") return {};
  const result: Partial<AvatarConfig> = {};
  for (const field of Object.keys(AVATAR_VALID_VALUES) as Array<keyof AvatarConfig>) {
    const val = (raw as Record<string, unknown>)[field];
    if (typeof val === "string" && AVATAR_VALID_VALUES[field].includes(val)) {
      (result as Record<string, string>)[field] = val;
    }
  }
  return result;
}

function hashUsername(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolveAvatarConfig(
  raw?: Partial<AvatarConfig> | Record<string, unknown> | null,
  username?: string | null
): AvatarConfig {
  const seed = hashUsername((username || "colono").toLowerCase().trim() || "colono");
  const pick = <T extends string>(arr: readonly T[], shift: number): T =>
    arr[(seed >> shift) % arr.length];

  const baseHats = AVATAR_HAT_OPTIONS.filter((h) => !h.requiredWins).map((h) => h.value);
  const defaults: AvatarConfig = {
    skin: pick(AVATAR_VALID_VALUES.skin as readonly AvatarSkin[], 0),
    eyes: pick(AVATAR_VALID_VALUES.eyes as readonly AvatarEyes[], 3),
    hair: pick(AVATAR_VALID_VALUES.hair as readonly AvatarHair[], 5),
    hairColor: pick(AVATAR_VALID_VALUES.hairColor as readonly AvatarHairColor[], 8),
    beard: pick(AVATAR_VALID_VALUES.beard as readonly AvatarBeard[], 11),
    hat: pick(baseHats, 13),
    outfit: pick(AVATAR_VALID_VALUES.outfit as readonly AvatarOutfit[], 16),
    outfitColor: pick(AVATAR_VALID_VALUES.outfitColor as readonly AvatarOutfitColor[], 19),
    background: pick(AVATAR_VALID_VALUES.background as readonly AvatarBackground[], 22),
    frame: "wood",
  };

  return {
    ...defaults,
    ...sanitizeAvatarConfig(raw),
  };
}

export function randomizeUnlockedAvatar(wins = 0): AvatarConfig {
  const unlockedPick = <T extends string>(
    field: keyof AvatarConfig,
    options: readonly AvatarOption<T>[]
  ): T => {
    const eligible = options.filter((o) => isAvatarItemUnlocked(field, o.value, wins));
    const list = eligible.length > 0 ? eligible : options;
    return list[Math.floor(Math.random() * list.length)].value;
  };

  return {
    skin: unlockedPick("skin", AVATAR_SKIN_OPTIONS),
    eyes: unlockedPick("eyes", AVATAR_EYES_OPTIONS),
    hair: unlockedPick("hair", AVATAR_HAIR_OPTIONS),
    hairColor: unlockedPick("hairColor", AVATAR_HAIR_COLOR_OPTIONS),
    beard: unlockedPick("beard", AVATAR_BEARD_OPTIONS),
    hat: unlockedPick("hat", AVATAR_HAT_OPTIONS),
    outfit: unlockedPick("outfit", AVATAR_OUTFIT_OPTIONS),
    outfitColor: unlockedPick("outfitColor", AVATAR_OUTFIT_COLOR_OPTIONS),
    background: unlockedPick("background", AVATAR_BACKGROUND_OPTIONS),
    frame: unlockedPick("frame", AVATAR_FRAME_OPTIONS),
  };
}
```

In `ui/src/utils/apiClient.ts`:
Update the imports (lines 4-30):
```ts
import type {
  AccountStats,
  AvatarConfig,
  Color,
  GameAction,
  GameState,
  LeaderboardEntry,
  MatchRecord,
  RoomState,
} from "./api.types";
import {
  localCreateGame,
  localCreateRoom,
  localGetLeaderboard,
  localGetMatchHistory,
  localGetMctsAnalysis,
  localGetRoom,
  localGetState,
  localJoinRoom,
  localListActiveRooms,
  localLoginOrRegister,
  localLoginUser,
  localPostAction,
  localRecordCompletedMatch,
  localRegisterUser,
  localStartRoomGame,
  localUpdateProfile,
  localUpdateRoom,
} from "./localEngine";
```

Update `PlayerAccount` (line 57):
```ts
export type PlayerAccount = {
  username: string;
  display_name: string;
  auth_token: string;
  has_google?: boolean;
  avatar_config?: Partial<AvatarConfig>;
  stats?: AccountStats;
  is_new?: boolean;
};
```

Update `updateProfile` (lines 226-247):
```ts
export async function updateProfile(payload: {
  displayName?: string;
  avatarConfig?: Partial<AvatarConfig>;
}): Promise<PlayerAccount> {
  const saved = getSavedAccount();
  if (!saved?.auth_token) throw new Error("Não autenticado");
  try {
    const response = await axios.patch<PlayerAccount>(
      `${API_URL}/api/auth/profile`,
      {
        display_name: payload.displayName,
        avatar_config: payload.avatarConfig,
      },
      { headers: authHeaders(saved.auth_token) }
    );
    const updated: PlayerAccount = {
      ...saved,
      ...response.data,
      auth_token: saved.auth_token,
    };
    saveAccount(updated);
    return updated;
  } catch (err: any) {
    if (err?.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
    const localUpdated = localUpdateProfile({
      username: saved.username,
      displayName: payload.displayName,
      avatarConfig: payload.avatarConfig,
    });
    const merged: PlayerAccount = {
      ...saved,
      ...localUpdated,
      auth_token: saved.auth_token,
    };
    saveAccount(merged);
    return merged;
  }
}
```

Update `joinRoom` (line 584) and `updateRoom` (line 621) so `Authorization` always sends the logged-in user's `Bearer` session token (`authHeaders()`), while `body.token` carries the room's `resolvedToken`:
```ts
      { headers: authHeaders() }
```
(Replace `{ headers: authHeaders(resolvedToken) }` in both `joinRoom` line 584 and `updateRoom` line 621.)

In `ui/src/utils/localEngine.ts`:
Update top imports (lines 1-20):
```ts
import type {
  AccountStats,
  AvatarConfig,
  Color,
  DevelopmentCard,
  Direction,
  GameAction,
  GameEdge,
  GameNode,
  GameState,
  LeaderboardEntry,
  MatchParticipant,
  MatchRecord,
  PlacedTile,
  ResourceCard,
  RoomState,
  SeatAvatarMeta,
  Tile,
  TileCoordinate,
} from "./api.types";
import type { MapTemplate, MCTSProbabilities, PlayerAccount } from "./apiClient";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import {
  AVATAR_UNLOCK_REQUIREMENTS,
  isAvatarItemUnlocked,
  sanitizeAvatarConfig,
} from "../config/avatarCatalog";
```

Update `LocalSeatMeta` (lines 415-421):
```ts
export type LocalSeatMeta = {
  color: Color;
  seat_kind: "USER" | "GUEST" | "BOT";
  username: string | null;
  player_key: string;
  display_name: string;
  avatar_config?: Partial<AvatarConfig> | null;
};
```

Add avatar-aware local user directory and seat projection helpers right after `GAMES_STORAGE_KEY` / `ROOMS_STORAGE_KEY`:
```ts
function getSavedPlayerAccount(): PlayerAccount | null {
  try {
    const raw = localStorage.getItem("catan_player_account");
    return raw ? (JSON.parse(raw) as PlayerAccount) : null;
  } catch {
    return null;
  }
}

function getLocalUserDirectory(): Record<
  string,
  { username: string; display_name: string; avatar_config: Partial<AvatarConfig> }
> {
  const dir: Record<
    string,
    { username: string; display_name: string; avatar_config: Partial<AvatarConfig> }
  > = {};
  for (const [k, u] of Object.entries(loadLocalUsers())) {
    dir[k] = {
      username: u.username,
      display_name: u.display_name,
      avatar_config: sanitizeAvatarConfig(u.avatar_config),
    };
  }
  const saved = getSavedPlayerAccount();
  if (saved?.username) {
    const clean = saved.username
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 24);
    if (clean) {
      dir[clean] = {
        username: clean,
        display_name: saved.display_name || dir[clean]?.display_name || clean,
        avatar_config: {
          ...(dir[clean]?.avatar_config || {}),
          ...sanitizeAvatarConfig(saved.avatar_config),
        },
      };
    }
  }
  return dir;
}

function buildSeatViewsFromMeta(
  seatMeta?: Partial<Record<Color, LocalSeatMeta>>
): {
  seatNames: Partial<Record<Color, string>>;
  seatAvatars: Partial<Record<Color, SeatAvatarMeta>>;
} {
  const seatNames: Partial<Record<Color, string>> = {};
  const seatAvatars: Partial<Record<Color, SeatAvatarMeta>> = {};
  if (!seatMeta) return { seatNames, seatAvatars };

  const dir = getLocalUserDirectory();
  for (const [colorKey, meta] of Object.entries(seatMeta)) {
    const color = colorKey as Color;
    if (!meta) continue;
    const uname = meta.seat_kind === "USER" ? meta.username : null;
    const liveUser = uname ? dir[uname] : undefined;
    seatNames[color] = liveUser?.display_name || meta.display_name;
    seatAvatars[color] = {
      seat_kind: meta.seat_kind,
      username: uname,
      avatar_config: uname
        ? liveUser?.avatar_config || sanitizeAvatarConfig(meta.avatar_config)
        : {},
    };
  }
  return { seatNames, seatAvatars };
}
```

Replace `localCreateGame`, `localGetState`, `localPostAction` (lines 1110-1309):
```ts
export function localCreateGame(options: {
  players: string[];
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
  seatNames?: Partial<Record<Color, string>>;
  roomCode?: string;
  seatMeta?: Record<Color, LocalSeatMeta>;
}): string {
  const built = buildLocalMap(options.mapTemplate);
  const colors = SEAT_COLORS.slice(0, Math.max(2, Math.min(4, options.players.length)));
  const botColors = colors.filter((_, idx) => options.players[idx] !== "HUMAN");
  const gameId =
    "local-" + Math.random().toString(36).substring(2, 10);

  const savedAcct = getSavedPlayerAccount();
  const defaultUser = savedAcct?.username
    ? {
        username: savedAcct.username,
        display_name: savedAcct.display_name || savedAcct.username,
        avatar_config: sanitizeAvatarConfig(savedAcct.avatar_config),
      }
    : null;

  const resolvedSeatMeta: Record<Color, LocalSeatMeta> = options.seatMeta
    ? { ...options.seatMeta }
    : ({} as Record<Color, LocalSeatMeta>);

  if (!options.seatMeta) {
    let userAssigned = false;
    colors.forEach((c, idx) => {
      const pKey = options.players[idx] || "HUMAN";
      if (pKey === "HUMAN") {
        if (defaultUser && !userAssigned) {
          resolvedSeatMeta[c] = {
            color: c,
            seat_kind: "USER",
            username: defaultUser.username,
            player_key: "HUMAN",
            display_name: options.seatNames?.[c] || defaultUser.display_name,
            avatar_config: defaultUser.avatar_config,
          };
          userAssigned = true;
        } else {
          resolvedSeatMeta[c] = {
            color: c,
            seat_kind: "GUEST",
            username: null,
            player_key: "HUMAN",
            display_name: options.seatNames?.[c] || PLAYER_COLOR_META[c].label,
            avatar_config: {},
          };
        }
      } else {
        resolvedSeatMeta[c] = {
          color: c,
          seat_kind: "BOT",
          username: null,
          player_key: pKey,
          display_name: options.seatNames?.[c] || `Bot (${pKey})`,
          avatar_config: {},
        };
      }
    });
  }

  const { seatNames: metaNames, seatAvatars } = buildSeatViewsFromMeta(resolvedSeatMeta);

  const playerState: Record<string, any> = {};
  colors.forEach((_, idx) => {
    const k = `P${idx}`;
    playerState[`${k}_ACTUAL_VICTORY_POINTS`] = 0;
    playerState[`${k}_VICTORY_POINTS`] = 0;
    playerState[`${k}_WOOD_IN_HAND`] = 0;
    playerState[`${k}_BRICK_IN_HAND`] = 0;
    playerState[`${k}_SHEEP_IN_HAND`] = 0;
    playerState[`${k}_WHEAT_IN_HAND`] = 0;
    playerState[`${k}_ORE_IN_HAND`] = 0;
    playerState[`${k}_KNIGHT_IN_HAND`] = 0;
    playerState[`${k}_MONOPOLY_IN_HAND`] = 0;
    playerState[`${k}_YEAR_OF_PLENTY_IN_HAND`] = 0;
    playerState[`${k}_ROAD_BUILDING_IN_HAND`] = 0;
    playerState[`${k}_VICTORY_POINT_IN_HAND`] = 0;
    playerState[`${k}_PLAYED_KNIGHT`] = 0;
    playerState[`${k}_LONGEST_ROAD_LENGTH`] = 0;
    playerState[`${k}_HAS_ARMY`] = false;
    playerState[`${k}_HAS_ROAD`] = false;
    playerState[`${k}_HAS_ROLLED`] = false;
    playerState[`${k}_SETTLEMENTS_AVAILABLE`] = 5;
    playerState[`${k}_CITIES_AVAILABLE`] = 4;
    playerState[`${k}_ROADS_AVAILABLE`] = 15;
  });

  const initialQueue: StoredLocalGame["initialQueue"] = [];
  for (const c of colors) {
    initialQueue.push({ color: c, type: "SETTLEMENT", secondRound: false });
    initialQueue.push({ color: c, type: "ROAD", secondRound: false });
  }
  for (const c of [...colors].reverse()) {
    initialQueue.push({ color: c, type: "SETTLEMENT", secondRound: true });
    initialQueue.push({ color: c, type: "ROAD", secondRound: true });
  }

  const state: GameState = {
    tiles: built.placedTiles,
    adjacent_tiles: built.adjacentTiles,
    bot_colors: botColors,
    colors,
    current_color: colors[0],
    winning_color: null,
    current_prompt: "BUILD_INITIAL_SETTLEMENT",
    player_state: playerState,
    action_records: [],
    robber_coordinate: built.robberCoordinate,
    current_discard_count: 0,
    nodes: built.nodes,
    edges: built.edges,
    current_playable_actions: [],
    is_initial_build_phase: true,
    longest_roads_by_player: {},
    state_index: 0,
    seat_names: { ...metaNames, ...(options.seatNames || {}) },
    seat_avatars: seatAvatars,
    room_code: options.roomCode,
    schema_version: 2,
    game: {
      id: gameId,
      vps_to_win: options.vpsToWin,
      discard_limit: options.discardLimit,
      friendly_robber: options.friendlyRobber,
    },
    num_turns: 0,
    current_player_index: 0,
    current_turn_index: 0,
    resource_freqdeck: [19, 19, 19, 19, 19],
    development_listdeck: { KNIGHT: 14, VICTORY_POINT: 5 },
  };

  const stored: StoredLocalGame = {
    state,
    nodeNeighbors: built.nodeNeighbors,
    portNodes: built.portNodes,
    initialQueue,
    lastInitialSettlementNode: null,
    history: [JSON.parse(JSON.stringify(state))],
    seatMeta: resolvedSeatMeta,
  };

  recomputeScoresAndPlayableActions(stored);
  stored.history = [JSON.parse(JSON.stringify(stored.state))];

  const map = loadGamesMap();
  map[gameId] = stored;
  saveGamesMap(map);
  return gameId;
}

export function localGetState(
  gameId: string,
  stateIndex: number | string = "latest"
): GameState {
  const map = loadGamesMap();
  let game = map[gameId];
  if (!game) {
    // Auto-create a game if user navigated directly to a URL
    const createdId = localCreateGame({
      players: ["HUMAN", "CATANATRON", "CATANATRON", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const freshMap = loadGamesMap();
    game = freshMap[createdId];
    game.state.game.id = gameId;
    freshMap[gameId] = game;
    saveGamesMap(freshMap);
  }
  const idx = Number(stateIndex);
  const rawState =
    stateIndex === "latest"
      ? game.state
      : game.history[idx] || game.state;
  const cloned = JSON.parse(JSON.stringify(rawState)) as GameState;
  if (game.seatMeta) {
    const { seatNames, seatAvatars } = buildSeatViewsFromMeta(game.seatMeta);
    cloned.seat_names = { ...seatNames, ...(cloned.seat_names || {}) };
    cloned.seat_avatars = seatAvatars;
  }
  return cloned;
}

export function localPostAction(
  gameId: string,
  action?: GameAction
): GameState {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game) {
    return localGetState(gameId, "latest");
  }
  const chosen = action ?? chooseBotAction(game);
  if (chosen) {
    applyActionToGame(game, chosen);
    saveGamesMap(map);
  }
  const cloned = JSON.parse(JSON.stringify(game.state)) as GameState;
  if (game.seatMeta) {
    const { seatNames, seatAvatars } = buildSeatViewsFromMeta(game.seatMeta);
    cloned.seat_names = { ...seatNames, ...(cloned.seat_names || {}) };
    cloned.seat_avatars = seatAvatars;
  }
  return cloned;
}
```

Replace `LocalUserRecord`, `localRegisterUser`, `localLoginUser`, add `localUpdateProfile`, and update `localGetLeaderboard` + room functions (lines 1341-1790):
```ts
type LocalUserRecord = {
  username: string;
  display_name: string;
  password: string;
  avatar_config?: Partial<AvatarConfig>;
};

function loadLocalUsers(): Record<string, LocalUserRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function localRegisterUser(options: {
  username: string;
  password: string;
  displayName?: string;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  if (cleanUser.length < 2) {
    throw new Error("Usuário deve ter pelo menos 2 caracteres.");
  }
  const users = loadLocalUsers();
  if (users[cleanUser]) {
    throw new Error("Este usuário já está cadastrado localmente.");
  }
  const display_name = (options.displayName || options.username).trim() || cleanUser;
  users[cleanUser] = {
    username: cleanUser,
    display_name,
    password: options.password,
    avatar_config: {},
  };
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
  return {
    username: cleanUser,
    display_name,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: {},
    is_new: true,
  };
}

export function localLoginUser(options: {
  username: string;
  password: string;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  const users = loadLocalUsers();
  const existing = users[cleanUser];
  if (!existing || existing.password !== options.password) {
    throw new Error("Usuário ou senha incorretos.");
  }
  return {
    username: existing.username,
    display_name: existing.display_name,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: sanitizeAvatarConfig(existing.avatar_config),
    is_new: false,
  };
}

export function localUpdateProfile(options: {
  username: string;
  displayName?: string;
  avatarConfig?: Partial<AvatarConfig> | null;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  if (!cleanUser) {
    throw new Error("Usuário inválido.");
  }

  const users = loadLocalUsers();
  let existing = users[cleanUser];
  if (!existing) {
    const saved = getSavedPlayerAccount();
    const savedMatches = saved?.username === cleanUser;
    existing = {
      username: cleanUser,
      display_name: savedMatches ? saved.display_name || cleanUser : cleanUser,
      password: "",
      avatar_config: savedMatches
        ? sanitizeAvatarConfig(saved.avatar_config)
        : {},
    };
  }

  const existingAvatar = sanitizeAvatarConfig(existing.avatar_config);
  const incomingAvatar = sanitizeAvatarConfig(options.avatarConfig || {});
  const mergedAvatar: Partial<AvatarConfig> = {
    ...existingAvatar,
    ...incomingAvatar,
  };

  const statsEntry = localGetLeaderboard().find((e) => e.username === cleanUser);
  const wins = statsEntry?.wins ?? 0;

  for (const [field, rules] of Object.entries(AVATAR_UNLOCK_REQUIREMENTS)) {
    const val = (mergedAvatar as Record<string, string | undefined>)[field];
    if (
      val &&
      rules &&
      val in rules &&
      !isAvatarItemUnlocked(field as keyof AvatarConfig, val, wins)
    ) {
      const reqWins = rules[val];
      const msg = `Este item requer ${reqWins} vitória(s) no Ranking para ser desbloqueado (você tem ${wins}).`;
      const err = new Error(msg) as Error & {
        response?: { status: number; data: { description: string } };
      };
      err.response = { status: 403, data: { description: msg } };
      throw err;
    }
  }

  const nextDisplay =
    options.displayName && options.displayName.trim()
      ? options.displayName.trim().slice(0, 32)
      : existing.display_name;

  users[cleanUser] = {
    ...existing,
    display_name: nextDisplay,
    avatar_config: mergedAvatar,
  };
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    const saved = getSavedPlayerAccount();
    if (saved?.username === cleanUser) {
      localStorage.setItem(
        "catan_player_account",
        JSON.stringify({
          ...saved,
          display_name: nextDisplay,
          avatar_config: mergedAvatar,
        })
      );
    }
  } catch {
    // ignore
  }

  return {
    username: cleanUser,
    display_name: nextDisplay,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: mergedAvatar,
    stats: statsEntry
      ? {
          wins: statsEntry.wins,
          losses: statsEntry.losses,
          games_played: statsEntry.games_played,
          win_rate: statsEntry.win_rate,
        }
      : { wins: 0, losses: 0, games_played: 0, win_rate: 0 },
    is_new: false,
  };
}
```

And update `localGetLeaderboard` + local rooms (`localCreateRoom`, `localGetRoom`, `localJoinRoom`, `localUpdateRoom`, `localStartRoomGame`):
```ts
export function localGetLeaderboard(
  extraUsers?: Array<{
    username: string;
    display_name: string;
    avatar_config?: Partial<AvatarConfig>;
  }>
): LeaderboardEntry[] {
  const usersMap = getLocalUserDirectory();
  for (const u of extraUsers || []) {
    const existing = usersMap[u.username];
    usersMap[u.username] = {
      username: u.username,
      display_name: u.display_name,
      avatar_config: sanitizeAvatarConfig(
        u.avatar_config ?? existing?.avatar_config
      ),
    };
  }

  const counts: Record<string, { wins: number; games: number }> = {};
  for (const match of localGetMatchHistory()) {
    for (const p of match.participants) {
      if (p.seat_kind !== "USER" || !p.username) continue;
      if (!usersMap[p.username]) {
        usersMap[p.username] = {
          username: p.username,
          display_name: p.display_name,
          avatar_config: {},
        };
      }
      const bucket = counts[p.username] || { wins: 0, games: 0 };
      bucket.games += 1;
      if (p.is_winner) bucket.wins += 1;
      counts[p.username] = bucket;
    }
  }

  const rows: LeaderboardEntry[] = Object.values(usersMap).map((u) => {
    const { wins, games } = counts[u.username] || { wins: 0, games: 0 };
    const losses = Math.max(0, games - wins);
    const win_rate = games > 0 ? Math.round((wins / games) * 1000) / 10 : 0.0;
    return {
      rank: 0,
      username: u.username,
      display_name: u.display_name,
      avatar_config: sanitizeAvatarConfig(u.avatar_config),
      wins,
      losses,
      games_played: games,
      win_rate,
    };
  });

  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.win_rate - a.win_rate ||
      b.games_played - a.games_played ||
      a.username.localeCompare(b.username)
  );
  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}
```

And update `localCreateRoom`, `localGetRoom`, `localJoinRoom`, `localUpdateRoom`, and `localStartRoomGame`:
```ts
export function localCreateRoom(options: {
  hostName: string;
  players: string[];
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
  token?: string | null;
}): { room_code: string; seat_token: string; room: RoomState } {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const hostToken = options.token || "tok_" + Math.random().toString(36).slice(2, 10);
  const savedAcct = getSavedPlayerAccount();
  const seatTokens: Record<string, string | null> = {};
  let hostSeated = false;

  const seats = options.players.slice(0, 4).map((pk, idx) => {
    const color = SEAT_COLORS[idx];
    if (pk === "HUMAN" && !hostSeated) {
      hostSeated = true;
      seatTokens[color] = hostToken;
      return {
        color,
        player_key: "HUMAN",
        player_name: options.hostName || "Anfitrião",
        is_bot: false,
        claimed: true,
        is_me: true,
        seat_kind: savedAcct?.username ? ("USER" as const) : ("GUEST" as const),
        username: savedAcct?.username ?? null,
        avatar_config: savedAcct?.username
          ? sanitizeAvatarConfig(savedAcct.avatar_config)
          : {},
      };
    } else if (pk === "HUMAN") {
      seatTokens[color] = null;
      return {
        color,
        player_key: "HUMAN",
        player_name: "Aguardando Amigo...",
        is_bot: false,
        claimed: false,
        is_me: false,
        seat_kind: "GUEST" as const,
        username: null,
        avatar_config: {},
      };
    } else {
      seatTokens[color] = null;
      return {
        color,
        player_key: pk,
        player_name: `🤖 IA (${pk})`,
        is_bot: true,
        claimed: true,
        is_me: false,
        seat_kind: "BOT" as const,
        username: null,
        avatar_config: {},
      };
    }
  });

  const room: RoomState = {
    room_code: code,
    status: "WAITING",
    game_id: null,
    is_host: true,
    my_color: seats.find((s) => s.is_me)?.color || "RED",
    config: {
      map_template: options.mapTemplate,
      vps_to_win: options.vpsToWin,
      discard_limit: options.discardLimit,
      friendly_robber: options.friendlyRobber,
    },
    seats,
  };

  const rooms = loadRoomsMap();
  rooms[code] = { ...room, host_token: hostToken, seat_tokens: seatTokens };
  saveRoomsMap(rooms);

  return { room_code: code, seat_token: hostToken, room };
}

export function localGetRoom(
  roomCode: string,
  token?: string | null
): RoomState {
  const code = roomCode.toUpperCase();
  const rooms = loadRoomsMap();
  let stored = rooms[code];
  if (!stored) {
    const created = localCreateRoom({
      hostName: "Anfitrião",
      players: ["HUMAN", "HUMAN", "CATANATRON", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const freshRooms = loadRoomsMap();
    stored = {
      ...created.room,
      room_code: code,
      host_token: created.seat_token,
      seat_tokens: { RED: created.seat_token, BLUE: null, ORANGE: null, WHITE: null },
    };
    freshRooms[code] = stored;
    saveRoomsMap(freshRooms);
  }

  let myColor: Color | null = null;
  const dir = getLocalUserDirectory();
  const seats = stored.seats.map((s) => {
    const isMe = Boolean(token && stored.seat_tokens[s.color] === token);
    if (isMe) myColor = s.color;
    const uname = !s.is_bot && s.seat_kind === "USER" ? s.username || null : null;
    const resolvedKind: "USER" | "GUEST" | "BOT" = s.is_bot
      ? "BOT"
      : s.seat_kind || (uname ? "USER" : "GUEST");
    return {
      ...s,
      seat_kind: resolvedKind,
      username: uname,
      avatar_config: uname
        ? dir[uname]?.avatar_config || sanitizeAvatarConfig(s.avatar_config)
        : {},
      claimed: s.is_bot || Boolean(stored.seat_tokens[s.color]),
      is_me: isMe,
    };
  });

  return {
    room_code: stored.room_code,
    status: stored.status,
    game_id: stored.game_id,
    is_host: Boolean(token && stored.host_token === token),
    my_color: myColor,
    config: stored.config,
    seats,
  };
}

export function localJoinRoom(
  roomCode: string,
  options: {
    playerName: string;
    preferredColor?: Color;
    token?: string | null;
  }
): { seat_token: string; seat_color: Color; room: RoomState } {
  const code = roomCode.toUpperCase();
  localGetRoom(code, options.token); // ensure exists
  const rooms = loadRoomsMap();
  const stored = rooms[code];
  const token =
    options.token || "tok_" + Math.random().toString(36).slice(2, 10);
  const savedAcct = getSavedPlayerAccount();
  const seatKind: "USER" | "GUEST" = savedAcct?.username ? "USER" : "GUEST";
  const seatUsername = savedAcct?.username ?? null;
  const seatAvatar = savedAcct?.username
    ? sanitizeAvatarConfig(savedAcct.avatar_config)
    : {};

  let targetSeat = options.preferredColor
    ? stored.seats.find((s) => s.color === options.preferredColor)
    : stored.seats.find(
        (s) => !s.is_bot && (!stored.seat_tokens[s.color] || stored.seat_tokens[s.color] === token)
      );

  if (!targetSeat) {
    targetSeat = stored.seats[0];
  }

  for (const s of stored.seats) {
    if (stored.seat_tokens[s.color] === token && s.color !== targetSeat.color) {
      stored.seat_tokens[s.color] = null;
      s.player_name = "Aguardando Amigo...";
      s.claimed = false;
      s.seat_kind = "GUEST";
      s.username = null;
      s.avatar_config = {};
    }
  }

  targetSeat.player_key = "HUMAN";
  targetSeat.is_bot = false;
  targetSeat.player_name = options.playerName || "Jogador";
  targetSeat.claimed = true;
  targetSeat.seat_kind = seatKind;
  targetSeat.username = seatUsername;
  targetSeat.avatar_config = seatAvatar;
  stored.seat_tokens[targetSeat.color] = token;
  saveRoomsMap(rooms);

  return {
    seat_token: token,
    seat_color: targetSeat.color,
    room: localGetRoom(code, token),
  };
}

export function localUpdateRoom(
  roomCode: string,
  payload: {
    token?: string | null;
    config?: Partial<RoomState["config"]>;
    seats?: Array<{ color: Color; player_key: string; player_name?: string }>;
  }
): RoomState {
  const code = roomCode.toUpperCase();
  localGetRoom(code, payload.token);
  const rooms = loadRoomsMap();
  const stored = rooms[code];

  if (payload.config) {
    stored.config = { ...stored.config, ...payload.config };
  }
  if (payload.seats) {
    const oldByColor = Object.fromEntries(
      stored.seats.map((s) => [s.color, s])
    );
    stored.seats = payload.seats.map((item, idx) => {
      const color = SEAT_COLORS[idx];
      const prev = oldByColor[color];
      const isBot = item.player_key !== "HUMAN";
      if (isBot) {
        stored.seat_tokens[color] = null;
        return {
          color,
          player_key: item.player_key,
          player_name: item.player_name || `🤖 IA (${item.player_key})`,
          is_bot: true,
          claimed: true,
          is_me: false,
          seat_kind: "BOT" as const,
          username: null,
          avatar_config: {},
        };
      }
      const hasClaim = Boolean(stored.seat_tokens[color]);
      return {
        color,
        player_key: "HUMAN",
        player_name: item.player_name || "Aguardando Amigo...",
        is_bot: false,
        claimed: hasClaim,
        is_me: Boolean(
          payload.token && stored.seat_tokens[color] === payload.token
        ),
        seat_kind: hasClaim ? prev?.seat_kind || "GUEST" : ("GUEST" as const),
        username: hasClaim ? prev?.username ?? null : null,
        avatar_config: hasClaim ? prev?.avatar_config ?? {} : {},
      };
    });
  }

  saveRoomsMap(rooms);
  return localGetRoom(code, payload.token);
}

export function localStartRoomGame(
  roomCode: string,
  token?: string | null
): { game_id: string; room: RoomState } {
  const code = roomCode.toUpperCase();
  const resolvedRoom = localGetRoom(code, token);
  const rooms = loadRoomsMap();
  const stored = rooms[code];

  if (!stored.game_id) {
    const seatNames: Partial<Record<Color, string>> = {};
    const seatMeta = {} as Record<Color, LocalSeatMeta>;
    for (const s of resolvedRoom.seats) {
      const cleanLabel =
        s.player_name === "Aguardando Amigo..."
          ? PLAYER_COLOR_META[s.color].label
          : s.player_name;
      seatNames[s.color] = cleanLabel;
      seatMeta[s.color] = {
        color: s.color,
        seat_kind: s.is_bot
          ? "BOT"
          : s.username
            ? "USER"
            : "GUEST",
        username: s.is_bot ? null : s.username ?? null,
        player_key: s.player_key,
        display_name: cleanLabel,
        avatar_config: s.avatar_config ?? {},
      };
    }
    stored.game_id = localCreateGame({
      players: stored.seats.map((s) => s.player_key),
      mapTemplate: stored.config.map_template,
      vpsToWin: stored.config.vps_to_win,
      discardLimit: stored.config.discard_limit,
      friendlyRobber: stored.config.friendly_robber,
      seatNames,
      seatMeta,
      roomCode: code,
    });
    stored.status = "IN_PROGRESS";
    saveRoomsMap(rooms);
  }

  return {
    game_id: stored.game_id,
    room: localGetRoom(code, token),
  };
}
```

- [ ] **Step 4: Rodar TypeScript check e Vitest para `avatarCatalog` e `apiClient`**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run src/config/avatarCatalog.test.ts src/utils/apiClient.test.ts
```
Expected: `0` TypeScript errors and all tests PASS.

- [ ] **Step 5: Commitar Task 2**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/utils/api.types.ts ui/src/config/avatarCatalog.ts ui/src/config/avatarCatalog.test.ts ui/src/utils/apiClient.ts ui/src/utils/localEngine.ts ui/src/utils/apiClient.test.ts
git commit -m "feat(avatar-core): add modular avatar catalog, unlock rules, TS types and offline profile mirror"
```

---

### Task 3: Renderizador SVG `PlayerAvatar` e Modal `AvatarStudioModal`

**Files:**
- Create: `ui/src/components/PlayerAvatar.tsx`
- Create: `ui/src/components/PlayerAvatar.scss`
- Create: `ui/src/components/AvatarStudioModal.tsx`
- Create: `ui/src/components/AvatarStudioModal.scss`
- Create: `ui/src/components/AvatarStudioModal.test.tsx`

**Interfaces:**
- Consumes: `AvatarConfig`, `resolveAvatarConfig`, `AVATAR_*_OPTIONS`, `AVATAR_PRESETS`, `getAvatarItemRequirement`, `isAvatarItemUnlocked`, `randomizeUnlockedAvatar`, `updateProfile`, `PlayerAccount`
- Produces:
  - `PlayerAvatar`: `React.FC<{ config?: Partial<AvatarConfig> | Record<string, unknown> | null; username?: string | null; size?: number; className?: string; showFrameLabel?: boolean; }>`
  - `AvatarStudioModal`: `React.FC<{ open: boolean; onClose: () => void; account: PlayerAccount; onSaved: (updated: PlayerAccount) => void; }>`

- [ ] **Step 1: Escrever teste falhando `ui/src/components/AvatarStudioModal.test.tsx`**

Create `ui/src/components/AvatarStudioModal.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import AvatarStudioModal from "./AvatarStudioModal";
import { updateProfile } from "../utils/apiClient";
import type { PlayerAccount } from "../utils/apiClient";

vi.mock("../utils/apiClient", () => ({
  updateProfile: vi.fn(),
}));

const baseAccount: PlayerAccount = {
  username: "joao",
  display_name: "João",
  auth_token: "sess_abc",
  avatar_config: {
    skin: "warm",
    eyes: "calm",
    hair: "short",
    hairColor: "brown",
    beard: "none",
    hat: "none",
    outfit: "settler",
    outfitColor: "royal",
    background: "ocean",
    frame: "wood",
  },
  stats: {
    wins: 2,
    losses: 1,
    games_played: 3,
    win_rate: 66.7,
  },
};

describe("AvatarStudioModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows locked thresholds on earned tabs, applies preset, and saves profile", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();

    vi.mocked(updateProfile).mockResolvedValue({
      ...baseAccount,
      display_name: "Cap. João",
      avatar_config: { ...baseAccount.avatar_config, frame: "bronze" },
    });

    render(
      <AvatarStudioModal
        open={true}
        onClose={onClose}
        account={baseAccount}
        onSaved={onSaved}
      />
    );

    // Resumo de vitórias e campo editável de apelido visíveis
    expect(screen.getByText(/2 vitórias/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Apelido na Mesa/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Cap. João");

    // Aplicar arquétipo pronto "Capitão dos Mares"
    await user.click(screen.getByRole("button", { name: /Capitão dos Mares/i }));

    // Trocar para aba Acessórios e checar Coroa Dourada travada (faltam 5 vitórias)
    await user.click(screen.getByRole("tab", { name: /Acessórios/i }));
    const crownBtn = screen.getByRole("button", { name: /Coroa Dourada/i });
    expect(crownBtn).toBeDisabled();
    expect(screen.getByText(/Faltam 5 vitórias/i)).toBeInTheDocument();

    // Trocar para aba Molduras: Bronze (1 vitória) liberada, Prata (3 vitórias) bloqueada
    await user.click(screen.getByRole("tab", { name: /Molduras/i }));
    const bronzeBtn = screen.getByRole("button", { name: /Bronze de Navegador/i });
    const silverBtn = screen.getByRole("button", { name: /Prata da Guilda/i });
    expect(bronzeBtn).toBeEnabled();
    expect(silverBtn).toBeDisabled();
    expect(screen.getByText(/Falta 1 vitória/i)).toBeInTheDocument();

    await user.click(bronzeBtn);
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));

    expect(updateProfile).toHaveBeenCalledWith({
      displayName: "Cap. João",
      avatarConfig: expect.objectContaining({
        hat: "captain",
        outfit: "captain",
        frame: "bronze",
      }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar o teste novo para confirmar falha antes da implementação**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx vitest run src/components/AvatarStudioModal.test.tsx
```
Expected: FAIL (`Cannot find module './AvatarStudioModal'`).

- [ ] **Step 3: Criar `PlayerAvatar.tsx`, `PlayerAvatar.scss`, `AvatarStudioModal.tsx` e `AvatarStudioModal.scss`**

Create `ui/src/components/PlayerAvatar.scss`:
```scss
.player-avatar {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  &__frame {
    position: relative;
    border-radius: 50%;
    padding: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(145deg, #a66c38, #5c3718);
    box-shadow:
      0 3px 10px rgba(0, 0, 0, 0.55),
      inset 0 1px 1px rgba(255, 255, 255, 0.28);
    overflow: hidden;
    flex-shrink: 0;
  }

  &--frame-wood &__frame {
    background: linear-gradient(145deg, #a66d3b 0%, #734620 55%, #472910 100%);
    border: 1.5px solid #c68b54;
  }

  &--frame-bronze &__frame {
    background: linear-gradient(145deg, #f09c5a 0%, #b45309 55%, #6d2e07 100%);
    border: 1.5px solid #fdba74;
    box-shadow: 0 3px 12px rgba(217, 119, 6, 0.45);
  }

  &--frame-silver &__frame {
    background: linear-gradient(145deg, #f8fafc 0%, #94a3b8 50%, #475569 100%);
    border: 1.5px solid #f1f5f9;
    box-shadow: 0 3px 14px rgba(148, 163, 184, 0.5);
  }

  &--frame-gold &__frame {
    background: linear-gradient(145deg, #fef08a 0%, #eab308 50%, #92400e 100%);
    border: 2px solid #fef9c3;
    box-shadow:
      0 0 14px rgba(250, 204, 21, 0.55),
      inset 0 1px 2px rgba(255, 255, 255, 0.65);
  }

  &--frame-imperial &__frame {
    padding: 3.5px;
    background: linear-gradient(135deg, #10b981 0%, #facc15 48%, #047857 100%);
    border: 2px solid #fde047;
    box-shadow:
      0 0 16px rgba(16, 185, 129, 0.55),
      0 0 24px rgba(250, 204, 21, 0.45);
    animation: player-avatar-imperial-pulse 3.2s ease-in-out infinite;
  }

  &__svg {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #0f172a;
  }

  &__frame-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #fef08a;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(250, 204, 21, 0.35);
    border-radius: 999px;
    padding: 2px 10px;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
}

@keyframes player-avatar-imperial-pulse {
  0%,
  100% {
    box-shadow:
      0 0 14px rgba(16, 185, 129, 0.5),
      0 0 22px rgba(250, 204, 21, 0.4);
  }
  50% {
    box-shadow:
      0 0 20px rgba(16, 185, 129, 0.8),
      0 0 30px rgba(250, 204, 21, 0.7);
  }
}
```

Create `ui/src/components/PlayerAvatar.tsx`:
```tsx
import { useId } from "react";
import cn from "classnames";
import type {
  AvatarBackground,
  AvatarConfig,
  AvatarHairColor,
  AvatarOutfitColor,
  AvatarSkin,
} from "../utils/api.types";
import {
  AVATAR_FRAME_OPTIONS,
  resolveAvatarConfig,
} from "../config/avatarCatalog";
import "./PlayerAvatar.scss";

const SKIN_PALETTE: Record<AvatarSkin, { base: string; shade: string; blush: string }> = {
  porcelain: { base: "#fbe2d1", shade: "#e6b89c", blush: "#f4a59a" },
  fair: { base: "#f3cfb3", shade: "#d6a07b", blush: "#e89282" },
  warm: { base: "#e4b287", shade: "#c08454", blush: "#d97d68" },
  tan: { base: "#c98b5b", shade: "#9e6238", blush: "#b85d47" },
  brown: { base: "#995c37", shade: "#713d1f", blush: "#8d4330" },
  deep: { base: "#633722", shade: "#422112", blush: "#5e2b1d" },
};

const HAIR_PALETTE: Record<AvatarHairColor, { main: string; shade: string }> = {
  brown: { main: "#5c3922", shade: "#3b2212" },
  black: { main: "#222732", shade: "#10141b" },
  blonde: { main: "#eab308", shade: "#a16207" },
  red: { main: "#c2410c", shade: "#7c2d12" },
  silver: { main: "#cbd5e1", shade: "#64748b" },
  navy: { main: "#2563eb", shade: "#1e3a8a" },
};

const OUTFIT_PALETTE: Record<
  AvatarOutfitColor,
  { primary: string; dark: string; trim: string }
> = {
  crimson: { primary: "#dc2626", dark: "#7f1d1d", trim: "#fde047" },
  royal: { primary: "#2563eb", dark: "#1e3a8a", trim: "#facc15" },
  emerald: { primary: "#059669", dark: "#064e3b", trim: "#fde68a" },
  amber: { primary: "#d97706", dark: "#78350f", trim: "#fef08a" },
  slate: { primary: "#475569", dark: "#1e293b", trim: "#e2e8f0" },
};

const BG_PALETTE: Record<AvatarBackground, { top: string; bottom: string }> = {
  ocean: { top: "#156599", bottom: "#072643" },
  sunset: { top: "#f97316", bottom: "#581c87" },
  forest: { top: "#16a34a", bottom: "#052e16" },
  mountain: { top: "#475569", bottom: "#0f172a" },
  gold: { top: "#eab308", bottom: "#713f12" },
  crimson: { top: "#b91c1c", bottom: "#450a0a" },
};

export default function PlayerAvatar({
  config,
  username,
  size = 48,
  className,
  showFrameLabel = false,
}: {
  config?: Partial<AvatarConfig> | Record<string, unknown> | null;
  username?: string | null;
  size?: number;
  className?: string;
  showFrameLabel?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const resolved = resolveAvatarConfig(config, username);
  const skin = SKIN_PALETTE[resolved.skin];
  const hair = HAIR_PALETTE[resolved.hairColor];
  const outfit = OUTFIT_PALETTE[resolved.outfitColor];
  const bg = BG_PALETTE[resolved.background];
  const frameLabel =
    AVATAR_FRAME_OPTIONS.find((f) => f.value === resolved.frame)?.label ||
    "Madeira de Colono";

  const clipId = `pa-clip-${uid}`;
  const bgGradId = `pa-bg-${uid}`;
  const hideFrontHair = resolved.hat === "helm";

  return (
    <div
      className={cn(
        "player-avatar",
        `player-avatar--frame-${resolved.frame}`,
        className
      )}
      data-testid="player-avatar"
      data-frame={resolved.frame}
    >
      <div
        className="player-avatar__frame"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 120 120"
          width={size}
          height={size}
          className="player-avatar__svg"
          role="img"
          aria-label={username ? `Avatar de ${username}` : "Avatar do jogador"}
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="60" cy="60" r="58" />
            </clipPath>
            <linearGradient id={bgGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bg.top} />
              <stop offset="100%" stopColor={bg.bottom} />
            </linearGradient>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            {/* 1. Background */}
            <rect width="120" height="120" fill={`url(#${bgGradId})`} />
            {resolved.background === "ocean" && (
              <path
                d="M0 90 Q30 82 60 90 T120 90 V120 H0 Z"
                fill="rgba(255,255,255,0.12)"
              />
            )}
            {resolved.background === "sunset" && (
              <circle cx="60" cy="68" r="28" fill="rgba(254, 240, 138, 0.28)" />
            )}
            {resolved.background === "forest" && (
              <path
                d="M8 106 L22 76 L36 106 Z M84 106 L98 72 L112 106 Z"
                fill="rgba(0,0,0,0.22)"
              />
            )}
            {resolved.background === "mountain" && (
              <path
                d="M-5 110 L32 64 L64 96 L94 60 L126 110 Z"
                fill="rgba(15,23,42,0.45)"
              />
            )}
            {resolved.background === "gold" && (
              <circle cx="60" cy="54" r="40" fill="rgba(254, 249, 195, 0.22)" />
            )}

            {/* 2. Back Hair */}
            {resolved.hair === "long" && (
              <path
                d="M30 48 C25 70 25 96 34 114 H86 C95 96 95 70 90 48 Z"
                fill={hair.shade}
              />
            )}
            {resolved.hair === "wavy" && (
              <path
                d="M31 46 C23 64 26 88 35 100 H85 C94 88 97 64 89 46 Z"
                fill={hair.shade}
              />
            )}
            {resolved.hair === "braids" && (
              <g fill={hair.shade}>
                <rect x="28" y="54" width="11" height="48" rx="5.5" />
                <rect x="81" y="54" width="11" height="48" rx="5.5" />
                <rect x="29" y="92" width="9" height="4" rx="2" fill="#facc15" />
                <rect x="82" y="92" width="9" height="4" rx="2" fill="#facc15" />
              </g>
            )}
            {resolved.hair === "curly" && (
              <g fill={hair.shade}>
                <circle cx="32" cy="48" r="11" />
                <circle cx="88" cy="48" r="11" />
                <circle cx="30" cy="64" r="10" />
                <circle cx="90" cy="64" r="10" />
              </g>
            )}
            {resolved.hair === "bun" && (
              <circle cx="60" cy="22" r="13" fill={hair.shade} />
            )}

            {/* 3. Outfit & Shoulders */}
            <g>
              <path
                d="M14 122 C16 94 34 84 60 84 C86 84 104 94 106 122 Z"
                fill={outfit.primary}
              />
              {resolved.outfit === "settler" && (
                <>
                  <path d="M36 86 L60 112 L84 86 L74 84 L60 100 L46 84 Z" fill={outfit.dark} />
                  <path d="M36 88 L80 120" stroke="#78350f" strokeWidth="6" />
                </>
              )}
              {resolved.outfit === "captain" && (
                <>
                  <path d="M40 85 L54 114 L46 120 L30 96 Z" fill={outfit.dark} />
                  <path d="M80 85 L66 114 L74 120 L90 96 Z" fill={outfit.dark} />
                  <circle cx="48" cy="100" r="2.2" fill={outfit.trim} />
                  <circle cx="72" cy="100" r="2.2" fill={outfit.trim} />
                </>
              )}
              {resolved.outfit === "armor" && (
                <>
                  <path
                    d="M22 104 C28 88 42 84 60 84 C78 84 92 88 98 104 L92 122 H28 Z"
                    fill="#94a3b8"
                  />
                  <path
                    d="M36 87 L60 105 L84 87"
                    fill="none"
                    stroke="#475569"
                    strokeWidth="3.5"
                  />
                  <path d="M18 106 C22 92 34 86 44 88 L40 104 Z" fill={outfit.primary} />
                  <path d="M102 106 C98 92 86 86 76 88 L80 104 Z" fill={outfit.primary} />
                </>
              )}
              {resolved.outfit === "merchant" && (
                <>
                  <path
                    d="M34 86 Q60 112 86 86 L92 122 H28 Z"
                    fill={outfit.dark}
                  />
                  <path
                    d="M44 87 Q60 102 76 87"
                    fill="none"
                    stroke={outfit.trim}
                    strokeWidth="3"
                  />
                  <circle cx="60" cy="99" r="4.5" fill={outfit.trim} />
                </>
              )}
            </g>

            {/* 4. Neck & Head */}
            <rect x="51" y="72" width="18" height="20" rx="7" fill={skin.shade} />
            <circle cx="35" cy="58" r="6" fill={skin.shade} />
            <circle cx="85" cy="58" r="6" fill={skin.shade} />
            <rect x="36" y="30" width="48" height="53" rx="23" fill={skin.base} />
            <ellipse cx="44" cy="63" rx="5" ry="2.6" fill={skin.blush} opacity="0.45" />
            <ellipse cx="76" cy="63" rx="5" ry="2.6" fill={skin.blush} opacity="0.45" />
            <path
              d="M58 55 Q60 61 62 59"
              fill="none"
              stroke={skin.shade}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* 5. Eyes & Expression */}
            {resolved.eyes === "calm" && (
              <g>
                <circle cx="48" cy="53" r="3" fill="#1e293b" />
                <circle cx="72" cy="53" r="3" fill="#1e293b" />
                <circle cx="49" cy="52" r="1" fill="#ffffff" />
                <circle cx="73" cy="52" r="1" fill="#ffffff" />
                <path d="M42 46 Q48 44 54 46" stroke={hair.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M66 46 Q72 44 78 46" stroke={hair.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M53 69 Q60 73 67 69" stroke={skin.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              </g>
            )}
            {resolved.eyes === "cheerful" && (
              <g>
                <circle cx="48" cy="53" r="3.2" fill="#1e293b" />
                <circle cx="72" cy="53" r="3.2" fill="#1e293b" />
                <circle cx="49" cy="51.8" r="1.1" fill="#ffffff" />
                <circle cx="73" cy="51.8" r="1.1" fill="#ffffff" />
                <path d="M42 45 Q48 42 54 45" stroke={hair.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M66 45 Q72 42 78 45" stroke={hair.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M51 67 Q60 76 69 67 Z" fill="#ffffff" />
                <path d="M51 67 Q60 76 69 67" stroke={skin.shade} strokeWidth="1.5" fill="none" />
              </g>
            )}
            {resolved.eyes === "sharp" && (
              <g>
                <ellipse cx="48" cy="54" rx="3.4" ry="2.6" fill="#0f172a" />
                <ellipse cx="72" cy="54" rx="3.4" ry="2.6" fill="#0f172a" />
                <path d="M42 45 L55 49" stroke={hair.shade} strokeWidth="2.8" strokeLinecap="round" />
                <path d="M78 45 L65 49" stroke={hair.shade} strokeWidth="2.8" strokeLinecap="round" />
                <path d="M53 70 Q62 72 68 67" stroke={skin.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              </g>
            )}
            {resolved.eyes === "wise" && (
              <g>
                <circle cx="48" cy="53" r="2.8" fill="#1e293b" />
                <circle cx="72" cy="53" r="2.8" fill="#1e293b" />
                <circle cx="48" cy="53" r="6.8" fill="none" stroke="#facc15" strokeWidth="1.8" />
                <circle cx="72" cy="53" r="6.8" fill="none" stroke="#facc15" strokeWidth="1.8" />
                <line x1="54.8" y1="53" x2="65.2" y2="53" stroke="#facc15" strokeWidth="1.8" />
                <path d="M42 43 Q48 41 54 43" stroke={hair.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />
                <path d="M66 43 Q72 41 78 43" stroke={hair.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />
                <path d="M54 70 Q60 73 66 70" stroke={skin.shade} strokeWidth="2" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* 6. Beard */}
            {resolved.beard === "goatee" && (
              <path
                d="M50 72 C50 82 54 88 60 88 C66 88 70 82 70 72 C65 75 55 75 50 72 Z"
                fill={hair.main}
              />
            )}
            {resolved.beard === "full" && (
              <path
                d="M36 58 C36 78 46 90 60 90 C74 90 84 78 84 58 L80 62 C78 72 70 75 60 75 C50 75 42 72 40 62 Z"
                fill={hair.main}
              />
            )}
            {resolved.beard === "mustache" && (
              <path
                d="M44 66 Q52 60 60 65 Q68 60 76 66 Q69 70 60 67 Q51 70 44 66 Z"
                fill={hair.main}
              />
            )}

            {/* 7. Front Hair */}
            {!hideFrontHair && resolved.hair !== "none" && (
              <g fill={hair.main}>
                {resolved.hair === "short" && (
                  <path d="M35 46 C35 28 48 22 60 22 C72 22 85 28 85 46 C77 36 45 36 35 46 Z" />
                )}
                {resolved.hair === "wavy" && (
                  <path d="M34 49 C34 27 47 21 60 21 C73 21 86 27 86 49 C78 39 67 35 56 41 C47 45 39 43 34 49 Z" />
                )}
                {resolved.hair === "bun" && (
                  <path d="M35 45 C37 28 49 23 60 23 C71 23 83 28 85 45 C75 34 45 34 35 45 Z" />
                )}
                {resolved.hair === "braids" && (
                  <path d="M35 47 C36 28 48 23 60 23 C72 23 84 28 85 47 C74 37 64 34 60 39 C56 34 46 37 35 47 Z" />
                )}
                {resolved.hair === "curly" && (
                  <>
                    <circle cx="43" cy="34" r="9" />
                    <circle cx="55" cy="29" r="10" />
                    <circle cx="68" cy="30" r="10" />
                    <circle cx="79" cy="36" r="8.5" />
                  </>
                )}
                {resolved.hair === "long" && (
                  <path d="M34 50 C34 27 46 21 60 21 C74 21 86 27 86 50 C77 36 65 34 60 34 C55 34 43 36 34 50 Z" />
                )}
              </g>
            )}

            {/* 8. Hats & Sovereign Crown */}
            {resolved.hat === "captain" && (
              <g>
                <path
                  d="M23 36 C32 16 46 14 60 15 C74 14 88 16 97 36 Q60 44 23 36 Z"
                  fill="#1e293b"
                />
                <path
                  d="M24 35 Q60 43 96 35"
                  fill="none"
                  stroke="#facc15"
                  strokeWidth="2.8"
                />
                <circle cx="60" cy="26" r="3.5" fill="#facc15" />
              </g>
            )}
            {resolved.hat === "explorer" && (
              <g>
                <path d="M38 33 C40 16 80 16 82 33 Z" fill="#854d0e" />
                <rect x="38" y="29" width="44" height="4.5" fill="#ca8a04" />
                <ellipse cx="60" cy="34" rx="37" ry="5.5" fill="#713f12" />
              </g>
            )}
            {resolved.hat === "bandana" && (
              <g>
                <path
                  d="M34 42 C35 23 85 23 86 42 Q60 36 34 42 Z"
                  fill={outfit.primary}
                />
                <circle cx="84" cy="40" r="5" fill={outfit.dark} />
                <path d="M86 41 L97 49 L90 52 Z" fill={outfit.primary} />
              </g>
            )}
            {resolved.hat === "helm" && (
              <g>
                <path
                  d="M33 48 C33 21 46 15 60 15 C74 15 87 21 87 48 Z"
                  fill="#94a3b8"
                  stroke="#475569"
                  strokeWidth="2"
                />
                <rect x="57.5" y="28" width="5" height="27" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
                <path d="M34 44 H86" stroke="#facc15" strokeWidth="2.5" />
              </g>
            )}
            {resolved.hat === "crown_gold" && (
              <g>
                <path
                  d="M36 33 L40 14 L51 24 L60 10 L69 24 L80 14 L84 33 Z"
                  fill="#facc15"
                  stroke="#a16207"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <rect x="36" y="30" width="48" height="5" rx="2" fill="#eab308" stroke="#a16207" strokeWidth="1.2" />
                <circle cx="60" cy="23" r="2.8" fill="#ef4444" />
                <circle cx="48" cy="26" r="2.2" fill="#10b981" />
                <circle cx="72" cy="26" r="2.2" fill="#10b981" />
              </g>
            )}
          </g>
        </svg>
      </div>
      {showFrameLabel && (
        <span className="player-avatar__frame-label">🏆 {frameLabel}</span>
      )}
    </div>
  );
}
```

Create `ui/src/components/AvatarStudioModal.scss`:
```scss
.avatar-studio-paper {
  background: #0f172a !important;
  color: #f8fafc !important;
  border: 1px solid rgba(250, 204, 21, 0.3) !important;
  border-radius: 18px !important;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.72) !important;
}

.avatar-studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #fde047;
  font-weight: 800;

  .avatar-studio-close-btn {
    color: #94a3b8;
    border-color: rgba(255, 255, 255, 0.16);
    text-transform: none;
    border-radius: 8px;
  }
}

.avatar-studio-body {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  gap: 20px;
  padding: 18px 22px !important;
}

.avatar-studio-preview-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.avatar-studio-stats-pill {
  font-size: 0.78rem;
  font-weight: 700;
  color: #fde047;
  background: rgba(250, 204, 21, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.32);
  border-radius: 999px;
  padding: 4px 12px;
  text-align: center;
}

.avatar-studio-name-field {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 0.74rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  input {
    width: 100%;
    padding: 8px 10px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(15, 23, 42, 0.9);
    color: #f8fafc;
    font-size: 0.88rem;
    font-weight: 600;
  }
}

.avatar-studio-random-btn {
  width: 100%;
  border-color: rgba(96, 165, 250, 0.45) !important;
  color: #93c5fd !important;
  font-weight: 700 !important;
  text-transform: none !important;
  border-radius: 10px !important;
}

.avatar-studio-presets {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 7px;

  &__title {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
}

.avatar-preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.65);
  color: #e2e8f0;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;

  &:hover {
    border-color: #facc15;
    background: rgba(51, 65, 85, 0.85);
    color: #fef08a;
  }
}

.avatar-studio-controls-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.avatar-studio-tabs {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 40px !important;

  .MuiTab-root {
    color: #94a3b8 !important;
    text-transform: none !important;
    font-weight: 700 !important;
    font-size: 0.82rem !important;
    min-height: 40px !important;
    padding: 6px 12px !important;

    &.Mui-selected {
      color: #facc15 !important;
    }
  }

  .MuiTabs-indicator {
    background: #facc15 !important;
  }
}

.avatar-studio-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.avatar-section-block {
  display: flex;
  flex-direction: column;
  gap: 8px;

  h4 {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 800;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

.avatar-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 8px;
}

.avatar-option-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.65);
  color: #f1f5f9;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: rgba(250, 204, 21, 0.65);
    background: rgba(51, 65, 85, 0.85);
  }

  &.selected {
    border-color: #facc15;
    background: rgba(250, 204, 21, 0.15);
    color: #fef08a;
  }

  &.locked {
    opacity: 0.58;
    cursor: not-allowed;
    background: rgba(15, 23, 42, 0.7);
    border-style: dashed;
  }

  &__swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  &__lock {
    font-size: 0.68rem;
    color: #fca5a5;
    font-weight: 700;
  }

  &__sub {
    font-size: 0.68rem;
    color: #94a3b8;
  }
}

.avatar-studio-error {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.45);
  color: #fca5a5;
  font-size: 0.8rem;
  font-weight: 600;
}

.avatar-studio-footer {
  padding: 12px 22px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  gap: 10px;

  .avatar-studio-cancel-btn {
    color: #cbd5e1 !important;
    border-color: rgba(255, 255, 255, 0.2) !important;
    text-transform: none !important;
    border-radius: 10px !important;
  }

  .avatar-studio-save-btn {
    background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%) !important;
    color: #0f172a !important;
    font-weight: 800 !important;
    text-transform: none !important;
    border-radius: 10px !important;
  }
}

@media (max-width: 720px) {
  .avatar-studio-body {
    grid-template-columns: 1fr;
  }
}
```

Create `ui/src/components/AvatarStudioModal.tsx`:
```tsx
import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import type { AvatarConfig } from "../utils/api.types";
import { updateProfile, type PlayerAccount } from "../utils/apiClient";
import {
  AVATAR_BACKGROUND_OPTIONS,
  AVATAR_BEARD_OPTIONS,
  AVATAR_EYES_OPTIONS,
  AVATAR_FRAME_OPTIONS,
  AVATAR_HAIR_COLOR_OPTIONS,
  AVATAR_HAIR_OPTIONS,
  AVATAR_HAT_OPTIONS,
  AVATAR_OUTFIT_COLOR_OPTIONS,
  AVATAR_OUTFIT_OPTIONS,
  AVATAR_PRESETS,
  AVATAR_SKIN_OPTIONS,
  getAvatarItemRequirement,
  isAvatarItemUnlocked,
  randomizeUnlockedAvatar,
  resolveAvatarConfig,
  type AvatarOption,
} from "../config/avatarCatalog";
import PlayerAvatar from "./PlayerAvatar";
import "./AvatarStudioModal.scss";

type StudioTab = "face" | "hair" | "accessories" | "outfit" | "frames";

export default function AvatarStudioModal({
  open,
  onClose,
  account,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  account: PlayerAccount;
  onSaved: (updated: PlayerAccount) => void;
}) {
  const [tab, setTab] = useState<StudioTab>("face");
  const [displayName, setDisplayName] = useState(account.display_name);
  const [draftConfig, setDraftConfig] = useState<AvatarConfig>(() =>
    resolveAvatarConfig(account.avatar_config, account.username)
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const wins = account.stats?.wins ?? 0;
  const winRate = account.stats?.win_rate ?? 0;

  useEffect(() => {
    if (!open) return;
    setDisplayName(account.display_name);
    setDraftConfig(resolveAvatarConfig(account.avatar_config, account.username));
    setErrorMsg("");
  }, [open, account]);

  const setField = <K extends keyof AvatarConfig>(
    field: K,
    value: AvatarConfig[K]
  ) => {
    if (!isAvatarItemUnlocked(field, value, wins)) return;
    setDraftConfig((prev) => ({ ...prev, [field]: value }));
  };

  const renderOptionGrid = <K extends keyof AvatarConfig>(
    title: string,
    field: K,
    options: readonly AvatarOption<AvatarConfig[K]>[]
  ) => (
    <div className="avatar-section-block">
      <h4>{title}</h4>
      <div className="avatar-options-grid">
        {options.map((opt) => {
          const req = getAvatarItemRequirement(field, opt.value);
          const unlocked = isAvatarItemUnlocked(field, opt.value, wins);
          const remaining = Math.max(0, req - wins);
          const lockCopy =
            remaining === 1
              ? "Falta 1 vitória"
              : `Faltam ${remaining} vitórias`;
          const isSelected = draftConfig[field] === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={!unlocked}
              aria-label={
                unlocked ? opt.label : `${opt.label} (Bloqueado: ${lockCopy})`
              }
              className={`avatar-option-btn ${isSelected ? "selected" : ""} ${
                !unlocked ? "locked" : ""
              }`}
              onClick={() => setField(field, opt.value)}
            >
              {opt.swatch && (
                <span
                  className="avatar-option-btn__swatch"
                  style={{
                    background: opt.secondarySwatch
                      ? `linear-gradient(135deg, ${opt.swatch} 0%, ${opt.secondarySwatch} 100%)`
                      : opt.swatch,
                  }}
                />
              )}
              <span className="avatar-option-btn__text">
                <span>{opt.label}</span>
                {!unlocked ? (
                  <small className="avatar-option-btn__lock">🔒 {lockCopy}</small>
                ) : (
                  opt.subtitle && (
                    <small className="avatar-option-btn__sub">{opt.subtitle}</small>
                  )
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const handleSave = async () => {
    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMsg("Informe um apelido na mesa.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const updated = await updateProfile({
        displayName: cleanName,
        avatarConfig: draftConfig,
      });
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.description ||
          err?.message ||
          "Não foi possível salvar seu perfil."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ className: "avatar-studio-paper" }}
    >
      <DialogTitle className="avatar-studio-header">
        <span>🎨 Personalizar Avatar & Perfil</span>
        <Button
          size="small"
          variant="outlined"
          className="avatar-studio-close-btn"
          onClick={onClose}
        >
          Fechar
        </Button>
      </DialogTitle>

      <DialogContent className="avatar-studio-body">
        {/* Coluna Esquerda: Preview + Apelido + Presets */}
        <div className="avatar-studio-preview-col">
          <PlayerAvatar
            config={draftConfig}
            username={account.username}
            size={120}
            showFrameLabel
          />

          <div className="avatar-studio-stats-pill">
            🏆 {wins} {wins === 1 ? "vitória" : "vitórias"} • {winRate}% aproveitamento
          </div>

          <div className="avatar-studio-name-field">
            <label htmlFor="studio-display-name">Apelido na Mesa</label>
            <input
              id="studio-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              placeholder="Seu apelido na partida"
            />
          </div>

          <Button
            variant="outlined"
            size="small"
            className="avatar-studio-random-btn"
            onClick={() => setDraftConfig(randomizeUnlockedAvatar(wins))}
          >
            🎲 Aleatório
          </Button>

          <div className="avatar-studio-presets">
            <span className="avatar-studio-presets__title">Modelos Prontos</span>
            <div className="avatar-studio-presets__grid">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="avatar-preset-btn"
                  onClick={() =>
                    setDraftConfig((prev) => ({
                      ...preset.config,
                      frame: isAvatarItemUnlocked("frame", prev.frame, wins)
                        ? prev.frame
                        : "wood",
                    }))
                  }
                >
                  <PlayerAvatar
                    config={preset.config}
                    username={preset.id}
                    size={34}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Abas modulares */}
        <div className="avatar-studio-controls-col">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            className="avatar-studio-tabs"
          >
            <Tab value="face" label="Rosto" />
            <Tab value="hair" label="Cabelo & Barba" />
            <Tab value="accessories" label="Acessórios" />
            <Tab value="outfit" label="Traje & Fundo" />
            <Tab value="frames" label="🏆 Molduras" />
          </Tabs>

          <div className="avatar-studio-sections">
            {tab === "face" && (
              <>
                {renderOptionGrid("Tom de Pele", "skin", AVATAR_SKIN_OPTIONS)}
                {renderOptionGrid("Expressão & Olhos", "eyes", AVATAR_EYES_OPTIONS)}
              </>
            )}

            {tab === "hair" && (
              <>
                {renderOptionGrid("Estilo de Cabelo", "hair", AVATAR_HAIR_OPTIONS)}
                {renderOptionGrid("Cor do Cabelo", "hairColor", AVATAR_HAIR_COLOR_OPTIONS)}
                {renderOptionGrid("Barba & Bigode", "beard", AVATAR_BEARD_OPTIONS)}
              </>
            )}

            {tab === "accessories" &&
              renderOptionGrid("Chapéus & Coroas", "hat", AVATAR_HAT_OPTIONS)}

            {tab === "outfit" && (
              <>
                {renderOptionGrid("Traje", "outfit", AVATAR_OUTFIT_OPTIONS)}
                {renderOptionGrid("Cor do Traje", "outfitColor", AVATAR_OUTFIT_COLOR_OPTIONS)}
                {renderOptionGrid("Cenário de Fundo", "background", AVATAR_BACKGROUND_OPTIONS)}
              </>
            )}

            {tab === "frames" &&
              renderOptionGrid("Molduras por Mérito no Ranking", "frame", AVATAR_FRAME_OPTIONS)}
          </div>

          {errorMsg && <div className="avatar-studio-error">{errorMsg}</div>}
        </div>
      </DialogContent>

      <DialogActions className="avatar-studio-footer">
        <Button
          variant="outlined"
          className="avatar-studio-cancel-btn"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          className="avatar-studio-save-btn"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Salvando..." : "💾 Salvar Perfil"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Rodar TypeScript check e `AvatarStudioModal.test.tsx`**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run src/components/AvatarStudioModal.test.tsx
```
Expected: `0` TypeScript errors and all tests in `AvatarStudioModal.test.tsx` PASS.

- [ ] **Step 5: Commitar Task 3**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/components/PlayerAvatar.tsx ui/src/components/PlayerAvatar.scss ui/src/components/AvatarStudioModal.tsx ui/src/components/AvatarStudioModal.scss ui/src/components/AvatarStudioModal.test.tsx
git commit -m "feat(avatar-ui): build layered PlayerAvatar SVG renderer and AvatarStudioModal"
```

---

### Task 4: Integração Universal (`HomePage`, `RoomLobbyPage`, `LeaderboardModal`, `PlayerTopBar`)

**Files:**
- Modify: `ui/src/pages/HomePage.tsx` & `ui/src/pages/HomePage.scss`
- Modify: `ui/src/pages/RoomLobbyPage.tsx` & `ui/src/pages/RoomLobbyPage.scss`
- Modify: `ui/src/components/LeaderboardModal.tsx` & `ui/src/components/LeaderboardModal.scss`
- Modify: `ui/src/components/PlayerTopBar.tsx` & `ui/src/components/PlayerTopBar.scss`
- Modify: `ui/src/components/LeaderboardModal.test.tsx`
- Modify: `ui/src/pages/GameScreen.test.tsx`

**Interfaces:**
- Consumes: `PlayerAvatar`, `AvatarStudioModal`, `GameState.seat_avatars`, `RoomSeat.seat_kind`, `RoomSeat.avatar_config`, `LeaderboardEntry.avatar_config`

- [ ] **Step 1: Adicionar testes falhando para renderização de `PlayerAvatar` no Ranking e no `PlayerTopBar`**

Update `ui/src/components/LeaderboardModal.test.tsx` to verify `PlayerAvatar` renders in the ranking row:
Add to mock leaderboard entry:
```ts
        avatar_config: { hat: "captain", background: "ocean", frame: "bronze" },
```
And in the test assert:
```tsx
    expect(await screen.findByText("Pedro")).toBeInTheDocument();
    expect(screen.getAllByTestId("player-avatar").length).toBeGreaterThanOrEqual(1);
```

Update `ui/src/pages/GameScreen.test.tsx` by adding a new test at the bottom asserting `PlayerTopBar` renders custom `<PlayerAvatar />` ONLY when `seat_avatars[color].seat_kind === "USER"`, keeping bots with default portraits:
```tsx
test("renders custom SVG PlayerAvatar for registered USER seats while keeping classic portraits for bots", async () => {
  const mixedState = makeGameState({
    seat_names: { RED: "Bot", BLUE: "João" },
    seat_avatars: {
      RED: { seat_kind: "BOT", username: null, avatar_config: {} },
      BLUE: {
        seat_kind: "USER",
        username: "joao",
        avatar_config: { hat: "captain", background: "ocean", frame: "gold" },
      },
    },
  });
  vi.mocked(getState).mockResolvedValue(mixedState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const customAvatars = screen.getAllByTestId("player-avatar");
  expect(customAvatars).toHaveLength(1);
  expect(customAvatars[0]).toHaveAttribute("data-frame", "gold");
});
```

- [ ] **Step 2: Rodar os testes atualizados e confirmar falha esperada**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx vitest run src/components/LeaderboardModal.test.tsx src/pages/GameScreen.test.tsx
```
Expected: FAIL (`Unable to find an element by: [data-testid="player-avatar"]`).

- [ ] **Step 3: Integrar `<PlayerAvatar />` e `<AvatarStudioModal />` em `HomePage`, `RoomLobbyPage`, `LeaderboardModal` e `PlayerTopBar`**

1. **`ui/src/pages/HomePage.tsx` & `HomePage.scss`:**
   - Add imports at lines 35-37 of `ui/src/pages/HomePage.tsx`:
```tsx
import GoogleSignInButton from "../components/GoogleSignInButton";
import LeaderboardModal from "../components/LeaderboardModal";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarStudioModal from "../components/AvatarStudioModal";
```
   - Add state right after `leaderboardOpen`:
```tsx
  const [avatarStudioOpen, setAvatarStudioOpen] = useState(false);
```
   - Inside `.account-bar__logged` (replacing/preceding `.account-bar__info`):
```tsx
                <div className="account-bar__logged">
                  <div className="account-bar__identity">
                    <button
                      type="button"
                      className="account-bar__avatar-btn"
                      onClick={() => setAvatarStudioOpen(true)}
                      title="Personalizar seu avatar"
                    >
                      <PlayerAvatar
                        config={account.avatar_config}
                        username={account.username}
                        size={52}
                      />
                    </button>
                    <div className="account-bar__info">
                      <span className="account-bar__badge">👤 CONTA ONLINE</span>
                      <strong>{account.display_name}</strong>
                      <small>
                        @{account.username} • Suas salas e assentos ficam salvos em qualquer dispositivo
                      </small>
                      {account.stats && (
                        <div className="account-bar__stats">
                          <span>Vitórias: <strong>{account.stats.wins}</strong></span>
                          <span>Partidas: <strong>{account.stats.games_played}</strong></span>
                          <span>Aproveitamento: <strong>{account.stats.win_rate}%</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="account-bar__actions">
                    <Button
                      size="small"
                      variant="outlined"
                      className="account-avatar-btn"
                      onClick={() => setAvatarStudioOpen(true)}
                    >
                      🎨 Personalizar Avatar
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      className="account-leaderboard-btn"
                      onClick={() => setLeaderboardOpen(true)}
                    >
                      🏆 Ranking & Histórico
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      className="account-logout-btn"
                      onClick={handleLogout}
                    >
                      Sair
                    </Button>
                  </div>
                </div>
```
   - Render `<AvatarStudioModal />` right after `<LeaderboardModal />`:
```tsx
      {account && (
        <AvatarStudioModal
          open={avatarStudioOpen}
          onClose={() => setAvatarStudioOpen(false)}
          account={account}
          onSaved={(updated) => {
            setAccount(updated);
            setHostName(updated.display_name);
            refreshRooms();
          }}
        />
      )}
```
   - In `HomePage.scss`, add styles inside `.account-bar`:
```scss
  &__identity {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  &__avatar-btn {
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 50%;
    transition: transform 0.15s ease;

    &:hover {
      transform: scale(1.06);
    }
  }
```
   and `.account-avatar-btn`:
```scss
.account-avatar-btn {
  border-color: rgba(96, 165, 250, 0.45) !important;
  color: #93c5fd !important;
  font-weight: 700 !important;
  text-transform: none !important;
  border-radius: 8px !important;
  font-size: 0.82rem !important;
}
```

2. **`ui/src/pages/RoomLobbyPage.tsx` & `RoomLobbyPage.scss`:**
   - Update imports at lines 5-18 of `ui/src/pages/RoomLobbyPage.tsx`:
```tsx
import {
  DEFAULT_PLAYERS,
  fetchCurrentAccount,
  getPlayers,
  getRoom,
  getSavedAccount,
  joinRoom,
  updateRoom,
  startRoomGame,
  type PlayerAccount,
  type PlayerEntry,
} from "../utils/apiClient";
import type { Color, RoomState } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarStudioModal from "../components/AvatarStudioModal";
import { HybridIllustration } from "../components/icons/GameIcons";
```
   - Add state & mount account hydration right after `starting` state (around line 73):
```tsx
  const [account, setAccount] = useState<PlayerAccount | null>(() =>
    getSavedAccount()
  );
  const [avatarStudioOpen, setAvatarStudioOpen] = useState(false);

  useEffect(() => {
    fetchCurrentAccount()
      .then((acct) => {
        if (acct) {
          setAccount(acct);
          setPlayerName((prev) =>
            prev === "Jogador" || !prev.trim() ? acct.display_name : prev
          );
        }
      })
      .catch(() => {});
  }, []);
```
   - Inside `.guest-identity-bar` (right after `identity-save-btn` at line 288), add the button for logged-in users:
```tsx
              {account && (
                <Button
                  variant="outlined"
                  size="small"
                  className="identity-avatar-btn"
                  onClick={() => setAvatarStudioOpen(true)}
                >
                  🎨 Editar Meu Avatar
                </Button>
              )}
```
   - Inside `.lobby-seat-row__color` (lines 313-331), render `<PlayerAvatar />` when `seat.seat_kind === "USER"`, else `<HybridIllustration />` with classic `.webp` fallback to the color dot:
```tsx
                      <div className="lobby-seat-row__color">
                        {seat.seat_kind === "USER" ? (
                          <PlayerAvatar
                            config={seat.avatar_config}
                            username={seat.username || seat.player_name}
                            size={42}
                          />
                        ) : (
                          <span
                            className="lobby-seat-row__classic-wrap"
                            style={{ borderColor: palette.primary }}
                          >
                            <HybridIllustration
                              src={`/assets/illustrations/avatars/${seat.color.toLowerCase()}.webp`}
                              alt={seat.player_name}
                              fallback={
                                <span
                                  className="lobby-seat-row__dot"
                                  style={{
                                    background: palette.primary,
                                    boxShadow: `0 0 8px ${palette.glow}`,
                                  }}
                                />
                              }
                            />
                          </span>
                        )}
                        <div>
                          <strong>{palette.label}</strong>
                          <small>
                            {seat.is_me
                              ? `★ Seu Assento (${seat.player_name})`
                              : isOpenHuman
                                ? "🔓 Vaga Aberta"
                                : seat.player_name}
                          </small>
                        </div>
                      </div>
```
   - Right before the closing `</div>` of `.room-lobby-page` (around line 417), render `<AvatarStudioModal />`:
```tsx
      {account && (
        <AvatarStudioModal
          open={avatarStudioOpen}
          onClose={() => setAvatarStudioOpen(false)}
          account={account}
          onSaved={async (updated) => {
            setAccount(updated);
            setPlayerName(updated.display_name);
            localStorage.setItem("catan_player_name", updated.display_name);
            if (room?.my_color && roomCode) {
              try {
                const res = await joinRoom(roomCode, {
                  playerName: updated.display_name,
                  preferredColor: room.my_color,
                  token: getStoredToken(roomCode),
                });
                saveStoredToken(roomCode, res.seat_token);
                setRoom(res.room);
                return;
              } catch {
                // fallback to polling refresh
              }
            }
            fetchRoomState();
          }}
        />
      )}
```
   - In `ui/src/pages/RoomLobbyPage.scss`, add `.identity-avatar-btn` inside `.guest-identity-bar`, increase `.lobby-seat-row` first column from `150px` to `minmax(185px, 210px)`, and add `&__classic-wrap` inside `.lobby-seat-row`:
```scss
  .identity-avatar-btn {
    border-color: rgba(96, 165, 250, 0.45) !important;
    color: #93c5fd !important;
    font-weight: 700 !important;
    border-radius: 10px !important;
    text-transform: none !important;
  }
```
```scss
.lobby-seat-row {
  display: grid;
  grid-template-columns: minmax(185px, 210px) minmax(0, 1fr) auto;
```
```scss
  &__classic-wrap {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 2px solid;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(15, 23, 42, 0.75);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
```

3. **`ui/src/components/LeaderboardModal.tsx` & `LeaderboardModal.scss`:**
   - Import `PlayerAvatar` from `./PlayerAvatar`.
   - In the ranking table player cell (`<td>`):
```tsx
                      <td>
                        <div className="leaderboard-player-cell">
                          <PlayerAvatar
                            config={row.avatar_config}
                            username={row.username}
                            size={34}
                          />
                          <div>
                            <strong>{row.display_name}</strong>{" "}
                            <small>@{row.username}</small>
                          </div>
                        </div>
                      </td>
```
   - In `LeaderboardModal.scss`, add:
```scss
.leaderboard-player-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
```

4. **`ui/src/components/PlayerTopBar.tsx` & `PlayerTopBar.scss`:**
   - Add import right below `HybridIllustration` (line 8):
```tsx
import PlayerAvatar from "./PlayerAvatar";
```
   - In `PlayerCard` (line 188), read `seatAvatar`:
```tsx
  const avatarSrc = `/assets/illustrations/avatars/${color.toLowerCase()}.webp`;
  const seatAvatar = gameState.seat_avatars?.[color];
  const isRegisteredUserSeat = seatAvatar?.seat_kind === "USER";
```
   - Replace `.cu-player-card__avatar-wrap` (lines 220-230) so TypeScript narrows `seatAvatar` safely:
```tsx
        <div
          className={cn("cu-player-card__avatar-wrap", {
            "cu-player-card__avatar-wrap--custom": isRegisteredUserSeat,
          })}
        >
          {seatAvatar?.seat_kind === "USER" ? (
            <PlayerAvatar
              config={seatAvatar.avatar_config}
              username={seatAvatar.username || name}
              size={58}
              className="cu-player-card__custom-avatar"
            />
          ) : (
            <HybridIllustration
              src={avatarSrc}
              alt={name}
              fallback={
                <div className="cu-player-card__avatar-fallback">
                  {isBot ? "🤖" : "🧑"}
                </div>
              }
            />
          )}
        </div>
```
   - In `PlayerTopBar.scss`, add inside `&__avatar-wrap` (around line 126):
```scss
    &--custom {
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.35), rgba(2, 6, 23, 0.65));
      padding: 4px;
    }
```

- [ ] **Step 4: Rodar `tsc --noEmit` e toda a suíte Vitest**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run
```
Expected: `0` TypeScript errors and all test files PASS.

- [ ] **Step 5: Commitar Task 4**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/pages/HomePage.tsx ui/src/pages/HomePage.scss ui/src/pages/RoomLobbyPage.tsx ui/src/pages/RoomLobbyPage.scss ui/src/components/LeaderboardModal.tsx ui/src/components/LeaderboardModal.scss ui/src/components/PlayerTopBar.tsx ui/src/components/PlayerTopBar.scss ui/src/components/LeaderboardModal.test.tsx ui/src/pages/GameScreen.test.tsx
git commit -m "feat(avatar-integration): display custom PlayerAvatar across Home, RoomLobby, Leaderboard and PlayerTopBar"
```

---

### Task 5: Documentação (`CONTEXTO_PROJETO.md`) e Verificação Final Completa

**Files:**
- Modify: `CONTEXTO_PROJETO.md`

- [ ] **Step 1: Atualizar `CONTEXTO_PROJETO.md`**

In `CONTEXTO_PROJETO.md`, apply these exact updates:

1. In Section 3 (`Como Rodar no PC de Casa`, lines 58-68), fix `npm run dev` to `npm start`:
````markdown
```bash
# 2. Instalar dependências do frontend e rodar servidor de desenvolvimento
cd ui
npm install
npm start

# 3. Rodar testes e build de produção
npx vitest run
npm run build
```

> **Nota:** Graças ao [`localEngine.ts`](ui/src/utils/localEngine.ts), você pode rodar apenas `cd ui && npm start` no PC de casa sem precisar subir o Docker/Flask em Python para testar o visual, o tabuleiro, as cartas e partidas completas contra Bots!
````

2. At the end of Section 5 (`### Concluído Recentemente:`, right after line 172), document the Bloco 2 delivery:
```markdown
- **Bloco 2 Concluído: Criador Modular de Avatar, Perfil e Molduras por Mérito:**
  - **Avatar SVG Modular em Camadas (`ui/src/config/avatarCatalog.ts` & `ui/src/components/PlayerAvatar.tsx`):**
    - 10 dimensões customizáveis (pele, olhos/expressão, estilo/cor de cabelo, barba, chapéu/coroa, traje/cor, cenário de fundo e moldura), com fallback determinístico a partir do `username` (`resolveAvatarConfig`), 6 arquétipos prontos (*Modelos Prontos*) e sorteio aleatório (`🎲 Aleatório`).
  - **Recompensas por Vitórias no Ranking Global (Trava Dupla `403` Servidor + Offline):**
    - Molduras (`wood` 0, `bronze` 1, `silver` 3, `gold` 5, `imperial` 10 vitórias) e `crown_gold` (7 vitórias) validadas tanto em `catanatron/catanatron/web/models.py` (`update_user_profile` com HTTP `403`) quanto em `localEngine.ts` (`localUpdateProfile`).
  - **Studio de Perfil & Propagação Universal:**
    - Modal [`AvatarStudioModal.tsx`](ui/src/components/AvatarStudioModal.tsx) acessível pela Home e pela Sala Multiplayer com edição de apelido e pré-visualização ao vivo.
    - Propagação em lote zero-N+1 via `_load_avatars_by_username`, `serialize_room` e `_enrich_view_with_seats`, exibindo o avatar SVG em `HomePage`, `RoomLobbyPage`, `LeaderboardModal` e `PlayerTopBar` (para usuários `USER`, preservando os retratos clássicos `.webp` para Bots e convidados).
```

3. In Section 7 (`## 7. Próximos Passos`, lines 190-200), replace item 1 & 2 with Bloco 3 next step:
```markdown
## 7. Próximos Passos (Bloco 3)

1. ~~**Bloco 2 — Customização de Avatar e Perfil**~~ *(Concluído)*
2. **Bloco 3 — Redesign da Tela Inicial e Lobby Aberto:**
   - Remoção do card sólido central que encobre a arte de fundo (`lobby_hero.webp`).
   - Apresentação do avatar do jogador no lobby com seus dados e ranking.
   - Botões de ação bem posicionados e dedicados para cada modo: *Partida Rápida (Solo/IA)*, *Criar Sala Online*, *Salas Abertas*, *Ranking & Histórico* e *Personalizar Avatar*.
3. **Substituir os 4 Avatares Padrão:** Gerar retratos 100% originais via Nano Banana Pro em `ui/public/assets/illustrations/avatars/{red,orange,white,blue}.webp`.
```

- [ ] **Step 2: Rodar verificação completa End-to-End (Python pytest + TypeScript + Vitest + Vite Build)**

Run:
```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui"
npx tsc --noEmit
npx vitest run
npm run build
```
Expected:
- Todos os testes Python `tests/web` PASSAM.
- `tsc --noEmit` termina com exit code `0`.
- Toda a suíte `vitest run` PASSA.
- `npm run build` gera `dist/` sem erros.

- [ ] **Step 3: Commitar Task 5 e verificar `git status`**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add CONTEXTO_PROJETO.md
git commit -m "docs: document Bloco 2 modular avatar creator, unlock rules and fix npm start command"
git status -s
```
Expected: working tree limpa na branch `layout-topbar`.
