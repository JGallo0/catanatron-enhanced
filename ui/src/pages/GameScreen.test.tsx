import { useContext } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { StateProvider, store } from "../store";
import type { GameState } from "../utils/api.types";
import {
  abandonGame,
  getState,
  postAction,
  reclaimGame,
  sendGameHeartbeat,
  setPerspective,
} from "../utils/apiClient";
import { dispatchSnackbar } from "../components/Snackbar";
import { makeGameState } from "../test/fixtures";
import GameScreen from "./GameScreen";

const snackbar = vi.hoisted(() => ({
  enqueueSnackbar: vi.fn(),
  closeSnackbar: vi.fn(),
}));

vi.mock("../utils/apiClient", () => ({
  getState: vi.fn(),
  postAction: vi.fn(),
  getMctsAnalysis: vi.fn(),
  setPerspective: vi.fn(),
  sendGameHeartbeat: vi.fn().mockResolvedValue({
    ok: true,
    bot_colors: [],
    taken_over_colors: [],
    my_seat_taken_over: false,
  }),
  abandonGame: vi.fn(),
  reclaimGame: vi.fn(),
  getSavedAccount: vi.fn().mockReturnValue(null),
}));
vi.mock("../components/Snackbar", () => ({
  dispatchSnackbar: vi.fn(),
}));
vi.mock("notistack", () => ({
  useSnackbar: () => snackbar,
}));
vi.mock("./ZoomableBoard", () => ({
  default: () => <div data-testid="board">Board</div>,
}));

const theme = createTheme();
const baseState = makeGameState();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function StateIndexProbe() {
  const { state } = useContext(store);
  return (
    <output data-testid="state-index">{state.gameState?.state_index}</output>
  );
}

function renderGameScreen({
  initialEntry = "/games/game-123",
  routePath = "/games/:gameId",
  replayMode = false,
}: {
  initialEntry?: string;
  routePath?: string;
  replayMode?: boolean;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <StateProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path={routePath}
              element={<GameScreen replayMode={replayMode} />}
            />
          </Routes>
        </MemoryRouter>
        <StateIndexProbe />
      </StateProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

test("loads a persisted API state into the real gameplay controls", async () => {
  vi.mocked(getState).mockResolvedValue(baseState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ROLAR DADOS" })).toBeEnabled();
  expect(screen.getAllByTitle("Victory Points").length).toBeGreaterThan(0);
  expect(screen.getByTestId("state-index")).toHaveTextContent("12");
  expect(getState).toHaveBeenCalledWith("game-123", undefined);
  expect(setPerspective).toHaveBeenCalledWith(null);
  expect(postAction).not.toHaveBeenCalled();
});

test("advances a persisted bot turn and publishes the returned state", async () => {
  const botTurn = makeGameState({ current_color: "RED" });
  const humanTurn: GameState = makeGameState({
    state_index: 13,
    action_records: [
      [["RED", "END_TURN", null], null],
    ] as GameState["action_records"],
  });
  const actionResponse = deferred<GameState>();
  vi.mocked(getState).mockResolvedValue(botTurn);
  vi.mocked(postAction).mockReturnValue(actionResponse.promise);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  expect(postAction).toHaveBeenCalledWith("game-123", undefined, {
    botOnly: true,
  });

  vi.useFakeTimers();
  await act(async () => {
    actionResponse.resolve(humanTurn);
    await actionResponse.promise;
  });

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(screen.getByTestId("state-index")).toHaveTextContent("13");
  expect(screen.getByRole("button", { name: "ROLAR DADOS" })).toBeEnabled();
  expect(dispatchSnackbar).toHaveBeenCalledOnce();
});

test("loads a historical state without advancing bots in replay mode", async () => {
  vi.mocked(getState).mockResolvedValue(makeGameState({ state_index: 7 }));

  renderGameScreen({
    initialEntry: "/games/game-123/states/7",
    routePath: "/games/:gameId/states/:stateIndex",
    replayMode: true,
  });

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  expect(screen.getByTestId("state-index")).toHaveTextContent("7");
  expect(getState).toHaveBeenCalledWith("game-123", "7");
  expect(postAction).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "ROLAR DADOS" })
  ).not.toBeInTheDocument();
});

test("renders original SVG PlayerAvatar for all seats (USER and BOT) with official bot names", async () => {
  const mixedState = makeGameState({
    seat_names: { RED: "Creitu", BLUE: "João" },
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
  expect(screen.getByText("Creitu")).toBeInTheDocument();
  expect(screen.getByText("João")).toBeInTheDocument();
  const avatars = screen.getAllByTestId("player-avatar");
  expect(avatars).toHaveLength(2);
  expect(avatars[1]).toHaveAttribute("data-frame", "gold");
});

test("renders custom guest SVG PlayerAvatar on GUEST seat when configured", async () => {
  localStorage.setItem(
    "catan_guest_profile_v1",
    JSON.stringify({
      display_name: "Navegante",
      customized: true,
      avatar_config: { hat: "explorer", background: "sunset", frame: "wood" },
    })
  );
  const guestState = makeGameState({
    seat_names: { RED: "Felire", BLUE: "Navegante" },
    seat_avatars: {
      RED: { seat_kind: "BOT", username: null, avatar_config: {} },
      BLUE: { seat_kind: "GUEST", username: null, avatar_config: {} },
    },
  });
  vi.mocked(getState).mockResolvedValue(guestState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  expect(screen.getByText("Felire")).toBeInTheDocument();
  const avatars = screen.getAllByTestId("player-avatar");
  expect(avatars).toHaveLength(2);
  localStorage.clear();
});

test("enables Trocar post-roll without maritime 4:1 cards and opens TradeOfferDecisionDialog on DECIDE_TRADE", async () => {
  const postRollState = makeGameState({
    current_color: "BLUE",
    current_prompt: "PLAY_TURN",
    seat_names: { RED: "Creitu", BLUE: "João" },
    player_state: {
      ...baseState.player_state,
      P0_NUM_RESOURCES_IN_HAND: 1,
      P1_HAS_ROLLED: true,
      P1_WOOD_IN_HAND: 1,
    },
    current_playable_actions: [["BLUE", "END_TURN", null]],
  });
  vi.mocked(getState).mockResolvedValue(postRollState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const tradeBtn = screen.getByRole("button", { name: /Trocar/i });
  expect(tradeBtn).toBeEnabled();

  fireEvent.click(tradeBtn);
  expect(
    await screen.findByRole("tab", { name: /Entre Jogadores/i })
  ).toBeInTheDocument();

  cleanup();

  const decideState = makeGameState({
    current_color: "BLUE",
    current_turn_index: 0,
    current_prompt: "DECIDE_TRADE",
    is_resolving_trade: true,
    current_trade: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    seat_names: { RED: "Creitu", BLUE: "João" },
    player_state: {
      ...baseState.player_state,
      P1_WHEAT_IN_HAND: 1,
    },
    current_playable_actions: [
      ["BLUE", "REJECT_TRADE", [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]],
      ["BLUE", "ACCEPT_TRADE", [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]],
    ],
  });
  vi.mocked(getState).mockResolvedValue(decideState);

  renderGameScreen();

  expect(
    await screen.findByText(/Proposta de Troca Recebida/i)
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Aceitar Troca/i })
  ).toBeEnabled();
});

test("toggles pacing speed between Normal (1x) and Rápido (0.5x) and persists catan_game_speed_v1", async () => {
  vi.mocked(getState).mockResolvedValue(baseState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const speedBtn = screen.getByRole("button", { name: /Normal \(1x\)/i });
  expect(speedBtn).toBeInTheDocument();
  expect(localStorage.getItem("catan_game_speed_v1")).toBeNull();

  fireEvent.click(speedBtn);
  expect(
    screen.getByRole("button", { name: /Rápido \(0\.5x\)/i })
  ).toBeInTheDocument();
  expect(localStorage.getItem("catan_game_speed_v1")).toBe("fast");

  fireEvent.click(screen.getByRole("button", { name: /Rápido \(0\.5x\)/i }));
  expect(
    screen.getByRole("button", { name: /Normal \(1x\)/i })
  ).toBeInTheDocument();
  expect(localStorage.getItem("catan_game_speed_v1")).toBe("normal");
});

test("announces the randomized starting player at state_index === 0", async () => {
  const openingState = makeGameState({
    state_index: 0,
    colors: ["ORANGE", "BLUE", "RED", "WHITE"],
    bot_colors: ["RED", "WHITE"],
    current_color: "ORANGE",
    seat_names: {
      ORANGE: "Ana",
      BLUE: "Beto",
      RED: "Creitu",
      WHITE: "Felire",
    },
  });
  vi.mocked(getState).mockResolvedValue(openingState);

  const { container } = renderGameScreen({
    initialEntry: "/games/game-123?seat=BLUE",
  });

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const toast = container.querySelector(".action-spotlight-toast");
  expect(toast).toBeTruthy();
  expect(toast?.textContent).toMatch(/Ordem sorteada: Ana inicia a partida!/i);
});

test("shows animated DiceRollOverlay (Total 8) and .action-spotlight-toast on ROLL transition and clears after delay", async () => {
  const botWait = makeGameState({
    state_index: 12,
    current_color: "RED",
    bot_colors: ["RED"],
    seat_names: { RED: "Creitu", BLUE: "João" },
  });
  const rollState = makeGameState({
    state_index: 13,
    current_color: "RED",
    bot_colors: ["RED"],
    seat_names: { RED: "Creitu", BLUE: "João" },
    action_records: [
      [["RED", "ROLL", null], [3, 5]],
    ] as GameState["action_records"],
  });
  const firstAction = deferred<GameState>();
  const nextBotAction = deferred<GameState>();

  vi.mocked(getState).mockResolvedValue(botWait);
  vi.mocked(postAction)
    .mockReturnValueOnce(firstAction.promise)
    .mockReturnValue(nextBotAction.promise);

  const { container } = renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  expect(postAction).toHaveBeenCalledWith("game-123", undefined, {
    botOnly: true,
  });

  vi.useFakeTimers();
  await act(async () => {
    firstAction.resolve(rollState);
    await firstAction.promise;
  });

  const toast = container.querySelector(".action-spotlight-toast");
  expect(toast).toBeTruthy();
  expect(toast?.textContent).toMatch(/Creitu rolou 8 \(3\+5\)/i);
  expect(screen.getByText(/Rolando\.\.\./i)).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });

  expect(screen.getByText(/Total 8/i)).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(screen.queryByText(/Total 8/i)).not.toBeInTheDocument();
  expect(container.querySelector(".action-spotlight-toast")).toBeNull();
});

test("supports multiplayer Sair (Bot Assume) dialog, abandonGame, Retomar Meu Assento banner, and reclaimGame", async () => {
  const mpState = makeGameState({
    room_code: "ABCD12",
    colors: ["RED", "BLUE"],
    bot_colors: [],
    current_color: "BLUE",
    seat_names: { RED: "Ana", BLUE: "João" },
    seat_avatars: {
      RED: { seat_kind: "USER", username: "ana", avatar_config: {} },
      BLUE: { seat_kind: "USER", username: "joao", avatar_config: {} },
    },
    seat_takeover: {
      RED: {
        taken_over: false,
        reason: null,
        original_username: "ana",
        original_display_name: "Ana",
      },
      BLUE: {
        taken_over: false,
        reason: null,
        original_username: "joao",
        original_display_name: "João",
      },
    },
  });
  const abandonedState = makeGameState({
    ...mpState,
    bot_colors: ["BLUE"],
    taken_over_colors: ["BLUE"],
    seat_names: { RED: "Ana", BLUE: "João (Bot)" },
    seat_takeover: {
      RED: {
        taken_over: false,
        reason: null,
        original_username: "ana",
        original_display_name: "Ana",
      },
      BLUE: {
        taken_over: true,
        reason: "ABANDONED",
        original_username: "joao",
        original_display_name: "João",
      },
    },
  });

  vi.mocked(getState).mockResolvedValue(mpState);
  vi.mocked(abandonGame).mockResolvedValue(abandonedState);
  vi.mocked(reclaimGame).mockResolvedValue(mpState);
  vi.mocked(sendGameHeartbeat).mockResolvedValue({
    ok: true,
    bot_colors: [],
    taken_over_colors: [],
    my_seat_taken_over: false,
  });

  renderGameScreen({ initialEntry: "/games/game-123?seat=BLUE" });

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const abandonBtn = screen.getByRole("button", {
    name: /Sair \(Bot Assume\)/i,
  });
  fireEvent.click(abandonBtn);

  expect(
    await screen.findByText(/Deseja sair e deixar um Bot jogar/i)
  ).toBeInTheDocument();

  const confirmBtn = screen.getByRole("button", {
    name: /Confirmar Saída/i,
  });
  await act(async () => {
    fireEvent.click(confirmBtn);
  });

  expect(abandonGame).toHaveBeenCalledWith("game-123", "BLUE");

  const reclaimBtn = await screen.findByRole("button", {
    name: /Retomar Meu Assento/i,
  });
  expect(reclaimBtn).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(reclaimBtn);
  });

  expect(reclaimGame).toHaveBeenCalledWith("game-123", "BLUE");
  expect(
    screen.queryByRole("button", { name: /Retomar Meu Assento/i })
  ).not.toBeInTheDocument();
});
