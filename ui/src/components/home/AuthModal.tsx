import { useCallback, useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import {
  loginAccount,
  loginWithGoogle,
  registerAccount,
  type AuthConfig,
  type PlayerAccount,
} from "../../utils/apiClient";
import GoogleSignInButton from "../GoogleSignInButton";
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
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAuthError("");
    setPasswordInput("");
  }, [open]);

  const handleLogin = async () => {
    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setAuthError("Informe seu nome de usuário.");
      return;
    }
    if (!passwordInput) {
      setAuthError("Informe sua senha.");
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
        err?.response?.data?.description || "Usuário ou senha incorretos."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    const cleanUsername = usernameInput.trim();
    if (cleanUsername.length < 2) {
      setAuthError("O nome de usuário deve ter pelo menos 2 caracteres.");
      return;
    }
    if (passwordInput.length < 4) {
      setAuthError("A senha deve ter pelo menos 4 caracteres.");
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
        err?.response?.data?.description || "Não foi possível cadastrar o usuário."
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
            "Falha na autenticação com o Google."
        );
      } finally {
        setBusy(false);
      }
    },
    [onAuthenticated, onClose]
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: "catan-modal-paper home-auth-paper" }}
    >
      <DialogTitle className="home-auth-header">
        <span>👤 Identificação de Jogador</span>
        <Button
          size="small"
          variant="outlined"
          className="home-modal-close-btn"
          onClick={onClose}
        >
          Fechar
        </Button>
      </DialogTitle>
      <DialogContent className="home-auth-body">
        {promptBanner && (
          <div className="home-auth-banner">{promptBanner}</div>
        )}

        <p className="home-auth-subtitle">
          Salve suas vitórias no Ranking Global, desbloqueie molduras exclusivas e jogue de qualquer dispositivo.
        </p>

        <div className="home-auth-tabs" role="tablist" aria-label="Modo de acesso">
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
            Entrar
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
            Criar Conta
          </button>
        </div>

        <div className="home-auth-form">
          <input
            type="text"
            className="home-modal-input"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={handleSubmitKeyDown}
            placeholder="Usuário (ex: joao)"
            maxLength={24}
          />
          {authMode === "register" && (
            <input
              type="text"
              className="home-modal-input"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              onKeyDown={handleSubmitKeyDown}
              placeholder="Apelido na mesa (ex: João)"
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
              authMode === "login" ? "Senha" : "Senha (mín 4 caracteres)"
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
              ? "Aguarde..."
              : authMode === "login"
                ? "Entrar"
                : "Criar Conta"}
          </Button>
        </div>

        {authConfig.google_enabled && authConfig.google_client_id && (
          <div className="home-auth-google">
            <div className="home-auth-divider">
              <span>ou</span>
            </div>
            <GoogleSignInButton
              clientId={authConfig.google_client_id}
              onCredential={handleGoogleCredential}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
