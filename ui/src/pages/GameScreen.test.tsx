import { useContext } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { StateProvider, store } from "../store";
import type { GameState } from "../utils/api.types";
import {
  abandonGame,
  getGameMessages,
  getState,
  postAction,
  reclaimGame,
  sendGameHeartbeat,
  sendGameMessage,
  setPerspective,
} from "../utils/apiClient";
import { dispatchSnackbar } from "../components/Snackbar";
import { setLanguage } from "../i18n";
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
  getGameMessages: vi.fn().mockResolvedValue([]),
  sendGameMessage: vi.fn(),
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
  default: () => <div data-testid="board" className="board-container">Board</div>,
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
  setLanguage("pt");
  vi.useRealTimers();
});

test("loads a persisted API state into the real gameplay controls", async () => {
  vi.mocked(getState).mockResolvedValue(baseState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ROLAR DADOS" })).toBeEnabled();
  expect(screen.getAllByTitle("Pontos de Vitória").length).toBeGreaterThan(0);
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

test("cycles pacing speed across Normal, Rápida, and Turbo and persists catan_game_speed_v1", async () => {
  vi.mocked(getState).mockResolvedValue(baseState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const normalBtn = screen.getByRole("button", { name: /Velocidade: Normal/i });
  expect(normalBtn).toBeInTheDocument();
  expect(localStorage.getItem("catan_game_speed_v1")).toBeNull();

  fireEvent.click(normalBtn);
  const fastBtn = screen.getByRole("button", { name: /Velocidade: Rápida/i });
  expect(fastBtn).toBeInTheDocument();
  expect(localStorage.getItem("catan_game_speed_v1")).toBe("fast");

  fireEvent.click(fastBtn);
  const turboBtn = screen.getByRole("button", { name: /Velocidade: Turbo/i });
  expect(turboBtn).toBeInTheDocument();
  expect(localStorage.getItem("catan_game_speed_v1")).toBe("turbo");

  fireEvent.click(turboBtn);
  expect(
    screen.getByRole("button", { name: /Velocidade: Normal/i })
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
  expect(container.querySelector(".ocean-panorama-backdrop")).toBeInTheDocument();
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
    await vi.advanceTimersByTimeAsync(3350);
  });

  expect(screen.getByText(/Total 8/i)).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5200);
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

test("supports in-match chat sending and incoming peer unread badge notifications", async () => {
  vi.useFakeTimers();
  const mpState = makeGameState({
    room_code: "CHAT99",
    colors: ["RED", "BLUE"],
    bot_colors: [],
    current_color: "BLUE",
    seat_names: { RED: "Ana", BLUE: "João" },
  });

  vi.mocked(getState).mockResolvedValue(mpState);
  vi.mocked(getGameMessages).mockResolvedValue([]);
  vi.mocked(sendGameMessage).mockResolvedValue({
    id: 1,
    game_id: "game-123",
    color: "BLUE",
    sender_name: "João",
    kind: "CHAT",
    body: "Troco tijolo!",
    created_at: 1700000100,
  });

  renderGameScreen({ initialEntry: "/games/game-123?seat=BLUE" });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
  expect(screen.getByTestId("board")).toBeInTheDocument();

  const chatBtn = screen.getByRole("button", { name: /^Bate-papo$/i });
  await act(async () => {
    fireEvent.click(chatBtn);
    await vi.advanceTimersByTimeAsync(10);
  });

  const input = screen.getByLabelText("Mensagem de bate-papo");
  fireEvent.change(input, { target: { value: "Troco tijolo!" } });
  await act(async () => {
    fireEvent.submit(input.closest("form")!);
  });

  expect(sendGameMessage).toHaveBeenCalledWith("game-123", {
    body: "Troco tijolo!",
    color: "BLUE",
    senderName: "João",
  });
  expect(screen.getByText("Troco tijolo!")).toBeInTheDocument();

  // Close chat and simulate peer message arriving on poll
  fireEvent.click(screen.getByRole("button", { name: "Fechar bate-papo" }));

  vi.mocked(getGameMessages).mockResolvedValueOnce([
    {
      id: 2,
      game_id: "game-123",
      color: "RED",
      sender_name: "Ana",
      kind: "CHAT",
      body: "Fechado!",
      created_at: 1700000120,
    },
  ]);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });

  expect(
    screen.getByRole("button", { name: /Bate-papo \(1 não lidas\)/i })
  ).toBeInTheDocument();
  expect(screen.getByText("Fechado!")).toBeInTheDocument();
});

test("shows 10s 'Boa Guerra' splash at state_index === 0 while gating bots until elapsed and supports Zarpar early dismiss", async () => {
  vi.useFakeTimers();
  const introBotState = makeGameState({
    state_index: 0,
    colors: ["RED", "BLUE"],
    bot_colors: ["RED"],
    current_color: "RED",
    seat_names: { RED: "Creitu", BLUE: "João" },
  });
  vi.mocked(getState).mockResolvedValue(introBotState);
  vi.mocked(postAction).mockResolvedValue(introBotState);

  renderGameScreen({ initialEntry: "/games/game-123?seat=BLUE" });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });

  expect(screen.getByText("Boa Guerra")).toBeInTheDocument();
  expect(postAction).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(9800);
  });
  expect(screen.getByText("Boa Guerra")).toBeInTheDocument();
  expect(postAction).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });

  expect(screen.queryByText("Boa Guerra")).not.toBeInTheDocument();
  expect(postAction).toHaveBeenCalledWith("game-123", undefined, {
    botOnly: true,
  });

  cleanup();
  vi.clearAllMocks();
  vi.mocked(getState).mockResolvedValue(introBotState);
  vi.mocked(postAction).mockResolvedValue(introBotState);

  renderGameScreen({ initialEntry: "/games/game-123?seat=BLUE" });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByText("Boa Guerra")).toBeInTheDocument();
  const zarparBtn = screen.getByRole("button", { name: /Zarpar para a Ilha/i });
  await act(async () => {
    fireEvent.click(zarparBtn);
  });
  expect(screen.queryByText("Boa Guerra")).not.toBeInTheDocument();
  expect(postAction).toHaveBeenCalledWith("game-123", undefined, {
    botOnly: true,
  });
});

test("shows 3s 'Vez de ...' turn transition banner and visible discarded resource drops", async () => {
  const botTurn = makeGameState({
    state_index: 12,
    current_color: "RED",
    bot_colors: ["RED"],
    seat_names: { RED: "Jaó", BLUE: "João" },
    action_records: [],
  });
  const afterTurn = makeGameState({
    state_index: 15,
    current_color: "BLUE",
    bot_colors: ["RED"],
    seat_names: { RED: "Jaó", BLUE: "João" },
    action_records: [
      [["RED", "DISCARD_RESOURCE", "BRICK"], "BRICK"],
      [["RED", "DISCARD_RESOURCE", "WOOD"], "WOOD"],
      [["RED", "END_TURN", null], null],
    ] as GameState["action_records"],
  });
  const firstAction = deferred<GameState>();
  vi.mocked(getState).mockResolvedValue(botTurn);
  vi.mocked(postAction).mockReturnValue(firstAction.promise);

  renderGameScreen({ initialEntry: "/games/game-123?seat=BLUE" });

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  vi.useFakeTimers();

  await act(async () => {
    firstAction.resolve(afterTurn);
    await firstAction.promise;
  });

  expect(screen.getByText(/Vez de João — Sua vez!/i)).toBeInTheDocument();
  expect(screen.getByText("−Argila")).toBeInTheDocument();
  expect(screen.getByText("−Madeira")).toBeInTheDocument();
  expect(
    screen.getByRole("complementary", { name: /Últimas jogadas na mesa/i })
  ).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });
  expect(screen.getByText(/Vez de João — Sua vez!/i)).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1550);
  });

  expect(screen.queryByText(/Vez de João — Sua vez!/i)).not.toBeInTheDocument();
});

test("sends animated portrait taunt with TAUNT kind, shows cooldown, and animates incoming peer taunt", async () => {
  vi.useFakeTimers();
  const mpState = makeGameState({
    room_code: "TAUNT1",
    colors: ["RED", "BLUE"],
    bot_colors: [],
    current_color: "BLUE",
    seat_names: { RED: "Ana", BLUE: "João" },
  });

  vi.mocked(getState).mockResolvedValue(mpState);
  vi.mocked(getGameMessages).mockResolvedValue([]);
  vi.mocked(sendGameMessage).mockResolvedValue({
    id: 10,
    game_id: "game-123",
    color: "BLUE",
    sender_name: "João",
    kind: "TAUNT",
    body: "[TAUNT:boa_guerra] ⚔️ Boa guerra a todos!",
    created_at: 1700000200,
  });

  renderGameScreen({ initialEntry: "/games/game-123?seat=BLUE" });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
  expect(screen.getByTestId("board")).toBeInTheDocument();

  const tauntBtn = screen.getByRole("button", { name: /^Provocações$/i });
  fireEvent.click(tauntBtn);

  const boaGuerraItem = screen.getByRole("button", { name: /Boa Guerra!/i });
  await act(async () => {
    fireEvent.click(boaGuerraItem);
  });

  expect(sendGameMessage).toHaveBeenCalledWith("game-123", {
    body: "[TAUNT:boa_guerra] ⚔️ Boa guerra a todos!",
    color: "BLUE",
    senderName: "João",
    kind: "TAUNT",
  });
  expect(screen.getByText(/Boa guerra a todos!/i)).toBeInTheDocument();
  expect(tauntBtn).toBeDisabled();

  // Cooldown clears after 3s
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3100);
  });
  expect(tauntBtn).toBeEnabled();
  expect(screen.queryByText(/Boa guerra a todos!/i)).not.toBeInTheDocument();

  // Incoming peer TAUNT animates without adding unread chat count
  vi.mocked(getGameMessages).mockResolvedValueOnce([
    {
      id: 11,
      game_id: "game-123",
      color: "RED",
      sender_name: "Ana",
      kind: "TAUNT",
      body: "[TAUNT:brinde] 🍻 Um brinde à ilha!",
      created_at: 1700000210,
    },
  ]);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });

  expect(screen.getByText(/Um brinde à ilha!/i)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Bate-papo \(1 não lidas\)/i })
  ).not.toBeInTheDocument();
});

test("renders left vertical quick dock shortcuts for AlmanacModal and RightDrawer DiceHistogram", async () => {
  const rollRichState = makeGameState({
    game: {
      id: "game-123",
      vps_to_win: 10,
      discard_limit: 7,
      friendly_robber: false,
      dice_mode: "balanced",
    },
    dice_deck_remaining: 34,
    action_records: [
      [["RED", "ROLL", null], [2, 6]],
      [["BLUE", "ROLL", null], [3, 4]],
    ] as GameState["action_records"],
  });
  vi.mocked(getState).mockResolvedValue(rollRichState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const dock = screen.getByRole("navigation", { name: /Atalhos da partida/i });
  expect(dock).toBeInTheDocument();

  const almanacBtn = screen.getByRole("button", { name: /^Almanaque$/i });
  fireEvent.click(almanacBtn);
  expect(
    await screen.findByText(/Almanaque & Regras — Rule the Isle/i)
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Fechar almanaque/i }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  const historyBtn = screen.getByRole("button", { name: /^Histórico$/i });
  fireEvent.click(historyBtn);
  expect(await screen.findByText(/Histórico de Jogadas/i)).toBeInTheDocument();
  fireEvent.keyDown(document.activeElement || document.body, { key: "Escape" });

  const soundBtn = screen.getByRole("button", { name: /^Silenciar som$/i });
  fireEvent.click(soundBtn);
  expect(screen.getByRole("button", { name: /^Ativar som$/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Ativar som$/i }));

  const analysisBtn = screen.getByRole("button", { name: /^Chances \(IA\)$/i });
  fireEvent.click(analysisBtn);
  expect(
    await screen.findByRole("region", {
      name: /Estatísticas e distribuição dos dados/i,
    })
  ).toBeInTheDocument();
  expect(screen.getByText(/2 rolagem\(ns\) · Último: 7/i)).toBeInTheDocument();
  expect(screen.getByText(/Equilibrados · 34\/36/i)).toBeInTheDocument();
});

test("locks dock speed to room bot_speed in online matches while keeping offline solo speed editable", async () => {
  localStorage.setItem("catan_game_speed_v1", "normal");
  const onlineTurboRoomState = makeGameState({
    state_index: 5,
    room_code: "RM9988",
    bot_speed: "turbo",
    colors: ["RED", "BLUE", "ORANGE"],
    bot_colors: ["ORANGE"],
    current_color: "RED",
    seat_names: { RED: "João", BLUE: "Maria", ORANGE: "Creitu" },
    current_playable_actions: [["RED", "END_TURN", null]],
  });
  vi.mocked(getState).mockResolvedValue(onlineTurboRoomState);

  renderGameScreen({ initialEntry: "/games/game-online?seat=RED" });

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const lockedBtn = screen.getByRole("button", {
    name: /Velocidade: Turbo \(Travada pela sala\)/i,
  });
  expect(lockedBtn).toBeDisabled();
  expect(lockedBtn).toHaveClass("is-locked", "is-turbo");

  fireEvent.click(lockedBtn);
  expect(localStorage.getItem("catan_game_speed_v1")).toBe("normal");
});

test("switches active match HUD, actions toolbar, and top bar cleanly to English when EN toggle is clicked", async () => {
  vi.mocked(getState).mockResolvedValue(baseState);

  renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ROLAR DADOS" })).toBeInTheDocument();

  const enBtn = screen.getByRole("button", { name: "EN" });
  fireEvent.click(enBtn);

  expect(localStorage.getItem("catan_language_v1")).toBe("en");
  expect(screen.getByRole("button", { name: "ROLL DICE" })).toBeInTheDocument();
  expect(screen.getAllByTitle("Victory Points").length).toBeGreaterThan(0);
  expect(
    screen.getByRole("navigation", { name: /Match shortcuts/i })
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "PT" }));
  expect(screen.getByRole("button", { name: "ROLAR DADOS" })).toBeInTheDocument();
});

test("solo match automatically binds perspective to human player and heals bot perspective", async () => {
  const soloState = makeGameState({
    state_index: 2,
    colors: ["ORANGE", "RED", "BLUE", "WHITE"],
    bot_colors: ["ORANGE", "BLUE", "WHITE"],
    current_color: "RED",
    current_prompt: "BUILD_INITIAL_SETTLEMENT",
    is_initial_build_phase: true,
    seat_names: {
      ORANGE: "Felire",
      RED: "Explorador da ilha",
      BLUE: "Creltu",
      WHITE: "Gulri",
    },
    current_playable_actions: [["RED", "BUILD_SETTLEMENT", 12]],
  });
  vi.mocked(getState).mockResolvedValue(soloState);

  // Render WITHOUT ?seat in url and without existing saved seat
  renderGameScreen({ initialEntry: "/games/local-solo-test" });

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  await waitFor(() => {
    expect(localStorage.getItem("catan_game_seat_local-solo-test")).toBe("RED");
  });
  expect(
    screen.getByText(/Fase Inicial — Explorador da ilha: Escolha um vértice para fundar sua Aldeia/i)
  ).toBeInTheDocument();
});

test("toggles board skin between Diorama 3D and Pintura Clássica via quick dock button", async () => {
  const state = makeGameState();
  vi.mocked(getState).mockResolvedValue(state);

  renderGameScreen({ initialEntry: "/games/123" });

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const skinBtn = screen.getByRole("button", {
    name: /Alternar estilo do tabuleiro/i,
  });
  expect(skinBtn).toBeInTheDocument();
  expect(localStorage.getItem("catan_board_skin_v1") ?? "diorama").toBe("diorama");

  fireEvent.click(skinBtn);
  expect(localStorage.getItem("catan_board_skin_v1")).toBe("classic");

  fireEvent.click(skinBtn);
  expect(localStorage.getItem("catan_board_skin_v1")).toBe("diorama");
});

test("toggles piece skin between contrast and cottage from left dock", async () => {
  vi.mocked(getState).mockResolvedValue(baseState);

  renderGameScreen({ initialEntry: "/games/123" });

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const pieceSkinBtn = screen.getByRole("button", {
    name: /Alternar estilo das peças/i,
  });
  expect(pieceSkinBtn).toBeInTheDocument();
  expect(localStorage.getItem("catan_piece_skin_v1") ?? "contrast").toBe("contrast");

  fireEvent.click(pieceSkinBtn);
  expect(localStorage.getItem("catan_piece_skin_v1")).toBe("cottage");

  fireEvent.click(pieceSkinBtn);
  expect(localStorage.getItem("catan_piece_skin_v1")).toBe("contrast");
});

test("renders game-top-hud-container enclosing top hud and player top bar, with full-bleed board-container", async () => {
  vi.mocked(getState).mockResolvedValue(baseState);

  const { container } = renderGameScreen();

  expect(await screen.findByTestId("board")).toBeInTheDocument();
  const hudContainer = container.querySelector(".game-top-hud-container");
  expect(hudContainer).toBeInTheDocument();
  expect(hudContainer?.querySelector(".game-top-hud")).toBeInTheDocument();
  expect(
    hudContainer?.querySelector(".cu-player-top-bar, .player-top-bar")
  ).toBeInTheDocument();
  expect(container.querySelector(".board-container")).toBeInTheDocument();
});
