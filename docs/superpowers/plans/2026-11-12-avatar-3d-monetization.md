# Rule the Isle — Avatar 3D Modular, Recolor Dinâmico e Monetização VIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o sistema de avatares V1 por um motor **3D modular em Three.js (`.glb` + recolor em runtime)** com palco de corpo inteiro na Home e nos cards do Lobby, **Estúdio 3D com Provador Livre (Try-On)**, **snapshot 2D automático** para emblemas leves durante a partida, e tabela **`user_entitlements`** no Neon Postgres pronta para conquistas e futura loja VIP.

**Architecture:** O cliente renderiza modelos `.glb` modulares sob demanda (`React.lazy` + `Three.js` Vanilla wrapper compatível com React 19), aplicando cores dinâmicas por canal de material (`mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount`) e encaixando acessórios em *bone sockets*. Ao salvar no Estúdio, gera-se um snapshot `.webp` 2D para que partida, ranking e listas não precisem de WebGL ativo. O backend Python/SQLAlchemy espelhado em `catanatron/catanatron/web/` e `api/catanatron/web/` valida posse real via `user_entitlements` e vitórias antes de persistir.

**Tech Stack:** React 19.1, TypeScript 5.8, Three.js (`three`, `OrbitControls`, `GLTFLoader`, `DRACOLoader`), Vite 6, Vitest + Testing Library, Flask, SQLAlchemy, PostgreSQL (Neon) / SQLite, Pytest.

## Global Constraints

- Espelhar **todos** os arquivos alterados em `catanatron/catanatron/web/` identicamente em `api/catanatron/web/` (o teste `tests/web/test_rooms_and_bots.py` falha em caso de divergência).
- Retrocompatibilidade total com contas e `avatar_json` V1 já gravados no Neon Postgres.
- Zero contextos WebGL ativos durante uma partida em andamento (`GameScreen` / `PlayerTopBar` / `LeaderboardModal` / `OpenLobbyModal` usam apenas o `portraitSnapshot` 2D ou fallback SVG V2).
- Toda cópia visível suportada em PT-BR e EN via `useLanguage()` (`t(pt, en)`).
- Degradação limpa sem erros quando WebGL estiver ausente (jsdom / Vitest / GPU indisponível).
- Executar testes Python com `.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web` a partir da raiz `1\`.

---

## File Structure Map

| Arquivo | Responsabilidade |
|---|---|
| `catanatron/catanatron/web/avatar_catalog.py` (+ espelho `api/`) | Catálogo autoritativo backend V1+V2, raridades/tiers (`free`/`earnable`/`vip`), validação de hex de cores e `portraitSnapshot` |
| `catanatron/catanatron/web/models.py` (+ espelho `api/`) | Tabela `StoredUserEntitlement`, helpers `get_user_entitlements`/`grant_user_entitlement`, validação `403` c/ `locked_items` em `update_user_profile`, `entitlements` em `serialize_user` |
| `catanatron/catanatron/web/api.py` (+ espelho `api/`) | Endpoint `GET /api/avatar/catalog` e propagação estruturada de `locked_items` no `403` |
| `tests/web/test_avatar_v2_entitlements.py` | Testes de schema, V1->V2, cores, limites de snapshot, Try-On bloqueado (`403`) e desbloqueio via `user_entitlements` |
| `ui/src/utils/api.types.ts` | Tipos `AvatarColors`, `AvatarConfigV2`, `AvatarConfig` retrocompatível, `AvatarItemTier`, `LockedAvatarItem`, `PlayerAccount.entitlements` |
| `ui/src/config/avatarCatalog.ts` | Catálogo unificado V2, paletas de cores, 6 arquétipos V2, migração V1->V2, `findLockedAvatarItems` e `stripLockedAvatarItems` |
| `ui/src/config/avatarCatalog.test.ts` | Testes unitários do catálogo V2, Try-On lock detection e compatibilidade V1 |
| `ui/src/utils/apiClient.ts` & `ui/src/utils/localEngine.ts` | Propagação de `entitlements`, erro estruturado `locked_items`, validação V2 offline paritária |
| `ui/scripts/build_starter_3d_assets.mjs` | Gerador reproduzível em Node+Three.js dos `.glb` iniciais com *sockets* e materiais nomeados |
| `ui/public/assets/models/avatars/**` | Modelos `.glb` iniciais do kit base (corpos, cabeças, cabelos, barbas, trajes, capas, botas, chapéus, adereços, pets, montarias, pedestais) |
| `docs/AVATAR_3D_ASSET_GUIDE.md` | Guia passo-a-passo gratuito + Google One (Gemini -> Hunyuan3D/Tripo -> Blender -> `.glb`) |
| `ui/src/components/avatar3d/materialTint.ts` | Recolor universal em runtime de `mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount` |
| `ui/src/components/avatar3d/sceneComposer.ts` | Montagem modular de `.glb`s nos sockets, iluminação *Rule the Isle*, pedestal, aura VIP e descarte seguro |
| `ui/src/components/avatar3d/Avatar3DCanvas.tsx` (+ `.scss`) | Viewport Three.js lazy-loadable (360º, modos `hero`/`studio`/`card`, câmera `full`/`portrait`, captura WebP snapshot, fallback sem WebGL) |
| `ui/src/components/avatar3d/materialTint.test.ts` & `Avatar3DCanvas.test.tsx` | Testes do recolor em `THREE.Group`, detecção WebGL e fallback seguro |
| `ui/src/components/PlayerAvatar.tsx` (+ `.scss`) | Renderizador de Emblema 2D (prioriza `portraitSnapshot`, fallback SVG V2 melhorado, molduras especiais inclusive `vip_dragon`) |
| `ui/src/components/AvatarStudioModal.tsx` (+ `.scss`, `.test.tsx`) | Estúdio 3D completo com 7 abas, seletor de cores em tempo real, filtros VIP e fluxo de confirmação do Provador Try-On |
| `ui/src/pages/HomePage.tsx` (+ `.scss`) | Palco central 3D heroico em `.home-stage-window` sobre `lobby_hero.webp` |
| `ui/src/pages/RoomLobbyPage.tsx` (+ `.scss`) | 4 Cards Verticais Heroicos nos assentos do Lobby com identidade *Rule the Isle* |

---

### Task 1: Backend Catalog V2, `user_entitlements` Schema & Validation

**Files:**
- Create: `catanatron/catanatron/web/avatar_catalog.py`
- Create (mirror): `api/catanatron/web/avatar_catalog.py`
- Modify: `catanatron/catanatron/web/models.py` (mirror to `api/catanatron/web/models.py`)
- Modify: `catanatron/catanatron/web/api.py` (mirror to `api/catanatron/web/api.py`)
- Test: `tests/web/test_avatar_v2_entitlements.py`

**Interfaces:**
- Produces:
  - `StoredUserEntitlement` SQLAlchemy model (`users.username` FK, unique `(username, item_key)`).
  - `get_user_entitlements(username: str, session=None) -> list[str]`
  - `grant_user_entitlement(username: str, item_key: str, source: str = "STORE", transaction_ref: str | None = None) -> StoredUserEntitlement`
  - `sanitize_avatar_config(raw: dict | None) -> dict[str, Any]` (aceita V1 e V2 + `colors` hex + `portraitSnapshot` WebP/PNG válido `<= 65536` chars)
  - `find_locked_avatar_items(cfg: dict, wins: int, entitlements: set[str]) -> list[dict]`
  - `GET /api/avatar/catalog` e `403` com payload JSON `{"description": ..., "locked_items": [...]}` em `PATCH /api/auth/profile`.

- [ ] **Step 1: Write the failing backend tests**

Create `tests/web/test_avatar_v2_entitlements.py`:

```python
import json
import pytest
from catanatron.web import create_app
from catanatron.web.models import (
    StoredMatch,
    StoredUserEntitlement,
    db,
    grant_user_entitlement,
    register_user,
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


def test_v2_colors_and_snapshot_sanitization(app, client):
    with app.app_context():
        _, sess = register_user("ana", "senha123", "Ana")
        token = sess.token

    valid_snap = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA="
    res = client.patch(
        "/api/auth/profile",
        headers={"X-Auth-Token": token},
        json={
            "avatar_config": {
                "version": 2,
                "bodyType": "athletic",
                "headShape": "oval",
                "eyeStyle": "noble",
                "hair": "navigator",
                "outfit": "settler",
                "mount": "none",
                "colors": {
                    "skin": "#e4b287",
                    "hair": "#2c1810",
                    "eyes": "#0284c7",
                    "outfitPrimary": "#1d4ed8",
                    "outfitSecondary": "javascript:alert(1)",  # invalido -> ignorado
                    "outfitTrim": "#facc15",
                },
                "portraitSnapshot": valid_snap,
                "__proto__": {"hack": True},
            }
        },
    )
    assert res.status_code == 200
    body = res.get_json()
    cfg = body["avatar_config"]
    assert cfg["version"] == 2
    assert cfg["colors"]["skin"] == "#e4b287"
    assert "outfitSecondary" not in cfg["colors"]
    assert cfg["portraitSnapshot"] == valid_snap
    assert body["entitlements"] == []


def test_vip_and_earnable_server_enforcement_with_entitlements(app, client):
    with app.app_context():
        _, sess = register_user("bruno", "senha123", "Bruno")
        token = sess.token

    # Tentar equipar montaria VIP sem entitlement -> 403 com locked_items
    res_vip = client.patch(
        "/api/auth/profile",
        headers={"X-Auth-Token": token},
        json={"avatar_config": {"version": 2, "mount": "imperial_griffin"}},
    )
    assert res_vip.status_code == 403
    err_data = res_vip.get_json()
    assert any(
        item["slot"] == "mount" and item["id"] == "imperial_griffin" and item["tier"] == "vip"
        for item in err_data["locked_items"]
    )

    # Conceder entitlement VIP no banco -> 200 e aparece em /api/auth/me
    with app.app_context():
        grant_user_entitlement("bruno", "mount:imperial_griffin", source="PROMO", transaction_ref="promo_01")

    res_me = client.get("/api/auth/me", headers={"X-Auth-Token": token})
    assert res_me.status_code == 200
    assert "mount:imperial_griffin" in res_me.get_json()["entitlements"]

    res_ok = client.patch(
        "/api/auth/profile",
        headers={"X-Auth-Token": token},
        json={"avatar_config": {"version": 2, "mount": "imperial_griffin"}},
    )
    assert res_ok.status_code == 200
    assert res_ok.get_json()["avatar_config"]["mount"] == "imperial_griffin"


def test_oversized_or_malicious_snapshot_is_dropped(app, client):
    with app.app_context():
        _, sess = register_user("carla", "senha123", "Carla")
        token = sess.token

    bad_snap = "data:image/svg+xml;base64,PHN2Zz4="
    huge_snap = "data:image/webp;base64," + ("A" * 70000)

    res = client.patch(
        "/api/auth/profile",
        headers={"X-Auth-Token": token},
        json={"avatar_config": {"version": 2, "portraitSnapshot": bad_snap}},
    )
    assert res.status_code == 200
    assert "portraitSnapshot" not in res.get_json()["avatar_config"]

    res2 = client.patch(
        "/api/auth/profile",
        headers={"X-Auth-Token": token},
        json={"avatar_config": {"version": 2, "portraitSnapshot": huge_snap}},
    )
    assert res2.status_code == 200
    assert "portraitSnapshot" not in res2.get_json()["avatar_config"]


def test_catalog_endpoint_exposes_vip_and_free_items(client):
    res = client.get("/api/avatar/catalog")
    assert res.status_code == 200
    data = res.get_json()
    assert "items" in data
    assert any(i["slot"] == "mount" and i["id"] == "imperial_griffin" and i["tier"] == "vip" for i in data["items"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_avatar_v2_entitlements.py -v`  
Expected: FAIL (`ImportError: cannot import name 'grant_user_entitlement'`).

- [ ] **Step 3: Create `catanatron/catanatron/web/avatar_catalog.py` (and mirror)**

Implement `AVATAR_CATALOG_ITEMS`, `AVATAR_COLOR_FIELDS`, `HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")`, `SNAPSHOT_RE = re.compile(r"^data:image/(?:webp|png);base64,[A-Za-z0-9+/=]+$")`, `MAX_SNAPSHOT_CHARS = 65536`, `sanitize_avatar_config(raw)`, `find_locked_avatar_items(cfg, wins, entitlements)`, and `filter_unlocked_avatar_config(raw, wins=0, entitlements=None)` preserving all V1 valid values plus V2 slots:
- V1 keys (`skin`, `eyes`, `hair`, `hairColor`, `beard`, `hat`, `outfit`, `outfitColor`, `background`, `frame`) remain accepted alongside V2 slots (`bodyType`, `headShape`, `eyeStyle`, `browStyle`, `noseStyle`, `mouthStyle`, `hair`, `beard`, `outfit`, `legsBoots`, `cape`, `hat`, `handProp`, `backProp`, `pet`, `mount`, `pedestal`, `aura`, `background`, `frame`) plus `version` (`1` or `2`), `colors` dict, and `portraitSnapshot`.
- Initial item tiers:
  - `free`: base bodies (`athletic`, `sturdy`, `slender`), head shapes (`oval`, `square`, `heart`, `chiseled`), eyes/brows/noses/mouths, hairs (`none`, `short`, `wavy`, `bun`, `braids`, `curly`, `long`, `navigator`), beards (`none`, `goatee`, `full`, `mustache`, `captain_trimmed`), outfits (`settler`, `captain`, `armor`, `merchant`), `legsBoots` (`traveler`, `cuffed_boots`, `greaves`), `cape` (`none`, `traveler`), `hat` (`none`, `captain`, `explorer`, `bandana`, `helm`), `handProp` (`none`, `spyglass`, `scroll`), `backProp` (`none`, `explorer_pack`), `pet` (`none`), `mount` (`none`, `island_horse`), `pedestal` (`stone_wood`), `aura` (`none`), `background` (`ocean`, `sunset`, `forest`, `mountain`, `gold`, `crimson`), `frame` (`wood`).
  - `earnable`: `frame:bronze` (1 win), `cape:navy_commander` (2 wins), `frame:silver` (3 wins), `handProp:royal_scepter` (4 wins), `frame:gold` (5 wins), `hat:crown_gold` (7 wins), `frame:imperial` (10 wins).
  - `vip`: `outfit:imperial_lord` (`sku: "vip_outfit_imperial_lord"`), `cape:royal_mantle` (`sku: "vip_cape_royal_mantle"`), `pet:parrot` (`sku: "vip_pet_parrot"`), `pet:falcon` (`sku: "vip_pet_falcon"`), `mount:snow_wolf` (`sku: "vip_mount_snow_wolf"`), `mount:imperial_griffin` (`sku: "vip_mount_griffin"`), `pedestal:obsidian_crown` (`sku: "vip_pedestal_obsidian"`), `aura:imperial_flame` (`sku: "vip_aura_imperial_flame"`), `frame:vip_dragon` (`sku: "vip_frame_dragon"`), `handProp:sun_rapier` (`sku: "vip_prop_sun_rapier"`), `backProp:imperial_shield` (`sku: "vip_prop_shield"`).

- [ ] **Step 4: Update `models.py` and `api.py` (and mirror to `api/catanatron/web/`)**

In `catanatron/catanatron/web/models.py`:
- Add `StoredUserEntitlement(Base)` (`__tablename__ = "user_entitlements"`, `UniqueConstraint("username", "item_key", name="uq_user_entitlement_item")`).
- Add `get_user_entitlements(username: str, session=None) -> list[str]` and `grant_user_entitlement(...)`.
- Update `serialize_user(user, stats=None)` to include `"entitlements": get_user_entitlements(user.username)`.
- Update `update_user_profile(...)`: check `locked = find_locked_avatar_items(merged_cfg, wins, set(get_user_entitlements(user.username)))`; if non-empty, raise a `ValueError` or custom `LockedAvatarItemsError(locked)` caught cleanly (or attach `locked_items` to Flask error handler) so `PATCH /api/auth/profile` returns HTTP `403` JSON `{"description": "...", "locked_items": locked}`.
- Add `@bp.route("/avatar/catalog", methods=("GET",))` in `api.py` returning `{"version": 2, "items": AVATAR_CATALOG_ITEMS}`.
- Mirror `avatar_catalog.py`, `models.py`, and `api.py` into `api/catanatron/web/`.

- [ ] **Step 5: Run backend tests & parity checks**

Run: `.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v`  
Expected: All existing 59 tests + all 4 tests in `test_avatar_v2_entitlements.py` PASS (`63+ passed`), including `api/` parity checks.

- [ ] **Step 6: Commit Task 1**

```bash
git add catanatron/catanatron/web/avatar_catalog.py catanatron/catanatron/web/models.py catanatron/catanatron/web/api.py api/catanatron/web/avatar_catalog.py api/catanatron/web/models.py api/catanatron/web/api.py tests/web/test_avatar_v2_entitlements.py
git commit -m "feat(backend): add avatar V2 catalog, user_entitlements table, and server VIP validation"
```

---

### Task 2: Frontend V2 Types, Unified Catalog, Client & LocalEngine Parity

**Files:**
- Modify: `ui/src/utils/api.types.ts`
- Modify: `ui/src/config/avatarCatalog.ts`
- Modify: `ui/src/utils/apiClient.ts`
- Modify: `ui/src/utils/localEngine.ts`
- Test: `ui/src/config/avatarCatalog.test.ts`

**Interfaces:**
- Produces:
  - `AvatarColors`, `AvatarConfig` (superset V1+V2), `AvatarConfigV2`, `AvatarItemTier`, `AvatarItemRarity`, `AvatarCatalogEntry`, `LockedAvatarItem`.
  - `resolveAvatarConfig(raw?, username?) -> AvatarConfigV2`
  - `findLockedAvatarItems(config, wins, entitlements?) -> LockedAvatarItem[]`
  - `stripLockedAvatarItems(config, fallback, wins, entitlements?) -> AvatarConfigV2`
  - `PlayerAccount.entitlements?: string[]`

- [ ] **Step 1: Write failing tests in `ui/src/config/avatarCatalog.test.ts`**

Add Vitest tests verifying:
1. V1 config (`{ skin: "warm", eyes: "sharp", hair: "short", hairColor: "navy", outfit: "captain", outfitColor: "royal", frame: "wood" }`) upgrades seamlessly via `resolveAvatarConfig` to `version: 2` preserving colors (`colors.skin`, `colors.hair`, `colors.outfitPrimary`) and slot mappings (`eyeStyle`, `outfit`, `frame`).
2. `findLockedAvatarItems` flags `vip` items when absent from `entitlements`, flags `earnable` items when `wins < requiredWins`, and clears them when present in `entitlements`.
3. `stripLockedAvatarItems` replaces only locked slots with `fallback` (or unlocked starter default) while keeping unlocked items AND custom `colors`.
4. `randomizeUnlockedAvatar(wins, entitlements)` never selects an item whose requirement is unmet or `vip` not owned.

- [ ] **Step 2: Run Vitest on `avatarCatalog.test.ts` to verify failure**

Run: `Set-Location ui; npx vitest run src/config/avatarCatalog.test.ts`  
Expected: FAIL (`findLockedAvatarItems is not exported`).

- [ ] **Step 3: Update `ui/src/utils/api.types.ts` and `ui/src/config/avatarCatalog.ts`**

Implement full V2 types, `AVATAR_COLOR_SWATCHES` (curated skins, hairs, eyes, cloth primary/secondary, trim metals, mount coats + hex regex validation), `AVATAR_CATALOG_ITEMS` matching Task 1 backend definitions 1-for-1 (including `modelPath` under `/assets/models/avatars/...` and bilingual `label`/`labelEn`), 6 updated Island Archetypes V2, `resolveAvatarConfig`, `findLockedAvatarItems`, `stripLockedAvatarItems`, and `sanitizeAvatarConfig`.

- [ ] **Step 4: Update `ui/src/utils/apiClient.ts` and `ui/src/utils/localEngine.ts`**

- Add `entitlements?: string[]` to `PlayerAccount` and `LockedAvatarItem[]` extraction on `403` responses in `updateProfile`.
- Update `LocalUserRecord` and `localUpdateProfile` in `localEngine.ts` to check `findLockedAvatarItems(merged, wins, existing.entitlements ?? [])`, throwing HTTP-compatible `{ response: { status: 403, data: { description, locked_items } } }` if locked, and preserving `version: 2`, `colors`, and validated `portraitSnapshot`.

- [ ] **Step 5: Run Vitest & TypeScript check**

Run: `Set-Location ui; npx vitest run src/config/avatarCatalog.test.ts; npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add ui/src/utils/api.types.ts ui/src/config/avatarCatalog.ts ui/src/config/avatarCatalog.test.ts ui/src/utils/apiClient.ts ui/src/utils/localEngine.ts
git commit -m "feat(ui): upgrade avatar catalog to V2 with color channels and VIP entitlements"
```

---

### Task 3: Three.js Dependency, Starter `.glb` Asset Generator & Creator Guide

**Files:**
- Modify: `ui/package.json` (`three`, `@types/three`)
- Create: `ui/scripts/build_starter_3d_assets.mjs`
- Create: `ui/public/assets/models/avatars/**` (starter `.glb` files generated by script)
- Create: `docs/AVATAR_3D_ASSET_GUIDE.md`
- Test: `ui/scripts/verify_starter_3d_assets.mjs` (Node verification check)

**Interfaces:**
- Produces:
  - `.glb` files matching every starter catalog `modelPath` under `ui/public/assets/models/avatars/`, each containing valid glTF 2.0 binary meshes and reserved material names (`mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount`) aligned to standard meters coordinates (`height ~1.75m`, `Y=0` at feet).
  - `npm run build:avatars3d` script in `ui/package.json` for deterministic regeneration.

- [ ] **Step 1: Install `three` and `@types/three`**

Run: `Set-Location ui; npm install three && npm install -D @types/three`  
Expected: `three` and `@types/three` added cleanly to `ui/package.json` with zero React 19 peer dependency conflicts.

- [ ] **Step 2: Write `ui/scripts/verify_starter_3d_assets.mjs` (failing first)**

Script reads `AVATAR_MODEL_MANIFEST` (expected `.glb` paths + required material names per category), parses each `.glb` header (`glTF` magic `0x46546C67`) and JSON chunk, and asserts every required `.glb` exists, is non-empty, has `buffers`/`meshes`, and exposes the expected named materials (`mat_*`). Run it first to observe FAIL (missing `.glb` files).

- [ ] **Step 3: Implement `ui/scripts/build_starter_3d_assets.mjs`**

Using `three` (`BufferGeometry`, `LatheGeometry`, `ExtrudeGeometry` with bevels, `TubeGeometry`, `MeshStandardMaterial`, and `GLTFExporter` from `three/examples/jsm/exporters/GLTFExporter.js` with minimal Node `FileReader`/Blob shim or direct glTF 2.0 JSON+BIN `.glb` packer), generate sculpted stylized starter assets (NOT crude boxes — bevelled armor plates, lathe-turned spyglass/crowns/pedestals, organic sculpted torso/cape curves, feathered tricorne/crowned helms, perched shoulder parrot/falcon silhouettes, horse/wolf/griffin starter mounts) in `ui/public/assets/models/avatars/`.
Run: `Set-Location ui; node scripts/build_starter_3d_assets.mjs; node scripts/verify_starter_3d_assets.mjs`  
Expected: All starter `.glb` files created and verified (`PASS`).

- [ ] **Step 4: Write `docs/AVATAR_3D_ASSET_GUIDE.md`**

Document exact coordinate scale (`1.75m`, `Y=0` floor, `Z+` front), bone socket positions (`socket_head`, `socket_torso`, `socket_legs`, `socket_cape`, `socket_hand_r`, `socket_back`, `socket_shoulder_l`, `socket_mount`, `socket_pedestal`), reserved material names (`mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount`), and the complete free + Google One workflow (**Gemini/Nano Banana Pro -> Hunyuan3D/Tripo3D/Meshy -> Blender export `.glb` -> drop in folder**).

- [ ] **Step 5: Commit Task 3**

```bash
git add ui/package.json ui/package-lock.json ui/scripts/build_starter_3d_assets.mjs ui/scripts/verify_starter_3d_assets.mjs ui/public/assets/models/avatars docs/AVATAR_3D_ASSET_GUIDE.md
git commit -m "feat(3d-assets): add starter modular GLB generator, verified assets, and creator guide"
```

---

### Task 4: Three.js Modular Engine, Universal Material Recolor & Snapshot Capture

**Files:**
- Create: `ui/src/components/avatar3d/materialTint.ts`
- Create: `ui/src/components/avatar3d/sceneComposer.ts`
- Create: `ui/src/components/avatar3d/Avatar3DCanvas.tsx`
- Create: `ui/src/components/avatar3d/Avatar3DCanvas.scss`
- Test: `ui/src/components/avatar3d/materialTint.test.ts`
- Test: `ui/src/components/avatar3d/Avatar3DCanvas.test.tsx`

**Interfaces:**
- Produces:
  - `applyAvatarMaterials(root: THREE.Object3D, colors: AvatarColors): void`
  - `isWebGLSupported(): boolean`
  - `Avatar3DCanvasHandle` (`capturePortraitSnapshot(): string | null`)
  - `<Avatar3DCanvas config={AvatarConfigV2} mode="studio" | "hero" | "card" cameraFocus="full" | "portrait" interactive={boolean} ref={...} />`

- [ ] **Step 1: Write failing tests (`materialTint.test.ts` & `Avatar3DCanvas.test.tsx`)**

Test that:
- `applyAvatarMaterials` converts `mat_skin.001`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount` on a `THREE.Group` to exact hex colors without mutating unrelated material names (`mat_fixed_stone`).
- `Avatar3DCanvas` renders safely in jsdom (where `isWebGLSupported()` is `false`) showing `[data-testid="avatar-3d-fallback"]` with `PlayerAvatar` / stylized card and never throws WebGL errors.

- [ ] **Step 2: Run Vitest to confirm tests fail**

Run: `Set-Location ui; npx vitest run src/components/avatar3d/`  
Expected: FAIL (`Cannot find module './materialTint'`).

- [ ] **Step 3: Implement `materialTint.ts`, `sceneComposer.ts`, `Avatar3DCanvas.tsx` and `.scss`**

- `materialTint.ts`: clones shared materials per instance and tints `MeshStandardMaterial` color/metalness cleanly for reserved names.
- `sceneComposer.ts`: builds `THREE.Scene` with *Rule the Isle* lighting (`key #ffd27d`, `fill #38bdf8`, `rim #f59e0b`), loads `.glb` parts in parallel via cached `GLTFLoader` + `DRACOLoader` into named socket `THREE.Group`s, attaches subtle idle breathing oscillation and VIP aura ring/particles (`sun_motes`, `sea_mist`, `imperial_flame`), and disposes cleanly on unmount.
- `Avatar3DCanvas.tsx`: exposes `useImperativeHandle` with `capturePortraitSnapshot()` which temporarily frames the `portrait` camera onto the head/bust, renders 1 frame with `preserveDrawingBuffer: true`, exports `canvas.toDataURL("image/webp", 0.86)` (checking `<= 65536` chars, falling back to scale/quality adjustment if needed), and restores previous camera seamlessly. Wrapped in graceful fallback when WebGL is unavailable.

- [ ] **Step 4: Run Vitest & TypeScript check**

Run: `Set-Location ui; npx vitest run src/components/avatar3d/; npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add ui/src/components/avatar3d/
git commit -m "feat(avatar3d): add Three.js modular socket composer, runtime recolor, and WebP snapshot"
```

---

### Task 5: 3D Avatar Studio Modal, Live Color Swatches & Try-On VIP Flow

**Files:**
- Modify: `ui/src/components/AvatarStudioModal.tsx`
- Modify: `ui/src/components/AvatarStudioModal.scss`
- Modify: `ui/src/components/AvatarStudioModal.test.tsx`

**Interfaces:**
- Consumes: `Avatar3DCanvas` (lazy-loaded via `React.lazy`), `AVATAR_CATALOG_ITEMS`, `AVATAR_COLOR_SWATCHES`, `findLockedAvatarItems`, `stripLockedAvatarItems`.
- Preserves existing props signature (`open`, `onClose`, `account`, `guestProfile`, `onSaved`, `onGuestSaved`) so `HomePage` and `RoomLobbyPage` keep full compatibility.

- [ ] **Step 1: Update/expand tests in `ui/src/components/AvatarStudioModal.test.tsx`**

Keep verification for existing behaviors (preset click, win threshold lock badges, display name validation, randomizer) and add new tests:
1. All 7 modular tabs render (`Corpo & Rosto`, `Cabelo & Barba`, `Vestimenta`, `Adereços`, `Montarias & Pets`, `Palco & Auras`, `🏆 Molduras`).
2. Changing color swatches (`Pele`, `Cabelo`, `Roupa`) updates draft `colors` sent to `updateProfile`.
3. **Try-On Flow (Option A):** Clicking a locked VIP mount (`Grifo Imperial`) equips it in preview mode (`Modo Provador`) without blocking the click; clicking `Salvar Perfil` opens the Try-On lock summary showing *"Remover bloqueados e salvar"* and *"Continuar no provador"*; clicking *"Remover bloqueados e salvar"* strips only `imperial_griffin` back to unlocked default while keeping user color changes and calls `updateProfile`.

- [ ] **Step 2: Run Vitest to confirm new Studio tests fail**

Run: `Set-Location ui; npx vitest run src/components/AvatarStudioModal.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement `AvatarStudioModal.tsx` & `AvatarStudioModal.scss`**

- Left column: lazy `<Avatar3DCanvas mode="studio" cameraFocus={cameraFocus} ... />`, `Corpo Inteiro / Rosto` toggle, Try-On active pill when `lockedItems.length > 0`, **Cores Livres** swatch & custom hex color panel (`skin`, `hair`, `eyes`, `outfitPrimary`, `outfitSecondary`, `outfitTrim`, `mount`), display name field, `🎲 Aleatório` and 6 Island Archetypes V2.
- Right column: 7 tabs + filter bar (`Todos` / `Desbloqueados` / `👑 VIP`), rarity/tier badges (`Grátis`, `🏆 X Vitórias`, `👑 VIP`), clickable cards even when locked (Try-On!), and lock-resolution confirmation drawer on save.
- On clean save, invokes `avatar3dRef.current?.capturePortraitSnapshot()` and attaches `portraitSnapshot` when non-null.

- [ ] **Step 4: Run Vitest & TypeScript check**

Run: `Set-Location ui; npx vitest run src/components/AvatarStudioModal.test.tsx; npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add ui/src/components/AvatarStudioModal.tsx ui/src/components/AvatarStudioModal.scss ui/src/components/AvatarStudioModal.test.tsx
git commit -m "feat(studio): upgrade AvatarStudioModal with 3D Try-On, 7 slots, and live color swatches"
```

---

### Task 6: Emblem Snapshot Renderer, Home 3D Hero Stage, Lobby 4-Card Showcase & Full Verification

**Files:**
- Modify: `ui/src/components/PlayerAvatar.tsx` & `ui/src/components/PlayerAvatar.scss`
- Modify: `ui/src/pages/HomePage.tsx` & `ui/src/pages/HomePage.scss`
- Modify: `ui/src/pages/RoomLobbyPage.tsx` & `ui/src/pages/RoomLobbyPage.scss`
- Test: `ui/src/components/PlayerTopBar.test.tsx`, `ui/src/pages/GameScreen.test.tsx` (verify/update if needed, zero regressions)

**Interfaces:**
- Consumes: `Avatar3DCanvas` (lazy-loaded on `HomePage` and `RoomLobbyPage`), `PlayerAvatar` (enhanced 2D snapshot/SVG emblem).

- [ ] **Step 1: Write failing tests for snapshot emblem rendering & Home/Lobby integration**

Add tests in `AvatarStudioModal.test.tsx` (or `PlayerAvatar.test.tsx`) confirming:
- `PlayerAvatar` renders `<img src={portraitSnapshot} ... />` inside its frame when `config.portraitSnapshot` is a valid `data:image/webp;base64,...` string, and falls back to SVG when absent or invalid.
- Renders `vip_dragon` frame styling class cleanly.

- [ ] **Step 2: Run Vitest to confirm failure**

Run: `Set-Location ui; npx vitest run src/components/AvatarStudioModal.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Upgrade `PlayerAvatar.tsx` & `PlayerAvatar.scss`**

- Support `portraitSnapshot` rendering inside the circular/hexagonal frame (`img.player-avatar__snapshot`) with frame tiers `wood`, `bronze`, `silver`, `gold`, `imperial`, and `vip_dragon`.
- Upgrade SVG fallback face geometry (eyes with sclera/iris/eyelid, contoured jaw, shaded nose, expressive mouth) so even bots/guests without snapshots look markedly sharper.

- [ ] **Step 4: Add Full-Body 3D Stage to `HomePage.tsx` & 4 Vertical Hero Cards to `RoomLobbyPage.tsx`**

- In `HomePage.tsx`: populate `.home-stage-window` with lazy `<Avatar3DCanvas mode="hero" config={activeAvatarConfig} />` + subtle floating name plate & `"🎨 Estúdio 3D"` click action on hover, preserving top-left `home-identity-pill` emblem and bottom mode dock.
- In `RoomLobbyPage.tsx`: render the 4 seats in a **4-card vertical hero showcase** (`lobby-hero-cards`) framed in obsidian-navy & antique gold above/integrated with seat selector controls, displaying lazy 3D/full-body character previews for occupied seats and sleek `"Vaga Aberta"` emblem cards for open seats.

- [ ] **Step 5: Run Full Regression Suite (Backend + Frontend + Build + Live Browser Check)**

1. Backend pytest:
   `.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v`
2. Frontend TypeScript, Vitest, Production Vite Build:
   `Set-Location ui; npx tsc --noEmit; npx vitest run; npm run build`
3. Verify chunk splitting cleanly separates Three.js lazy chunk from main board bundle in `vite build` output.
4. Live browser verification on `http://localhost:3000`: Home 3D Hero Stage, Avatar Studio 3D (change colors + Try-On VIP lock prompt + save), Lobby 4 Hero Cards, and Board Match (`PlayerTopBar` 2D snapshot emblem, zero WebGL contexts active).

- [ ] **Step 6: Commit Task 6**

```bash
git add ui/src/components/PlayerAvatar.tsx ui/src/components/PlayerAvatar.scss ui/src/pages/HomePage.tsx ui/src/pages/HomePage.scss ui/src/pages/RoomLobbyPage.tsx ui/src/pages/RoomLobbyPage.scss
git commit -m "feat(ui): integrate 3D Home stage, Lobby hero cards, and 2D snapshot emblem"
```

---

## Self-Review Check (writing-plans)
1. **Spec coverage:**
   - Dual-Render (3D Home/Lobby/Studio + 2D WebP Snapshot Emblem in gameplay): Tasks 4, 5, 6.
   - Bone sockets & named material universal recolor (`mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount`): Tasks 3, 4.
   - Backward compatibility V1->V2: Tasks 1, 2.
   - Neon Postgres `user_entitlements` + server-authoritative `403` `locked_items`: Task 1.
   - Try-On VIP Studio UX (Option A): Task 5.
   - Starter `.glb` kit + free/Google One asset guide: Task 3.
2. **Placeholder scan:** No `TBD`/`TODO` left; every test file, function name, route, material name, and command is explicit.
3. **Type consistency:** `AvatarConfigV2`, `AvatarColors`, `LockedAvatarItem`, `portraitSnapshot`, `entitlements`, `applyAvatarMaterials`, `Avatar3DCanvas` match identically across Tasks 1–6.
