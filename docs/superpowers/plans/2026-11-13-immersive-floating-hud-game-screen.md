# Immersive Floating HUD & Enlarged Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the game screen into an immersive full-bleed ocean board with floating glassmorphism HUD docks, expanding the playable island area by +38% to +45%, eliminating zoom stutter with GPU hardware compositing, and repositioning camera controls to eliminate visual collisions.

**Architecture:** Transform the desktop/mobile board from an artificially squeezed flex child with 240px-344px static deductions into a 100% viewport canvas (`inset: 0`). Top and bottom UI bars become floating translucent overlays (`pointer-events: none` container with `pointer-events: auto` on interactive cards), allowing ocean water to bleed seamlessly behind them. CSS GPU acceleration (`will-change: transform`, `transform: translate3d(0,0,0)`) and fine-tuned `react-zoom-pan-pinch` parameters provide 60/120 FPS buttery-smooth wheel and touch zooming.

**Tech Stack:** React 18, TypeScript, SCSS, `react-zoom-pan-pinch`, Material-UI icons, Vitest, Testing Library.

## Global Constraints

- Never break or bypass placement confirmation (`CONFIRM_PLACEMENT_STORAGE_KEY` 2-click build mode).
- Never break node/edge click hitboxes or robber movement tile detection.
- All code changes must be in `ui/` within the repository root `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1`.
- Tests must pass via `npm test` inside `ui/`.
- TypeScript verification (`npx tsc --noEmit`) must succeed with 0 errors.
- Production build (`npm run build`) must succeed.

---

### Task 1: Reescalonamento Ampliado do Tabuleiro & Margens Dinâmicas

**Files:**
- Modify: `ui/src/pages/Board.tsx:93-130`
- Test: `ui/src/pages/Board.test.tsx`

**Interfaces:**
- Consumes: `BoardProps` (`width`, `height`, `containerWidth`, `containerHeight`, `isMobile`, `gameState`, etc.)
- Produces: Larger computed hex `size` in `Board.tsx` (from ~33px up to ~48px-52px on standard desktop/laptop viewports), rendered board dimensions matching measured container bounds without arbitrary 268px-344px height loss.

- [ ] **Step 1: Write the failing test for expanded hex size & dynamic container margins**

In `ui/src/pages/Board.test.tsx`, add a test asserting that on a standard 1200x900 viewport (or 768px height container), the computed board canvas height utilizes the full container height (less safety margins for harbor placards) rather than deducting 268px:

```tsx
test("maximizes canvas height in floating HUD layout instead of subtracting rigid 268px reserved height", () => {
  const gameState = makeGameState();

  const { container } = render(
    <Board
      width={1200}
      height={800}
      containerWidth={1200}
      containerHeight={800}
      buildOnNodeClick={() => () => undefined}
      buildOnEdgeClick={() => () => undefined}
      handleTileClick={() => undefined}
      replayMode={false}
      gameState={gameState}
      isMobile={false}
      show
      isMovingRobber={false}
    />
  );

  const board = container.querySelector(".board") as HTMLElement;
  expect(board).toBeTruthy();
  // Under the old 268px deduction, canvas height was 800 - 268 = 532px.
  // With dynamic floating margins, canvas height utilizes >= 700px of the 800px container.
  const boardHeight = parseInt(board.style.height, 10);
  expect(boardHeight).toBeGreaterThanOrEqual(700);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "ui"
npm test -- Board.test.tsx
```
Expected: FAIL (boardHeight is ~532px, which is < 700px).

- [ ] **Step 3: Update `Board.tsx` with dynamic floating safety margins**

In `ui/src/pages/Board.tsx`, replace the static `reservedHeight` logic (lines ~95-115) with dynamic floating margins that preserve breathing room for the outer harbor ships and placards while letting the board expand:

```tsx
  // Exact available viewport: prefer ResizeObserver container bounds when mounted in ZoomableBoard
  const leftSidebarWidth = 0;
  const isCompactHeight = height <= 520;
  const hasMeasuredContainer =
    typeof containerWidth === "number" &&
    containerWidth > 0 &&
    typeof containerHeight === "number" &&
    containerHeight > 0;
  const fallbackCanvasWidth = Math.max(280, width - leftSidebarWidth);

  // In floating HUD mode, top and bottom bars float over the sea margins.
  // We only reserve minimal safety margin so outer harbor ships and 2:1 placards stay comfortably on-screen.
  const verticalSafetyMargin = isCompactHeight ? 24 : isMobile ? 48 : 64;
  const fallbackCanvasHeight = Math.max(
    isCompactHeight ? 200 : 320,
    height - verticalSafetyMargin
  );

  const canvasWidth = hasMeasuredContainer ? containerWidth : fallbackCanvasWidth;
  const canvasHeight = hasMeasuredContainer
    ? Math.max(200, containerHeight)
    : fallbackCanvasHeight;
  const margin = isMobile ? 12 : 20;

  const size = computeDefaultSize(canvasWidth - margin, canvasHeight - margin);
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd "ui"
npm test -- Board.test.tsx
```
Expected: PASS with 5 passed tests.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/pages/Board.tsx ui/src/pages/Board.test.tsx
git commit -m "feat(board): enlarge board sizing with dynamic floating HUD margins"
```

---

### Task 2: Zoom & Pan Suave com GPU Layer & Configuração do TransformWrapper

**Files:**
- Modify: `ui/src/pages/ZoomableBoard.tsx:325-380`
- Modify: `ui/src/pages/Board.scss:44-55`
- Modify: `ui/src/pages/GameScreen.scss:360-395`
- Test: `ui/src/pages/ZoomableBoard.test.tsx`

**Interfaces:**
- Consumes: `TransformWrapper`, `TransformComponent` from `react-zoom-pan-pinch`.
- Produces: Smooth wheel zoom interpolation, elastic bounds damping (`limitToBounds={true}`), smooth programmatic `zoomIn(0.25, 220, "easeOutCubic")` and `zoomOut(0.25, 220, "easeOutCubic")`, GPU layer promotion via `will-change: transform` and `transform: translate3d(0,0,0)`.

- [ ] **Step 1: Write test for camera smooth zoom calls and zoom wrapper attributes**

In `ui/src/pages/ZoomableBoard.test.tsx`, add a test verifying that zoom buttons trigger smoothly and the camera controls render accessible labels:

```tsx
test("ZoomableBoard provides smooth zoom controls and reset camera buttons", () => {
  const gameState = makeGameState();

  render(
    <ZoomableBoard
      replayMode={false}
    />
  );

  const zoomInBtn = screen.getByLabelText(/Zoom \+/i);
  const zoomOutBtn = screen.getByLabelText(/Zoom -/i);
  const resetBtn = screen.getByLabelText(/Centralizar tabuleiro/i);

  expect(zoomInBtn).toBeInTheDocument();
  expect(zoomOutBtn).toBeInTheDocument();
  expect(resetBtn).toBeInTheDocument();
});
```

- [ ] **Step 2: Update `ZoomableBoard.tsx` configuration for smooth zoom and GPU panning**

In `ui/src/pages/ZoomableBoard.tsx`:
1. Tune `TransformWrapper` props:
```tsx
      <TransformWrapper
        initialScale={1}
        minScale={0.65}
        maxScale={2.5}
        centerOnInit={true}
        limitToBounds={true}
        smooth={true}
        wheel={{ step: 0.05, smoothStep: 0.002 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: true }}
        panning={{
          velocityDisabled: false,
          excluded: [
            "node--buildable",
            "edge--buildable",
            "pulse",
            "camera-btn",
            "board-confirm-toggle",
            "placement-confirm-bar",
            "placement-confirm-btn",
          ],
        }}
      >
```
2. Update the `zoomIn` / `zoomOut` button handlers:
```tsx
              <button
                type="button"
                className="camera-btn"
                onClick={() => zoomIn(0.25, 220, "easeOutCubic")}
                title={t("Aproximar (Zoom +)", "Zoom +")}
                aria-label={t("Zoom +", "Zoom +")}
              >
                <ZoomInIcon fontSize="small" />
              </button>
              <button
                type="button"
                className="camera-btn"
                onClick={() => zoomOut(0.25, 220, "easeOutCubic")}
                title={t("Afastar (Zoom -)", "Zoom -")}
                aria-label={t("Zoom -", "Zoom -")}
              >
                <ZoomOutIcon fontSize="small" />
              </button>
              <button
                type="button"
                className="camera-btn"
                onClick={() => resetTransform(250, "easeOutCubic")}
                title={t("Centralizar tabuleiro", "Center board")}
                aria-label={t("Centralizar tabuleiro", "Center board")}
              >
                <CenterFocusStrongIcon fontSize="small" />
              </button>
```

- [ ] **Step 3: Add GPU hardware acceleration styles in `GameScreen.scss` and `Board.scss`**

In `ui/src/pages/GameScreen.scss` (around line 363):
```scss
  .react-transform-wrapper {
    height: 100%;
    width: 100%;
    touch-action: none;
  }
  .react-transform-component {
    height: 100%;
    width: 100%;
    touch-action: none;
    contain: layout size style;

    .react-transform-element {
      height: 100%;
      width: 100%;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      will-change: transform;
      transform: translate3d(0, 0, 0);
      backface-visibility: hidden;
    }
  }

  .board {
    position: relative;
    opacity: 0;
    height: 100%;
    width: 100%;
    transition: opacity 0.35s ease;
    will-change: transform;
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
  }
```

- [ ] **Step 4: Run tests to verify**

Run:
```bash
cd "ui"
npm test -- ZoomableBoard.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/pages/ZoomableBoard.tsx ui/src/pages/ZoomableBoard.test.tsx ui/src/pages/GameScreen.scss ui/src/pages/Board.scss
git commit -m "feat(board): add gpu hardware acceleration and buttery-smooth zoom easing"
```

---

### Task 3: TopBar Flutuante em Glassmorphism & Tabuleiro Fullscreen

**Files:**
- Modify: `ui/src/pages/GameScreen.tsx:1240-1300`
- Modify: `ui/src/pages/GameScreen.scss:74-175`
- Test: `ui/src/pages/GameScreen.test.tsx`

**Interfaces:**
- Consumes: `gameState`, `playerKey`, `PlayerTopBar`, `ZoomableBoard`.
- Produces: `.game-top-hud-container` (floating translucent top wrapper over the sea), `.board-container` occupying full viewport (`position: absolute; inset: 0`).

- [ ] **Step 1: Check existing `GameScreen.test.tsx` and add assertion for floating top bar container**

In `ui/src/pages/GameScreen.test.tsx`, add a test verifying that `game-top-hud-container` and `board-container` render properly in the DOM:

```tsx
test("renders game-top-hud-container and full-bleed board-container", async () => {
  // Mount GameScreen fixture
  // Assert .game-top-hud-container exists and contains both .game-top-hud and .player-top-bar
});
```

- [ ] **Step 2: Update `GameScreen.tsx` JSX structure**

In `ui/src/pages/GameScreen.tsx`:
Wrap `<header className="game-top-hud">` and `<PlayerTopBar ... />` inside `<div className="game-top-hud-container">`:

```tsx
      <OceanBackdrop />

      {/* Fullscreen Board Canvas */}
      <ZoomableBoard
        replayMode={replayMode}
        recentNodeId={recentPlacedPiece?.kind === "node" ? recentPlacedPiece.id : null}
        recentEdgeId={recentPlacedPiece?.kind === "edge" ? recentPlacedPiece.id : null}
      />

      {/* Floating Top HUD Container (Glassmorphism over sea) */}
      <div className="game-top-hud-container">
        <header className="game-top-hud">
          {/* existing top bar items: Lobby button, logo, room badge, prompt banner, right tools */}
        </header>
        <PlayerTopBar
          gameState={gs}
          perspective={state.perspective}
          replayMode={replayMode}
          onReclaimSeat={handleReclaimSeat}
          activeTaunts={activeTaunts}
          floatingYields={floatingYields}
          floatingVps={floatingVps}
          floatingDiscards={floatingDiscards}
        />
      </div>
```

- [ ] **Step 3: Update `GameScreen.scss` for floating top HUD and full-bleed canvas**

In `ui/src/pages/GameScreen.scss`:
```scss
main.catan-game-screen {
  position: relative;
  background: #031222;
  color: #f8fafc;
  height: 100%;
  width: 100%;
  overflow: hidden;

  .board-container {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

.game-top-hud-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 25;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    180deg,
    rgba(3, 18, 34, 0.94) 0%,
    rgba(3, 18, 34, 0.65) 75%,
    transparent 100%
  );
  backdrop-filter: blur(12px);
  padding-bottom: 6px;

  > * {
    pointer-events: auto;
  }
}

.game-top-hud {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 14px 2px;
  background: transparent;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Run `GameScreen.test.tsx` to verify**

Run:
```bash
cd "ui"
npm test -- GameScreen.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/pages/GameScreen.tsx ui/src/pages/GameScreen.scss ui/src/pages/GameScreen.test.tsx
git commit -m "feat(layout): make top hud and player bar a floating glassmorphism overlay"
```

---

### Task 4: Console Inferior Flutuante & Dock de Câmera Desacoplado

**Files:**
- Modify: `ui/src/pages/ActionsToolbar.scss:1-60`
- Modify: `ui/src/pages/GameScreen.scss:395-430, 665-755`
- Modify: `ui/src/pages/Board.scss:315-395`
- Test: `ui/src/pages/GameScreen.test.tsx`

**Interfaces:**
- Consumes: `ActionsToolbar`, `board-camera-controls`, `placement-confirm-bar`.
- Produces: Floating bottom console dock with blur glassmorphism (`backdrop-filter: blur(16px)`), repositioned camera dock on right margin (`right: 16px; bottom: 120px`), placement confirm bar lifted above the dock (`bottom: 125px`).

- [ ] **Step 1: Update `ActionsToolbar.scss` for floating dock positioning**

In `ui/src/pages/ActionsToolbar.scss`:
```scss
.cu-console-wrapper {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 28;
  width: calc(100% - 32px);
  max-width: 1040px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
}

.cu-bottom-console {
  width: 100%;
  padding: 8px 14px;
  border-radius: 18px;
  background: linear-gradient(
    180deg,
    rgba(20, 28, 44, 0.94) 0%,
    rgba(8, 14, 24, 0.96) 100%
  );
  backdrop-filter: blur(16px);
  border: 1.5px solid rgba(250, 204, 21, 0.45);
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.78),
    inset 0 1px 0 rgba(254, 240, 138, 0.22);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
```

- [ ] **Step 2: Reposition `.board-camera-controls` to the right margin dock**

In `ui/src/pages/GameScreen.scss`:
```scss
.board-camera-controls {
  position: absolute;
  bottom: 120px;
  right: 16px;
  z-index: 26;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border-radius: 14px;
  background: rgba(10, 20, 34, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(250, 204, 21, 0.35);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);

  .camera-btn {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(30, 41, 59, 0.85);
    color: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;

    &:hover {
      background: rgba(51, 65, 85, 0.95);
      border-color: rgba(250, 204, 21, 0.6);
      transform: scale(1.05);
      color: #facc15;
    }
  }
}

@media (max-width: 768px) {
  .board-camera-controls {
    bottom: 140px;
    right: 10px;
    padding: 4px;
    gap: 4px;

    .camera-btn {
      width: 32px;
      height: 32px;
    }
  }
}
```

- [ ] **Step 3: Adjust `.placement-confirm-bar` in `Board.scss`**

In `ui/src/pages/Board.scss`:
Lift `.placement-confirm-bar` to `bottom: 130px;` so it floats gracefully right above the bottom console:
```scss
.placement-confirm-bar {
  position: fixed;
  left: 50%;
  bottom: 130px;
  transform: translateX(-50%);
  z-index: 39;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(10, 20, 34, 0.96);
  backdrop-filter: blur(14px);
  border: 1.5px solid rgba(52, 211, 153, 0.8);
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.75),
    0 0 20px rgba(16, 185, 129, 0.3);
}

@media (max-width: 768px) {
  .placement-confirm-bar {
    bottom: 145px;
    max-width: 94vw;
  }
}
```

- [ ] **Step 4: Run unit tests to verify**

Run:
```bash
cd "ui"
npm test -- GameScreen.test.tsx Board.test.tsx ZoomableBoard.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git add ui/src/pages/ActionsToolbar.scss ui/src/pages/GameScreen.scss ui/src/pages/Board.scss
git commit -m "feat(layout): make action toolbar floating and decouple camera dock"
```

---

### Task 5: Verificação Completa de Regressão, Build e Integração

**Files:**
- Test all: `ui/src/pages/Board.test.tsx`, `ui/src/pages/ZoomableBoard.test.tsx`, `ui/src/pages/GameScreen.test.tsx`, `ui/src/components/DiscardPlannerDialog.test.tsx`, `ui/src/test/simulateRealMatches.test.ts`
- Build & Typecheck: `npx tsc --noEmit` & `npm run build`

- [ ] **Step 1: Run complete frontend unit tests**

Run:
```bash
cd "ui"
npx vitest run --testTimeout=20000 --maxWorkers=2 --minWorkers=1
```
Expected: All test suites pass.

- [ ] **Step 2: Run TypeScript typecheck**

Run:
```bash
cd "ui"
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Run production build**

Run:
```bash
cd "ui"
npm run build
```
Expected: `vite build` completed successfully, producing production bundle in `dist/`.

- [ ] **Step 4: Final verification commit & status check**

```bash
cd "C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1"
git status
```
Expected: Working tree clean.

---
