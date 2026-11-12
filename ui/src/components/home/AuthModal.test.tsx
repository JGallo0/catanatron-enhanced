import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import AuthModal from "./AuthModal";
import {
  getBackendHealth,
  loginAccount,
  registerAccount,
  type PlayerAccount,
} from "../../utils/apiClient";

vi.mock("../../utils/apiClient", () => ({
  getBackendHealth: vi.fn(),
  loginAccount: vi.fn(),
  registerAccount: vi.fn(),
  loginWithGoogle: vi.fn(),
}));

vi.mock("../GoogleSignInButton", () => ({
  default: () => <div data-testid="google-signin-mock" />,
}));

afterEach(() => {
  cleanup();
});

const loggedSample: PlayerAccount = {
  username: "ana",
  display_name: "Ana",
  auth_token: "sess_ana",
  leaderboard_rank: 2,
};

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBackendHealth).mockResolvedValue(null);
  });

  test("validates credentials, shows promptBanner, logs in and notifies parent", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onAuthenticated = vi.fn();
    vi.mocked(loginAccount).mockResolvedValueOnce(loggedSample);

    render(
      <AuthModal
        open={true}
        onClose={onClose}
        authConfig={{ google_enabled: false, google_client_id: null }}
        promptBanner="Entre ou crie uma conta grátis para personalizar seu avatar."
        onAuthenticated={onAuthenticated}
      />
    );

    expect(
      screen.getByText(/Entre ou crie uma conta grátis para personalizar seu avatar\./i)
    ).toBeInTheDocument();

    // Mesmo sem GOOGLE_CLIENT_ID configurado, a seção do Google fica visível com explicação clara
    expect(screen.getByText(/^Entrar com Google$/i)).toBeInTheDocument();
    expect(screen.getByText(/GOOGLE_CLIENT_ID/i)).toBeInTheDocument();

    // Tentar enviar sem usuário mostra validação
    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));
    expect(screen.getByText(/Informe seu nome de usuário\./i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Usuário/i), "ana");
    await user.type(screen.getByPlaceholderText(/^Senha$/i), "1234");
    await user.click(screen.getByRole("button", { name: /^Entrar$/i }));

    expect(loginAccount).toHaveBeenCalledWith({
      username: "ana",
      password: "1234",
    });
    expect(onAuthenticated).toHaveBeenCalledWith(loggedSample);
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 15000);

  test("switches to Criar Conta tab and surfaces API registration error cleanly", async () => {
    const user = userEvent.setup();
    vi.mocked(registerAccount).mockRejectedValueOnce({
      response: { data: { description: "Este nome de usuário já está cadastrado." } },
    });

    render(
      <AuthModal
        open={true}
        onClose={vi.fn()}
        authConfig={{ google_enabled: true, google_client_id: "gid-123" }}
        onAuthenticated={vi.fn()}
      />
    );

    expect(screen.getByTestId("google-signin-mock")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^Criar Conta$/i }));
    await user.type(screen.getByPlaceholderText(/Usuário/i), "joao");
    await user.type(screen.getByPlaceholderText(/Apelido na mesa/i), "João");
    await user.type(screen.getByPlaceholderText(/Senha \(mín 4/i), "123456");

    const submitButtons = screen.getAllByRole("button", { name: /^Criar Conta$/i });
    await user.click(submitButtons[submitButtons.length - 1]);

    expect(
      await screen.findByText(/Este nome de usuário já está cadastrado\./i)
    ).toBeInTheDocument();
  }, 15000);

  test("warns when Vercel backend uses ephemeral SQLite without DATABASE_URL", async () => {
    vi.mocked(getBackendHealth).mockResolvedValueOnce({
      ok: true,
      database_backend: "sqlite",
      persistent_storage: false,
      ephemeral_vercel_sqlite: true,
    });

    render(
      <AuthModal
        open={true}
        onClose={vi.fn()}
        authConfig={{ google_enabled: false, google_client_id: null }}
        onAuthenticated={vi.fn()}
      />
    );

    expect(
      await screen.findByText(/Banco temporário ativo na Vercel/i)
    ).toBeInTheDocument();
  }, 15000);
});
