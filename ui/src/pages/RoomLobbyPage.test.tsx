import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import RoomLobbyPage from "./RoomLobbyPage";
import { OPEN_SEAT_LABEL } from "../config/botCatalog";
import {
  closeRoom,
  fetchCurrentAccount,
  getRoom,
  getSavedAccount,
  joinRoom,
  leaveRoom,
  startRoomGame,
} from "../utils/apiClient";
import type { RoomState } from "../utils/api.types";

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/apiClient")>();
  return {
    ...actual,
    closeRoom: vi.fn(),
    fetchCurrentAccount: vi.fn(),
    getRoom: vi.fn(),
    getSavedAccount: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    startRoomGame: vi.fn(),
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
    friendly_robber: false,
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
        <Route path="/games/:gameId" element={<div>Mesa da Partida</div>} />
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
});

describe("RoomLobbyPage", () => {
  test("renders scenic stage lineup without duplicate match configuration panels or home menu buttons", async () => {
    localStorage.setItem("catan_room_token_RM9988", "tok_host_99");
    vi.mocked(getRoom).mockResolvedValue(hostRoom);

    renderLobby("RM9988");

    expect(await screen.findByTestId("room-lobby-stage")).toBeInTheDocument();
    expect(screen.getByText(/Sala #RM9988/i)).toBeInTheDocument();
    expect(screen.getByTestId("lobby-hero-card-RED")).toBeInTheDocument();
    expect(screen.getByTestId("lobby-hero-card-BLUE")).toBeInTheDocument();
    expect(screen.getByTestId("lobby-hero-card-ORANGE")).toBeInTheDocument();

    // No duplicate pre-match configuration controls
    expect(screen.queryByText(/Dificuldade dos Bots/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Velocidade dos Bots/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Modo dos Dados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Assentos da Partida/i)).not.toBeInTheDocument();

    // No Home menu dock buttons
    expect(screen.queryByRole("button", { name: /Partida Rápida/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar Sala Online/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salas Abertas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ranking & Histórico/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Personalizar Avatar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Almanaque/i })).not.toBeInTheDocument();

    // Streamlined lobby CTA controls for host
    expect(screen.getByRole("button", { name: /Copiar Link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar Partida/i })).toBeInTheDocument();
  }, 15000);

  test("incoming player sees open slot pedestal, claims seat with avatar, and starts when host triggers match", async () => {
    const user = userEvent.setup();
    const unseatedRoom: RoomState = {
      ...hostRoom,
      is_host: false,
      my_color: null,
      seats: [
        { ...hostRoom.seats[0], is_me: false },
        hostRoom.seats[1],
        hostRoom.seats[2],
      ],
    };
    const claimedRoom: RoomState = {
      ...unseatedRoom,
      my_color: "BLUE",
      seats: [
        { ...hostRoom.seats[0], is_me: false },
        {
          color: "BLUE",
          player_key: "HUMAN",
          player_name: "Marina",
          is_bot: false,
          claimed: true,
          is_me: true,
          seat_kind: "GUEST",
          username: null,
          avatar_config: {},
        },
        hostRoom.seats[2],
      ],
    };

    vi.mocked(getRoom).mockResolvedValue(unseatedRoom);
    vi.mocked(joinRoom).mockResolvedValueOnce({
      seat_token: "tok_marina_2",
      seat_color: "BLUE",
      room: claimedRoom,
    });

    renderLobby("RM9988");

    const blueCard = await screen.findByTestId("lobby-hero-card-BLUE");
    expect(within(blueCard).getByText(/Vaga Aberta/i)).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Seu Nome/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Marina");

    await user.click(within(blueCard).getByRole("button", { name: /Sentar Aqui/i }));

    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalledWith("RM9988", {
        playerName: "Marina",
        preferredColor: "BLUE",
        token: null,
      });
    });

    const updatedBlueCard = await screen.findByTestId("lobby-hero-card-BLUE");
    expect(within(updatedBlueCard).getByText("Marina")).toBeInTheDocument();
    expect(
      within(updatedBlueCard).getByTestId("lobby-seat-fallback-1")
    ).toBeInTheDocument();
  }, 15000);

  test("host starts match from lobby dock and navigates into active game", async () => {
    const user = userEvent.setup();
    localStorage.setItem("catan_room_token_RM9988", "tok_host_99");
    vi.mocked(getRoom).mockResolvedValue(hostRoom);
    vi.mocked(startRoomGame).mockResolvedValueOnce({
      game_id: "GAME77",
      room: { ...hostRoom, status: "IN_PROGRESS", game_id: "GAME77" },
    });

    renderLobby("RM9988");

    await user.click(await screen.findByRole("button", { name: /Iniciar Partida/i }));

    await waitFor(() => {
      expect(startRoomGame).toHaveBeenCalledWith("RM9988", "tok_host_99");
      expect(screen.getByText("Mesa da Partida")).toBeInTheDocument();
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

    expect(await screen.findByText(/Sala #RM9988/i)).toBeInTheDocument();

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

  test("non-host WAITING guest sees Sair da Sala, cannot start match, and returns home after leaving", async () => {
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
    expect(
      screen.queryByRole("button", { name: /Iniciar Partida/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Aguardando quem criou a sala iniciar a partida/i)
    ).toBeInTheDocument();

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
    expect(screen.getAllByRole("link", { name: /Voltar/i }).length).toBeGreaterThanOrEqual(1);
  }, 15000);

  test("renders side-by-side 3D hero slots and opens AvatarStudioModal from local seat card", async () => {
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
