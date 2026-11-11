import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Checkbox,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Tooltip,
} from "@mui/material";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { GridLoader } from "react-spinners";
import {
  createGame,
  createRoom,
  DEFAULT_PLAYERS,
  fetchCurrentAccount,
  getAuthConfig,
  getPlayers,
  getSavedAccount,
  listActiveRooms,
  loginAccount,
  loginWithGoogle,
  logoutAccount,
  registerAccount,
  type AuthConfig,
  type MapTemplate,
  type PlayerAccount,
  type PlayerEntry,
  type PlayerKey,
} from "../utils/apiClient";
import type { RoomState } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import GoogleSignInButton from "../components/GoogleSignInButton";
import LeaderboardModal from "../components/LeaderboardModal";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarStudioModal from "../components/AvatarStudioModal";

import "./HomePage.scss";

const MAP_TEMPLATES: Array<{ value: MapTemplate; label: string }> = [
  { value: "BASE", label: "PADRÃO (BASE)" },
  { value: "MINI", label: "MINI (RÁPIDO)" },
  { value: "TOURNAMENT", label: "TORNEIO" },
];

const PLAYER_COLORS = ["RED", "BLUE", "ORANGE", "WHITE"] as const;
const COLOR_LABELS_PT: Record<(typeof PLAYER_COLORS)[number], string> = {
  RED: "VERMELHO",
  BLUE: "AZUL",
  ORANGE: "LARANJA",
  WHITE: "BRANCO",
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [mapTemplate, setMapTemplate] = useState<MapTemplate>("BASE");
  const [vpsToWin, setVpsToWin] = useState(10);
  const [discardLimit, setDiscardLimit] = useState(7);
  const [friendlyRobber, setFriendlyRobber] = useState(true);
  const [players, setPlayers] = useState<PlayerKey[]>([
    "HUMAN",
    "CATANATRON",
    "CATANATRON",
    "CATANATRON",
  ]);
  const [available, setAvailable] = useState<PlayerEntry[]>(DEFAULT_PLAYERS);

  // Account & Online Lobby state
  const [account, setAccount] = useState<PlayerAccount | null>(() =>
    getSavedAccount()
  );
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    google_enabled: false,
    google_client_id: null,
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [avatarStudioOpen, setAvatarStudioOpen] = useState(false);
  const [activeRooms, setActiveRooms] = useState<RoomState[]>([]);

  const [hostName, setHostName] = useState(
    () =>
      getSavedAccount()?.display_name ||
      localStorage.getItem("catan_player_name") ||
      "Anfitrião"
  );
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const navigate = useNavigate();

  const refreshRooms = useCallback(() => {
    listActiveRooms(account?.auth_token)
      .then(setActiveRooms)
      .catch(() => {});
  }, [account?.auth_token]);

  useEffect(() => {
    getPlayers()
      .then((list) => {
        if (list.length > 0) setAvailable(list);
      })
      .catch(() => setAvailable(DEFAULT_PLAYERS));

    getAuthConfig()
      .then(setAuthConfig)
      .catch(() => {});

    fetchCurrentAccount()
      .then((acc) => {
        if (acc) {
          setAccount(acc);
          setHostName(acc.display_name);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshRooms();
    const timer = setInterval(refreshRooms, 5000);
    return () => clearInterval(timer);
  }, [refreshRooms]);

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
    setAuthBusy(true);
    setAuthError("");
    try {
      const logged = await loginAccount({
        username: cleanUsername,
        password: passwordInput,
      });
      setAccount(logged);
      setHostName(logged.display_name);
      setPasswordInput("");
      refreshRooms();
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.description ||
          "Usuário ou senha incorretos."
      );
    } finally {
      setAuthBusy(false);
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
    setAuthBusy(true);
    setAuthError("");
    try {
      const logged = await registerAccount({
        username: cleanUsername,
        password: passwordInput,
        displayName: displayNameInput.trim() || cleanUsername,
      });
      setAccount(logged);
      setHostName(logged.display_name);
      setPasswordInput("");
      refreshRooms();
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.description ||
          "Não foi possível cadastrar o usuário."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const logged = await loginWithGoogle(credential);
      setAccount(logged);
      setHostName(logged.display_name);
      refreshRooms();
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.description ||
          "Falha na autenticação com o Google."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAvatarStudioOpen(false);
    await logoutAccount();
    setAccount(null);
    refreshRooms();
  };

  const handlePlayerChange = (index: number, value: PlayerKey) => {
    setPlayers((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? value : player
      )
    );
  };

  const handleAddPlayer = () => {
    setPlayers((current) =>
      current.length >= 4 ? current : [...current, "CATANATRON"]
    );
  };

  const handleRemovePlayer = (index: number) => {
    setPlayers((current) =>
      current.length <= 2
        ? current
        : current.filter((_, playerIndex) => playerIndex !== index)
    );
  };

  const handleCreateGame = async () => {
    setLoading(true);
    try {
      const gameId = await createGame({
        players,
        mapTemplate,
        vpsToWin,
        discardLimit,
        friendlyRobber,
      });
      setLoading(false);
      navigate("/games/" + gameId);
    } catch {
      setLoading(false);
    }
  };

  const handleCreatePrivateRoom = async () => {
    setLoading(true);
    try {
      const cleanName =
        account?.display_name || hostName.trim() || "Anfitrião";
      localStorage.setItem("catan_player_name", cleanName);
      const humanSeats = players.filter((p) => p === "HUMAN").length;
      const roomPlayers =
        humanSeats >= 2
          ? players
          : ["HUMAN", "HUMAN", ...players.slice(2)];

      const res = await createRoom({
        hostName: cleanName,
        players: roomPlayers,
        mapTemplate,
        vpsToWin,
        discardLimit,
        friendlyRobber,
        token: account?.auth_token,
      });
      localStorage.setItem(
        `catan_room_token_${res.room_code.toUpperCase()}`,
        res.seat_token
      );
      setLoading(false);
      navigate(`/rooms/${res.room_code}`);
    } catch {
      setLoading(false);
    }
  };

  const handleJoinRoomByCode = () => {
    const code = joinCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length >= 4) {
      navigate(`/rooms/${code}`);
    }
  };

  const selectedTemplateLabel =
    MAP_TEMPLATES.find((t) => t.value === mapTemplate)?.label || mapTemplate;

  return (
    <div className="home-page">
      <div className="home-page__inner">
        <h1 className="logo">Rule the Isle</h1>
        {!loading ? (
          <div className="setup-card">
            <p className="setup-note">
              Mãos privadas no multiplayer • Tabuleiro Interativo em Português
            </p>

            {/* Player Account Bar & Global Leaderboard */}
            <div className="account-bar">
              {account ? (
                <div className="account-bar__logged">
                  <div className="account-bar__identity">
                    <button
                      type="button"
                      className="account-bar__avatar-btn"
                      onClick={() => setAvatarStudioOpen(true)}
                      title="Personalizar seu avatar"
                    >
                      <PlayerAvatar
                        config={account.avatar_config}
                        username={account.username}
                        size={52}
                      />
                    </button>
                    <div className="account-bar__info">
                      <span className="account-bar__badge">👤 CONTA ONLINE</span>
                      <strong>{account.display_name}</strong>
                      <small>
                        @{account.username} • Suas salas e assentos ficam salvos em qualquer dispositivo
                      </small>
                      {account.stats && (
                        <div className="account-bar__stats">
                          <span>Vitórias: <strong>{account.stats.wins}</strong></span>
                          <span>Partidas: <strong>{account.stats.games_played}</strong></span>
                          <span>Aproveitamento: <strong>{account.stats.win_rate}%</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="account-bar__actions">
                    <Button
                      size="small"
                      variant="outlined"
                      className="account-avatar-btn"
                      onClick={() => setAvatarStudioOpen(true)}
                    >
                      🎨 Personalizar Avatar
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      className="account-leaderboard-btn"
                      onClick={() => setLeaderboardOpen(true)}
                    >
                      🏆 Ranking & Histórico
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      className="account-logout-btn"
                      onClick={handleLogout}
                    >
                      Sair
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="account-bar__login">
                  <div className="account-bar__top-row">
                    <div className="account-bar__header">
                      <span>👤 Identificação de Jogador</span>
                      <small>
                        Acesse sua conta para salvar suas vitórias e pontuar no Ranking Global
                      </small>
                    </div>
                    <Button
                      size="small"
                      variant="outlined"
                      className="account-leaderboard-btn"
                      onClick={() => setLeaderboardOpen(true)}
                    >
                      🏆 Ranking & Histórico
                    </Button>
                  </div>

                  <div className="account-bar__tabs">
                    <button
                      type="button"
                      className={`account-tab-btn ${authMode === "login" ? "active" : ""}`}
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError("");
                      }}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      className={`account-tab-btn ${authMode === "register" ? "active" : ""}`}
                      onClick={() => {
                        setAuthMode("register");
                        setAuthError("");
                      }}
                    >
                      Criar Conta
                    </button>
                  </div>

                  <div className="account-bar__inputs">
                    <input
                      type="text"
                      className="multiplayer-input"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          authMode === "login" ? handleLogin() : handleRegister();
                        }
                      }}
                      placeholder="Usuário (ex: joao)"
                      maxLength={24}
                    />
                    {authMode === "register" && (
                      <input
                        type="text"
                        className="multiplayer-input"
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        placeholder="Apelido na mesa (ex: João)"
                        maxLength={24}
                      />
                    )}
                    <input
                      type="password"
                      className="multiplayer-input multiplayer-input--pin"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          authMode === "login" ? handleLogin() : handleRegister();
                        }
                      }}
                      placeholder={authMode === "login" ? "Senha" : "Senha (mín 4 caracteres)"}
                      maxLength={64}
                    />
                    <Button
                      variant="contained"
                      className="account-login-btn"
                      disabled={authBusy}
                      onClick={authMode === "login" ? handleLogin : handleRegister}
                    >
                      {authBusy ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar Conta"}
                    </Button>
                  </div>

                  {authConfig.google_enabled && authConfig.google_client_id && (
                    <div className="account-bar__google">
                      <div className="account-bar__divider">
                        <span>ou</span>
                      </div>
                      <GoogleSignInButton
                        clientId={authConfig.google_client_id}
                        onCredential={handleGoogleCredential}
                      />
                    </div>
                  )}

                  {authError && (
                    <div className="account-bar__error">{authError}</div>
                  )}
                </div>
              )}
            </div>

            {/* Multiplayer Quick Bar: Create Invite Link, Join by Code, or Browse Active Rooms */}
            <div className="multiplayer-banner-box">
              <div className="multiplayer-banner-box__header">
                <span>🌐 Jogar com Amigos Online + Bots</span>
                <small>
                  Crie uma sala privada, envie o link ou entre direto nas salas abertas abaixo
                </small>
              </div>
              <div className="multiplayer-banner-box__controls">
                <input
                  type="text"
                  className="multiplayer-input"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Seu apelido na mesa..."
                  maxLength={24}
                />
                <Button
                  variant="contained"
                  className="create-room-link-btn"
                  onClick={handleCreatePrivateRoom}
                >
                  🔗 Criar Sala Online (Gerar Link)
                </Button>
              </div>
              <div className="multiplayer-banner-box__join-row">
                <input
                  type="text"
                  className="multiplayer-input multiplayer-input--code"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Código da sala (ex: K7M4P9)"
                  maxLength={10}
                />
                <Button
                  variant="outlined"
                  className="join-room-code-btn"
                  disabled={joinCodeInput.trim().length < 4}
                  onClick={handleJoinRoomByCode}
                >
                  Entrar com Código
                </Button>
              </div>

              {activeRooms.length > 0 && (
                <div className="active-rooms-list">
                  <div className="active-rooms-list__title">
                    <span>
                      Salas Abertas & Suas Partidas Ativas ({activeRooms.length})
                    </span>
                  </div>
                  <div className="active-rooms-list__items">
                    {activeRooms.slice(0, 6).map((r) => {
                      const humanCount = r.seats.filter(
                        (s) => !s.is_bot && s.claimed
                      ).length;
                      const botCount = r.seats.filter((s) => s.is_bot).length;
                      const openHumans = r.seats.filter(
                        (s) => !s.is_bot && !s.claimed
                      ).length;
                      const myColorLabel = r.my_color
                        ? PLAYER_COLOR_META[r.my_color]?.label
                        : null;

                      return (
                        <div
                          key={r.room_code}
                          className={`active-room-item ${r.my_color ? "active-room-item--mine" : ""}`}
                        >
                          <div className="active-room-item__meta">
                            <div className="active-room-item__top">
                              <strong>#{r.room_code}</strong>
                              <span
                                className={`room-status-pill ${
                                  r.status === "WAITING" ? "waiting" : "playing"
                                }`}
                              >
                                {r.status === "WAITING"
                                  ? `Aberta (${openHumans} vaga${openHumans === 1 ? "" : "s"})`
                                  : "Em Andamento"}
                              </span>
                              {myColorLabel && (
                                <span className="room-my-seat-pill">
                                  ★ Seu Assento: {myColorLabel}
                                </span>
                              )}
                            </div>
                            <small>
                              👥 {humanCount} humano(s) • 🤖 {botCount} bot(s) • Mapa {r.config.map_template} ({r.config.vps_to_win} PV)
                            </small>
                          </div>
                          <Button
                            size="small"
                            variant="contained"
                            className="active-room-join-btn"
                            onClick={() => {
                              if (r.status === "IN_PROGRESS" && r.game_id) {
                                const q = r.my_color ? `?seat=${r.my_color}` : "";
                                navigate(`/games/${r.game_id}${q}`);
                              } else {
                                navigate(`/rooms/${r.room_code}`);
                              }
                            }}
                          >
                            {r.status === "IN_PROGRESS"
                              ? r.my_color
                                ? "▶ Retomar"
                                : "👁 Assistir"
                              : "Entrar"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="control-group">
              <div className="control-header">
                <span>Modelo do Mapa</span>
                <strong>{selectedTemplateLabel}</strong>
              </div>
              <div className="map-template-buttons">
                {MAP_TEMPLATES.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant="contained"
                    onClick={() => setMapTemplate(value)}
                    className={`choice-button ${
                      mapTemplate === value ? "selected" : ""
                    }`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="control-row">
              <div className="control-group compact-control">
                <div className="control-header">
                  <span>Pontos para Vencer</span>
                  <strong>{vpsToWin}</strong>
                </div>
                <Slider
                  value={vpsToWin}
                  min={3}
                  max={20}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_, value) => setVpsToWin(value as number)}
                />
              </div>

              <div className="control-group compact-control">
                <div className="control-header">
                  <span>Limite de Cartas (Ladrão)</span>
                  <strong>{discardLimit}</strong>
                </div>
                <Slider
                  value={discardLimit}
                  min={5}
                  max={20}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_, value) => setDiscardLimit(value as number)}
                />
              </div>

              <div className="control-group compact-control switch-control">
                <div className="control-header">
                  <span className="inline-title">
                    Ladrão Amigável
                    <Tooltip
                      title="Impede colocar o Ladrão em terrenos de jogadores que tenham apenas 2 pontos de vitória."
                      arrow
                      enterTouchDelay={0}
                      leaveTouchDelay={3000}
                    >
                      <IconButton
                        size="small"
                        className="help-button"
                        aria-label="Ajuda sobre Ladrão Amigável"
                      >
                        <HelpOutlineRoundedIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </span>
                  <strong>{friendlyRobber ? "Ativo" : "Inativo"}</strong>
                </div>
                <Checkbox
                  className="inline-switch"
                  checked={friendlyRobber}
                  onChange={(event) => setFriendlyRobber(event.target.checked)}
                />
              </div>
            </div>

            <div className="control-group">
              <div className="control-header">
                <span>Jogadores na Mesa</span>
                <strong>{players.length}/4</strong>
              </div>
              <div className="players-list">
                {players.map((player, index) => (
                  <div className="player-row" key={`${player}-${index}`}>
                    <div className="player-meta">
                      <span className="player-label">Jogador {index + 1}</span>
                      <span
                        className={`player-color-chip ${PLAYER_COLORS[index].toLowerCase()}`}
                      >
                        {COLOR_LABELS_PT[PLAYER_COLORS[index]]}
                      </span>
                    </div>
                    <Select
                      size="small"
                      fullWidth
                      value={player}
                      onChange={(event) =>
                        handlePlayerChange(
                          index,
                          event.target.value as PlayerKey
                        )
                      }
                    >
                      {available.map((option) => (
                        <MenuItem key={option.key} value={option.key}>
                          {option.is_bot ? `🤖 ${option.name}` : `👤 ${option.name}`}
                        </MenuItem>
                      ))}
                    </Select>
                    <Button
                      variant="text"
                      className="remove-player-btn"
                      disabled={players.length <= 2}
                      onClick={() => handleRemovePlayer(index)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="contained"
                className="add-player-btn"
                disabled={players.length >= 4}
                onClick={handleAddPlayer}
              >
                + Adicionar Jogador
              </Button>
            </div>

            <Button
              variant="contained"
              color="primary"
              className="start-btn"
              onClick={handleCreateGame}
            >
              Iniciar Partida Rápida
            </Button>
          </div>
        ) : (
          <GridLoader className="loader" color="#FACC15" size={60} />
        )}
        <footer className="home-page__legal-footer">
          <strong>Rule the Isle</strong> • Versão modificada em português baseada no motor{" "}
          <a
            href="https://github.com/bcollazo/catanatron"
            target="_blank"
            rel="noreferrer"
          >
            Catanatron
          </a>{" "}
          (Bryan Collazo) • Licença GNU GPL-3.0
        </footer>
        <div className="page-end-spacer" aria-hidden="true" />
      </div>

      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        currentUsername={account?.username}
      />

      {account && (
        <AvatarStudioModal
          open={avatarStudioOpen}
          onClose={() => setAvatarStudioOpen(false)}
          account={account}
          onSaved={(updated) => {
            setAccount(updated);
            setHostName(updated.display_name);
            refreshRooms();
          }}
        />
      )}
    </div>
  );
}
