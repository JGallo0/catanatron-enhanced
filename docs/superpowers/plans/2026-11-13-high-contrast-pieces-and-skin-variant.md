# High-Contrast Pieces & Skin Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement approved high-contrast clean piece models (Aldeia B, Estrada B, Cidade A/B) as the default base in Rule the Isle, keeping the existing detailed cottage models as a selectable piece skin variant.

**Architecture:** Create an isolated `pieceSkin.ts` module with localStorage persistence and custom event broadcasting mirroring `boardSkin.ts`. Update `GameIcons.tsx` components to render the high-contrast models by default while preserving the previous cottage models under the `cottage` skin. Add a reactive toggle button with toast feedback in `GameScreen.tsx` dock.

**Tech Stack:** React 18, TypeScript 5, SCSS, Vitest, Testing Library, SVG vectors.

## Global Constraints
- Directory safety: Always run git and terminal commands inside `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1`.
- Vitest tests: Always run from `ui/` with `--run` flag.
- Default piece skin: `"contrast"` (Option B + City A).
- Variant piece skin: `"cottage"` (Previous illustrated cottage with chimney/doors & tubular road).
- Storage key: `"catan_piece_skin_v1"`.
- Event name: `"catan_piece_skin_changed"`.

---

### Task 1: Create `pieceSkin.ts` and Unit Tests

**Files:**
- Create: `ui/src/utils/pieceSkin.ts`
- Create: `ui/src/utils/pieceSkin.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `export type PieceSkinId = "contrast" | "cottage"`
  - `export interface PieceSkinMeta`
  - `export const PIECE_SKINS: Record<PieceSkinId, PieceSkinMeta>`
  - `export function getSavedPieceSkin(): PieceSkinId`
  - `export function savePieceSkin(skin: PieceSkinId): void`
  - `export function togglePieceSkin(current?: PieceSkinId): PieceSkinId`
  - `export function usePieceSkin(): { skin: PieceSkinId; setSkin: (s: PieceSkinId) => void; toggle: () => PieceSkinId }`

- [ ] **Step 1: Write unit tests in `ui/src/utils/pieceSkin.test.ts`**
- [ ] **Step 2: Run test to verify it fails (`npm test -- pieceSkin.test.ts --run`)**
- [ ] **Step 3: Implement `ui/src/utils/pieceSkin.ts`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit `pieceSkin` module**

---

### Task 2: Update `GameIcons.tsx` for Settlement, City, and Road Pieces

**Files:**
- Modify: `ui/src/components/icons/GameIcons.tsx`
- Test: `ui/src/components/icons/GameIcons.test.tsx` (or update existing component tests)

**Interfaces:**
- Consumes: `PieceSkinId`, `getSavedPieceSkin`, `usePieceSkin` from `../utils/pieceSkin`
- Produces:
  - `SettlementSvgPiece({ color, scale, skin })`: Renders high-contrast dual-border house when `skin === "contrast"` (default); renders cottage with chimney when `skin === "cottage"`.
  - `CitySvgPiece({ color, scale, skin })`: Renders stepped peaked tower + main hall with dual-border when `skin === "contrast"`; renders keep/hall with spire when `skin === "cottage"`.
  - `RoadSvgPiece({ color, className, skin })`: Renders straight rectangular bar with dual-border when `skin === "contrast"`; renders tubular bar when `skin === "cottage"`.

- [ ] **Step 1: Write test cases verifying both skins render appropriate SVG elements**
- [ ] **Step 2: Update `SettlementSvgPiece`, `CitySvgPiece`, and `RoadSvgPiece` in `GameIcons.tsx`**
- [ ] **Step 3: Verify tests pass and typescript types are sound**
- [ ] **Step 4: Commit `GameIcons.tsx` updates**

---

### Task 3: Reactive Skin Hook Integration in `Node.tsx`, `Edge.tsx`, `PlayerStateBox.tsx`, and `ActionsToolbar.tsx`

**Files:**
- Modify: `ui/src/pages/Node.tsx`
- Modify: `ui/src/pages/Edge.tsx`
- Modify: `ui/src/components/PlayerStateBox.tsx`
- Modify: `ui/src/pages/ActionsToolbar.tsx`

**Interfaces:**
- Consumes: `usePieceSkin` from `../utils/pieceSkin`
- Produces: Seamless live piece skin re-rendering on the board and in inventory cards without page refresh.

- [ ] **Step 1: Add `usePieceSkin()` to `Node.tsx` and pass `skin` to `SettlementSvgPiece` and `CitySvgPiece`**
- [ ] **Step 2: Add `usePieceSkin()` to `Edge.tsx` and pass `skin` to `RoadSvgPiece`**
- [ ] **Step 3: Add `usePieceSkin()` to `PlayerStateBox.tsx` and `ActionsToolbar.tsx`**
- [ ] **Step 4: Run existing board tests (`npm test -- --run`) to verify no regressions**
- [ ] **Step 5: Commit board integration**

---

### Task 4: Add Piece Skin Toggle Button to `GameScreen.tsx` Left Dock

**Files:**
- Modify: `ui/src/pages/GameScreen.tsx`
- Modify: `ui/src/pages/GameScreen.test.tsx`

**Interfaces:**
- Consumes: `usePieceSkin` from `../utils/pieceSkin`
- Produces: Piece skin toggle button in `game-left-dock` with icon 🏰, tag `Min`/`Det`, and localized snackbar notification.

- [ ] **Step 1: Add piece skin toggle test in `GameScreen.test.tsx`**
- [ ] **Step 2: Add `usePieceSkin()` button in `GameScreen.tsx` alongside board skin button**
- [ ] **Step 3: Run `GameScreen.test.tsx` to verify passing**
- [ ] **Step 4: Commit `GameScreen.tsx` dock button**

---

### Task 5: Full Verification, TypeScript Check & Production Build

**Files:**
- All modified files across `ui/src`
- Docs update: `CONTEXTO_PROJETO.md`

- [ ] **Step 1: Run complete Vitest suite (`npm test -- --run`)**
- [ ] **Step 2: Run `tsc --noEmit`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Commit and push to `origin/main`**
