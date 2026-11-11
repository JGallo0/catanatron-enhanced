import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import OpenLobbyModal from "./OpenLobbyModal";
import type { RoomState } from "../../utils/api.types";

afterEach(() => {
  cleanup();
});

const sampleRooms: RoomState[] = [
  {
    room_code: "AB12CD",
    status: "WAITING",
    game_id: null,
    is_host: false,
    my_color: null,
    config: {
      map_template: "BASE",
      vps_to_win: 10,
      discard_limit: 7,
      friendly_robber: true,
    },
    seats: [
      {
        color: "RED",
        player_key: "HUMAN",
        player_name: "Ana",
        is_bot: false,
        claimed: true,
        is_me: false,
        seat_kind: "USER",
        username: "ana",
        avatar_config: { hat: "captain", frame: "bronze" },
      },
      {
        color: "BLUE",
        player_key: "HUMAN",
        player_name: "Aguardando Amigo...",
        is_bot: false,
        claimed: false,
        is_me: false,
        seat_kind: "GUEST",
        username: null,
        avatar_config: {},
      },
      {
        color: "ORANGE",
        player_key: "CATANATRON",
        player_name: "Creitu",
        is_bot: true,
        claimed: true,
        is_me: false,
        seat_kind: "BOT",
        username: null,
        avatar_config: {},
      },
    ],
  },
  {
    room_code: "MINE99",
    status: "IN_PROGRESS",
    game_id: "g-live-99",
    is_host: true,
    my_color: "RED",
    config: {
      map_template: "MINI",
      vps_to_win: 7,
      discard_limit: 7,
      friendly_robber: true,
    },
    seats: [
      {
        color: "RED",
        player_key: "HUMAN",
        player_name: "João",
        is_bot: false,
        claimed: true,
        is_me: true,
        seat_kind: "USER",
        username: "joao",
        avatar_config: { frame: "gold" },
      },
    ],
  },
];

describe("OpenLobbyModal", () => {
  test("renders rooms with seat PlayerAvatars, supports filters and code join", async () => {
    const user = userEvent.setup();
    const onJoinRoom = vi.fn();
    const onOpenMatch = vi.fn();

    render(
      <OpenLobbyModal
        open={true}
        onClose={vi.fn()}
        rooms={sampleRooms}
        onJoinRoom={onJoinRoom}
        onOpenMatch={onOpenMatch}
        onCreateRoomClick={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText("#AB12CD")).toBeInTheDocument();
    expect(screen.getByText("#MINE99")).toBeInTheDocument();
    expect(screen.getAllByTestId("player-avatar").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Vaga Aberta/i)).toBeInTheDocument();

    const allFilter = screen.getByRole("button", { name: /Todas/i });
    const openFilter = screen.getByRole("button", { name: /Com Vagas/i });
    const mineFilter = screen.getByRole("button", { name: /Minhas/i });
    expect(allFilter).toHaveAttribute("aria-pressed", "true");
    expect(openFilter).toHaveAttribute("aria-pressed", "false");

    // Filtro "Com Vagas" mantém apenas AB12CD
    await user.click(openFilter);
    expect(openFilter).toHaveAttribute("aria-pressed", "true");
    expect(allFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("#AB12CD")).toBeInTheDocument();
    expect(screen.queryByText("#MINE99")).not.toBeInTheDocument();

    // Filtro "Minhas" mantém apenas MINE99 e botão Retomar navega para partida
    await user.click(mineFilter);
    expect(mineFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("#AB12CD")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retomar/i }));
    expect(onOpenMatch).toHaveBeenCalledWith("g-live-99", "RED");

    // Entrar com código direto normalizado
    const codeInput = screen.getByPlaceholderText(/Código da sala/i);
    const codeJoinBtn = screen.getByRole("button", {
      name: /^Entrar com Código$/i,
    });
    expect(codeJoinBtn).toBeDisabled();
    await user.type(codeInput, "k7m4p9");
    expect(codeJoinBtn).toBeEnabled();
    await user.click(codeJoinBtn);
    expect(onJoinRoom).toHaveBeenCalledWith("K7M4P9");
  }, 15000);

  test("handles WAITING room join, spectating, refresh, close, and contrasting seat icon colors", async () => {
    const user = userEvent.setup();
    const onJoinRoom = vi.fn();
    const onOpenMatch = vi.fn();
    const onRefresh = vi.fn();
    const onClose = vi.fn();

    const roomsWithSpectate: RoomState[] = [
      ...sampleRooms,
      {
        room_code: "SPEC77",
        status: "IN_PROGRESS",
        game_id: "g-watch-77",
        is_host: false,
        my_color: null,
        config: {
          map_template: "TOURNAMENT",
          vps_to_win: 12,
          discard_limit: 9,
          friendly_robber: false,
        },
        seats: [
          {
            color: "BLUE",
            player_key: "CATANATRON",
            player_name: "Felire",
            is_bot: true,
            claimed: true,
            is_me: false,
            seat_kind: "BOT",
            username: null,
            avatar_config: {},
          },
          {
            color: "WHITE",
            player_key: "HUMAN",
            player_name: "Aguardando Amigo...",
            is_bot: false,
            claimed: false,
            is_me: false,
            seat_kind: "GUEST",
            username: null,
            avatar_config: {},
          },
        ],
      },
    ];

    render(
      <OpenLobbyModal
        open={true}
        onClose={onClose}
        rooms={roomsWithSpectate}
        onJoinRoom={onJoinRoom}
        onOpenMatch={onOpenMatch}
        onCreateRoomClick={vi.fn()}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("Creitu")).toBeInTheDocument();
    expect(screen.getByText("Felire")).toBeInTheDocument();
    // Open seat icon uses palette.textOnFill for high contrast on light fills (e.g. WHITE -> #0F172A)
    const openLabels = screen.getAllByText("Vaga Aberta");
    const whiteOpenChip = openLabels[openLabels.length - 1].closest(
      ".open-lobby-seat-chip"
    );
    const seatIcon = whiteOpenChip?.querySelector(".open-lobby-seat-icon");
    expect(seatIcon).toHaveStyle({
      background: "#F8FAFC",
      color: "#0F172A",
    });

    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));
    expect(onJoinRoom).toHaveBeenCalledWith("AB12CD");

    await user.click(screen.getByRole("button", { name: /Assistir/i }));
    expect(onOpenMatch).toHaveBeenCalledWith("g-watch-77", null);

    await user.click(screen.getByRole("button", { name: /Atualizar/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Fechar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 15000);

  test("shows empty state CTA to create a new online room", async () => {
    const user = userEvent.setup();
    const onCreateRoomClick = vi.fn();

    render(
      <OpenLobbyModal
        open={true}
        onClose={vi.fn()}
        rooms={[]}
        onJoinRoom={vi.fn()}
        onOpenMatch={vi.fn()}
        onCreateRoomClick={onCreateRoomClick}
        onRefresh={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /Criar Nova Sala Online/i })
    );
    expect(onCreateRoomClick).toHaveBeenCalledTimes(1);
  }, 15000);
});
