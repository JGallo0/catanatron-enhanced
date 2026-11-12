import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import RoomLobbyPage from "./RoomLobbyPage";
import { OPEN_SEAT_LABEL } from "../config/botCatalog";
import {
  closeRoom,
  DEFAULT_PLAYERS,
  fetchCurrentAccount,
  getPlayers,
  getRoom,
  getSavedAccount,
  leaveRoom,
  updateRoom,
} from "../utils/apiClient";
import type { RoomState } from "../utils/api.types";

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/apiClient")>();
  return {
    ...actual,
    closeRoom: vi.fn(),
    fetchCurrentAccount: vi.fn(),
    getPlayers: vi.fn(),
    getRoom: vi.fn(),
    getSavedAccount: vi.fn(),
    leaveRoom: vi.fn(),
    updateRoom: vi.fn(),
  };
});

const hostRoom: RoomState = {
  room_code: "RM9988",
  status: "WAITING",
  game_id: null,
  is_host: true,
  my_color: "RED",
  config: {
    map_template: "TOURNAMENT",
    vps_to_win: 10,
    discard_limit: 7,
    friendly_robber: true,
    bot_difficulty: "medium",
  },
  seats: [
    {
      color: "RED",
      player_key: "HUMAN",
      player_name: "Anfitrião",
      is_bot: false,
      claimed: true,
      is_me: true,
      seat_kind: "USER",
      username: "joao",
      avatar_config: {},
    },
    {
      color: "BLUE",
      player_key: "HUMAN",
      player_name: OPEN_SEAT_LABEL,
      is_bot: false,
      claimed: false,
      is_me: false,
      seat_kind: "GUEST",
      username: null,
      avatar_config: {},
    },
    {
      color: "ORANGE",
      player_key: "F",
      player_name: "Creitu",
      is_bot: true,
      claimed: true,
      is_me: false,
      seat_kind: "BOT",
      username: null,
      avatar_config: {},
    },
  ],
};

function renderLobby(code = "RM9988") {
  return render(
    <MemoryRouter initialEntries={[`/rooms/${code}`]}>
      <Routes>
        <Route path="/" element={<div>Página Inicial</div>} />
        <Route path="/rooms/:roomCode" element={<RoomLobbyPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(getSavedAccount).mockReturnValue(null);
  vi.mocked(fetchCurrentAccount).mockResolvedValue(null);
  vi.mocked(getPlayers).mockResolvedValue(DEFAULT_PLAYERS);
});

describe("RoomLobbyPage", () => {
  test("host manages single bot difficulty, official bot profiles, Assento livre replacement, and seat removal", async () => {
    const user = userEvent.setup();
    localStorage.setItem("catan_room_token_RM9988", "tok_host_99");
    const claimedFriendRoom: RoomState = {
      ...hostRoom,
      seats: [
        hostRoom.seats[0],
        {
          ...hostRoom.seats[1],
          player_name: "Marina",
          claimed: true,
          is_me: false,
          seat_kind: "GUEST",
        },
        hostRoom.seats[2],
      ],
    };
    const hardRoom: RoomState = {
      ...hostRoom,
      config: { ...hostRoom.config, bot_difficulty: "hard" },
    };
    vi.mocked(getRoom).mockResolvedValue(hostRoom);
    vi.mocked(updateRoom).mockImplementationOnce(async () => {
      vi.mocked(getRoom).mockResolvedValue(hardRoom);
      return hardRoom;
    });

    const { unmount } = renderLobby("RM9988");

    expect(
      await screen.findByRole("heading", { name: /Sala Privada #RM9988/i })
    ).toBeInTheDocument();

    // Resumo mostra nome do mapa atualizado e dificuldade Moderado
    expect(screen.getByText(/Torneio \(Mapa fixo\)/i)).toBeInTheDocument();
    const diffGroup = screen.getByRole("group", { name: /Dificuldade dos Bots/i });
    expect(
      within(diffGroup).getByRole("button", { name: /^Moderado$/i })
    ).toHaveAttribute("aria-pressed", "true");

    // Alterar dificuldade única para Difícil dispara updateRoom global
    await user.click(within(diffGroup).getByRole("button", { name: /^Difícil$/i }));
    expect(updateRoom).toHaveBeenCalledWith("RM9988", {
      token: "tok_host_99",
      config: { bot_difficulty: "hard" },
    });
    await waitFor(() => {
      expect(
        within(diffGroup).getByRole("button", { name: /^Difícil$/i })
      ).toHaveAttribute("aria-pressed", "true");
    });

    // Botão Sentar Aqui aparece no Assento livre desocupado (Azul)
    expect(screen.getByRole("button", { name: /Sentar Aqui/i })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Assento Azul/i })
    ).toHaveTextContent(OPEN_SEAT_LABEL);

    // Selecionar outro bot oficial no assento Laranja bloqueia Creitu duplicado se tentar em Azul
    await user.click(screen.getByRole("combobox", { name: /Assento Azul/i }));
    const listbox = await screen.findByRole("listbox");
    expect(
      within(listbox).getByRole("option", { name: /Creitu/i })
    ).toHaveAttribute("aria-disabled", "true");
    vi.mocked(updateRoom).mockResolvedValueOnce(hardRoom);
    await user.click(within(listbox).getByRole("option", { name: /Jaó/i }));
    expect(updateRoom).toHaveBeenLastCalledWith("RM9988", {
      token: "tok_host_99",
      seats: [
        {
          color: "RED",
          source_color: "RED",
          player_key: "HUMAN",
          player_name: "Anfitrião",
        },
        {
          color: "BLUE",
          source_color: "BLUE",
          player_key: "CATANATRON",
          player_name: "Jaó",
        },
        {
          color: "ORANGE",
          source_color: "ORANGE",
          player_key: "F",
          player_name: "Creitu",
        },
      ],
    });

    unmount();

    // Quando amiga Marina entra no Assento livre, card e Select mostram "Marina" e escondem "Assento livre"
    vi.mocked(getRoom).mockResolvedValue(claimedFriendRoom);
    renderLobby("RM9988");

    expect(await screen.findByText("Marina")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sentar Aqui/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Assento Azul/i })
    ).toHaveTextContent(/👤 Marina/);

    // Liberar vaga envia release_claim: true
    vi.mocked(updateRoom).mockResolvedValueOnce(hostRoom);
    await user.click(screen.getByRole("combobox", { name: /Assento Azul/i }));
    const friendListbox = await screen.findByRole("listbox");
    await user.click(
      within(friendListbox).getByRole("option", {
        name: /Assento livre \(Liberar vaga\)/i,
      })
    );
    expect(updateRoom).toHaveBeenLastCalledWith("RM9988", {
      token: "tok_host_99",
      seats: [
        {
          color: "RED",
          source_color: "RED",
          player_key: "HUMAN",
          player_name: "Anfitrião",
        },
        {
          color: "BLUE",
          source_color: "BLUE",
          player_key: "HUMAN",
          player_name: OPEN_SEAT_LABEL,
          release_claim: true,
        },
        {
          color: "ORANGE",
          source_color: "ORANGE",
          player_key: "F",
          player_name: "Creitu",
        },
      ],
    });
  }, 15000);

  test("host sees Encerrar Sala, confirms close, calls closeRoom and returns home", async () => {
    const user = userEvent.setup();
    localStorage.setItem("catan_room_token_RM9988", "tok_host_99");
    vi.mocked(getRoom).mockResolvedValue(hostRoom);
    vi.mocked(closeRoom).mockResolvedValueOnce({
      closed: true,
      room_code: "RM9988",
      game_id: null,
    });

    renderLobby("RM9988");

    expect(
      await screen.findByRole("heading", { name: /Sala Privada #RM9988/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Encerrar Sala/i }));
    await user.click(screen.getByRole("button", { name: /^Cancelar$/i }));
    expect(closeRoom).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Encerrar Sala/i }));
    await user.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(closeRoom).toHaveBeenCalledWith("RM9988", "tok_host_99");
      expect(screen.getByText("Página Inicial")).toBeInTheDocument();
    });
  }, 15000);

  test("non-host WAITING guest sees Sair da Sala, cannot change difficulty, and returns home after leaving", async () => {
    const user = userEvent.setup();
    const guestRoom: RoomState = {
      ...hostRoom,
      is_host: false,
      my_color: "BLUE",
      seats: [
        { ...hostRoom.seats[0], is_me: false },
        {
          ...hostRoom.seats[1],
          claimed: true,
          is_me: true,
          player_name: "Convidada",
        },
        hostRoom.seats[2],
      ],
    };
    localStorage.setItem("catan_room_token_RM9988", "tok_guest_1");
    vi.mocked(getRoom).mockResolvedValue(guestRoom);
    vi.mocked(leaveRoom).mockResolvedValueOnce({ left: true, room: guestRoom });

    renderLobby("RM9988");

    expect(
      await screen.findByRole("button", { name: /Sair da Sala/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Encerrar Sala/i })
    ).not.toBeInTheDocument();

    const diffGroup = screen.getByRole("group", { name: /Dificuldade dos Bots/i });
    expect(
      within(diffGroup).getByRole("button", { name: /^Fácil$/i })
    ).toBeDisabled();
    expect(
      within(diffGroup).getByRole("button", { name: /^Difícil$/i })
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Sair da Sala/i }));
    await waitFor(() => {
      expect(leaveRoom).toHaveBeenCalledWith("RM9988", "tok_guest_1");
      expect(screen.getByText("Página Inicial")).toBeInTheDocument();
    });
  }, 15000);

  test("shows clear error and Voltar link when room returns 404", async () => {
    vi.mocked(getRoom).mockRejectedValue({
      response: {
        status: 404,
        data: { description: "Sala encerrada pelo anfitrião." },
      },
    });

    renderLobby("GONE44");

    expect(
      await screen.findByText(/Sala encerrada pelo anfitrião/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar/i })).toBeInTheDocument();
  }, 15000);

  test("host changes Modo dos Dados to balanced with compact MapTemplatePreview, and guest sees disabled dice controls", async () => {
    const user = userEvent.setup();
    localStorage.setItem("catan_room_token_RM9988", "tok_host_99");
    const balancedRoom: RoomState = {
      ...hostRoom,
      config: { ...hostRoom.config, dice_mode: "balanced" },
    };
    vi.mocked(getRoom).mockResolvedValue(hostRoom);
    vi.mocked(updateRoom).mockImplementationOnce(async () => {
      vi.mocked(getRoom).mockResolvedValue(balancedRoom);
      return balancedRoom;
    });

    const { unmount } = renderLobby("RM9988");

    expect(await screen.findByTestId("map-preview-tournament")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ajuda sobre Modo dos Dados/i })
    ).toBeInTheDocument();

    const diceGroup = screen.getByRole("group", { name: /Modo dos Dados/i });
    await user.click(
      within(diceGroup).getByRole("button", { name: /Equilibrados \(Baralho 36\)/i })
    );

    expect(updateRoom).toHaveBeenCalledWith("RM9988", {
      token: "tok_host_99",
      config: { dice_mode: "balanced" },
    });
    await waitFor(() => {
      expect(
        within(diceGroup).getByRole("button", { name: /Equilibrados \(Baralho 36\)/i })
      ).toHaveAttribute("aria-pressed", "true");
    });

    unmount();

    const guestBalancedRoom: RoomState = {
      ...balancedRoom,
      is_host: false,
      my_color: "BLUE",
    };
    vi.mocked(getRoom).mockResolvedValue(guestBalancedRoom);
    renderLobby("RM9988");

    const guestDiceGroup = await screen.findByRole("group", {
      name: /Modo dos Dados/i,
    });
    expect(
      within(guestDiceGroup).getByRole("button", { name: /Padrão \(2d6\)/i })
    ).toBeDisabled();
    expect(
      within(guestDiceGroup).getByRole("button", {
        name: /Equilibrados \(Baralho 36\)/i,
      })
    ).toBeDisabled();
  }, 15000);

  test("host changes Velocidade dos Bots in pre-match lobby and guest sees disabled speed controls", async () => {
    const user = userEvent.setup();
    localStorage.setItem("catan_room_token_RM9988", "tok_host_99");
    const turboRoom: RoomState = {
      ...hostRoom,
      config: { ...hostRoom.config, bot_speed: "turbo" },
    };
    vi.mocked(getRoom).mockResolvedValue(hostRoom);
    vi.mocked(updateRoom).mockImplementationOnce(async () => {
      vi.mocked(getRoom).mockResolvedValue(turboRoom);
      return turboRoom;
    });

    const { unmount } = renderLobby("RM9988");

    const speedGroup = await screen.findByRole("group", {
      name: /Velocidade dos Bots/i,
    });
    expect(
      within(speedGroup).getByRole("button", { name: /Normal/i })
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(within(speedGroup).getByRole("button", { name: /Turbo/i }));

    expect(updateRoom).toHaveBeenCalledWith("RM9988", {
      token: "tok_host_99",
      config: { bot_speed: "turbo" },
    });
    await waitFor(() => {
      expect(
        within(speedGroup).getByRole("button", { name: /Turbo/i })
      ).toHaveAttribute("aria-pressed", "true");
    });

    unmount();

    const guestTurboRoom: RoomState = {
      ...turboRoom,
      is_host: false,
      my_color: "BLUE",
    };
    vi.mocked(getRoom).mockResolvedValue(guestTurboRoom);
    renderLobby("RM9988");

    const guestSpeedGroup = await screen.findByRole("group", {
      name: /Velocidade dos Bots/i,
    });
    expect(
      within(guestSpeedGroup).getByRole("button", { name: /Normal/i })
    ).toBeDisabled();
    expect(
      within(guestSpeedGroup).getByRole("button", { name: /Rápida/i })
    ).toBeDisabled();
    expect(
      within(guestSpeedGroup).getByRole("button", { name: /Turbo/i })
    ).toBeDisabled();
  }, 15000);

  test("renders vertical 3D hero cards for occupied seats, open slot card, and opens AvatarStudioModal from card action", async () => {
    const user = userEvent.setup();
    localStorage.setItem("catan_room_token_RM9988", "tok_host_99");
    vi.mocked(getRoom).mockResolvedValue(hostRoom);

    renderLobby("RM9988");

    const redCard = await screen.findByTestId("lobby-hero-card-RED");
    const blueCard = screen.getByTestId("lobby-hero-card-BLUE");
    const orangeCard = screen.getByTestId("lobby-hero-card-ORANGE");

    expect(redCard).toBeInTheDocument();
    expect(within(redCard).getByTestId("lobby-seat-fallback-0")).toBeInTheDocument();
    expect(within(blueCard).getByText(/Vaga Aberta/i)).toBeInTheDocument();
    expect(within(orangeCard).getByTestId("lobby-seat-fallback-2")).toBeInTheDocument();

    await user.click(within(redCard).getByRole("button", { name: /Editar Avatar/i }));
    expect(
      await screen.findByText(/Estúdio 3D — Personalizar Avatar & Perfil/i)
    ).toBeInTheDocument();
  }, 15000);
});
