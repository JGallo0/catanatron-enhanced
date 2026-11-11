# Bloco 4 — Google OAuth, Player-to-Player Trade, Mobile UX, Bots Oficiais e Avatares SVG Originais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver all Bloco 4 priorities cleanly across Python engine, Flask API, Vercel bundle (`api/catanatron` + `api/index.py`), React/TypeScript UI, offline `localEngine.ts`, and SCSS responsive layouts:
1. Fix Home black rectangle bug caused by unscoped `main { ... }` rules in `ReplayScreen.scss` / `GameScreen.scss`.
2. Make Google OAuth resilient & visible (`.env`/`.env.local` autoload, env var aliases, COOP headers in Flask + `vercel.json`, hardened `GoogleSignInButton`, and visible pt-BR config status in `AuthModal`).
3. Enforce unique official bot names (`Creitu`, `Felire`, `Guiri`, `Jaó`, `Angeleri`) everywhere with zero color names for AI seats.
4. Remove inherited Catan Universe portrait `.webp` assets (`{red,blue,orange,white}.webp`), render 100% `<PlayerAvatar />` SVG everywhere, refresh `AVATAR_PRESETS` & `BOT_AVATAR_PROFILES`, allow guest + logged-in interactive avatar editing, and always prioritize player custom avatars across all screens.
5. Implement complete Player-to-Player Domestic Trade across Python engine (`game.py` validation, `tree_search_utils.py` determinism, `trade_evaluator.py` smart bot negotiation), `localEngine.ts` parity, `TradeModal` (`Entre Jogadores` + `Porto & Banco`), `TradeOfferDecisionDialog`, `ActionsToolbar`, `GameScreen`, `promptUtils`, and `soundEffects`.
6. Optimize mobile layout (`<=768px`, `<=480px`, landscape `max-height: 520px`) with compact HUD, horizontal mini-card strip + tap-to-inspect popover in `PlayerTopBar`, calibrated `Board` height & `touch-action: none`, thumb-friendly bottom dock, and overflow-free modals.

**Tech Stack:** Python 3.12 (Flask, SQLAlchemy, pytest), React 19, TypeScript, Vite 6, MUI v5/v6, SCSS, Vitest + Testing Library.

## Global Constraints
- Work strictly on branch `layout-topbar` inside `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1`; never push or merge to `main`.
- Official bot names spelling: `("Creitu", "Felire", "Guiri", "Jaó", "Angeleri")` — zero color names (`Vermelho`, `Azul`, `Laranja`, `Branco`) for bots.
- Keep `GET /api/players` technical keys & `"HUMAN" -> "Human"`, `"R" -> "Random"` intact for API compatibility tests.
- Keep `RandomPlayer` unchanged for deterministic engine suite (`tests/test_game.py`), while equipping all 6 strategic bots with smart domestic trade evaluation.
- Sync `api/catanatron/` with `catanatron/catanatron/` and prioritize `catanatron/` in `api/index.py`.

---

### Task 1: Python Engine P2P Trade Validation, Tree Search Safety & Smart Bot Evaluator

**Files:**
- Create: `tests/test_domestic_trade.py`
- Modify: `catanatron/catanatron/game.py:23-50`
- Modify: `catanatron/catanatron/players/tree_search_utils.py:24-38`
- Create: `catanatron/catanatron/players/trade_evaluator.py`
- Modify: `catanatron/catanatron/players/value.py:166-187`
- Modify: `catanatron/catanatron/players/minimax.py:55-78`
- Modify: `catanatron/catanatron/players/mcts.py:24-40`
- Modify: `catanatron/catanatron/players/weighted_random.py:20-26`
- Modify: `catanatron/catanatron/players/search.py:17-35`
- Modify: `catanatron/catanatron/players/playouts.py:31-57`

- [ ] **Step 1:** Write failing unit tests in `tests/test_domestic_trade.py` verifying:
  - `is_valid_action` rejects `OFFER_TRADE` during initial build phase, during `is_road_building`, while `is_resolving_trade`, when offering cards the player does not hold, or when offering/asking non-int / bool / negative values.
  - `AlphaBetaPlayer` and `MCTSPlayer` safely simulate states during `DECIDE_TRADE` and `DECIDE_ACCEPTEES` without raising `Unknown ActionType`.
  - Strategic bots (`ValueFunctionPlayer`, `AlphaBetaPlayer`, `WeightedRandomPlayer`, `VictoryPointPlayer`, `MCTSPlayer`, `GreedyPlayoutsPlayer`) accept mutually beneficial trades (or immediate settlement/city unlocks) and reject bad giveaways, while `RandomPlayer` keeps original random sampling behavior.
  - Full 3-step roundtrip `OFFER_TRADE -> ACCEPT_TRADE / REJECT_TRADE -> CONFIRM_TRADE / CANCEL_TRADE` swaps exact resources and returns prompt to `PLAY_TURN`.
- [ ] **Step 2:** Run pytest on `tests/test_domestic_trade.py` and verify failures on missing checks / `tree_search_utils` / `trade_evaluator`.
- [ ] **Step 3:** Harden `catanatron/catanatron/game.py:is_valid_action` & `is_valid_trade`:
  - Check `not state.is_initial_build_phase`, `not state.is_road_building`, `not state.is_resolving_trade`, `state.current_color() == action.color`, `state.current_prompt == ActionPrompt.PLAY_TURN`, `player_has_rolled(state, action.color)`, and `player_resource_freqdeck_contains(state, action.color, offering)`.
  - In `is_valid_trade(action_value)`: verify tuple/list length `== 10`, every item `isinstance(x, int) and not isinstance(x, bool) and x >= 0`, `sum(offering) > 0`, `sum(asking) > 0`, and no resource appears on both sides.
- [ ] **Step 4:** Add `ActionType.OFFER_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `CONFIRM_TRADE`, `CANCEL_TRADE` to `DETERMINISTIC_ACTIONS` in `tree_search_utils.py`.
- [ ] **Step 5:** Implement `catanatron/catanatron/players/trade_evaluator.py` with `evaluate_trade_decision(player_color, game, playable_actions, value_fn=None) -> Action | None` handling `DECIDE_TRADE` (`ACCEPT_TRADE` vs `REJECT_TRADE` scoring strategic value gain + build completion bonus + anti-leader guard) and `DECIDE_ACCEPTEES` (`CONFIRM_TRADE` preferring weakest/best net gain partner vs `CANCEL_TRADE`), and hook into the 6 strategic bots when `state.current_prompt in (ActionPrompt.DECIDE_TRADE, ActionPrompt.DECIDE_ACCEPTEES)`.
- [ ] **Step 6:** Run full pytest suite (`.\.venv\Scripts\python.exe -m pytest -o addopts="" tests -v`), ensure 100% green, and commit `feat(engine): harden domestic trade validation, search safety and smart bot negotiation`.

---

### Task 2: Flask `.env` Autoload, COOP Headers, Official Bot Names, Guest/User Avatar Persistence & Vercel Sync

**Files:**
- Modify: `catanatron/catanatron/web/__init__.py`
- Modify: `vercel.json`
- Modify: `api/index.py`
- Modify: `catanatron/catanatron/web/models.py`
- Modify: `catanatron/catanatron/web/api.py`
- Sync: `api/catanatron/**`
- Modify: `tests/web/test_auth_and_ranking.py`
- Create: `tests/web/test_rooms_and_bots.py`

- [ ] **Step 1:** Add failing tests in `tests/web/test_auth_and_ranking.py` and `tests/web/test_rooms_and_bots.py`:
  - `GET /api/auth/config` sets `Cross-Origin-Opener-Policy: same-origin-allow-popups`, accepts `GOOGLE_OAUTH_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` fallback, and `create_app()` loads `.env` / `.env.local` if present.
  - `POST /api/auth/register` and `POST /api/auth/google` accept optional unlocked `avatar_config` (stripping locked frames like `imperial` when 0 wins rather than failing login/signup!).
  - `POST /api/games`, `POST /api/rooms`, `PATCH /api/rooms/<code >`, `POST /api/rooms/<code >/start`, `GET /api/matches` assign unique bot names strictly from `("Creitu", "Felire", "Guiri", "Jaó", "Angeleri")` with zero color names and zero `IA (...)` / `Bot (...)` prefixes; `BOT` and custom `GUEST` `avatar_config` appear in `seat_avatars` and `room.seats`.
  - Test verifying recursive parity between `catanatron/catanatron` and `api/catanatron`.
- [ ] **Step 2:** Run pytest on those test files to confirm failure before implementation.
- [ ] **Step 3:** Update `catanatron/catanatron/web/__init__.py` (`_load_dotenv_files()`, `after_request` COOP header `same-origin-allow-popups`) and `vercel.json` (`headers` for COOP + Referrer-Policy).
- [ ] **Step 4:** Update `models.py` & `api.py`:
  - Add `OFFICIAL_BOT_NAMES = ("Creitu", "Felire", "Guiri", "Jaó", "Angeleri")`, `pick_bot_names(count, exclude=...)`, `BOT_AVATAR_BY_NAME` SVG profiles matching frontend `BOT_AVATAR_PROFILES`, and safe `avatar_config` storage on `GUEST` seats + initial account creation (`register_user`, `login_with_google_claims`).
  - Pass optional `avatar_config` in `/games`, `/rooms`, `/rooms/<code>/join`, `/auth/register`, `/auth/google`; hydrate `seat_avatars` cleanly for `USER`, `GUEST` (preserving guest interactive avatar!), and `BOT`.
- [ ] **Step 5:** Update `api/index.py` import priority (`ROOT_DIR/catanatron` highest) and copy updated `catanatron/catanatron/` files into `api/catanatron/` so Serverless and tests are 100% identical.
- [ ] **Step 6:** Run full web pytest (`.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web -v`), verify pass, and commit.

---

### Task 3: Fix Home Black Rectangle, Harden Google UI, Bot/Avatar SVG Catalogs & `.webp` Removal

**Files:**
- Delete (`git rm`): `ui/public/assets/illustrations/avatars/{red,blue,orange,white}.webp`
- Modify: `ui/src/pages/ReplayScreen.scss`, `ui/src/pages/ReplayScreen.tsx`
- Modify: `ui/src/pages/GameScreen.scss`, `ui/src/pages/GameScreen.tsx`
- Modify: `ui/src/pages/HomePage.scss`, `ui/src/pages/HomePage.tsx`
- Modify: `ui/src/components/GoogleSignInButton.tsx`
- Modify: `ui/src/components/home/AuthModal.tsx`, `ui/src/components/home/AuthModal.scss`
- Create: `ui/src/config/botCatalog.ts`
- Modify: `ui/src/config/avatarCatalog.ts`
- Modify: `ui/src/components/AvatarStudioModal.tsx`
- Modify: `ui/src/components/PlayerTopBar.tsx`, `ui/src/components/PlayerTopBar.scss`
- Modify: `ui/src/components/home/OpenLobbyModal.tsx`, `ui/src/pages/RoomLobbyPage.tsx`
- Modify: `ui/src/utils/apiClient.ts`, `ui/src/utils/localEngine.ts`
- Tests: `ui/src/pages/HomePage.test.tsx`, `ui/src/components/home/AuthModal.test.tsx`, `ui/src/components/AvatarStudioModal.test.tsx`, `ui/src/components/PlayerTopBar.test.tsx`, `ui/src/utils/apiClient.test.ts`

- [ ] **Step 1:** Remove inherited `.webp` avatars via `git rm` and scope `main` in `ReplayScreen.scss`/`.tsx` and `GameScreen.scss`/`.tsx`; drop `fixed` background attachment in `HomePage.scss`.
- [ ] **Step 2:** Create `ui/src/config/botCatalog.ts` exporting `OFFICIAL_BOT_NAMES`, `BOT_AVATAR_PROFILES`, `pickBotNames`, `resolveSeatAvatar`; refresh `AVATAR_PRESETS` in `ui/src/config/avatarCatalog.ts` and add guest profile helpers (`getGuestProfile`, `saveGuestProfile`, `getActiveCustomAvatarPayload`).
- [ ] **Step 3:** Upgrade `GoogleSignInButton.tsx` (callback ref, responsive width `<= 320px`, GSI error notice when blocked) and `AuthModal.tsx` (always render Google section: live button when enabled, honest pt-BR configuration notice when disabled; carry guest custom `avatar_config` on register/Google).
- [ ] **Step 4:** Enable interactive avatar customization directly for guests (`HomePage.tsx` + `AvatarStudioModal.tsx` dual logged/guest mode), propagate guest/user `avatar_config` through `apiClient.ts` & `localEngine.ts` (`createGame`, `createRoom`, `joinRoom`, `registerAccount`, `loginWithGoogle`), replace every bot portrait & name in `PlayerTopBar`, `RoomLobbyPage`, `OpenLobbyModal`, `GameScreen`, `Prompt`, `localEngine` with `<PlayerAvatar />` and `OFFICIAL_BOT_NAMES`, and delete the `Mia` `#1b6535` CSS rule.
- [ ] **Step 5:** Add/update Vitest unit tests (`HomePage.test.tsx`, `AuthModal.test.tsx`, `AvatarStudioModal.test.tsx`, `PlayerTopBar.test.tsx`, `apiClient.test.ts`), run `npx tsc --noEmit` and `npx vitest run`, fix any failure, and commit.

---

### Task 4: Player-to-Player Domestic Trade UI & `localEngine.ts` State Machine

**Files:**
- Modify: `ui/src/utils/api.types.ts`
- Modify: `ui/src/utils/promptUtils.ts`, `ui/src/utils/promptUtils.test.ts`
- Modify: `ui/src/utils/soundEffects.ts`
- Modify: `ui/src/utils/localEngine.ts`
- Modify: `ui/src/components/TradeModal.tsx`, `ui/src/pages/ActionsToolbar.scss`
- Create: `ui/src/components/TradeOfferDecisionDialog.tsx`, `ui/src/components/TradeOfferDecisionDialog.scss`
- Modify: `ui/src/pages/ActionsToolbar.tsx`, `ui/src/pages/GameScreen.tsx`
- Create/Update Tests: `ui/src/components/TradeModal.test.tsx`, `ui/src/components/TradeOfferDecisionDialog.test.tsx`, `ui/src/utils/localEngineTrade.test.ts`

- [ ] **Step 1:** Extend `api.types.ts` (`OfferTradeAction`, `AcceptTradeAction`, `RejectTradeAction`, `ConfirmTradeAction`, `CancelTradeAction`, `is_resolving_trade?`, `current_trade?`, `acceptees?`), `promptUtils.ts` (pt-BR + EN formatting for all 5 domestic trade actions), and `soundEffects.ts`.
- [ ] **Step 2:** Implement full 3-step domestic trade execution (`PLAY_TURN` -> `DECIDE_TRADE` -> `DECIDE_ACCEPTEES` / cancel) and smart bot trade responder/confirmer heuristics in `localEngine.ts` + failing-first Vitest coverage.
- [ ] **Step 3:** Upgrade `TradeModal.tsx` with `🤝 Entre Jogadores` (resource steppers `-`/`+` limited to player hand for offers, clear swap preview, anti-self-resource guard, submits `OFFER_TRADE`) and `⚓ Porto & Banco` tabs.
- [ ] **Step 4:** Build `TradeOfferDecisionDialog.tsx`/`.scss` handling both `DECIDE_TRADE` (proposer `<PlayerAvatar />`, Offered vs Requested resources, `Aceitar Proposta` / `Recusar`) and `DECIDE_ACCEPTEES` (list of responding seats with `<PlayerAvatar />` status badges, `Trocar com <Nome>` button per acceptee, and `Cancelar Troca`), and wire into `GameScreen.tsx` + enable `Trocar` in `ActionsToolbar.tsx` whenever `isInteractiveTurn && !isPlayingDevCard && gameState.current_prompt === "PLAY_TURN" && !gameState.is_initial_build_phase && !gameState.is_resolving_trade && !isRoll`.
- [ ] **Step 5:** Add `TradeModal.test.tsx`, `TradeOfferDecisionDialog.test.tsx`, `promptUtils.test.ts` cases, run `npx tsc --noEmit` & `npx vitest run`, verify green, and commit.

---

### Task 5: Mobile-First Responsive Overhaul Across Table, HUD, Dock & Modals

**Files:**
- Modify: `ui/src/components/PlayerTopBar.tsx`, `ui/src/components/PlayerTopBar.scss`, `ui/src/components/PlayerTopBar.test.tsx`
- Modify: `ui/src/pages/Board.tsx`, `ui/src/pages/ZoomableBoard.tsx`, `ui/src/pages/Board.scss`
- Modify: `ui/src/pages/GameScreen.scss`, `ui/src/pages/ActionsToolbar.scss`
- Modify: `ui/src/components/DiscardPlannerDialog.scss` / `ResourceSelector.scss` / `TradeOfferDecisionDialog.scss` / `RoomLobbyPage.scss` / `HomePage.scss` / `components/home/*.scss` / `LeaderboardModal.scss` / `AvatarStudioModal.scss`

- [ ] **Step 1:** Add mobile compact strip mode (`<=768px`) with tap-to-inspect popover to `PlayerTopBar.tsx`/`.scss`, preserving full desktop card metrics and zero portrait overlap.
- [ ] **Step 2:** Calibrate `Board.tsx` `canvasHeight` for mobile portrait (`<=768px`) & compact landscape (`height <= 520px`), set `touch-action: none` in `ZoomableBoard.tsx`/`Board.scss`, and tighten `.game-top-hud` (`GameScreen.scss`) and `.cu-bottom-console` (`ActionsToolbar.scss`) so the board retains `~60%+` vertical space and cards scroll horizontally cleanly on `375px` width.
- [ ] **Step 3:** Harden all modal/lobby stylesheets (`44px+` touch targets, full-screen/near-full-width padding, scroll-safe dialogs, zero horizontal overflow across `360px`–`430px`).
- [ ] **Step 4:** Extend `PlayerTopBar.test.tsx` and `Board.test.tsx` to cover mobile inspect popover and compact board height calculation; run `npx tsc --noEmit`, `npx vitest run`, `npm run build`, verify green, and commit.

---

### Task 6: Sync Docs, Full Regression Verification & Live Browser Inspection (`1280×800` & `375×812`)

**Files:**
- Modify: `CONTEXTO_PROJETO.md`

- [ ] **Step 1:** Update `CONTEXTO_PROJETO.md` reflecting Bloco 4 changes (removal of inherited `.webp` avatars, `<PlayerAvatar />` + custom avatar precedence, `Creitu`/`Felire`/`Guiri`/`Jaó`/`Angeleri`, Google OAuth env + COOP, P2P domestic trade, mobile layout) and commit.
- [ ] **Step 2:** Run full backend test suite (`.\.venv\Scripts\python.exe -m pytest -o addopts="" tests -v`) and full frontend checks (`npx tsc --noEmit`, `npx vitest run`, `npm run build`).
- [ ] **Step 3:** Restart Flask daemon (`task-1631`) so live port 5001 runs the new Bloco 4 backend, verify HTTP `/api/auth/config` (`Cross-Origin-Opener-Policy: same-origin-allow-popups`), `/api/games` official bot names & `seat_avatars`, and run the `browser` subagent on `http://localhost:3000` at both `1280×800` and `375×812` to confirm zero black rectangle on HomePage, visible Google auth UI in `AuthModal`, interactive custom SVG avatars for guest/logged user & bots (`Creitu`, `Felire`, `Guiri`, `Jaó`, `Angeleri`), working P2P trade workbench, zero horizontal overflow, and zero console/runtime errors.
