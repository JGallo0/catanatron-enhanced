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

  test("resets players cleanly when switching mode between room and solo (match-setup-solo)", async () => {
    const user = userEvent.setup();
    const onGameCreated = vi.fn();
    vi.mocked(createGame).mockResolvedValueOnce("game-solo-reset");

    const { rerender } = render(
      <MatchSetupModal
        mode="room"
        onClose={vi.fn()}
        availablePlayers={DEFAULT_PLAYERS}
        defaultHostName="Anfitrião"
        account={null}
        onGameCreated={onGameCreated}
        onRoomCreated={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Seu Apelido na Mesa/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Humano \(Você \/ Amigo\)/i)).toHaveLength(2);

    rerender(
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

    expect(screen.queryByLabelText(/Seu Apelido na Mesa/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Humano \(Você \/ Amigo\)/i)).toHaveLength(1);
    expect(
      screen.getAllByText(/IA: Mestre da Ilha \(AlphaBeta Forte\)/i)
    ).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /Iniciar Partida/i }));

    expect(createGame).toHaveBeenCalledWith({
      players: ["HUMAN", "CATANATRON", "CATANATRON", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    expect(onGameCreated).toHaveBeenCalledWith("game-solo-reset");
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
