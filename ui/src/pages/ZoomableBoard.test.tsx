import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import ZoomableBoard, { CONFIRM_PLACEMENT_STORAGE_KEY } from "./ZoomableBoard";
import { StateProvider, store } from "../store";
import { makeGameState } from "../test/fixtures";
import { postAction } from "../utils/apiClient";
import ACTIONS from "../actions";
import { useContext, useEffect } from "react";
import type { GameState } from "../utils/api.types";

const snackbar = vi.hoisted(() => ({
  enqueueSnackbar: vi.fn(),
  closeSnackbar: vi.fn(),
}));

const zoomControls = vi.hoisted(() => ({
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  resetTransform: vi.fn(),
}));

vi.mock("../utils/apiClient", () => ({
  postAction: vi.fn(),
}));

vi.mock("notistack", () => ({
  useSnackbar: () => snackbar,
}));

vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({ children }: { children: any }) => (
    <div>
      {typeof children === "function"
        ? children(zoomControls)
        : children}
    </div>
  ),
  TransformComponent: ({ children }: { children: any }) => (
    <div>{children}</div>
  ),
}));

const theme = createTheme();

function SeedState({ gameState }: { gameState: GameState }) {
  const { state, dispatch } = useContext(store);
  useEffect(() => {
    dispatch({ type: ACTIONS.SET_GAME_STATE, data: gameState });
  }, [dispatch, gameState]);
  if (!state.gameState) return null;
  return <ZoomableBoard replayMode={false} />;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ZoomableBoard robber victim selector", () => {
  test("displays seat_names instead of color labels (Creitu / Jaó instead of Azul / Laranja)", async () => {
    const gameState = makeGameState({
      colors: ["RED", "BLUE", "ORANGE", "WHITE"],
      bot_colors: ["BLUE", "ORANGE", "WHITE"],
      current_color: "RED",
      current_player_index: 0,
      current_turn_index: 0,
      current_prompt: "MOVE_ROBBER",
      robber_coordinate: [1, -1, 0],
      seat_names: {
        RED: "Anfitrião",
        BLUE: "Creitu",
        ORANGE: "Jaó",
        WHITE: "Guire",
      },
      player_state: {
        ...makeGameState().player_state,
        P1_NUM_RESOURCES_IN_HAND: 4,
        P2_NUM_RESOURCES_IN_HAND: 19,
        P3_NUM_RESOURCES_IN_HAND: 5,
      },
      tiles: [
        {
          coordinate: [0, 0, 0],
          tile: { id: 0, type: "RESOURCE_TILE", resource: "ORE", number: 6 },
        },
        {
          coordinate: [1, -1, 0],
          tile: { id: 1, type: "DESERT" },
        },
      ],
      current_playable_actions: [
        ["RED", "MOVE_ROBBER", [[0, 0, 0], "BLUE"]],
        ["RED", "MOVE_ROBBER", [[0, 0, 0], "ORANGE"]],
        ["RED", "MOVE_ROBBER", [[0, 0, 0], "WHITE"]],
      ],
    });

    vi.mocked(postAction).mockResolvedValue(
      makeGameState({ ...gameState, current_prompt: "PLAY_TURN" })
    );

    const { container } = render(
      <ThemeProvider theme={theme}>
        <StateProvider>
          <MemoryRouter initialEntries={["/games/game-123"]}>
            <Routes>
              <Route
                path="/games/:gameId"
                element={<SeedState gameState={gameState} />}
              />
            </Routes>
          </MemoryRouter>
        </StateProvider>
      </ThemeProvider>
    );

    const tileEl = container.querySelector(".tile");
    expect(tileEl).toBeTruthy();
    fireEvent.click(tileEl!);

    expect(
      await screen.findByText(/Escolha de Quem Roubar 1 Recurso/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Creitu")).toBeInTheDocument();
    expect(screen.getByText("Jaó")).toBeInTheDocument();
    expect(screen.getByText("Guire")).toBeInTheDocument();
    expect(screen.getByText("19 carta(s) na mão")).toBeInTheDocument();
    expect(screen.queryByText("Azul")).not.toBeInTheDocument();
    expect(screen.queryByText("Laranja")).not.toBeInTheDocument();
    expect(screen.queryByText("Branco")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Jaó"));
    expect(postAction).toHaveBeenCalledWith("game-123", [
      "RED",
      "MOVE_ROBBER",
      [[0, 0, 0], "ORANGE"],
    ]);
  });

  test("requires confirmation before placement by default (Catan Universe style), and supports 1-click when toggled off", async () => {
    const buildableState = makeGameState({
      is_initial_build_phase: true,
      current_color: "BLUE",
      current_prompt: "BUILD_INITIAL_SETTLEMENT",
      nodes: {
        "0": {
          id: 0,
          tile_coordinate: [0, 0, 0],
          direction: "SOUTHWEST",
          building: null,
          color: null,
        },
      },
      current_playable_actions: [["BLUE", "BUILD_SETTLEMENT", 0]],
    });
    vi.mocked(postAction).mockResolvedValue(buildableState);

    const renderSeeded = () =>
      render(
        <ThemeProvider theme={theme}>
          <StateProvider>
            <MemoryRouter initialEntries={["/games/game-123"]}>
              <Routes>
                <Route
                  path="/games/:gameId"
                  element={<SeedState gameState={buildableState} />}
                />
              </Routes>
            </MemoryRouter>
          </StateProvider>
        </ThemeProvider>
      );

    const { container, unmount } = renderSeeded();

    const toggleBtn = await screen.findByRole("button", {
      name: /Confirmar jogada em 2 cliques/i,
    });
    // Default is now ENABLED for player safety (Catan Universe behavior)
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");

    const buildableNode = container.querySelector(".node--buildable") as HTMLElement;
    expect(buildableNode).toBeTruthy();

    // 1st click on node opens provisional ghost preview and confirmation dock without executing
    await act(async () => {
      fireEvent.click(buildableNode);
    });
    expect(postAction).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Confirmar construção de Aldeia\?/i)
    ).toBeInTheDocument();
    expect(container.querySelector(".node--pending")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Confirmar Construção/i })
    ).toBeInTheDocument();

    // Cancel clears confirmation bar and ghost preview
    fireEvent.click(screen.getByRole("button", { name: /✕ Cancelar/i }));
    expect(
      screen.queryByText(/Confirmar construção de Aldeia\?/i)
    ).not.toBeInTheDocument();
    expect(postAction).not.toHaveBeenCalled();

    // 1st click then Catan Universe green check button executes postAction
    fireEvent.click(buildableNode);
    expect(
      screen.getByText(/Confirmar construção de Aldeia\?/i)
    ).toBeInTheDocument();
    const cuConfirmBtn = screen.getByRole("button", { name: /Confirmar Construção/i });
    await act(async () => {
      fireEvent.click(cuConfirmBtn);
    });
    expect(postAction).toHaveBeenCalledTimes(1);
    expect(postAction).toHaveBeenCalledWith("game-123", [
      "BLUE",
      "BUILD_SETTLEMENT",
      0,
    ]);

    vi.clearAllMocks();

    // Toggle OFF to switch to instant 1-click
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem(CONFIRM_PLACEMENT_STORAGE_KEY)).toBe("0");

    await act(async () => {
      fireEvent.click(buildableNode);
    });
    expect(postAction).toHaveBeenCalledTimes(1);
    expect(postAction).toHaveBeenCalledWith("game-123", [
      "BLUE",
      "BUILD_SETTLEMENT",
      0,
    ]);

    unmount();
  });

  test("ZoomableBoard provides smooth zoom controls and reset camera buttons", () => {
    const gameState = makeGameState();

    render(
      <ThemeProvider theme={theme}>
        <StateProvider>
          <MemoryRouter initialEntries={["/games/game-123"]}>
            <Routes>
              <Route
                path="/games/:gameId"
                element={<SeedState gameState={gameState} />}
              />
            </Routes>
          </MemoryRouter>
        </StateProvider>
      </ThemeProvider>
    );

    const zoomInBtn = screen.getByLabelText(/Zoom \+/i);
    const zoomOutBtn = screen.getByLabelText(/Zoom -/i);
    const resetBtn = screen.getByLabelText(/Centralizar tabuleiro/i);

    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(zoomInBtn);
    expect(zoomControls.zoomIn).toHaveBeenCalledWith(0.25, 220, "easeOutCubic");

    fireEvent.click(zoomOutBtn);
    expect(zoomControls.zoomOut).toHaveBeenCalledWith(0.25, 220, "easeOutCubic");

    fireEvent.click(resetBtn);
    expect(zoomControls.resetTransform).toHaveBeenCalledWith(250, "easeOutCubic");
  });
});
