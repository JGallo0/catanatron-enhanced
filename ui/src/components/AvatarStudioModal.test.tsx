import { forwardRef, useImperativeHandle } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import AvatarStudioModal from "./AvatarStudioModal";
import PlayerAvatar from "./PlayerAvatar";
import { updateProfile } from "../utils/apiClient";
import type { PlayerAccount } from "../utils/apiClient";
import { setLanguage } from "../i18n";
import type { Avatar3DCanvasHandle, Avatar3DCanvasProps } from "./avatar3d/Avatar3DCanvas";

const mockSnapshotState = { value: null as string | null };

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/apiClient")>();
  return {
    ...actual,
    updateProfile: vi.fn(),
  };
});

vi.mock("./avatar3d/Avatar3DCanvas", () => {
  const MockAvatar3DCanvas = forwardRef<Avatar3DCanvasHandle, Avatar3DCanvasProps>(
    function MockAvatar3DCanvas(props, ref) {
      useImperativeHandle(
        ref,
        () => ({
          capturePortraitSnapshot: () => mockSnapshotState.value,
        }),
        []
      );
      return (
        <div
          data-testid="studio-3d-wrapper"
          data-camera-focus={props.cameraFocus}
          data-interactive={String(Boolean(props.interactive))}
          data-mode={props.mode}
        >
          <div data-testid="avatar-3d-fallback">
            <PlayerAvatar
              config={props.config}
              username={props.username}
              size={props.fallbackSize ?? 160}
            />
          </div>
        </div>
      );
    }
  );
  return {
    Avatar3DCanvas: MockAvatar3DCanvas,
    default: MockAvatar3DCanvas,
    isWebGLSupported: () => false,
    clearAvatarGltfCache: () => {},
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setLanguage("pt");
  mockSnapshotState.value = null;
});

const baseAccount: PlayerAccount = {
  username: "joao",
  display_name: "João",
  auth_token: "sess_abc",
  entitlements: [],
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
    setLanguage("pt");
    mockSnapshotState.value = null;
  });

  test("renders 7 modular tabs, lazy 3D viewport with camera toggles, applies V2 preset, and saves unlocked profile", async () => {
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

    // 7 modular tabs rendered
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(7);
    expect(screen.getByRole("tab", { name: /Corpo & Rosto/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Cabelo & Barba/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Vestimenta/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Adereços/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Montarias & Pets/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Palco & Auras/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Molduras/i })).toBeInTheDocument();

    // Lazy 3D viewport (falls back cleanly in jsdom) + camera toggles + 360 hint
    const wrapper = await screen.findByTestId("studio-3d-wrapper");
    expect(wrapper).toHaveAttribute("data-mode", "studio");
    expect(wrapper).toHaveAttribute("data-interactive", "true");
    expect(wrapper).toHaveAttribute("data-camera-focus", "full");
    expect(screen.getByText(/Arraste para girar 360°/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Rosto$/i }));
    expect(screen.getByTestId("studio-3d-wrapper")).toHaveAttribute(
      "data-camera-focus",
      "portrait"
    );
    await user.click(screen.getByRole("button", { name: /Corpo Inteiro/i }));
    expect(screen.getByTestId("studio-3d-wrapper")).toHaveAttribute(
      "data-camera-focus",
      "full"
    );

    // Stats pill & editable display name
    expect(screen.getByText(/2 vitórias/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Apelido na Mesa/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Cap. João");

    // Apply V2 archetype preset "Capitão dos Mares"
    await user.click(screen.getByRole("button", { name: /Capitão dos Mares/i }));

    // Adereços tab: Coroa Dourada is clickable for Try-On and shows 7 Vitórias lock badge
    await user.click(screen.getByRole("tab", { name: /Adereços/i }));
    const crownBtn = screen.getByRole("button", { name: /Coroa Dourada/i });
    expect(crownBtn).toBeEnabled();
    expect(crownBtn).toHaveTextContent(/7 Vitórias/i);

    // Molduras tab: Bronze (1 win) unlocked, Prata (3 wins) locked at 3 Vitórias
    await user.click(screen.getByRole("tab", { name: /Molduras/i }));
    const bronzeBtn = screen.getByRole("button", { name: /Bronze de Navegador/i });
    const silverBtn = screen.getByRole("button", { name: /Prata da Guilda/i });
    expect(bronzeBtn).toBeEnabled();
    expect(silverBtn).toBeEnabled();
    expect(silverBtn).toHaveTextContent(/3 Vitórias/i);

    await user.click(bronzeBtn);
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));

    expect(updateProfile).toHaveBeenCalledWith({
      displayName: "Cap. João",
      avatarConfig: expect.objectContaining({
        version: 2,
        hat: "captain",
        outfit: "captain",
        handProp: "spyglass",
        frame: "bronze",
        colors: expect.objectContaining({
          outfitPrimary: "#2563eb",
          outfitTrim: "#facc15",
        }),
      }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 20000);

  test("validates empty and short (<2 chars) display name, supports randomizer, and surfaces API error", async () => {
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

    // Randomizer keeps frame within unlocked options (wood or bronze at 2 wins)
    await user.click(screen.getByRole("button", { name: /Aleatório/i }));
    const previewAvatar = screen.getAllByTestId("player-avatar")[0];
    expect(["wood", "bronze"]).toContain(previewAvatar.getAttribute("data-frame"));

    // Empty nickname validation
    const nameInput = screen.getByLabelText(/Apelido na Mesa/i);
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));
    expect(screen.getByText(/Informe um apelido na mesa\./i)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();

    // < 2 chars validation
    await user.type(nameInput, "J");
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));
    expect(
      screen.getByText(/pelo menos 2 caracteres/i)
    ).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();

    // Valid name + API error surfaced
    await user.type(nameInput, "oão");
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));
    expect(await screen.findByText(/Moldura ainda bloqueada\./i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  }, 15000);

  test("unlocks earnable items at 10+ wins across all 7 tabs and supports tier filter pills", async () => {
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

    // Tab 1: Corpo & Rosto
    expect(screen.getByRole("button", { name: /Atlético/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Esculpido/i })).toBeInTheDocument();

    // Tab 2: Cabelo & Barba
    await user.click(screen.getByRole("tab", { name: /Cabelo & Barba/i }));
    expect(screen.getByRole("button", { name: /Tranças/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Barba Viking Real/i })).toBeInTheDocument();

    // Tab 3: Vestimenta
    await user.click(screen.getByRole("tab", { name: /Vestimenta/i }));
    expect(screen.getByRole("button", { name: /Armadura Medieval/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Grevas de Aço/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Manto de Comandante/i })).not.toHaveTextContent(
      /🔒/
    );

    // Tab 4: Adereços
    await user.click(screen.getByRole("tab", { name: /Adereços/i }));
    const crownBtn = screen.getByRole("button", { name: /Coroa Dourada do Soberano/i });
    expect(crownBtn).toBeEnabled();
    expect(crownBtn).not.toHaveTextContent(/🔒/);

    // Tab 5: Montarias & Pets + Tier filters
    await user.click(screen.getByRole("tab", { name: /Montarias & Pets/i }));
    expect(screen.getByRole("button", { name: /Corcel da Ilha/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Grifo Imperial/i })).toHaveTextContent(
      /R\$ 29,90/
    );

    await user.click(screen.getByRole("button", { name: /👑 VIP/i }));
    expect(screen.queryByRole("button", { name: /Corcel da Ilha/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Grifo Imperial/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Desbloqueados/i }));
    expect(screen.getByRole("button", { name: /Corcel da Ilha/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Coruja Cartógrafa/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Grifo Imperial/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Todos$/i }));

    // Tab 6: Palco & Auras
    await user.click(screen.getByRole("tab", { name: /Palco & Auras/i }));
    expect(screen.getByRole("button", { name: /Partículas Solares/i })).not.toHaveTextContent(/🔒/);
    expect(screen.getByRole("button", { name: /^Oceano$/i })).toBeInTheDocument();

    // Tab 7: Molduras
    await user.click(screen.getByRole("tab", { name: /Molduras/i }));
    expect(screen.getByRole("button", { name: /Imperial da Ilha/i })).not.toHaveTextContent(/🔒/);
  }, 20000);

  test("live custom color swatches and hex color pickers update and save all 7 color channels", async () => {
    const user = userEvent.setup();
    vi.mocked(updateProfile).mockResolvedValue(baseAccount);

    render(
      <AvatarStudioModal
        open={true}
        onClose={vi.fn()}
        account={baseAccount}
        onSaved={vi.fn()}
      />
    );

    // Click curated swatch for outfitPrimary (Esmeralda)
    await user.click(
      screen.getByRole("button", { name: /Roupa Principal: Esmeralda/i })
    );

    // Use <input type="color"> custom hex pickers for trim & mount
    const trimPicker = screen.getByLabelText(/Detalhes \/ Metal.*cor personalizada/i);
    fireEvent.change(trimPicker, { target: { value: "#12ab34" } });

    const mountPicker = screen.getByLabelText(/Montaria.*cor personalizada/i);
    fireEvent.change(mountPicker, { target: { value: "#abcdef" } });

    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));

    expect(updateProfile).toHaveBeenCalledWith({
      displayName: "João",
      avatarConfig: expect.objectContaining({
        colors: expect.objectContaining({
          outfitPrimary: "#059669",
          outfitTrim: "#12ab34",
          mount: "#abcdef",
        }),
      }),
    });
  }, 15000);

  test("Option A Try-On VIP flow: allows live preview of locked VIP items, opens lock dialog on save, and strips only locked slots while preserving unlocked + colors", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const rookieAccount: PlayerAccount = {
      ...baseAccount,
      stats: { wins: 0, losses: 1, games_played: 1, win_rate: 0 },
    };

    vi.mocked(updateProfile).mockResolvedValue(rookieAccount);

    render(
      <AvatarStudioModal
        open={true}
        onClose={onClose}
        account={rookieAccount}
        onSaved={onSaved}
      />
    );

    // Customize unlocked color & unlocked cape
    await user.click(
      screen.getByRole("button", { name: /Roupa Principal: Esmeralda/i })
    );
    await user.click(screen.getByRole("tab", { name: /Vestimenta/i }));
    await user.click(screen.getByRole("button", { name: /Capa de Viajante/i }));

    // Equip locked VIP mount "Grifo Imperial" in Try-On mode
    await user.click(screen.getByRole("tab", { name: /Montarias & Pets/i }));
    const griffinBtn = screen.getByRole("button", { name: /Grifo Imperial/i });
    expect(griffinBtn).toBeEnabled();
    await user.click(griffinBtn);

    // Try-On pill banner appears
    expect(
      screen.getByText(/Modo Provador — testando 1 item\(ns\) bloqueado\(s\)/i)
    ).toBeInTheDocument();

    // Attempting to save opens tryon-lock-dialog instead of calling updateProfile
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));
    expect(updateProfile).not.toHaveBeenCalled();

    const lockDialog = screen.getByTestId("tryon-lock-dialog");
    expect(lockDialog).toBeInTheDocument();
    expect(lockDialog).toHaveTextContent(/Grifo Imperial/i);
    expect(lockDialog).toHaveTextContent(/VIP/i);

    // "Continuar no provador" keeps modal open and keeps Grifo Imperial equipped
    await user.click(screen.getByRole("button", { name: /Continuar no provador/i }));
    expect(screen.queryByTestId("tryon-lock-dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Modo Provador — testando 1 item\(ns\) bloqueado\(s\)/i)
    ).toBeInTheDocument();

    // Save again -> click "Remover bloqueados e salvar"
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));
    await user.click(
      screen.getByRole("button", { name: /Remover bloqueados e salvar/i })
    );

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledTimes(1);
    });
    expect(updateProfile).toHaveBeenCalledWith({
      displayName: "João",
      avatarConfig: expect.objectContaining({
        mount: "none",
        cape: "traveler",
        colors: expect.objectContaining({
          outfitPrimary: "#059669",
        }),
      }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 20000);

  test("allows saving VIP items when account owns the entitlement and handles 403 locked_items defensively", async () => {
    const user = userEvent.setup();
    const vipAccount: PlayerAccount = {
      ...baseAccount,
      entitlements: ["mount:imperial_griffin"],
    };

    vi.mocked(updateProfile)
      .mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            description: "Item bloqueado no servidor",
            locked_items: [
              {
                slot: "mount",
                id: "imperial_griffin",
                tier: "vip",
                required_wins: 0,
                sku: "vip_mount_griffin",
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce(vipAccount);

    render(
      <AvatarStudioModal
        open={true}
        onClose={vi.fn()}
        account={vipAccount}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("tab", { name: /Montarias & Pets/i }));
    await user.click(screen.getByRole("button", { name: /Grifo Imperial/i }));

    // Should NOT show Try-On warning because entitlement is owned
    expect(screen.queryByText(/Modo Provador/i)).not.toBeInTheDocument();

    // First save triggers defensive 403 -> opens tryon-lock-dialog
    await user.click(screen.getByRole("button", { name: /Salvar Perfil/i }));
    expect(await screen.findByTestId("tryon-lock-dialog")).toBeInTheDocument();
  }, 15000);

  test("supports guest customization, Try-On stripping, and attaches portraitSnapshot when available", async () => {
    const user = userEvent.setup();
    const onGuestSaved = vi.fn();
    const onClose = vi.fn();
    mockSnapshotState.value = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4";

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
          portraitSnapshot: "data:image/webp;base64,UklGRh4AAABXRUJQVlA4",
        }),
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    const savedRaw = localStorage.getItem("catan_guest_profile_v1");
    expect(savedRaw).toContain("Viajante da Ilha");
  }, 15000);

  test("renders bilingual English copy cleanly across tabs, camera controls, and Try-On dialog", async () => {
    const user = userEvent.setup();
    setLanguage("en");

    render(
      <AvatarStudioModal
        open={true}
        onClose={vi.fn()}
        account={{
          ...baseAccount,
          stats: { wins: 0, losses: 0, games_played: 0, win_rate: 0 },
        }}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: /Body & Face/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Mounts & Pets/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Full Body/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Portrait/i })).toBeInTheDocument();
    expect(screen.getByText(/Drag to rotate 360°/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Mounts & Pets/i }));
    await user.click(screen.getByRole("button", { name: /Imperial Griffin/i }));
    expect(screen.getByText(/Try-On Mode — testing 1 locked item/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Save Profile/i }));
    const lockDialog = screen.getByTestId("tryon-lock-dialog");
    expect(lockDialog).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Remove locked & save/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Keep trying on/i })
    ).toBeInTheDocument();
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
