# Bloco 3 — Redesign da Tela Inicial (Palco Aberto A2) e Lobby Aberto Modular Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign [`HomePage`](ui/src/pages/HomePage.tsx) into an open panoramic showcase (Layout **A2**) over `lobby_hero.webp` with symmetric 3-column header (`PlayerAvatar` identity, monumental `RULE THE ISLE` title, live `#rank` scoreboard), 5 dedicated bottom-dock mode actions, modular [`AuthModal`](ui/src/components/home/AuthModal.tsx), [`MatchSetupModal`](ui/src/components/home/MatchSetupModal.tsx), and [`OpenLobbyModal`](ui/src/components/home/OpenLobbyModal.tsx), plus backend + offline `leaderboard_rank` computation.

**Architecture:** Extract [`_build_leaderboard_rows`](catanatron/catanatron/web/models.py) and expose top-level `leaderboard_rank` on serialized accounts in [`models.py`](catanatron/catanatron/web/models.py) and [`localEngine.ts`](ui/src/utils/localEngine.ts) without changing existing 4-key `stats` payloads. Refactor [`HomePage.tsx`](ui/src/pages/HomePage.tsx) to manage only stage orchestration while delegating login, solo/online match setup, and live open lobby browsing (including seat `<PlayerAvatar />` rendering) to focused dialog components in `ui/src/components/home/`.

**Tech Stack:** Python 3.12+ (Flask, SQLAlchemy, pytest), React 19, TypeScript, Vite 6, MUI v5/v6 Dialog/Controls, SCSS, Vitest + Testing Library.

## Global Constraints

- Stay on branch `layout-topbar` at `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1`; do **NOT** merge to `main` or `git push`.
- All visible UI copy, labels, errors, tooltips, tests for UI copy, and docs must be in **Brazilian Portuguese (`pt-BR`)**, keeping brand name **Rule the Isle**.
- Keep [`Lobby Hero`](ui/public/assets/illustrations/ui/lobby_hero.webp) center unobstructed: no `.setup-card` overlay covering the central island; edge-only vignette gradients.
- Do **NOT** break existing API contracts (`me["stats"]` must remain `{wins, losses, games_played, win_rate}`; expose `leaderboard_rank` as a sibling field on the user payload).
- Preserve all unrelated comments and docstrings.

---

### Task 1: Backend `leaderboard_rank` & API Tests

**Files:**
- Modify: `catanatron/catanatron/web/models.py:503-517`, `catanatron/catanatron/web/models.py:863-912`
- Modify: `catanatron/catanatron/web/api.py:229-244`
- Test: `tests/web/test_auth_and_ranking.py`

**Interfaces:**
- Produces in `catanatron/catanatron/web/models.py`:
  - `get_user_rank(username: str) -> int | None`
  - `serialize_user(user: StoredUser, stats: dict | None = None) -> dict` — adds `"leaderboard_rank": int | None` at top level when `stats is not None`.
- Updates in `catanatron/catanatron/web/api.py`:
  - `post_auth_register_endpoint` passes `get_user_stats(user.username)` to `serialize_user(...)` so newly registered users immediately receive `stats` and `leaderboard_rank`.
- Consumed by: Task 2 (`apiClient.ts` types) and Task 5 (`HomePage.tsx` right header pill `#<rank> no Ranking`).

- [ ] **Step 1: Write the failing test in `tests/web/test_auth_and_ranking.py`**

Read the end of `tests/web/test_auth_and_ranking.py` first to verify exact imports and trailing lines, then append:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1`:
```powershell
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web/test_auth_and_ranking.py -k "leaderboard_rank" -v
```
Expected: FAIL with `KeyError: 'leaderboard_rank'`.

- [ ] **Step 3: Implement `_build_leaderboard_rows()`, `get_user_rank()`, and update `serialize_user()` in `catanatron/catanatron/web/models.py`**

In `catanatron/catanatron/web/models.py`:

1. Extract `_build_leaderboard_rows()` and add `get_user_rank(username: str)` right around lines 863-912:

```python
def _build_leaderboard_rows() -> list[dict]:
    users = db.session.query(StoredUser).all()
    participants = (
        db.session.query(StoredMatchParticipant).filter_by(seat_kind="USER").all()
    )
    counts: dict[str, list[int]] = {}
    for p in participants:
        if not p.username:
            continue
        bucket = counts.setdefault(p.username, [0, 0])  # [wins, games]
        bucket[1] += 1
        if p.is_winner:
            bucket[0] += 1

    board = []
    for u in users:
        wins, games_played = counts.get(u.username, [0, 0])
        losses = max(0, games_played - wins)
        win_rate = (
            round((wins / games_played) * 100.0, 1) if games_played > 0 else 0.0
        )
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

    board.sort(
        key=lambda item: (
            -item["wins"],
            -item["win_rate"],
            -item["games_played"],
            item["username"],
        )
    )
    for idx, entry in enumerate(board, start=1):
        entry["rank"] = idx
    return board


def get_leaderboard(limit: int = 100) -> list[dict]:
    return _build_leaderboard_rows()[:limit]


def get_user_rank(username: str) -> int | None:
    clean = _normalize_username(username)
    if not clean:
        return None
    for row in _build_leaderboard_rows():
        if row["username"] == clean:
            return int(row["rank"])
    return None
```

2. Update `serialize_user(user: StoredUser, stats: dict | None = None) -> dict` (lines 503-517):

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
        payload["leaderboard_rank"] = get_user_rank(user.username)
    return payload
```

3. In `catanatron/catanatron/web/api.py:241` inside `post_auth_register_endpoint()`, pass `get_user_stats(user.username)`:

```python
    payload = serialize_user(user, get_user_stats(user.username))
```

- [ ] **Step 4: Run full web pytest suite to verify pass and backward compatibility**

Run:
```powershell
.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v
```
Expected: All existing tests + new `test_auth_endpoints_expose_leaderboard_rank_without_altering_stats_keys` PASS (`42 passed`).

- [ ] **Step 5: Commit Task 1**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add catanatron/catanatron/web/models.py catanatron/catanatron/web/api.py tests/web/test_auth_and_ranking.py
git commit -m "feat(home-api): expose leaderboard_rank in serialized user account"
```

---

### Task 2: Frontend `PlayerAccount.leaderboard_rank` & Offline Mirror Hydration

**Files:**
- Modify: `ui/src/utils/apiClient.ts:53-62`, `ui/src/utils/apiClient.ts:187-210`
- Modify: `ui/src/utils/localEngine.ts:1452-1612`
- Test: `ui/src/utils/apiClient.test.ts`

**Interfaces:**
- Produces:
  - `PlayerAccount` in `ui/src/utils/apiClient.ts` includes `leaderboard_rank?: number | null`.
  - `localGetUserRankAndStats(username: string): { leaderboard_rank: number | null; stats: AccountStats }` exported from `ui/src/utils/localEngine.ts`.
  - `localRegisterUser`, `localLoginUser`, `localUpdateProfile` populate `stats` and `leaderboard_rank`.
  - `fetchCurrentAccount` in `ui/src/utils/apiClient.ts` hydrates `stats` and `leaderboard_rank` in offline fallback when server fails with non-401 error.
- Consumed by: Task 5 (`HomePage.tsx`).

- [ ] **Step 1: Write failing test in `ui/src/utils/apiClient.test.ts`**

Read the bottom of `ui/src/utils/apiClient.test.ts` (`lines 190-203`), ensure `fetchCurrentAccount`, `getSavedAccount` are imported at the top from `"./apiClient"` and `localGetUserRankAndStats` from `"./localEngine"`, then append inside `describe(...)`:

```ts
  test("computes offline leaderboard_rank and stats on register, login, update and fetchCurrentAccount", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Offline"));

    const bruno = await registerAccount({
      username: "bruno_rank",
      password: "pw1234",
      displayName: "Bruno",
    });
    expect(bruno.leaderboard_rank).toBe(1);
    expect(bruno.stats).toEqual({
      wins: 0,
      losses: 0,
      games_played: 0,
      win_rate: 0,
    });

    localRecordCompletedMatch({
      game_id: "g-bruno-win",
      mode: "SOLO",
      map_template: "BASE",
      vps_to_win: 10,
      num_turns: 20,
      winning_color: "RED",
      winner_name: "Bruno",
      winner_username: "bruno_rank",
      winner_is_bot: false,
      participants: [
        {
          color: "RED",
          seat_kind: "USER",
          username: "bruno_rank",
          player_key: "HUMAN",
          display_name: "Bruno",
          victory_points: 10,
          is_winner: true,
        },
        {
          color: "BLUE",
          seat_kind: "BOT",
          username: null,
          player_key: "CATANATRON",
          display_name: "IA (CATANATRON)",
          victory_points: 6,
          is_winner: false,
        },
      ],
    });

    vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("Offline"));
    const hydrated = await fetchCurrentAccount();
    expect(hydrated?.leaderboard_rank).toBe(1);
    expect(hydrated?.stats).toMatchObject({
      wins: 1,
      games_played: 1,
      win_rate: 100,
    });

    const direct = localGetUserRankAndStats("bruno_rank");
    expect(direct.leaderboard_rank).toBe(1);
    expect(getSavedAccount()?.leaderboard_rank).toBe(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui`:
```powershell
npx vitest run src/utils/apiClient.test.ts
```
Expected: FAIL because `localGetUserRankAndStats` is not exported and `leaderboard_rank` is `undefined`.

- [ ] **Step 3: Implement `leaderboard_rank` in `ui/src/utils/apiClient.ts` and `ui/src/utils/localEngine.ts`**

1. In `ui/src/utils/api.types.ts` check `AccountStats` is imported into `localEngine.ts` (update line 1-19 import list in `ui/src/utils/localEngine.ts` to include `AccountStats`).

2. In `ui/src/utils/apiClient.ts`:
- Import `localGetUserRankAndStats` from `"./localEngine"`.
- Add `leaderboard_rank?: number | null;` to `PlayerAccount` (around lines 53-62):
```ts
export type PlayerAccount = {
  username: string;
  display_name: string;
  auth_token: string;
  has_google?: boolean;
  avatar_config?: Partial<AvatarConfig>;
  stats?: AccountStats;
  leaderboard_rank?: number | null;
  is_new?: boolean;
};
```
- Update `fetchCurrentAccount()` (around lines 187-210) so network fallback hydrates offline rank & stats and persists the hydrated snapshot:
```ts
export async function fetchCurrentAccount(): Promise<PlayerAccount | null> {
  const saved = getSavedAccount();
  if (!saved?.auth_token) return null;
  try {
    const response = await axios.get<PlayerAccount>(`${API_URL}/api/auth/me`, {
      headers: authHeaders(saved.auth_token),
    });
    if (response.data?.username) {
      const merged: PlayerAccount = {
        ...saved,
        ...response.data,
        auth_token: saved.auth_token,
      };
      saveAccount(merged);
      return merged;
    }
  } catch (err: any) {
    if (err?.response?.status === 401) {
      clearSavedAccount();
      return null;
    }
  }
  const offline = localGetUserRankAndStats(saved.username);
  const hydrated: PlayerAccount = {
    ...saved,
    stats: offline.stats,
    leaderboard_rank: offline.leaderboard_rank,
  };
  saveAccount(hydrated);
  return hydrated;
}
```

3. In `ui/src/utils/localEngine.ts`:
- Export `localGetUserRankAndStats(username: string)` right above `localRegisterUser` (around line 1451):
```ts
export function localGetUserRankAndStats(username: string): {
  leaderboard_rank: number | null;
  stats: AccountStats;
} {
  const cleanUser = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  if (!cleanUser) {
    return {
      leaderboard_rank: null,
      stats: { wins: 0, losses: 0, games_played: 0, win_rate: 0 },
    };
  }
  const lb = localGetLeaderboard();
  const row = lb.find((e) => e.username === cleanUser);
  if (!row) {
    return {
      leaderboard_rank: null,
      stats: { wins: 0, losses: 0, games_played: 0, win_rate: 0 },
    };
  }
  return {
    leaderboard_rank: row.rank,
    stats: {
      wins: row.wins,
      losses: row.losses,
      games_played: row.games_played,
      win_rate: row.win_rate,
    },
  };
}
```
- Update `localRegisterUser`, `localLoginUser`, and `localUpdateProfile` in `ui/src/utils/localEngine.ts`:
```ts
// In localRegisterUser (after saving users to LOCAL_USERS_KEY):
  const rankMeta = localGetUserRankAndStats(cleanUser);
  return {
    username: cleanUser,
    display_name,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: {},
    stats: rankMeta.stats,
    leaderboard_rank: rankMeta.leaderboard_rank,
    is_new: true,
  };
```
```ts
// In localLoginUser:
  const rankMeta = localGetUserRankAndStats(existing.username);
  return {
    username: existing.username,
    display_name: existing.display_name,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: sanitizeAvatarConfig(existing.avatar_config),
    stats: rankMeta.stats,
    leaderboard_rank: rankMeta.leaderboard_rank,
    is_new: false,
  };
```
```ts
// In localUpdateProfile return object (reusing statsEntry):
  return {
    username: cleanUser,
    display_name: nextDisplay,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: mergedAvatar,
    leaderboard_rank: statsEntry?.rank ?? null,
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
```
Also ensure `localUpdateProfile` syncs `leaderboard_rank` when writing `"catan_player_account"` to `localStorage` (lines 1584-1591):
```ts
          ...saved,
          display_name: nextDisplay,
          avatar_config: mergedAvatar,
          leaderboard_rank: statsEntry?.rank ?? saved.leaderboard_rank ?? null,
```

- [ ] **Step 4: Run TypeScript check and `apiClient.test.ts`**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui`:
```powershell
npx tsc --noEmit
npx vitest run src/utils/apiClient.test.ts
```
Expected: `0` TypeScript errors and all tests in `apiClient.test.ts` PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/utils/apiClient.ts ui/src/utils/localEngine.ts ui/src/utils/apiClient.test.ts
git commit -m "feat(home-core): add leaderboard_rank to PlayerAccount and offline engine mirror"
```

---

### Task 3: Modular `AuthModal` and `MatchSetupModal` + Tests

**Files:**
- Create: `ui/src/components/home/AuthModal.tsx`
- Create: `ui/src/components/home/AuthModal.scss`
- Create: `ui/src/components/home/AuthModal.test.tsx`
- Create: `ui/src/components/home/MatchSetupModal.tsx`
- Create: `ui/src/components/home/MatchSetupModal.scss`
- Create: `ui/src/components/home/MatchSetupModal.test.tsx`

**Interfaces:**
- Produces `AuthModal`:
  ```ts
  export type AuthModalProps = {
    open: boolean;
    onClose: () => void;
    authConfig: AuthConfig;
    promptBanner?: string;
    onAuthenticated: (account: PlayerAccount) => void;
  };
  ```
- Produces `MatchSetupModal`:
  ```ts
  export type MatchSetupMode = "solo" | "room" | null;
  export type MatchSetupModalProps = {
    mode: MatchSetupMode;
    onClose: () => void;
    availablePlayers: PlayerEntry[];
    defaultHostName: string;
    account: PlayerAccount | null;
    onGameCreated: (gameId: string) => void;
    onRoomCreated: (roomCode: string) => void;
  };
  ```
- Consumed by: Task 5 (`HomePage.tsx`).

- [ ] **Step 1: Write failing tests `AuthModal.test.tsx` and `MatchSetupModal.test.tsx`**

Create `ui/src/components/home/AuthModal.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import AuthModal from "./AuthModal";
import {
  loginAccount,
  registerAccount,
  type PlayerAccount,
} from "../../utils/apiClient";

vi.mock("../../utils/apiClient", () => ({
  loginAccount: vi.fn(),
  registerAccount: vi.fn(),
  loginWithGoogle: vi.fn(),
}));

vi.mock("../GoogleSignInButton", () => ({
  default: () => <div data-testid="google-signin-mock" />,
}));

afterEach(() => {
  cleanup();
});

const loggedSample: PlayerAccount = {
  username: "ana",
  display_name: "Ana",
  auth_token: "sess_ana",
  leaderboard_rank: 2,
};

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("validates credentials, shows promptBanner, logs in and notifies parent", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onAuthenticated = vi.fn();
    vi.mocked(loginAccount).mockResolvedValueOnce(loggedSample);

    render(
      <AuthModal
        open={true}
        onClose={onClose}
        authConfig={{ google_enabled: false, google_client_id: null }}
        promptBanner="Entre ou crie uma conta grátis para personalizar seu avatar."
        onAuthenticated={onAuthenticated}
      />
    );

    expect(
      screen.getByText(/Entre ou crie uma conta grátis para personalizar seu avatar\./i)
    ).toBeInTheDocument();

    // Tentar enviar sem usuário mostra validação
    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));
    expect(screen.getByText(/Informe seu nome de usuário\./i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Usuário/i), "ana");
    await user.type(screen.getByPlaceholderText(/^Senha$/i), "1234");
    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));

    expect(loginAccount).toHaveBeenCalledWith({
      username: "ana",
      password: "1234",
    });
    expect(onAuthenticated).toHaveBeenCalledWith(loggedSample);
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 15000);

  test("switches to Criar Conta tab and surfaces API registration error cleanly", async () => {
    const user = userEvent.setup();
    vi.mocked(registerAccount).mockRejectedValueOnce({
      response: { data: { description: "Este nome de usuário já está cadastrado." } },
    });

    render(
      <AuthModal
        open={true}
        onClose={vi.fn()}
        authConfig={{ google_enabled: true, google_client_id: "gid-123" }}
        onAuthenticated={vi.fn()}
      />
    );

    expect(screen.getByTestId("google-signin-mock")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Criar Conta$/i }));
    await user.type(screen.getByPlaceholderText(/Usuário/i), "joao");
    await user.type(screen.getByPlaceholderText(/Apelido na mesa/i), "João");
    await user.type(screen.getByPlaceholderText(/Senha \(mín 4/i), "123456");

    const submitButtons = screen.getAllByRole("button", { name: /^Criar Conta$/i });
    await user.click(submitButtons[submitButtons.length - 1]);

    expect(
      await screen.findByText(/Este nome de usuário já está cadastrado\./i)
    ).toBeInTheDocument();
  }, 15000);
});
```

Create `ui/src/components/home/MatchSetupModal.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import MatchSetupModal from "./MatchSetupModal";
import {
  createGame,
  createRoom,
  DEFAULT_PLAYERS,
} from "../../utils/apiClient";

vi.mock("../../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/apiClient")>();
  return {
    ...actual,
    createGame: vi.fn(),
    createRoom: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("MatchSetupModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates solo match with selected map and players", async () => {
    const user = userEvent.setup();
    const onGameCreated = vi.fn();
    vi.mocked(createGame).mockResolvedValueOnce("game-abc");

    render(
      <MatchSetupModal
        mode="solo"
        onClose={vi.fn()}
        availablePlayers={DEFAULT_PLAYERS}
        defaultHostName="Anfitrião"
        account={null}
        onGameCreated={onGameCreated}
        onRoomCreated={vi.fn()}
      />
    );

    expect(screen.getByText(/Modelo do Mapa/i)).toBeInTheDocument();
    expect(screen.getByText(/Pontos para Vencer/i)).toBeInTheDocument();
    expect(screen.getByText(/Limite de Cartas/i)).toBeInTheDocument();
    expect(screen.getByText(/^Jogadores na Mesa$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /MINI \(RÁPIDO\)/i }));
    await user.click(screen.getByRole("button", { name: /Iniciar Partida/i }));

    expect(createGame).toHaveBeenCalledWith({
      players: ["HUMAN", "CATANATRON", "CATANATRON", "CATANATRON"],
      mapTemplate: "MINI",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    expect(onGameCreated).toHaveBeenCalledWith("game-abc");
  }, 15000);

  test("creates online room guaranteeing at least 2 human slots and saving seat token", async () => {
    const user = userEvent.setup();
    const onRoomCreated = vi.fn();
    vi.mocked(createRoom).mockResolvedValueOnce({
      room_code: "K7M4P9",
      seat_token: "seat-tok-1",
      room: {
        room_code: "K7M4P9",
        status: "WAITING",
        game_id: null,
        is_host: true,
        my_color: "RED",
        config: {
          map_template: "BASE",
          vps_to_win: 10,
          discard_limit: 7,
          friendly_robber: true,
        },
        seats: [],
      },
    });

    render(
      <MatchSetupModal
        mode="room"
        onClose={vi.fn()}
        availablePlayers={DEFAULT_PLAYERS}
        defaultHostName="João"
        account={{
          username: "joao",
          display_name: "João",
          auth_token: "sess_joao",
        }}
        onGameCreated={vi.fn()}
        onRoomCreated={onRoomCreated}
      />
    );

    expect(screen.getByLabelText(/Seu Apelido na Mesa/i)).toHaveValue("João");
    await user.click(screen.getByRole("button", { name: /Criar Sala e Gerar Link/i }));

    expect(createRoom).toHaveBeenCalledWith({
      hostName: "João",
      players: ["HUMAN", "HUMAN", "CATANATRON", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
      token: "sess_joao",
    });
    expect(localStorage.getItem("catan_room_token_K7M4P9")).toBe("seat-tok-1");
    expect(onRoomCreated).toHaveBeenCalledWith("K7M4P9");
  }, 15000);

  test("surfaces error message cleanly if creation fails without trapping in loading", async () => {
    const user = userEvent.setup();
    vi.mocked(createGame).mockRejectedValueOnce(new Error("Falha de rede"));

    render(
      <MatchSetupModal
        mode="solo"
        onClose={vi.fn()}
        availablePlayers={DEFAULT_PLAYERS}
        defaultHostName="Anfitrião"
        account={null}
        onGameCreated={vi.fn()}
        onRoomCreated={vi.fn()}
      />
    );

    const startBtn = screen.getByRole("button", { name: /Iniciar Partida/i });
    await user.click(startBtn);

    expect(
      await screen.findByText(/Não foi possível iniciar a partida\./i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar Partida/i })).toBeEnabled();
  }, 15000);
});
```

- [ ] **Step 2: Run new modal tests to confirm they fail**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui`:
```powershell
npx vitest run src/components/home/AuthModal.test.tsx src/components/home/MatchSetupModal.test.tsx
```
Expected: FAIL because `AuthModal.tsx` and `MatchSetupModal.tsx` do not exist yet.

- [ ] **Step 3: Implement `AuthModal.tsx`, `AuthModal.scss`, `MatchSetupModal.tsx`, and `MatchSetupModal.scss`**

Create `ui/src/components/home/AuthModal.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import {
  loginAccount,
  loginWithGoogle,
  registerAccount,
  type AuthConfig,
  type PlayerAccount,
} from "../../utils/apiClient";
import GoogleSignInButton from "../GoogleSignInButton";
import "./AuthModal.scss";

export type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  authConfig: AuthConfig;
  promptBanner?: string;
  onAuthenticated: (account: PlayerAccount) => void;
};

export default function AuthModal({
  open,
  onClose,
  authConfig,
  promptBanner,
  onAuthenticated,
}: AuthModalProps) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAuthError("");
    setPasswordInput("");
  }, [open]);

  const handleLogin = async () => {
    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setAuthError("Informe seu nome de usuário.");
      return;
    }
    if (!passwordInput) {
      setAuthError("Informe sua senha.");
      return;
    }
    setBusy(true);
    setAuthError("");
    try {
      const logged = await loginAccount({
        username: cleanUsername,
        password: passwordInput,
      });
      onAuthenticated(logged);
      onClose();
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.description || "Usuário ou senha incorretos."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    const cleanUsername = usernameInput.trim();
    if (cleanUsername.length < 2) {
      setAuthError("O nome de usuário deve ter pelo menos 2 caracteres.");
      return;
    }
    if (passwordInput.length < 4) {
      setAuthError("A senha deve ter pelo menos 4 caracteres.");
      return;
    }
    setBusy(true);
    setAuthError("");
    try {
      const logged = await registerAccount({
        username: cleanUsername,
        password: passwordInput,
        displayName: displayNameInput.trim() || cleanUsername,
      });
      onAuthenticated(logged);
      onClose();
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.description || "Não foi possível cadastrar o usuário."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setBusy(true);
    setAuthError("");
    try {
      const logged = await loginWithGoogle(credential);
      onAuthenticated(logged);
      onClose();
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.description || "Falha na autenticação com o Google."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: "catan-modal-paper home-auth-paper" }}
    >
      <DialogTitle className="home-auth-header">
        <span>👤 Identificação de Jogador</span>
        <Button
          size="small"
          variant="outlined"
          className="home-modal-close-btn"
          onClick={onClose}
        >
          Fechar
        </Button>
      </DialogTitle>
      <DialogContent className="home-auth-body">
        {promptBanner && (
          <div className="home-auth-banner">{promptBanner}</div>
        )}

        <p className="home-auth-subtitle">
          Salve suas vitórias no Ranking Global, desbloqueie molduras exclusivas e jogue de qualquer dispositivo.
        </p>

        <div className="home-auth-tabs">
          <button
            type="button"
            className={`home-auth-tab-btn ${authMode === "login" ? "active" : ""}`}
            onClick={() => {
              setAuthMode("login");
              setAuthError("");
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`home-auth-tab-btn ${authMode === "register" ? "active" : ""}`}
            onClick={() => {
              setAuthMode("register");
              setAuthError("");
            }}
          >
            Criar Conta
          </button>
        </div>

        <div className="home-auth-form">
          <input
            type="text"
            className="home-modal-input"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                authMode === "login" ? handleLogin() : handleRegister();
              }
            }}
            placeholder="Usuário (ex: joao)"
            maxLength={24}
          />
          {authMode === "register" && (
            <input
              type="text"
              className="home-modal-input"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="Apelido na mesa (ex: João)"
              maxLength={24}
            />
          )}
          <input
            type="password"
            className="home-modal-input"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                authMode === "login" ? handleLogin() : handleRegister();
              }
            }}
            placeholder={
              authMode === "login" ? "Senha" : "Senha (mín 4 caracteres)"
            }
            maxLength={64}
          />

          {authError && <div className="home-auth-error">{authError}</div>}

          <Button
            variant="contained"
            className="home-auth-submit-btn"
            disabled={busy}
            onClick={authMode === "login" ? handleLogin : handleRegister}
          >
            {busy
              ? "Aguarde..."
              : authMode === "login"
                ? "Entrar"
                : "Criar Conta"}
          </Button>
        </div>

        {authConfig.google_enabled && authConfig.google_client_id && (
          <div className="home-auth-google">
            <div className="home-auth-divider">
              <span>ou</span>
            </div>
            <GoogleSignInButton
              clientId={authConfig.google_client_id}
              onCredential={handleGoogleCredential}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Create `ui/src/components/home/AuthModal.scss`:
```scss
.home-auth-paper {
  background: #0f172a !important;
  color: #f8fafc !important;
  border: 1px solid rgba(250, 204, 21, 0.3) !important;
  border-radius: 18px !important;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.72) !important;
}

.home-auth-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #fde047;
  font-weight: 800;
  font-size: 1.05rem !important;
}

.home-modal-close-btn {
  color: #94a3b8 !important;
  border-color: rgba(255, 255, 255, 0.16) !important;
  text-transform: none !important;
  border-radius: 8px !important;
}

.home-auth-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 22px 22px !important;
}

.home-auth-banner {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.16);
  border: 1px solid rgba(96, 165, 250, 0.45);
  color: #bfdbfe;
  font-size: 0.82rem;
  font-weight: 600;
}

.home-auth-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: #94a3b8;
  line-height: 1.4;
}

.home-auth-tabs {
  display: flex;
  gap: 8px;
}

.home-auth-tab-btn {
  flex: 1;
  background: rgba(30, 41, 59, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #94a3b8;
  padding: 8px 12px;
  font-size: 0.86rem;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: #f8fafc;
    border-color: rgba(255, 255, 255, 0.3);
  }

  &.active {
    background: rgba(250, 204, 21, 0.16);
    color: #fde047;
    border-color: #facc15;
  }
}

.home-auth-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.home-modal-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(2, 6, 23, 0.72);
  color: #f8fafc;
  font-size: 0.9rem;

  &:focus {
    outline: none;
    border-color: #facc15;
  }
}

.home-auth-error {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.16);
  border: 1px solid rgba(239, 68, 68, 0.42);
  color: #fca5a5;
  font-size: 0.8rem;
  font-weight: 600;
}

.home-auth-submit-btn {
  height: 42px;
  background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%) !important;
  color: #0f172a !important;
  font-weight: 800 !important;
  border-radius: 10px !important;
  text-transform: none !important;
  font-size: 0.94rem !important;
}

.home-auth-google {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.home-auth-divider {
  display: flex;
  align-items: center;
  width: 100%;
  color: #64748b;
  font-size: 0.78rem;

  &::before,
  &::after {
    content: "";
    flex: 1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  span {
    padding: 0 10px;
  }
}
```

Create `ui/src/components/home/MatchSetupModal.tsx`:
```tsx
import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Tooltip,
} from "@mui/material";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import {
  createGame,
  createRoom,
  type MapTemplate,
  type PlayerAccount,
  type PlayerEntry,
  type PlayerKey,
} from "../../utils/apiClient";
import "./MatchSetupModal.scss";

const MAP_TEMPLATES: Array<{ value: MapTemplate; label: string }> = [
  { value: "BASE", label: "PADRÃO (BASE)" },
  { value: "MINI", label: "MINI (RÁPIDO)" },
  { value: "TOURNAMENT", label: "TORNEIO" },
];

const PLAYER_COLORS = ["RED", "BLUE", "ORANGE", "WHITE"] as const;
const COLOR_LABELS_PT: Record<(typeof PLAYER_COLORS)[number], string> = {
  RED: "VERMELHO",
  BLUE: "AZUL",
  ORANGE: "LARANJA",
  WHITE: "BRANCO",
};

export type MatchSetupMode = "solo" | "room" | null;

export type MatchSetupModalProps = {
  mode: MatchSetupMode;
  onClose: () => void;
  availablePlayers: PlayerEntry[];
  defaultHostName: string;
  account: PlayerAccount | null;
  onGameCreated: (gameId: string) => void;
  onRoomCreated: (roomCode: string) => void;
};

export default function MatchSetupModal({
  mode,
  onClose,
  availablePlayers,
  defaultHostName,
  account,
  onGameCreated,
  onRoomCreated,
}: MatchSetupModalProps) {
  const [mapTemplate, setMapTemplate] = useState<MapTemplate>("BASE");
  const [vpsToWin, setVpsToWin] = useState(10);
  const [discardLimit, setDiscardLimit] = useState(7);
  const [friendlyRobber, setFriendlyRobber] = useState(true);
  const [hostName, setHostName] = useState(defaultHostName || "Anfitrião");
  const [players, setPlayers] = useState<PlayerKey[]>([
    "HUMAN",
    "CATANATRON",
    "CATANATRON",
    "CATANATRON",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!mode) return;
    setErrorMsg("");
    setSubmitting(false);
    setHostName(account?.display_name || defaultHostName || "Anfitrião");
    if (mode === "room") {
      setPlayers(["HUMAN", "HUMAN", "CATANATRON", "CATANATRON"]);
    } else {
      setPlayers(["HUMAN", "CATANATRON", "CATANATRON", "CATANATRON"]);
    }
  }, [mode, account?.display_name, defaultHostName]);

  const handlePlayerChange = (index: number, value: PlayerKey) => {
    setPlayers((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? value : player
      )
    );
  };

  const handleAddPlayer = () => {
    setPlayers((current) =>
      current.length >= 4 ? current : [...current, "CATANATRON"]
    );
  };

  const handleRemovePlayer = (index: number) => {
    setPlayers((current) =>
      current.length <= 2
        ? current
        : current.filter((_, playerIndex) => playerIndex !== index)
    );
  };

  const handleSubmit = async () => {
    if (!mode) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      if (mode === "solo") {
        const gameId = await createGame({
          players,
          mapTemplate,
          vpsToWin,
          discardLimit,
          friendlyRobber,
        });
        onGameCreated(gameId);
      } else {
        const cleanName =
          hostName.trim() || account?.display_name || "Anfitrião";
        localStorage.setItem("catan_player_name", cleanName);
        const humanSeats = players.filter((p) => p === "HUMAN").length;
        const roomPlayers =
          humanSeats >= 2
            ? players
            : ["HUMAN", "HUMAN", ...players.slice(2)];

        const res = await createRoom({
          hostName: cleanName,
          players: roomPlayers,
          mapTemplate,
          vpsToWin,
          discardLimit,
          friendlyRobber,
          token: account?.auth_token,
        });
        localStorage.setItem(
          `catan_room_token_${res.room_code.toUpperCase()}`,
          res.seat_token
        );
        onRoomCreated(res.room_code);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.description ||
          (mode === "solo"
            ? "Não foi possível iniciar a partida."
            : "Não foi possível criar a sala online.")
      );
      setSubmitting(false);
    }
  };

  const selectedTemplateLabel =
    MAP_TEMPLATES.find((t) => t.value === mapTemplate)?.label || mapTemplate;
  const isRoom = mode === "room";

  return (
    <Dialog
      open={Boolean(mode)}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ className: "catan-modal-paper match-setup-paper" }}
    >
      <DialogTitle className="match-setup-header">
        <span>
          {isRoom
            ? "🌐 Criar Sala Online (Amigos & Bots)"
            : "⚔️ Configurar Partida Rápida (Solo vs IA)"}
        </span>
        <Button
          size="small"
          variant="outlined"
          className="home-modal-close-btn"
          onClick={onClose}
        >
          Fechar
        </Button>
      </DialogTitle>

      <DialogContent className="match-setup-body">
        {isRoom && (
          <div className="match-setup-host-field">
            <label htmlFor="setup-host-name">Seu Apelido na Mesa</label>
            <input
              id="setup-host-name"
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Seu apelido na sala..."
              maxLength={24}
            />
          </div>
        )}

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span>Modelo do Mapa</span>
            <strong>{selectedTemplateLabel}</strong>
          </div>
          <div className="match-setup-templates">
            {MAP_TEMPLATES.map(({ value, label }) => (
              <Button
                key={value}
                variant="contained"
                onClick={() => setMapTemplate(value)}
                className={`match-setup-choice-btn ${
                  mapTemplate === value ? "selected" : ""
                }`}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="match-setup-sliders-row">
          <div className="match-setup-compact-box">
            <div className="match-setup-group__header">
              <span>Pontos para Vencer</span>
              <strong>{vpsToWin}</strong>
            </div>
            <Slider
              value={vpsToWin}
              min={3}
              max={20}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_, value) => setVpsToWin(value as number)}
            />
          </div>

          <div className="match-setup-compact-box">
            <div className="match-setup-group__header">
              <span>Limite de Cartas (Ladrão)</span>
              <strong>{discardLimit}</strong>
            </div>
            <Slider
              value={discardLimit}
              min={5}
              max={20}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_, value) => setDiscardLimit(value as number)}
            />
          </div>

          <div className="match-setup-compact-box match-setup-compact-box--switch">
            <div className="match-setup-group__header">
              <span className="match-setup-inline-title">
                Ladrão Amigável
                <Tooltip
                  title="Impede colocar o Ladrão em terrenos de jogadores que tenham apenas 2 pontos de vitória."
                  arrow
                  enterTouchDelay={0}
                  leaveTouchDelay={3000}
                >
                  <IconButton
                    size="small"
                    className="match-setup-help-btn"
                    aria-label="Ajuda sobre Ladrão Amigável"
                  >
                    <HelpOutlineRoundedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </span>
              <strong>{friendlyRobber ? "Ativo" : "Inativo"}</strong>
            </div>
            <Checkbox
              className="match-setup-checkbox"
              checked={friendlyRobber}
              onChange={(event) => setFriendlyRobber(event.target.checked)}
            />
          </div>
        </div>

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span>Jogadores na Mesa</span>
            <strong>{players.length}/4</strong>
          </div>
          <div className="match-setup-players">
            {players.map((player, index) => (
              <div className="match-setup-player-row" key={`${player}-${index}`}>
                <div className="match-setup-player-meta">
                  <span>Jogador {index + 1}</span>
                  <span
                    className={`match-setup-color-chip ${PLAYER_COLORS[
                      index
                    ].toLowerCase()}`}
                  >
                    {COLOR_LABELS_PT[PLAYER_COLORS[index]]}
                  </span>
                </div>
                <Select
                  size="small"
                  fullWidth
                  value={player}
                  onChange={(event) =>
                    handlePlayerChange(index, event.target.value as PlayerKey)
                  }
                >
                  {availablePlayers.map((option) => (
                    <MenuItem key={option.key} value={option.key}>
                      {option.is_bot ? `🤖 ${option.name}` : `👤 ${option.name}`}
                    </MenuItem>
                  ))}
                </Select>
                <Button
                  variant="text"
                  className="match-setup-remove-btn"
                  disabled={players.length <= 2}
                  onClick={() => handleRemovePlayer(index)}
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outlined"
            className="match-setup-add-btn"
            disabled={players.length >= 4}
            onClick={handleAddPlayer}
          >
            + Adicionar Jogador
          </Button>
        </div>

        {errorMsg && <div className="match-setup-error">{errorMsg}</div>}
      </DialogContent>

      <DialogActions className="match-setup-actions">
        <Button
          variant="outlined"
          className="match-setup-cancel-btn"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          className={
            isRoom ? "match-setup-submit-btn--room" : "match-setup-submit-btn--solo"
          }
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? "Preparando mesa..."
            : isRoom
              ? "🔗 Criar Sala e Gerar Link"
              : "⚔️ Iniciar Partida"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

Create `ui/src/components/home/MatchSetupModal.scss`:
```scss
.match-setup-paper {
  background: #0f172a !important;
  color: #f8fafc !important;
  border: 1px solid rgba(250, 204, 21, 0.3) !important;
  border-radius: 18px !important;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.74) !important;
}

.match-setup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 15px 22px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #fde047;
  font-weight: 800;
  font-size: 1.05rem !important;
}

.match-setup-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 22px !important;

  .MuiSlider-root {
    color: #facc15;
  }

  .MuiInputBase-root {
    color: #f8fafc;
    background: rgba(2, 6, 23, 0.68);
    border-radius: 10px;
  }

  .MuiOutlinedInput-notchedOutline {
    border-color: rgba(255, 255, 255, 0.14);
  }

  .MuiSelect-icon {
    color: rgba(255, 255, 255, 0.72);
  }
}

.match-setup-host-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 0.8rem;
    font-weight: 700;
    color: #93c5fd;
  }

  input {
    height: 40px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid rgba(96, 165, 250, 0.38);
    background: rgba(2, 6, 23, 0.72);
    color: #f8fafc;
    font-size: 0.9rem;
    font-weight: 600;
  }
}

.match-setup-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 0.84rem;
    font-weight: 600;
    color: #e2e8f0;

    strong {
      color: #fde047;
      font-size: 0.88rem;
    }
  }
}

.match-setup-templates {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.match-setup-choice-btn {
  background: rgba(30, 41, 59, 0.85) !important;
  color: #e2e8f0 !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 10px !important;
  font-weight: 700 !important;
  font-size: 0.78rem !important;
  height: 40px;

  &.selected {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
    border-color: #60a5fa !important;
    color: #ffffff !important;
  }
}

.match-setup-sliders-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.match-setup-compact-box {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.08);

  &--switch {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
}

.match-setup-inline-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.match-setup-help-btn {
  padding: 0 !important;
  color: rgba(255, 255, 255, 0.56) !important;
}

.match-setup-checkbox {
  width: fit-content;
  margin-left: -9px !important;
  padding: 0 !important;
  color: #facc15 !important;
}

.match-setup-players {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.match-setup-player-row {
  display: grid;
  grid-template-columns: 98px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.match-setup-player-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #f8fafc;
}

.match-setup-color-chip {
  width: fit-content;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 800;

  &.red {
    background: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.45);
  }
  &.blue {
    background: rgba(59, 130, 246, 0.25);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.45);
  }
  &.orange {
    background: rgba(245, 158, 11, 0.25);
    color: #fde68a;
    border: 1px solid rgba(245, 158, 11, 0.45);
  }
  &.white {
    background: rgba(248, 250, 252, 0.18);
    color: #f8fafc;
    border: 1px solid rgba(248, 250, 252, 0.4);
  }
}

.match-setup-remove-btn {
  color: #94a3b8 !important;
  font-size: 0.78rem !important;
  text-transform: none !important;
}

.match-setup-add-btn {
  border-color: rgba(255, 255, 255, 0.16) !important;
  color: #e2e8f0 !important;
  border-radius: 10px !important;
  text-transform: none !important;
  font-weight: 700 !important;
}

.match-setup-error {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.16);
  border: 1px solid rgba(239, 68, 68, 0.42);
  color: #fca5a5;
  font-size: 0.82rem;
  font-weight: 600;
}

.match-setup-actions {
  padding: 12px 22px 18px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  gap: 10px;
}

.match-setup-cancel-btn {
  color: #cbd5e1 !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  border-radius: 10px !important;
  text-transform: none !important;
}

.match-setup-submit-btn--solo {
  background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%) !important;
  color: #0f172a !important;
  font-weight: 800 !important;
  border-radius: 10px !important;
  text-transform: none !important;
}

.match-setup-submit-btn--room {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
  color: #ffffff !important;
  font-weight: 800 !important;
  border-radius: 10px !important;
  text-transform: none !important;
}

@media (max-width: 640px) {
  .match-setup-templates,
  .match-setup-sliders-row {
    grid-template-columns: 1fr;
  }

  .match-setup-player-row {
    grid-template-columns: 80px minmax(0, 1fr) auto;
  }
}
```

- [ ] **Step 4: Run TypeScript check and new tests**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui`:
```powershell
npx tsc --noEmit
npx vitest run src/components/home/AuthModal.test.tsx src/components/home/MatchSetupModal.test.tsx
```
Expected: `0` TypeScript errors and all tests in `AuthModal.test.tsx` + `MatchSetupModal.test.tsx` PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/components/home/AuthModal.tsx ui/src/components/home/AuthModal.scss ui/src/components/home/AuthModal.test.tsx ui/src/components/home/MatchSetupModal.tsx ui/src/components/home/MatchSetupModal.scss ui/src/components/home/MatchSetupModal.test.tsx
git commit -m "feat(home-modals): build modular AuthModal and MatchSetupModal for solo and online rooms"
```

---

### Task 4: Open Lobby Browser (`OpenLobbyModal`) + Tests

**Files:**
- Create: `ui/src/components/home/OpenLobbyModal.tsx`
- Create: `ui/src/components/home/OpenLobbyModal.scss`
- Create: `ui/src/components/home/OpenLobbyModal.test.tsx`

**Interfaces:**
- Consumes: `PlayerAvatar` (`ui/src/components/PlayerAvatar.tsx`), `PLAYER_COLOR_META` (`ui/src/config/assetRegistry.ts`), `RoomState` (`ui/src/utils/api.types.ts`).
- Produces `OpenLobbyModal`:
  ```ts
  export type OpenLobbyModalProps = {
    open: boolean;
    onClose: () => void;
    rooms: RoomState[];
    onJoinRoom: (roomCode: string) => void;
    onOpenMatch: (gameId: string, myColor: Color | null) => void;
    onCreateRoomClick: () => void;
    onRefresh: () => void;
  };
  ```
- Consumed by: Task 5 (`HomePage.tsx`).

- [ ] **Step 1: Write failing test `ui/src/components/home/OpenLobbyModal.test.tsx`**

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import OpenLobbyModal from "./OpenLobbyModal";
import type { RoomState } from "../../utils/api.types";

afterEach(() => {
  cleanup();
});

const sampleRooms: RoomState[] = [
  {
    room_code: "AB12CD",
    status: "WAITING",
    game_id: null,
    is_host: false,
    my_color: null,
    config: {
      map_template: "BASE",
      vps_to_win: 10,
      discard_limit: 7,
      friendly_robber: true,
    },
    seats: [
      {
        color: "RED",
        player_key: "HUMAN",
        player_name: "Ana",
        is_bot: false,
        claimed: true,
        is_me: false,
        seat_kind: "USER",
        username: "ana",
        avatar_config: { hat: "captain", frame: "bronze" },
      },
      {
        color: "BLUE",
        player_key: "HUMAN",
        player_name: "Aguardando Amigo...",
        is_bot: false,
        claimed: false,
        is_me: false,
        seat_kind: "GUEST",
        username: null,
        avatar_config: {},
      },
      {
        color: "ORANGE",
        player_key: "CATANATRON",
        player_name: "🤖 Mestre IA",
        is_bot: true,
        claimed: true,
        is_me: false,
        seat_kind: "BOT",
        username: null,
        avatar_config: {},
      },
    ],
  },
  {
    room_code: "MINE99",
    status: "IN_PROGRESS",
    game_id: "g-live-99",
    is_host: true,
    my_color: "RED",
    config: {
      map_template: "MINI",
      vps_to_win: 7,
      discard_limit: 7,
      friendly_robber: true,
    },
    seats: [
      {
        color: "RED",
        player_key: "HUMAN",
        player_name: "João",
        is_bot: false,
        claimed: true,
        is_me: true,
        seat_kind: "USER",
        username: "joao",
        avatar_config: { frame: "gold" },
      },
    ],
  },
];

describe("OpenLobbyModal", () => {
  test("renders rooms with seat PlayerAvatars, supports filters and code join", async () => {
    const user = userEvent.setup();
    const onJoinRoom = vi.fn();
    const onOpenMatch = vi.fn();

    render(
      <OpenLobbyModal
        open={true}
        onClose={vi.fn()}
        rooms={sampleRooms}
        onJoinRoom={onJoinRoom}
        onOpenMatch={onOpenMatch}
        onCreateRoomClick={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText("#AB12CD")).toBeInTheDocument();
    expect(screen.getByText("#MINE99")).toBeInTheDocument();
    expect(screen.getAllByTestId("player-avatar").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Vaga Aberta/i)).toBeInTheDocument();

    // Filtro "Com Vagas" mantém apenas AB12CD
    await user.click(screen.getByRole("button", { name: /Com Vagas/i }));
    expect(screen.getByText("#AB12CD")).toBeInTheDocument();
    expect(screen.queryByText("#MINE99")).not.toBeInTheDocument();

    // Filtro "Minhas" mantém apenas MINE99 e botão Retomar navega para partida
    await user.click(screen.getByRole("button", { name: /Minhas/i }));
    expect(screen.queryByText("#AB12CD")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retomar/i }));
    expect(onOpenMatch).toHaveBeenCalledWith("g-live-99", "RED");

    // Entrar com código direto normalizado
    const codeInput = screen.getByPlaceholderText(/Código da sala/i);
    await user.type(codeInput, "k7m4p9");
    await user.click(screen.getByRole("button", { name: /^Entrar com Código$/i }));
    expect(onJoinRoom).toHaveBeenCalledWith("K7M4P9");
  }, 15000);

  test("shows empty state CTA to create a new online room", async () => {
    const user = userEvent.setup();
    const onCreateRoomClick = vi.fn();

    render(
      <OpenLobbyModal
        open={true}
        onClose={vi.fn()}
        rooms={[]}
        onJoinRoom={vi.fn()}
        onOpenMatch={vi.fn()}
        onCreateRoomClick={onCreateRoomClick}
        onRefresh={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /Criar Nova Sala Online/i })
    );
    expect(onCreateRoomClick).toHaveBeenCalledTimes(1);
  }, 15000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui`:
```powershell
npx vitest run src/components/home/OpenLobbyModal.test.tsx
```
Expected: FAIL because `OpenLobbyModal.tsx` does not exist yet.

- [ ] **Step 3: Implement `OpenLobbyModal.tsx` and `OpenLobbyModal.scss`**

Create `ui/src/components/home/OpenLobbyModal.tsx`:
```tsx
import { useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import { PLAYER_COLOR_META } from "../../config/assetRegistry";
import type { Color, RoomState } from "../../utils/api.types";
import PlayerAvatar from "../PlayerAvatar";
import "./OpenLobbyModal.scss";

type LobbyFilter = "all" | "open" | "mine";

export type OpenLobbyModalProps = {
  open: boolean;
  onClose: () => void;
  rooms: RoomState[];
  onJoinRoom: (roomCode: string) => void;
  onOpenMatch: (gameId: string, myColor: Color | null) => void;
  onCreateRoomClick: () => void;
  onRefresh: () => void;
};

export default function OpenLobbyModal({
  open,
  onClose,
  rooms,
  onJoinRoom,
  onOpenMatch,
  onCreateRoomClick,
  onRefresh,
}: OpenLobbyModalProps) {
  const [filter, setFilter] = useState<LobbyFilter>("all");
  const [joinCodeInput, setJoinCodeInput] = useState("");

  const openRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.status === "WAITING" && r.seats.some((s) => !s.is_bot && !s.claimed)
      ),
    [rooms]
  );

  const myRooms = useMemo(
    () => rooms.filter((r) => Boolean(r.my_color)),
    [rooms]
  );

  const filteredRooms = useMemo(() => {
    if (filter === "open") return openRooms;
    if (filter === "mine") return myRooms;
    return rooms;
  }, [filter, openRooms, myRooms, rooms]);

  const cleanCode = joinCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  const handleJoinByCode = () => {
    if (cleanCode.length >= 4) {
      onJoinRoom(cleanCode);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ className: "catan-modal-paper open-lobby-paper" }}
    >
      <DialogTitle className="open-lobby-header">
        <span>🧭 Salas Abertas & Lobby Online</span>
        <div className="open-lobby-header__right">
          <Button
            size="small"
            variant="outlined"
            className="open-lobby-refresh-btn"
            onClick={onRefresh}
          >
            ↻ Atualizar
          </Button>
          <Button
            size="small"
            variant="outlined"
            className="home-modal-close-btn"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </DialogTitle>

      <DialogContent className="open-lobby-body">
        <div className="open-lobby-code-bar">
          <input
            type="text"
            className="home-modal-input open-lobby-code-input"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoinByCode();
            }}
            placeholder="Código da sala (ex: K7M4P9)"
            maxLength={10}
          />
          <Button
            variant="outlined"
            className="open-lobby-code-btn"
            disabled={cleanCode.length < 4}
            onClick={handleJoinByCode}
          >
            Entrar com Código
          </Button>
        </div>

        <div className="open-lobby-filters">
          <button
            type="button"
            className={`open-lobby-filter-pill ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Todas ({rooms.length})
          </button>
          <button
            type="button"
            className={`open-lobby-filter-pill ${filter === "open" ? "active" : ""}`}
            onClick={() => setFilter("open")}
          >
            Com Vagas ({openRooms.length})
          </button>
          <button
            type="button"
            className={`open-lobby-filter-pill ${filter === "mine" ? "active" : ""}`}
            onClick={() => setFilter("mine")}
          >
            Minhas ({myRooms.length})
          </button>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="open-lobby-empty">
            <p>Nenhuma sala encontrada neste filtro no momento.</p>
            <Button
              variant="contained"
              className="open-lobby-create-btn"
              onClick={onCreateRoomClick}
            >
              🌐 Criar Nova Sala Online
            </Button>
          </div>
        ) : (
          <div className="open-lobby-list">
            {filteredRooms.map((room) => {
              const openHumans = room.seats.filter(
                (s) => !s.is_bot && !s.claimed
              ).length;
              const myColorLabel = room.my_color
                ? PLAYER_COLOR_META[room.my_color]?.label
                : null;

              return (
                <div
                  key={room.room_code}
                  className={`open-lobby-card ${
                    room.my_color ? "open-lobby-card--mine" : ""
                  }`}
                >
                  <div className="open-lobby-card__top">
                    <div className="open-lobby-card__badges">
                      <strong>#{room.room_code}</strong>
                      <span
                        className={`open-lobby-status ${
                          room.status === "WAITING" ? "waiting" : "playing"
                        }`}
                      >
                        {room.status === "WAITING"
                          ? `Aberta (${openHumans} vaga${openHumans === 1 ? "" : "s"})`
                          : "Em Andamento"}
                      </span>
                      {myColorLabel && (
                        <span className="open-lobby-my-seat">
                          ★ Seu Assento: {myColorLabel}
                        </span>
                      )}
                    </div>
                    <small className="open-lobby-card__rules">
                      Mapa {room.config.map_template} • {room.config.vps_to_win} PV
                    </small>
                  </div>

                  <div className="open-lobby-card__bottom">
                    <div className="open-lobby-seats">
                      {room.seats.map((seat) => {
                        const palette = PLAYER_COLOR_META[seat.color];
                        const isOpen = !seat.is_bot && !seat.claimed;
                        return (
                          <div
                            key={seat.color}
                            className={`open-lobby-seat-chip ${
                              isOpen ? "open-lobby-seat-chip--open" : ""
                            }`}
                            style={{ borderColor: palette.primary }}
                          >
                            {seat.seat_kind === "USER" ? (
                              <PlayerAvatar
                                config={seat.avatar_config}
                                username={seat.username || seat.player_name}
                                size={28}
                              />
                            ) : (
                              <span
                                className="open-lobby-seat-icon"
                                style={{
                                  background: palette.primary,
                                  color: palette.textOnFill,
                                }}
                              >
                                {seat.is_bot ? "🤖" : isOpen ? "➕" : "👤"}
                              </span>
                            )}
                            <span>
                              {isOpen ? "Vaga Aberta" : seat.player_name}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      size="small"
                      variant="contained"
                      className="open-lobby-join-btn"
                      onClick={() => {
                        if (room.status === "IN_PROGRESS" && room.game_id) {
                          onOpenMatch(room.game_id, room.my_color);
                        } else {
                          onJoinRoom(room.room_code);
                        }
                      }}
                    >
                      {room.status === "IN_PROGRESS"
                        ? room.my_color
                          ? "▶ Retomar"
                          : "👁 Assistir"
                        : "Entrar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Create `ui/src/components/home/OpenLobbyModal.scss`:
```scss
.open-lobby-paper {
  background: #0f172a !important;
  color: #f8fafc !important;
  border: 1px solid rgba(250, 204, 21, 0.3) !important;
  border-radius: 18px !important;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.74) !important;
}

.open-lobby-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 15px 22px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #fde047;
  font-weight: 800;
  font-size: 1.05rem !important;

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.open-lobby-refresh-btn {
  color: #93c5fd !important;
  border-color: rgba(96, 165, 250, 0.38) !important;
  text-transform: none !important;
  border-radius: 8px !important;
}

.open-lobby-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 22px 22px !important;
}

.open-lobby-code-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.open-lobby-code-input {
  flex: 1;
  min-width: 180px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.open-lobby-code-btn {
  border-color: rgba(250, 204, 21, 0.48) !important;
  color: #fde047 !important;
  font-weight: 700 !important;
  border-radius: 10px !important;
  text-transform: none !important;
}

.open-lobby-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.open-lobby-filter-pill {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(30, 41, 59, 0.6);
  color: #cbd5e1;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: #ffffff;
  }

  &.active {
    background: rgba(250, 204, 21, 0.16);
    border-color: #facc15;
    color: #fde047;
  }
}

.open-lobby-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 16px;
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.5);
  border: 1px dashed rgba(255, 255, 255, 0.14);
  text-align: center;

  p {
    margin: 0;
    color: #94a3b8;
    font-size: 0.9rem;
  }
}

.open-lobby-create-btn {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  border-radius: 10px !important;
  text-transform: none !important;
}

.open-lobby-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.open-lobby-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(30, 41, 59, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &--mine {
    border-color: rgba(250, 204, 21, 0.45);
    background: rgba(30, 58, 138, 0.28);
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  &__badges {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    strong {
      font-size: 0.95rem;
      color: #f8fafc;
      letter-spacing: 0.05em;
    }
  }

  &__rules {
    font-size: 0.78rem;
    color: #94a3b8;
    font-weight: 600;
  }

  &__bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
}

.open-lobby-status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;

  &.waiting {
    background: rgba(34, 197, 94, 0.18);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  &.playing {
    background: rgba(59, 130, 246, 0.22);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }
}

.open-lobby-my-seat {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  background: rgba(250, 204, 21, 0.18);
  color: #fde047;
  border: 1px solid rgba(250, 204, 21, 0.45);
}

.open-lobby-seats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}

.open-lobby-seat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px 3px 4px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.16);
  font-size: 0.75rem;
  color: #e2e8f0;
  font-weight: 600;

  &--open {
    border-style: dashed;
    color: #93c5fd;
  }
}

.open-lobby-seat-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #ffffff;
}

.open-lobby-join-btn {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  border-radius: 9px !important;
  text-transform: none !important;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Run TypeScript check and `OpenLobbyModal.test.tsx`**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui`:
```powershell
npx tsc --noEmit
npx vitest run src/components/home/OpenLobbyModal.test.tsx
```
Expected: `0` TypeScript errors and all tests in `OpenLobbyModal.test.tsx` PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/components/home/OpenLobbyModal.tsx ui/src/components/home/OpenLobbyModal.scss ui/src/components/home/OpenLobbyModal.test.tsx
git commit -m "feat(open-lobby): add OpenLobbyModal with live filters, code join and seat avatars"
```

---

### Task 5: Palco Aberto `HomePage` A2 + Testes de Integração (`HomePage.test.tsx` & `App.test.tsx`)

**Files:**
- Modify: `ui/src/pages/HomePage.tsx` (replace monolith with A2 stage + modal orchestration)
- Modify: `ui/src/pages/HomePage.scss` (uncovered hero island + 3-column topbar + floating bottom mode dock + responsive breakpoints)
- Modify: `ui/src/App.test.tsx`
- Create: `ui/src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes:
  - `PlayerAvatar` (`ui/src/components/PlayerAvatar.tsx`)
  - `AVATAR_FRAME_OPTIONS`, `resolveAvatarConfig` (`ui/src/config/avatarCatalog.ts`)
  - `AvatarStudioModal` (`ui/src/components/AvatarStudioModal.tsx`)
  - `LeaderboardModal` (`ui/src/components/LeaderboardModal.tsx`)
  - `AuthModal` (`ui/src/components/home/AuthModal.tsx`)
  - `MatchSetupModal`, `MatchSetupMode` (`ui/src/components/home/MatchSetupModal.tsx`)
  - `OpenLobbyModal` (`ui/src/components/home/OpenLobbyModal.tsx`)
  - `PlayerAccount.leaderboard_rank` (`ui/src/utils/apiClient.ts`)

- [ ] **Step 1: Update `ui/src/App.test.tsx` and write `ui/src/pages/HomePage.test.tsx` (TDD)**

Update `ui/src/App.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, test, expect } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
});

test("renders A2 scenic home stage and opens Quick Match setup modal in Portuguese", async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole("heading", { name: /Rule the Isle/i })).toBeInTheDocument();
  expect(screen.getByText(/Mãos Privadas no Multiplayer/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Partida Rápida/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Criar Sala Online/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Salas Abertas/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Ranking & Histórico/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Personalizar Avatar/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Partida Rápida/i }));
  expect(await screen.findByText(/Modelo do Mapa/i)).toBeInTheDocument();
  expect(screen.getByText(/Pontos para Vencer/i)).toBeInTheDocument();
  expect(screen.getByText(/Limite de Cartas/i)).toBeInTheDocument();
  expect(screen.getByText(/^Jogadores na Mesa$/i)).toBeInTheDocument();
}, 15000);
```

Create `ui/src/pages/HomePage.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import HomePage from "./HomePage";
import {
  DEFAULT_PLAYERS,
  fetchCurrentAccount,
  getAuthConfig,
  getPlayers,
  getSavedAccount,
  listActiveRooms,
  loginAccount,
  logoutAccount,
  type PlayerAccount,
} from "../utils/apiClient";

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/apiClient")>();
  return {
    ...actual,
    fetchCurrentAccount: vi.fn(),
    getAuthConfig: vi.fn(),
    getPlayers: vi.fn(),
    getSavedAccount: vi.fn(),
    listActiveRooms: vi.fn(),
    loginAccount: vi.fn(),
    logoutAccount: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

const loggedAccount: PlayerAccount = {
  username: "joao",
  display_name: "João Gallo",
  auth_token: "sess_joao",
  leaderboard_rank: 1,
  avatar_config: { hat: "captain", frame: "gold" },
  stats: { wins: 5, losses: 3, games_played: 8, win_rate: 62.5 },
};

describe("HomePage A2 Stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSavedAccount).mockReturnValue(null);
    vi.mocked(fetchCurrentAccount).mockResolvedValue(null);
    vi.mocked(getAuthConfig).mockResolvedValue({
      google_enabled: false,
      google_client_id: null,
    });
    vi.mocked(getPlayers).mockResolvedValue(DEFAULT_PLAYERS);
    vi.mocked(listActiveRooms).mockResolvedValue([]);
  });

  test("displays logged-in avatar, frame label, and live #rank in A2 symmetric header without setup-card", async () => {
    vi.mocked(getSavedAccount).mockReturnValue(loggedAccount);
    vi.mocked(fetchCurrentAccount).mockResolvedValue(loggedAccount);
    vi.mocked(listActiveRooms).mockResolvedValue([
      {
        room_code: "R1A2B3",
        status: "WAITING",
        game_id: null,
        is_host: true,
        my_color: "RED",
        config: {
          map_template: "BASE",
          vps_to_win: 10,
          discard_limit: 7,
          friendly_robber: true,
        },
        seats: [],
      },
    ]);

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(container.querySelector(".setup-card")).toBeNull();
    expect(await screen.findByText("João Gallo")).toBeInTheDocument();
    expect(screen.getByText(/#1 no Ranking/i)).toBeInTheDocument();
    expect(screen.getByText(/Ouro Real/i)).toBeInTheDocument();
    expect(screen.getByTestId("player-avatar")).toHaveAttribute("data-frame", "gold");
    expect(
      await screen.findByRole("button", { name: /Salas Abertas \(1\)/i })
    ).toBeInTheDocument();

    // Logout volta ao estado visitante
    const user = userEvent.setup();
    vi.mocked(logoutAccount).mockResolvedValueOnce();
    await user.click(screen.getByRole("button", { name: /^Sair$/i }));
    expect(await screen.findByText(/Explorador da Ilha/i)).toBeInTheDocument();
  }, 15000);

  test("clicking Personalizar Avatar while logged out opens AuthModal then transitions straight to AvatarStudioModal", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAccount).mockResolvedValueOnce(loggedAccount);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: /Personalizar Avatar/i })
    );
    expect(
      await screen.findByText(/Entre ou crie uma conta para personalizar/i)
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Usuário/i), "joao");
    await user.type(screen.getByPlaceholderText(/^Senha$/i), "1234");
    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));

    expect(
      await screen.findByText(/Personalizar Avatar & Perfil/i)
    ).toBeInTheDocument();
  }, 15000);
});
```

- [ ] **Step 2: Run `App.test.tsx` and `HomePage.test.tsx` to verify failure**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui`:
```powershell
npx vitest run src/App.test.tsx src/pages/HomePage.test.tsx
```
Expected: FAIL against old monolithic `HomePage.tsx`.

- [ ] **Step 3: Implement redesigned `ui/src/pages/HomePage.tsx` and `ui/src/pages/HomePage.scss`**

Replace `ui/src/pages/HomePage.tsx`:
```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import {
  DEFAULT_PLAYERS,
  fetchCurrentAccount,
  getAuthConfig,
  getPlayers,
  getSavedAccount,
  listActiveRooms,
  logoutAccount,
  type AuthConfig,
  type PlayerAccount,
  type PlayerEntry,
} from "../utils/apiClient";
import type { Color, RoomState } from "../utils/api.types";
import {
  AVATAR_FRAME_OPTIONS,
  resolveAvatarConfig,
} from "../config/avatarCatalog";
import LeaderboardModal from "../components/LeaderboardModal";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarStudioModal from "../components/AvatarStudioModal";
import AuthModal from "../components/home/AuthModal";
import MatchSetupModal, {
  type MatchSetupMode,
} from "../components/home/MatchSetupModal";
import OpenLobbyModal from "../components/home/OpenLobbyModal";

import "./HomePage.scss";

export default function HomePage() {
  const [available, setAvailable] = useState<PlayerEntry[]>(DEFAULT_PLAYERS);
  const [account, setAccount] = useState<PlayerAccount | null>(() =>
    getSavedAccount()
  );
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    google_enabled: false,
    google_client_id: null,
  });
  const [activeRooms, setActiveRooms] = useState<RoomState[]>([]);

  const [setupMode, setSetupMode] = useState<MatchSetupMode>(null);
  const [openLobbyOpen, setOpenLobbyOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [avatarStudioOpen, setAvatarStudioOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPromptBanner, setAuthPromptBanner] = useState<string | undefined>(
    undefined
  );
  const [pendingAvatarStudioAfterAuth, setPendingAvatarStudioAfterAuth] =
    useState(false);

  const [hostName, setHostName] = useState(
    () =>
      getSavedAccount()?.display_name ||
      localStorage.getItem("catan_player_name") ||
      "Anfitrião"
  );

  const navigate = useNavigate();

  const refreshRooms = useCallback(() => {
    listActiveRooms(account?.auth_token)
      .then(setActiveRooms)
      .catch(() => {});
  }, [account?.auth_token]);

  useEffect(() => {
    getPlayers()
      .then((list) => {
        if (list.length > 0) setAvailable(list);
      })
      .catch(() => setAvailable(DEFAULT_PLAYERS));

    getAuthConfig()
      .then(setAuthConfig)
      .catch(() => {});

    fetchCurrentAccount()
      .then((acc) => {
        if (acc) {
          setAccount(acc);
          setHostName(acc.display_name);
        } else {
          setAccount(null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshRooms();
    const timer = setInterval(refreshRooms, 5000);
    return () => clearInterval(timer);
  }, [refreshRooms]);

  const handleLogout = async () => {
    setAvatarStudioOpen(false);
    setPendingAvatarStudioAfterAuth(false);
    await logoutAccount();
    setAccount(null);
    refreshRooms();
  };

  const handleOpenAuth = (banner?: string, openStudioAfter = false) => {
    setAuthPromptBanner(banner);
    setPendingAvatarStudioAfterAuth(openStudioAfter);
    setAuthModalOpen(true);
  };

  const handleOpenAvatarStudio = () => {
    if (account) {
      setAvatarStudioOpen(true);
      return;
    }
    handleOpenAuth(
      "Entre ou crie uma conta para personalizar e salvar seu avatar na ilha.",
      true
    );
  };

  const resolvedFrame = account
    ? resolveAvatarConfig(account.avatar_config, account.username).frame
    : "wood";
  const frameLabel =
    AVATAR_FRAME_OPTIONS.find((f) => f.value === resolvedFrame)?.label ||
    "Madeira de Colono";

  return (
    <div className="home-page home-page--stage">
      {/* Cabeçalho Simétrico em 3 Colunas (A2) */}
      <header className="home-topbar">
        <div className="home-topbar__left">
          {account ? (
            <div className="home-identity-pill">
              <button
                type="button"
                className="home-identity-pill__avatar-btn"
                onClick={handleOpenAvatarStudio}
                title="Personalizar seu avatar"
              >
                <PlayerAvatar
                  config={account.avatar_config}
                  username={account.username}
                  size={56}
                />
              </button>
              <div className="home-identity-pill__meta">
                <strong>{account.display_name}</strong>
                <small>@{account.username}</small>
                <span className="home-identity-pill__frame">{frameLabel}</span>
              </div>
            </div>
          ) : (
            <div className="home-identity-pill home-identity-pill--guest">
              <div className="home-identity-pill__guest-icon" aria-hidden="true">
                🧭
              </div>
              <div className="home-identity-pill__meta">
                <strong>Explorador da Ilha</strong>
                <small>Modo visitante</small>
                <button
                  type="button"
                  className="home-identity-pill__inline-link"
                  onClick={() => handleOpenAuth()}
                >
                  Entrar na conta →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="home-topbar__center">
          <h1 className="logo">Rule the Isle</h1>
          <p className="home-hero-subtitle">
            Mãos Privadas no Multiplayer • Estratégia em Português
          </p>
        </div>

        <div className="home-topbar__right">
          {account ? (
            <div className="home-rank-pill">
              <div className="home-rank-pill__stats">
                <span className="home-rank-pill__rank">
                  🏆{" "}
                  {typeof account.leaderboard_rank === "number"
                    ? `#${account.leaderboard_rank} no Ranking`
                    : "Ranking Ativo"}
                </span>
                <small>
                  {account.stats?.wins ?? 0} vitórias •{" "}
                  {account.stats?.games_played ?? 0} partidas •{" "}
                  {account.stats?.win_rate ?? 0}%
                </small>
              </div>
              <Button
                size="small"
                variant="outlined"
                className="home-logout-btn"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>
          ) : (
            <div className="home-rank-pill home-rank-pill--guest">
              <div className="home-rank-pill__stats">
                <span className="home-rank-pill__rank">🏆 Ranking Global</span>
                <small>Salve vitórias e desbloqueie molduras</small>
              </div>
              <Button
                size="small"
                variant="contained"
                className="home-login-cta-btn"
                onClick={() => handleOpenAuth()}
              >
                👤 Entrar / Criar Conta
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Centro 100% Aberto destacando a ilha de lobby_hero.webp */}
      <main className="home-stage-window" aria-hidden="true" />

      {/* Doca Inferior Flutuante com os 5 Modos Dedicados + Rodapé Legal */}
      <section className="home-dock-wrap">
        <nav className="home-mode-dock" aria-label="Modos de jogo e perfil">
          <Button
            variant="contained"
            className="home-dock-btn home-dock-btn--solo"
            onClick={() => setSetupMode("solo")}
          >
            ⚔️ Partida Rápida (Solo/IA)
          </Button>
          <Button
            variant="contained"
            className="home-dock-btn home-dock-btn--room"
            onClick={() => setSetupMode("room")}
          >
            🌐 Criar Sala Online
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--lobby"
            onClick={() => {
              refreshRooms();
              setOpenLobbyOpen(true);
            }}
          >
            {activeRooms.length > 0
              ? `🧭 Salas Abertas (${activeRooms.length})`
              : "🧭 Salas Abertas"}
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--ranking"
            onClick={() => setLeaderboardOpen(true)}
          >
            🏆 Ranking & Histórico
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--avatar"
            onClick={handleOpenAvatarStudio}
          >
            🎨 Personalizar Avatar
          </Button>
        </nav>

        <footer className="home-page__legal-footer">
          <strong>Rule the Isle</strong> • Versão modificada em português baseada no motor{" "}
          <a
            href="https://github.com/bcollazo/catanatron"
            target="_blank"
            rel="noreferrer"
          >
            Catanatron
          </a>{" "}
          (Bryan Collazo) • Licença GNU GPL-3.0
        </footer>
      </section>

      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingAvatarStudioAfterAuth(false);
        }}
        authConfig={authConfig}
        promptBanner={authPromptBanner}
        onAuthenticated={(logged) => {
          setAccount(logged);
          setHostName(logged.display_name);
          refreshRooms();
          if (pendingAvatarStudioAfterAuth) {
            setPendingAvatarStudioAfterAuth(false);
            setAvatarStudioOpen(true);
          }
        }}
      />

      <MatchSetupModal
        mode={setupMode}
        onClose={() => setSetupMode(null)}
        availablePlayers={available}
        defaultHostName={hostName}
        account={account}
        onGameCreated={(gameId) => {
          setSetupMode(null);
          navigate("/games/" + gameId);
        }}
        onRoomCreated={(roomCode) => {
          setSetupMode(null);
          navigate(`/rooms/${roomCode}`);
        }}
      />

      <OpenLobbyModal
        open={openLobbyOpen}
        onClose={() => setOpenLobbyOpen(false)}
        rooms={activeRooms}
        onJoinRoom={(roomCode) => {
          setOpenLobbyOpen(false);
          navigate(`/rooms/${roomCode}`);
        }}
        onOpenMatch={(gameId: string, myColor: Color | null) => {
          setOpenLobbyOpen(false);
          const q = myColor ? `?seat=${myColor}` : "";
          navigate(`/games/${gameId}${q}`);
        }}
        onCreateRoomClick={() => {
          setOpenLobbyOpen(false);
          setSetupMode("room");
        }}
        onRefresh={refreshRooms}
      />

      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        currentUsername={account?.username}
      />

      {account && (
        <AvatarStudioModal
          open={avatarStudioOpen}
          onClose={() => setAvatarStudioOpen(false)}
          account={account}
          onSaved={(updated) => {
            setAccount((prev) =>
              prev
                ? {
                    ...prev,
                    ...updated,
                    leaderboard_rank:
                      updated.leaderboard_rank ?? prev.leaderboard_rank ?? null,
                  }
                : updated
            );
            setHostName(updated.display_name);
            refreshRooms();
          }}
        />
      )}
    </div>
  );
}
```

Replace `ui/src/pages/HomePage.scss`:
```scss
@use "../variables.scss";

.home-page--stage {
  height: 100%;
  min-height: 100dvh;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px 24px max(16px, env(safe-area-inset-bottom));
  overflow-x: hidden;
  overflow-y: auto;
  background:
    linear-gradient(
      180deg,
      rgba(6, 13, 24, 0.62) 0%,
      rgba(6, 13, 24, 0.08) 32%,
      rgba(6, 13, 24, 0.06) 64%,
      rgba(6, 13, 24, 0.84) 100%
    ),
    url("/assets/illustrations/ui/lobby_hero.webp") center center / cover no-repeat fixed,
    linear-gradient(180deg, #060d18 0%, #0b192c 55%, #07111e 100%);
}

/* Cabeçalho Simétrico em 3 Colunas (A2) */
.home-topbar {
  width: min(100%, 1340px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(230px, 1fr) auto minmax(240px, 1fr);
  align-items: start;
  gap: 18px;

  &__left {
    display: flex;
    justify-content: flex-start;
  }

  &__center {
    text-align: center;
    padding-top: 2px;
  }

  &__right {
    display: flex;
    justify-content: flex-end;
  }
}

.home-topbar .logo {
  margin: 0;
  font-family: "Cinzel", "Bungee Inline", serif;
  font-weight: 800;
  font-size: clamp(2.15rem, 4.2vw, 3.45rem);
  line-height: 1.04;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #fef9c3 0%, #facc15 55%, #d97706 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.92));
}

.home-hero-subtitle {
  margin: 6px 0 0;
  color: #fde68a;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
}

.home-identity-pill,
.home-rank-pill {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(9, 17, 32, 0.8);
  border: 1px solid rgba(250, 204, 21, 0.36);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
}

.home-identity-pill {
  max-width: 100%;

  &__avatar-btn {
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 50%;
    display: inline-flex;
    flex-shrink: 0;
    transition: transform 0.15s ease;

    &:hover {
      transform: scale(1.06);
    }
  }

  &__guest-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.35rem;
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(250, 204, 21, 0.35);
    flex-shrink: 0;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    strong {
      font-size: 0.95rem;
      color: #fef08a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    small {
      font-size: 0.75rem;
      color: #94a3b8;
    }
  }

  &__frame {
    font-size: 0.7rem;
    font-weight: 700;
    color: #93c5fd;
  }

  &__inline-link {
    padding: 0;
    border: none;
    background: transparent;
    color: #facc15;
    font-size: 0.75rem;
    font-weight: 700;
    text-align: left;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.home-rank-pill {
  justify-content: space-between;

  &__stats {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    text-align: right;

    small {
      font-size: 0.74rem;
      color: #cbd5e1;
    }
  }

  &__rank {
    font-size: 0.9rem;
    font-weight: 800;
    color: #facc15;
  }
}

.home-logout-btn {
  border-color: rgba(255, 255, 255, 0.24) !important;
  color: #cbd5e1 !important;
  text-transform: none !important;
  border-radius: 9px !important;
  flex-shrink: 0;
}

.home-login-cta-btn {
  background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%) !important;
  color: #0f172a !important;
  font-weight: 800 !important;
  border-radius: 10px !important;
  text-transform: none !important;
  flex-shrink: 0;
}

/* Centro Aberto para a Arte da Ilha */
.home-stage-window {
  flex: 1 1 auto;
  min-height: 200px;
  pointer-events: none;
}

/* Doca Inferior Flutuante de Modos */
.home-dock-wrap {
  width: min(100%, 1180px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.home-mode-dock {
  width: fit-content;
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 18px;
  background: rgba(7, 15, 29, 0.82);
  border: 1px solid rgba(250, 204, 21, 0.34);
  backdrop-filter: blur(12px);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.65),
    inset 0 1px 1px rgba(255, 255, 255, 0.08);
}

.home-dock-btn {
  height: 44px;
  padding: 0 16px !important;
  border-radius: 12px !important;
  font-weight: 800 !important;
  font-size: 0.88rem !important;
  text-transform: none !important;
  white-space: nowrap;

  &--solo {
    background: linear-gradient(135deg, #facc15 0%, #eab308 55%, #ca8a04 100%) !important;
    color: #0f172a !important;
    border: 1px solid #fef08a !important;
    box-shadow: 0 8px 22px rgba(234, 179, 8, 0.35) !important;
  }

  &--room {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
    color: #ffffff !important;
    border: 1px solid rgba(96, 165, 250, 0.65) !important;
  }

  &--lobby {
    background: rgba(15, 23, 42, 0.85) !important;
    border-color: rgba(96, 165, 250, 0.45) !important;
    color: #bfdbfe !important;
  }

  &--ranking {
    background: rgba(15, 23, 42, 0.85) !important;
    border-color: rgba(250, 204, 21, 0.42) !important;
    color: #fde047 !important;
  }

  &--avatar {
    background: rgba(15, 23, 42, 0.85) !important;
    border-color: rgba(148, 163, 184, 0.4) !important;
    color: #f1f5f9 !important;
  }
}

.home-page__legal-footer {
  padding: 0 8px;
  text-align: center;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(203, 213, 225, 0.82);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);

  strong {
    color: rgba(254, 240, 138, 0.92);
    font-weight: 700;
  }

  a {
    color: rgba(147, 197, 253, 0.92);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

@media (max-width: variables.$md-breakpoint) {
  .home-page--stage {
    padding: 16px 14px max(16px, env(safe-area-inset-bottom));
  }

  .home-topbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    &__center {
      grid-column: 1 / -1;
      order: -1;
    }

    &__left,
    &__right {
      justify-content: stretch;
    }
  }

  .home-identity-pill,
  .home-rank-pill {
    width: 100%;
  }

  .home-rank-pill__stats {
    align-items: flex-start;
    text-align: left;
  }
}

@media (max-width: 600px) {
  .home-topbar {
    grid-template-columns: 1fr;
  }

  .home-mode-dock {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-dock-btn--solo {
    grid-column: 1 / -1;
  }

  .home-dock-btn {
    padding: 0 10px !important;
    font-size: 0.82rem !important;
  }
}
```

- [ ] **Step 4: Run `tsc --noEmit` and full Vitest suite**

Run from `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1\ui`:
```powershell
npx tsc --noEmit
npx vitest run
```
Expected: `0` TypeScript errors and all test files (`App.test.tsx`, `HomePage.test.tsx`, `AuthModal.test.tsx`, `MatchSetupModal.test.tsx`, `OpenLobbyModal.test.tsx`, `apiClient.test.ts`, plus all prior 12 files) PASS.

- [ ] **Step 5: Commit Task 5**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/pages/HomePage.tsx ui/src/pages/HomePage.scss ui/src/pages/HomePage.test.tsx ui/src/App.test.tsx
git commit -m "feat(home-redesign): implement A2 scenic hero stage and modular lobby dock"
```

---

### Task 6: Documentação (`CONTEXTO_PROJETO.md`) e Verificação Final End-to-End

**Files:**
- Modify: `CONTEXTO_PROJETO.md`

- [ ] **Step 1: Atualizar `CONTEXTO_PROJETO.md`**

Read lines 170-210 of `CONTEXTO_PROJETO.md` first to verify exact context and line endings, then update:
1. In Section 2 (`### Frontend (`ui/`) — React 19 + TypeScript + Vite + SCSS`, line 42), update the `HomePage.tsx` description to note the modular modal suite in `ui/src/components/home/` (`AuthModal.tsx`, `MatchSetupModal.tsx`, `OpenLobbyModal.tsx`).
2. Append the Bloco 3 delivery summary to `### Concluído Recentemente:` right after Bloco 2:
````markdown
- **Bloco 3 Concluído: Redesign da Tela Inicial (Palco A2) & Lobby Aberto Modular:**
  - **Palco Panorâmico A2 (`HomePage.tsx` & `HomePage.scss`):**
    - Remoção do card central sólido que encobria `lobby_hero.webp`, preservando o miolo da ilha 100% descoberto sobre o mar e degradês suaves apenas nas bordas.
    - Cabeçalho simétrico em 3 colunas: cartão do jogador à esquerda (`PlayerAvatar` clicável e moldura atual), título monumental `RULE THE ISLE` centralizado no céu e placa à direita com posição oficial `#rank` no Ranking (`leaderboard_rank` exposto em `models.py` + `localEngine.ts`) e estatísticas.
    - Doca inferior flutuante com os 5 botões dedicados: *Partida Rápida (Solo/IA)*, *Criar Sala Online*, *Salas Abertas*, *Ranking & Histórico* e *Personalizar Avatar*.
  - **Modais Modulares (`ui/src/components/home/`):**
    - `AuthModal.tsx`: login, criação de conta e Google Sign-In em diálogo dedicado (com transição automática para o Studio de Avatar quando acionado deslogado).
    - `MatchSetupModal.tsx`: configuração compartilhada para partidas Solo vs IA e criação de Salas Online com código/link compartilhável.
    - `OpenLobbyModal.tsx`: navegador do Lobby Aberto com entrada rápida por código (`#K7M4P9`), filtros (*Todas*, *Com Vagas*, *Minhas*) e exibição dos `<PlayerAvatar />` nos assentos humanos.
````
3. Update `## 7. Próximos Passos (Bloco 3)` to `## 7. Próximos Passos` marking Bloco 3 completed (`2. ~~**Bloco 3 — Redesign da Tela Inicial e Lobby Aberto**~~ *(Concluído)*`).

- [ ] **Step 2: Run full end-to-end verification (pytest + tsc + vitest + production build)**

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
- All Python tests in `tests/web` PASS.
- `tsc --noEmit` exits with `0`.
- All Vitest suites PASS.
- `npm run build` outputs `dist/` cleanly without errors.

- [ ] **Step 3: Commit Task 6 and check `git status`**

```powershell
Set-Location "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add CONTEXTO_PROJETO.md
git commit -m "docs: document Bloco 3 A2 scenic home stage and modular open lobby"
git status -s
```
Expected: clean working tree on `layout-topbar`.
