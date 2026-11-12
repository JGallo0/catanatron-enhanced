import { cleanup, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import HomePage from "./HomePage";
import { saveGuestProfile } from "../config/avatarCatalog";
import { setLanguage } from "../i18n";
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
  setLanguage("pt");
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
    expect(screen.getByTestId("home-hero-stage")).toBeInTheDocument();
    expect(screen.getAllByTestId("player-avatar")).toHaveLength(1);

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

  test("opens AlmanacModal from the Home dock button", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const almanacBtn = screen.getByRole("button", { name: /Almanaque/i });
    await user.click(almanacBtn);

    expect(
      await screen.findByText(/Almanaque & Regras — Rule the Isle/i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Fechar almanaque/i }));
  }, 15000);

  test("LanguageToggle switches HomePage, MatchSetupModal, and AlmanacModal between PT and EN cleanly", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Default PT state
    expect(
      screen.getByText(
        /Confrontos online entre amigos e offline com bots que não travam/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Explorador da Ilha")).toBeInTheDocument();
    expect(screen.getByText(/Modo visitante/i)).toBeInTheDocument();
    expect(screen.getByText(/Ranking Global/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Versão modificada em português baseada no motor/i)
    ).toBeInTheDocument();

    // Switch to EN
    const enBtn = screen.getByRole("button", { name: /^EN$/i });
    await user.click(enBtn);
    expect(enBtn).toHaveAttribute("aria-pressed", "true");

    expect(
      screen.getByText(
        /Online matches with friends & offline games with bots that never stall/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Island Explorer")).toBeInTheDocument();
    expect(screen.getByText(/Guest mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Global Ranking/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Localized edition powered by the/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Quick Match \(Solo\/AI\)/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Online Room/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open Lobbies/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ranking & History/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Customize Avatar/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Almanac/i })).toBeInTheDocument();

    // MatchSetupModal in EN
    await user.click(
      screen.getByRole("button", { name: /Quick Match \(Solo\/AI\)/i })
    );
    expect(
      await screen.findByText(/Quick Match Setup \(Solo vs AI\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Map Template/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Standard \(Random Map\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Players at Table/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Close$/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    // AlmanacModal in EN
    await user.click(await screen.findByRole("button", { name: /Almanac/i }));
    expect(
      await screen.findByText(/Almanac & Rules — Rule the Isle/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Settlement")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Buildings & Trade/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Close almanac/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    // Switch back to PT
    const ptBtn = await screen.findByRole("button", { name: /^PT$/i });
    await user.click(ptBtn);
    expect(ptBtn).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(
        /Confrontos online entre amigos e offline com bots que não travam/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Explorador da Ilha")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Partida Rápida \(Solo\/IA\)/i })
    ).toBeInTheDocument();
  }, 15000);

  test("clicking Estúdio 3D pill on central hero stage opens AvatarStudioModal", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const heroStage = screen.getByTestId("home-hero-stage");
    expect(heroStage).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Estúdio 3D/i }));
    expect(
      await screen.findByText(/Personalizar Avatar & Perfil/i)
    ).toBeInTheDocument();
  }, 15000);
});
