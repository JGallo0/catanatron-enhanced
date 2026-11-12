import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import MatchSetupModal from "./MatchSetupModal";
import { OFFICIAL_BOT_NAMES, OPEN_SEAT_LABEL } from "../../config/botCatalog";
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
    vi.resetAllMocks();
  });

  test("renders updated map labels, single difficulty selector, and creates solo match with chosen bots", async () => {
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
    expect(
      screen.getByRole("button", { name: "Padrão (Mapa aleatório)" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mini" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Torneio (Mapa fixo)" })
    ).toBeInTheDocument();

    const diffGroup = screen.getByRole("group", {
      name: /Dificuldade dos Bots/i,
    });
    expect(within(diffGroup).getByRole("button", { name: "Fácil" })).toBeInTheDocument();
    expect(
      within(diffGroup).getByRole("button", { name: "Moderado" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(within(diffGroup).getByRole("button", { name: "Difícil" })).toBeInTheDocument();

    // Lista os 5 perfis oficiais ao abrir o seletor do Jogador 4 (Guiri -> Angeleri)
    // e bloqueia bots já usados em outros assentos (Creitu e Felire)
    const seat4Select = screen.getByRole("combobox", { name: /Jogador 4/i });
    await user.click(seat4Select);
    const listbox = await screen.findByRole("listbox");
    for (const bot of OFFICIAL_BOT_NAMES) {
      expect(within(listbox).getByText(bot)).toBeInTheDocument();
    }
    const creituOption = within(listbox).getByRole("option", { name: /Creitu/i });
    expect(creituOption).toHaveAttribute("aria-disabled", "true");
    await user.click(within(listbox).getByRole("option", { name: /Angeleri/i }));

    await user.click(screen.getByRole("button", { name: /^Mini$/i }));
    await user.click(within(diffGroup).getByRole("button", { name: /^Difícil$/i }));
    await user.click(screen.getByRole("button", { name: /Iniciar Partida/i }));

    expect(createGame).toHaveBeenCalledWith({
      players: ["HUMAN", "CATANATRON", "CATANATRON", "CATANATRON"],
      mapTemplate: "MINI",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
      diceMode: "random",
      seatNamesList: ["Anfitrião", "Creitu", "Felire", "Angeleri"],
      hostName: "Anfitrião",
      hostSeatIndex: 0,
    });
    expect(onGameCreated).toHaveBeenCalledWith("game-abc");
  }, 15000);

  test("creates online room with explicit Assento livre seat, official bots, and single bot difficulty", async () => {
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
          map_template: "TOURNAMENT",
          vps_to_win: 10,
          discard_limit: 7,
          friendly_robber: true,
          bot_difficulty: "easy",
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

    // Padrão em sala online traz 1 Assento livre no Jogador 2
    expect(screen.getByRole("combobox", { name: /Jogador 2/i })).toHaveTextContent(
      OPEN_SEAT_LABEL
    );

    // Move "Assento livre" para o Jogador 3 e coloca Jaó no Jogador 2
    await user.click(screen.getByRole("combobox", { name: /Jogador 2/i }));
    let listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByRole("option", { name: /Jaó/i }));

    await user.click(screen.getByRole("combobox", { name: /Jogador 3/i }));
    listbox = await screen.findByRole("listbox");
    await user.click(
      within(listbox).getByRole("option", { name: new RegExp(OPEN_SEAT_LABEL, "i") })
    );

    await user.click(screen.getByRole("button", { name: "Torneio (Mapa fixo)" }));
    const diffGroup = screen.getByRole("group", {
      name: /Dificuldade dos Bots/i,
    });
    await user.click(within(diffGroup).getByRole("button", { name: /^Fácil$/i }));
    await user.click(screen.getByRole("button", { name: /Criar Sala e Gerar Link/i }));

    expect(createRoom).toHaveBeenCalledWith({
      hostName: "João",
      players: ["HUMAN", "W", "HUMAN", "W"],
      seats: [
        { player_key: "HUMAN", player_name: "João", is_host: true },
        { player_key: "W", player_name: "Jaó", is_host: false },
        { player_key: "HUMAN", player_name: "Assento livre", is_host: false },
        { player_key: "W", player_name: "Felire", is_host: false },
      ],
      botDifficulty: "easy",
      mapTemplate: "TOURNAMENT",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
      diceMode: "random",
      token: "sess_joao",
    });
    expect(localStorage.getItem("catan_room_token_K7M4P9")).toBe("seat-tok-1");
    expect(onRoomCreated).toHaveBeenCalledWith("K7M4P9");
  }, 15000);

  test("resets players and difficulty cleanly when switching mode between room and solo", async () => {
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
    expect(screen.getAllByText(new RegExp(OPEN_SEAT_LABEL, "i"))).toHaveLength(1);

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
    expect(screen.queryByText(new RegExp(OPEN_SEAT_LABEL, "i"))).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Jogador 2/i })).toHaveTextContent(
      "Creitu"
    );
    expect(screen.getByRole("combobox", { name: /Jogador 3/i })).toHaveTextContent(
      "Felire"
    );
    expect(screen.getByRole("combobox", { name: /Jogador 4/i })).toHaveTextContent(
      "Guiri"
    );

    await user.click(screen.getByRole("button", { name: /Iniciar Partida/i }));

    expect(createGame).toHaveBeenCalledWith({
      players: ["HUMAN", "F", "F", "F"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
      diceMode: "random",
      seatNamesList: ["Anfitrião", "Creitu", "Felire", "Guiri"],
      hostName: "Anfitrião",
      hostSeatIndex: 0,
    });
    expect(onGameCreated).toHaveBeenCalledWith("game-solo-reset");
  }, 15000);

  test("renders MapTemplatePreview, rule help tooltips, and sends balanced diceMode when selected", async () => {
    const user = userEvent.setup();
    const onGameCreated = vi.fn();
    vi.mocked(createGame).mockResolvedValueOnce("game-balanced");

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

    expect(screen.getByTestId("map-preview-base")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Mini$/i }));
    expect(screen.getByTestId("map-preview-mini")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Torneio (Mapa fixo)" }));
    expect(screen.getByTestId("map-preview-tournament")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Ajuda sobre Modelo do Mapa/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ajuda sobre Limite de Cartas/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ajuda sobre Modo dos Dados/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ajuda sobre Dificuldade dos Bots/i })
    ).toBeInTheDocument();

    const diceGroup = screen.getByRole("group", { name: /Modo dos Dados/i });
    await user.click(
      within(diceGroup).getByRole("button", { name: /Equilibrados \(Baralho 36\)/i })
    );
    await user.click(screen.getByRole("button", { name: /Iniciar Partida/i }));

    expect(createGame).toHaveBeenCalledWith(
      expect.objectContaining({
        mapTemplate: "TOURNAMENT",
        diceMode: "balanced",
      })
    );
    expect(onGameCreated).toHaveBeenCalledWith("game-balanced");
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
