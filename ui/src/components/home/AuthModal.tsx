import { useCallback, useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import {
  getBackendHealth,
  loginAccount,
  loginWithGoogle,
  registerAccount,
  type AuthConfig,
  type BackendHealth,
  type PlayerAccount,
} from "../../utils/apiClient";
import GoogleSignInButton from "../GoogleSignInButton";
import { useLanguage } from "../../i18n";
import "./AuthModal.scss";

export type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  authConfig: AuthConfig;
  promptBanner?: string;
  onAuthenticated: (account: PlayerAccount) => void;
};

export default function AuthModal({
  open,
  onClose,
  authConfig,
  promptBanner,
  onAuthenticated,
}: AuthModalProps) {
  const { t } = useLanguage();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  useEffect(() => {
    if (!open) return;
    setAuthError("");
    setPasswordInput("");
    let cancelled = false;
    if (typeof getBackendHealth === "function") {
      getBackendHealth()
        .then((health) => {
          if (!cancelled) setBackendHealth(health);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [open]);

  const formatAuthError = (err: any, fallbackMsg: string): string => {
    const desc = err?.response?.data?.description;
    if (typeof desc === "string" && desc.trim()) {
      return desc;
    }
    const status = err?.response?.status;
    if (typeof status === "number" && status >= 500) {
      return t(
        `Erro no servidor (HTTP ${status}) ao acessar o banco de dados. Verifique a variável DATABASE_URL na Vercel.`,
        `Server error (HTTP ${status}) accessing the database. Check the DATABASE_URL environment variable on Vercel.`
      );
    }
    if (typeof err?.message === "string" && err.message.trim()) {
      return err.message;
    }
    return fallbackMsg;
  };

  const handleLogin = async () => {
    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setAuthError(
        t("Informe seu nome de usuário.", "Enter your username.")
      );
      return;
    }
    if (!passwordInput) {
      setAuthError(t("Informe sua senha.", "Enter your password."));
      return;
    }
    setBusy(true);
    setAuthError("");
    try {
      const logged = await loginAccount({
        username: cleanUsername,
        password: passwordInput,
      });
      onAuthenticated(logged);
      onClose();
    } catch (err: any) {
      setAuthError(
        formatAuthError(
          err,
          t("Usuário ou senha incorretos.", "Invalid username or password.")
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    const cleanUsername = usernameInput.trim();
    if (cleanUsername.length < 2) {
      setAuthError(
        t(
          "O nome de usuário deve ter pelo menos 2 caracteres.",
          "Username must be at least 2 characters."
        )
      );
      return;
    }
    if (passwordInput.length < 4) {
      setAuthError(
        t(
          "A senha deve ter pelo menos 4 caracteres.",
          "Password must be at least 4 characters."
        )
      );
      return;
    }
    setBusy(true);
    setAuthError("");
    try {
      const logged = await registerAccount({
        username: cleanUsername,
        password: passwordInput,
        displayName: displayNameInput.trim() || cleanUsername,
      });
      onAuthenticated(logged);
      onClose();
    } catch (err: any) {
      setAuthError(
        formatAuthError(
          err,
          t("Não foi possível cadastrar o usuário.", "Could not register account.")
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setBusy(true);
      setAuthError("");
      try {
        const logged = await loginWithGoogle(credential);
        onAuthenticated(logged);
        onClose();
      } catch (err: any) {
        setAuthError(
          err?.response?.data?.description ||
            t(
              "Falha na autenticação com o Google.",
              "Google authentication failed."
            )
        );
      } finally {
        setBusy(false);
      }
    },
    [onAuthenticated, onClose, t]
  );

  const handleSubmitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !busy) {
      if (authMode === "login") {
        void handleLogin();
      } else {
        void handleRegister();
      }
    }
  };

  const envGoogleClientId =
    ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "").trim();
  const resolvedGoogleClientId =
    (authConfig.google_client_id || envGoogleClientId).trim();
  const isGoogleReady = Boolean(
    resolvedGoogleClientId && (authConfig.google_enabled || resolvedGoogleClientId)
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: "catan-modal-paper home-auth-paper" }}
    >
      <DialogTitle className="home-auth-header">
        <span>👤 {t("Identificação de Jogador", "Player Sign-In")}</span>
        <Button
          size="small"
          variant="outlined"
          className="home-modal-close-btn"
          onClick={onClose}
        >
          {t("Fechar", "Close")}
        </Button>
      </DialogTitle>
      <DialogContent className="home-auth-body">
        {promptBanner && (
          <div className="home-auth-banner">{promptBanner}</div>
        )}
        {backendHealth?.ephemeral_vercel_sqlite && (
          <div className="home-auth-warning" role="alert">
            ⚠️{" "}
            {t(
              "Banco temporário ativo na Vercel (sem DATABASE_URL configurada): contas criadas aqui podem se perder ao atualizar ou reiniciar o servidor.",
              "Temporary database active on Vercel (DATABASE_URL not configured): accounts created here may be lost when refreshing or restarting the server."
            )}
          </div>
        )}

        <p className="home-auth-subtitle">
          {t(
            "Salve suas vitórias no Ranking Global, desbloqueie molduras exclusivas e jogue de qualquer dispositivo.",
            "Save your wins to the Global Ranking, unlock exclusive frames, and play from any device."
          )}
        </p>

        <div
          className="home-auth-tabs"
          role="tablist"
          aria-label={t("Modo de acesso", "Access mode")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "login"}
            className={`home-auth-tab-btn ${authMode === "login" ? "active" : ""}`}
            onClick={() => {
              setAuthMode("login");
              setAuthError("");
            }}
          >
            {t("Entrar", "Sign In")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "register"}
            className={`home-auth-tab-btn ${authMode === "register" ? "active" : ""}`}
            onClick={() => {
              setAuthMode("register");
              setAuthError("");
            }}
          >
            {t("Criar Conta", "Create Account")}
          </button>
        </div>

        <div className="home-auth-form">
          <input
            type="text"
            className="home-modal-input"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder={t("Usuário (ex: joao)", "Username (e.g. john)")}
            maxLength={24}
          />
          {authMode === "register" && (
            <input
              type="text"
              className="home-modal-input"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              onKeyDown={handleSubmitKeyDown}
              placeholder={t(
                "Apelido na mesa (ex: João)",
                "Table nickname (e.g. John)"
              )}
              maxLength={24}
            />
          )}
          <input
            type="password"
            className="home-modal-input"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder={
              authMode === "login"
                ? t("Senha", "Password")
                : t("Senha (mín 4 caracteres)", "Password (min 4 characters)")
            }
            maxLength={64}
          />

          {authError && <div className="home-auth-error">{authError}</div>}

          <Button
            variant="contained"
            className="home-auth-submit-btn"
            disabled={busy}
            onClick={authMode === "login" ? handleLogin : handleRegister}
          >
            {busy
              ? t("Aguarde...", "Please wait...")
              : authMode === "login"
                ? t("Entrar", "Sign In")
                : t("Criar Conta", "Create Account")}
          </Button>
        </div>

        <div className="home-auth-google">
          <div className="home-auth-divider">
            <span>{t("ou", "or")}</span>
          </div>
          {isGoogleReady ? (
            <GoogleSignInButton
              clientId={resolvedGoogleClientId}
              onCredential={handleGoogleCredential}
            />
          ) : (
            <div className="home-auth-google-unavailable" role="note">
              <span
                className="home-auth-google-unavailable__badge"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.4 3.6 1.5 7.4l3.6 2.8C6 7.2 8.7 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.1 14.8c-.2-.8-.4-1.6-.4-2.8s.2-2 .4-2.8L1.5 6.4C.5 8.1 0 10 0 12s.5 3.9 1.5 5.6l3.6-2.8z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.3 0-6-2.2-6.9-5.2l-3.6 2.8C3.4 20.4 7.4 23 12 23z"
                  />
                </svg>
              </span>
              <div className="home-auth-google-unavailable__text">
                <strong>{t("Entrar com Google", "Sign in with Google")}</strong>
                <span>
                  {t(
                    "Indisponível neste servidor: configure",
                    "Unavailable on this server: set"
                  )}{" "}
                  <code>GOOGLE_CLIENT_ID</code>{" "}
                  {t(
                    "no .env ou Vercel para ativar.",
                    "in .env or Vercel to enable."
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
