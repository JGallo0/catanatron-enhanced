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
  clearSavedAccount,
  createGame,
  createRoom,
  DEFAULT_PLAYERS,
  getPlayers,
  getSavedAccount,
  listActiveRooms,
  loginOrRegisterAccount,
  type MapTemplate,
  type PlayerAccount,
  type PlayerEntry,
  type PlayerKey,
} from "../utils/apiClient";
import type { RoomState } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";

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
  const [usernameInput, setUsernameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
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
  }, []);

  useEffect(() => {
    refreshRooms();
    const timer = setInterval(refreshRooms, 5000);
    return () => clearInterval(timer);
  }, [refreshRooms]);

  const handleLoginOrRegister = async () => {
    const cleanUsername = usernameInput.trim() || hostName.trim();
    if (!cleanUsername) {
      setAuthError("Digite um nome de usuário acima para entrar ou criar sua conta.");
      return;
    }
    const cleanPin = pinInput.trim() || "1234";
    setAuthBusy(true);
    setAuthError("");
    try {
      const logged = await loginOrRegisterAccount({
        username: cleanUsername,
        pin: cleanPin,
        displayName: hostName.trim() || cleanUsername,
      });
      setAccount(logged);
      setHostName(logged.display_name);
      setPinInput("");
      listActiveRooms(logged.auth_token)
        .then(setActiveRooms)
        .catch(() => {});
    } catch (err: any) {
      setAuthError(
        err?.response?.data?.description ||
          "Não foi possível autenticar. Verifique usuário e PIN."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    clearSavedAccount();
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

            {/* Player Account Bar (persistent login across any device on Vercel) */}
            <div className="account-bar">
              {account ? (
                <div className="account-bar__logged">
                  <div className="account-bar__info">
                    <span className="account-bar__badge">👤 CONTA ONLINE</span>
                    <strong>{account.display_name}</strong>
                    <small>
                      @{account.username} • Suas salas e assentos ficam salvos em qualquer dispositivo
                    </small>
                  </div>
                  <Button
                    size="small"
                    variant="outlined"
                    className="account-logout-btn"
                    onClick={handleLogout}
                  >
                    Sair
                  </Button>
                </div>
              ) : (
                <div className="account-bar__login">
                  <div className="account-bar__header">
                    <span>👤 Entrar ou Criar Conta Rápida</span>
                    <small>
                      Entre com usuário + PIN de 4 dígitos para jogar de qualquer PC/celular e retomar suas partidas quando quiser
                    </small>
                  </div>
                  <div className="account-bar__inputs">
                    <input
                      type="text"
                      className="multiplayer-input"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLoginOrRegister();
                      }}
                      placeholder="Usuário (ex: joao)"
                      maxLength={24}
                    />
                    <input
                      type="password"
                      className="multiplayer-input multiplayer-input--pin"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLoginOrRegister();
                      }}
                      placeholder="PIN / Senha (opcional)"
                      maxLength={16}
                    />
                    <Button
                      variant="contained"
                      className="account-login-btn"
                      disabled={authBusy}
                      onClick={handleLoginOrRegister}
                    >
                      {authBusy ? "Entrando..." : "Entrar / Criar"}
                    </Button>
                  </div>
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
    </div>
  );
}
