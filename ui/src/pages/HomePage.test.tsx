import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import HomePage from "./HomePage";
import { saveGuestProfile } from "../config/avatarCatalog";
import {
  DEFAULT_PLAYERS,
  fetchCurrentAccount,
  getAuthConfig,
  getPlayers,
  getSavedAccount,
  listActiveRooms,
  logoutAccount,
  type PlayerAccount,
} from "../utils/apiClient";

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/apiClient")>();
  return {
    ...actual,
    fetchCurrentAccount: vi.fn(),
    getAuthConfig: vi.fn(),
    getPlayers: vi.fn(),
    getSavedAccount: vi.fn(),
    listActiveRooms: vi.fn(),
    logoutAccount: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const loggedAccount: PlayerAccount = {
  username: "joao",
  display_name: "João Gallo",
  auth_token: "sess_joao",
  leaderboard_rank: 1,
  avatar_config: { hat: "captain", frame: "gold" },
  stats: { wins: 5, losses: 3, games_played: 8, win_rate: 62.5 },
};

describe("HomePage A2 Stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getSavedAccount).mockReturnValue(null);
    vi.mocked(fetchCurrentAccount).mockResolvedValue(null);
    vi.mocked(getAuthConfig).mockResolvedValue({
      google_enabled: false,
      google_client_id: null,
    });
    vi.mocked(getPlayers).mockResolvedValue(DEFAULT_PLAYERS);
    vi.mocked(listActiveRooms).mockResolvedValue([]);
  });

  test("displays logged-in avatar, frame label, and live #rank in A2 symmetric header without setup-card", async () => {
    vi.mocked(getSavedAccount).mockReturnValue(loggedAccount);
    vi.mocked(fetchCurrentAccount).mockResolvedValue(loggedAccount);
    vi.mocked(listActiveRooms).mockResolvedValue([
      {
        room_code: "R1A2B3",
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
    ]);

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(container.querySelector(".setup-card")).toBeNull();
    expect(await screen.findByText("João Gallo")).toBeInTheDocument();
    expect(screen.getByText(/#1 no Ranking/i)).toBeInTheDocument();
    expect(screen.getByText(/Ouro Real/i)).toBeInTheDocument();
    expect(screen.getByTestId("player-avatar")).toHaveAttribute("data-frame", "gold");
    expect(
      await screen.findByRole("button", { name: /Salas Abertas \(1\)/i })
    ).toBeInTheDocument();

    // Logout volta ao estado visitante
    const user = userEvent.setup();
    vi.mocked(logoutAccount).mockResolvedValueOnce();
    await user.click(screen.getByRole("button", { name: /^Sair$/i }));
    expect(await screen.findByText(/Explorador da Ilha/i)).toBeInTheDocument();
  }, 15000);

  test("clicking Personalizar Avatar while logged out opens AvatarStudioModal directly for guests and updates pill", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(container.querySelector("main.home-stage-window")).toBeInTheDocument();
    expect(screen.getAllByTestId("player-avatar").length).toBeGreaterThanOrEqual(1);

    await user.click(
      screen.getByRole("button", { name: /Personalizar Avatar/i })
    );
    expect(
      await screen.findByText(/Personalizar Avatar & Perfil/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Visitante • Salvo neste navegador/i)).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Apelido na Mesa/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Capitão Visitante");
    await user.click(screen.getByRole("button", { name: /Capitão dos Mares/i }));
    await user.click(screen.getByRole("button", { name: /Salvar Avatar/i }));

    expect(await screen.findByText("Capitão Visitante")).toBeInTheDocument();
    expect(screen.getByText(/Avatar personalizado \(visitante\)/i)).toBeInTheDocument();
    const rawSaved = localStorage.getItem("catan_guest_profile_v1");
    expect(rawSaved).not.toBeNull();
    expect(JSON.parse(rawSaved!).avatar_config.hat).toBe("captain");
  }, 15000);

  test("restores custom guest avatar from localStorage when logged out", async () => {
    saveGuestProfile({
      displayName: "Navegante Livre",
      avatarConfig: { hat: "explorer", outfit: "captain", background: "sunset" },
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Navegante Livre")).toBeInTheDocument();
    expect(screen.getByText(/Avatar personalizado \(visitante\)/i)).toBeInTheDocument();
  });
});
