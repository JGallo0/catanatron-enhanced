import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import AvatarStudioModal from "./AvatarStudioModal";
import PlayerAvatar from "./PlayerAvatar";
import { updateProfile } from "../utils/apiClient";
import type { PlayerAccount } from "../utils/apiClient";

vi.mock("../utils/apiClient", () => ({
  updateProfile: vi.fn(),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const baseAccount: PlayerAccount = {
  username: "joao",
  display_name: "João",
  auth_token: "sess_abc",
  avatar_config: {
    skin: "warm",
    eyes: "calm",
    hair: "short",
    hairColor: "brown",
    beard: "none",
    hat: "none",
    outfit: "settler",
    outfitColor: "royal",
    background: "ocean",
    frame: "wood",
  },
  stats: {
    wins: 2,
    losses: 1,
    games_played: 3,
    win_rate: 66.7,
  },
};

describe("AvatarStudioModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows locked thresholds on earned tabs, applies preset, and saves profile", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();

    vi.mocked(updateProfile).mockResolvedValue({
      ...baseAccount,
      display_name: "Cap. João",
      avatar_config: { ...baseAccount.avatar_config, frame: "bronze" },
    });

    render(
      <AvatarStudioModal
        open={true}
        onClose={onClose}
        account={baseAccount}
        onSaved={onSaved}
      />
    );

    // Resumo de vitórias e campo editável de apelido visíveis
    expect(screen.getByText(/2 vitórias/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Apelido na Mesa/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Cap. João");

    // Aplicar arquétipo pronto "Capitão dos Mares"
    await user.click(screen.getByRole("button", { name: /Capitão dos Mares/i }));

    // Trocar para aba Acessórios e checar Coroa Dourada travada (faltam 5 vitórias)
    await user.click(screen.getByRole("tab", { name: /Acessórios/i }));
    const crownBtn = screen.getByRole("button", { name: /Coroa Dourada/i });
    expect(crownBtn).toBeDisabled();
    expect(screen.getByText(/Faltam 5 vitórias/i)).toBeInTheDocument();

    // Trocar para aba Molduras: Bronze (1 vitória) liberada, Prata (3 vitórias) bloqueada
    await user.click(screen.getByRole("tab", { name: /Molduras/i }));
    const bronzeBtn = screen.getByRole("button", { name: /Bronze de Navegador/i });
    const silverBtn = screen.getByRole("button", { name: /Prata da Guilda/i });
    expect(bronzeBtn).toBeEnabled();
    expect(silverBtn).toBeDisabled();
    expect(screen.getByText(/Falta 1 vitória/i)).toBeInTheDocument();

    await user.click(bronzeBtn);
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));

    expect(updateProfile).toHaveBeenCalledWith({
      displayName: "Cap. João",
      avatarConfig: expect.objectContaining({
        hat: "captain",
        outfit: "captain",
        frame: "bronze",
      }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 15000);

  test("validates empty display name, supports randomizer, and surfaces API error", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();

    vi.mocked(updateProfile).mockRejectedValue({
      response: { data: { description: "Moldura ainda bloqueada." } },
    });

    render(
      <AvatarStudioModal
        open={true}
        onClose={onClose}
        account={baseAccount}
        onSaved={onSaved}
      />
    );

    // Clicar em Aleatório mantém moldura dentro das desbloqueadas (wood ou bronze para 2 vitórias)
    await user.click(screen.getByRole("button", { name: /Aleatório/i }));
    const previewAvatar = screen.getAllByTestId("player-avatar")[0];
    expect(["wood", "bronze"]).toContain(previewAvatar.getAttribute("data-frame"));

    // Limpar apelido e tentar salvar deve mostrar erro sem chamar API
    const nameInput = screen.getByLabelText(/Apelido na Mesa/i);
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));
    expect(screen.getByText(/Informe um apelido na mesa\./i)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();

    // Preencher apelido e simular erro vindo do backend
    await user.type(nameInput, "Navegador");
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));
    expect(await screen.findByText(/Moldura ainda bloqueada\./i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  }, 15000);

  test("unlocks crown and imperial frame at 10+ wins and switches across all 5 tabs", async () => {
    const user = userEvent.setup();
    const championAccount: PlayerAccount = {
      ...baseAccount,
      stats: { wins: 10, losses: 2, games_played: 12, win_rate: 83.3 },
    };

    render(
      <AvatarStudioModal
        open={true}
        onClose={vi.fn()}
        account={championAccount}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText(/10 vitórias/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Cabelo & Barba/i }));
    expect(screen.getByRole("button", { name: /Tranças/i })).toBeEnabled();

    await user.click(screen.getByRole("tab", { name: /Traje & Fundo/i }));
    expect(screen.getByRole("button", { name: /Armadura Medieval/i })).toBeEnabled();

    await user.click(screen.getByRole("tab", { name: /Acessórios/i }));
    expect(screen.getByRole("button", { name: /Coroa Dourada do Soberano/i })).toBeEnabled();

    await user.click(screen.getByRole("tab", { name: /Molduras/i }));
    expect(screen.getByRole("button", { name: /Imperial da Ilha/i })).toBeEnabled();
  }, 15000);

  test("supports guest customization directly in localStorage without backend login", async () => {
    const user = userEvent.setup();
    const onGuestSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <AvatarStudioModal
        open={true}
        onClose={onClose}
        account={null}
        onGuestSaved={onGuestSaved}
      />
    );

    expect(
      screen.getByText(/Visitante • Salvo neste navegador/i)
    ).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Apelido na Mesa/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Viajante da Ilha");
    await user.click(screen.getByRole("button", { name: /Guardiã da Floresta/i }));
    await user.click(screen.getByRole("button", { name: /Salvar Avatar/i }));

    expect(updateProfile).not.toHaveBeenCalled();
    expect(onGuestSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: "Viajante da Ilha",
        customized: true,
        avatar_config: expect.objectContaining({
          hat: "explorer",
          outfit: "settler",
          frame: "wood",
        }),
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    const savedRaw = localStorage.getItem("catan_guest_profile_v1");
    expect(savedRaw).toContain("Viajante da Ilha");
  }, 15000);
});

describe("PlayerAvatar", () => {
  test("renders all 5 earned frame classes, frame labels, and layered SVG portrait", () => {
    const { rerender } = render(
      <PlayerAvatar
        username="soberano"
        size={96}
        showFrameLabel
        config={{
          frame: "imperial",
          hat: "crown_gold",
          hair: "long",
          beard: "full",
          eyes: "wise",
          outfit: "armor",
          background: "sunset",
        }}
      />
    );

    const avatar = screen.getByTestId("player-avatar");
    expect(avatar).toHaveClass("player-avatar--frame-imperial");
    expect(avatar).toHaveAttribute("data-frame", "imperial");
    expect(screen.getByText(/Imperial da Ilha/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Avatar de soberano/i })).toBeInTheDocument();

    const frameExpectations = [
      { frame: "wood", label: /Madeira de Colono/i },
      { frame: "bronze", label: /Bronze de Navegador/i },
      { frame: "silver", label: /Prata da Guilda/i },
      { frame: "gold", label: /Ouro Real/i },
      { frame: "imperial", label: /Imperial da Ilha/i },
    ] as const;

    for (const entry of frameExpectations) {
      rerender(
        <PlayerAvatar
          username="cavaleiro"
          showFrameLabel
          config={{
            frame: entry.frame,
            hat: "helm",
            hair: "short",
            beard: "mustache",
            eyes: "cheerful",
            outfit: "merchant",
            background: "mountain",
          }}
        />
      );
      const current = screen.getByTestId("player-avatar");
      expect(current).toHaveClass(`player-avatar--frame-${entry.frame}`);
      expect(current).toHaveAttribute("data-frame", entry.frame);
      expect(screen.getByText(entry.label)).toBeInTheDocument();
    }
  });
});
