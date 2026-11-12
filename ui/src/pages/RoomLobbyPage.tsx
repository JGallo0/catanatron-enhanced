import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button, IconButton, MenuItem, Select, Tooltip } from "@mui/material";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { GridLoader } from "react-spinners";
import {
  closeRoom,
  fetchCurrentAccount,
  getRoom,
  getSavedAccount,
  joinRoom,
  leaveRoom,
  saveGameRoomCode,
  updateRoom,
  startRoomGame,
  type BotDifficulty,
  type BotSpeed,
  type DiceMode,
  type PlayerAccount,
} from "../utils/apiClient";
import type { Color, RoomState } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { getGuestProfile, type GuestProfile } from "../config/avatarCatalog";
import {
  BOT_AVATAR_PROFILES,
  BOT_DIFFICULTY_OPTIONS,
  BOT_SPEED_OPTIONS,
  difficultyFromPlayerKey,
  formatBotDifficultyLabel,
  formatBotSpeedLabel,
  formatMapTemplateLabel,
  isOfficialBotName,
  normalizeBotSpeed,
  OFFICIAL_BOT_NAMES,
  OPEN_SEAT_LABEL,
  pickBotNameDeterministic,
  pickBotNames,
  playerKeyForDifficulty,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarStudioModal from "../components/AvatarStudioModal";
import MapTemplatePreview from "../components/home/MapTemplatePreview";
import { getSavedGameSeat, saveGameSeat } from "../utils/seatStorage";

import "./RoomLobbyPage.scss";

const SEAT_COLORS: Color[] = ["RED", "BLUE", "ORANGE", "WHITE"];

function getStoredToken(roomCode: string): string | null {
  try {
    return (
      localStorage.getItem(`catan_room_token_${roomCode.toUpperCase()}`) ||
      getSavedAccount()?.auth_token ||
      null
    );
  } catch {
    return null;
  }
}

function saveStoredToken(roomCode: string, token: string) {
  try {
    localStorage.setItem(`catan_room_token_${roomCode.toUpperCase()}`, token);
  } catch {
    // ignore storage errors
  }
}

export { getSavedGameSeat, saveGameSeat };

export default function RoomLobbyPage() {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerName, setPlayerName] = useState(() => {
    const saved = getSavedAccount();
    if (saved?.display_name) return saved.display_name;
    const guest = getGuestProfile();
    if (guest.customized && guest.display_name) return guest.display_name;
    return localStorage.getItem("catan_player_name") || "Jogador";
  });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [roomGone, setRoomGone] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [closingRoom, setClosingRoom] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [account, setAccount] = useState<PlayerAccount | null>(() =>
    getSavedAccount()
  );
  const [guestProfile, setGuestProfile] = useState<GuestProfile>(() =>
    getGuestProfile()
  );
  const [avatarStudioOpen, setAvatarStudioOpen] = useState(false);
  const roomEpochRef = useRef(0);

  useEffect(() => {
    fetchCurrentAccount()
      .then((acct) => {
        if (acct) {
          setAccount(acct);
          setPlayerName((prev) =>
            prev === "Jogador" || !prev.trim() ? acct.display_name : prev
          );
        }
      })
      .catch(() => {});
  }, []);

  const fetchRoomState = useCallback(async () => {
    if (!roomCode || roomGone || closingRoom) return;
    const startEpoch = roomEpochRef.current;
    try {
      const data = await getRoom(roomCode, getStoredToken(roomCode));
      if (startEpoch !== roomEpochRef.current) return;
      setRoom(data);
      if (data.status === "IN_PROGRESS" && data.game_id) {
        saveGameSeat(data.game_id, data.my_color);
        saveGameRoomCode(data.game_id, data.room_code);
        const query = data.my_color ? `?seat=${data.my_color}` : "";
        navigate(`/games/${data.game_id}${query}`);
      }
    } catch (err: any) {
      if (startEpoch !== roomEpochRef.current) return;
      if (err?.response?.status === 404 || err?.response?.status === 410) {
        setRoom(null);
        setRoomGone(true);
      }
      setError(
        err?.response?.data?.description ||
          "Sala não encontrada ou encerrada."
      );
    }
  }, [roomCode, roomGone, closingRoom, navigate]);

  useEffect(() => {
    if (!roomCode || roomGone || closingRoom) return;
    fetchRoomState();
    const interval = setInterval(fetchRoomState, 1500);
    return () => clearInterval(interval);
  }, [roomCode, roomGone, closingRoom, fetchRoomState]);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/rooms/${roomCode.toUpperCase()}`
      : `/rooms/${roomCode.toUpperCase()}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleClaimSeat = async (preferredColor?: Color) => {
    if (!roomCode) return;
    roomEpochRef.current += 1;
    try {
      setError("");
      const cleanName = playerName.trim() || "Amigo";
      localStorage.setItem("catan_player_name", cleanName);
      const res = await joinRoom(roomCode, {
        playerName: cleanName,
        preferredColor,
        token: getStoredToken(roomCode),
      });
      saveStoredToken(roomCode, res.seat_token);
      setRoom(res.room);
    } catch (err: any) {
      setError(
        err?.response?.data?.description ||
          "Não foi possível ocupar este assento."
      );
    }
  };

  const resolveRoomDifficulty = (currentRoom: RoomState): BotDifficulty => {
    if (currentRoom.config.bot_difficulty) {
      return currentRoom.config.bot_difficulty;
    }
    const firstBot = currentRoom.seats.find((s) => s.is_bot);
    return firstBot ? difficultyFromPlayerKey(firstBot.player_key) : "medium";
  };

  const handleDifficultyChange = async (nextDiff: BotDifficulty) => {
    if (!room || !room.is_host || room.status !== "WAITING") return;
    if (resolveRoomDifficulty(room) === nextDiff) return;
    roomEpochRef.current += 1;
    try {
      setError("");
      const updated = await updateRoom(room.room_code, {
        token: getStoredToken(room.room_code),
        config: { bot_difficulty: nextDiff },
      });
      setRoom(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.description ||
          "Não foi possível alterar a dificuldade dos bots."
      );
    }
  };

  const resolveRoomDiceMode = (currentRoom: RoomState): DiceMode => {
    return currentRoom.config.dice_mode === "balanced" ? "balanced" : "random";
  };

  const resolveRoomBotSpeed = (currentRoom: RoomState): BotSpeed => {
    return normalizeBotSpeed(currentRoom.config.bot_speed) ?? "normal";
  };

  const handleBotSpeedChange = async (nextSpeed: BotSpeed) => {
    if (!room || !room.is_host || room.status !== "WAITING") return;
    if (resolveRoomBotSpeed(room) === nextSpeed) return;
    roomEpochRef.current += 1;
    try {
      setError("");
      const updated = await updateRoom(room.room_code, {
        token: getStoredToken(room.room_code),
        config: { bot_speed: nextSpeed },
      });
      setRoom(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.description ||
          "Não foi possível alterar a velocidade dos bots."
      );
    }
  };

  const handleDiceModeChange = async (nextMode: DiceMode) => {
    if (!room || !room.is_host || room.status !== "WAITING") return;
    if (resolveRoomDiceMode(room) === nextMode) return;
    roomEpochRef.current += 1;
    try {
      setError("");
      const updated = await updateRoom(room.room_code, {
        token: getStoredToken(room.room_code),
        config: { dice_mode: nextMode },
      });
      setRoom(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.description ||
          "Não foi possível alterar o modo dos dados."
      );
    }
  };

  const handleSeatChange = async (index: number, selectionValue: string) => {
    if (!room || !room.is_host || room.status !== "WAITING") return;
    const roomDiff = resolveRoomDifficulty(room);
    const botKey = playerKeyForDifficulty(roomDiff);

    if (selectionValue.startsWith("BOT:")) {
      const targetBot = selectionValue.slice(4);
      const dupOther = room.seats.some(
        (s, idx) => idx !== index && s.is_bot && s.player_name === targetBot
      );
      if (dupOther) return;
    }

    roomEpochRef.current += 1;
    try {
      setError("");
      const nextSeats = room.seats.map((s, idx) => {
        if (idx !== index) {
          return {
            color: SEAT_COLORS[idx],
            source_color: s.color,
            player_key: s.player_key,
            player_name: s.player_name,
          };
        }
        if (selectionValue === "HUMAN") {
          return {
            color: SEAT_COLORS[idx],
            source_color: s.color,
            player_key: "HUMAN",
            player_name: s.claimed ? s.player_name : OPEN_SEAT_LABEL,
          };
        }
        if (selectionValue === "RELEASE_HUMAN") {
          return {
            color: SEAT_COLORS[idx],
            source_color: s.color,
            player_key: "HUMAN",
            player_name: OPEN_SEAT_LABEL,
            release_claim: true,
          };
        }
        const chosenBot = selectionValue.startsWith("BOT:")
          ? selectionValue.slice(4)
          : pickBotNames(1)[0];
        return {
          color: SEAT_COLORS[idx],
          source_color: s.color,
          player_key: botKey,
          player_name: chosenBot,
        };
      });

      const updated = await updateRoom(room.room_code, {
        token: getStoredToken(room.room_code),
        seats: nextSeats,
      });
      setRoom(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.description ||
          "Não foi possível atualizar o assento."
      );
    }
  };

  const handleAddSeat = async () => {
    if (!room || !room.is_host || room.seats.length >= 4) return;
    const nextColor = SEAT_COLORS[room.seats.length];
    const usedBotNames = new Set(
      room.seats
        .filter((s) => s.is_bot)
        .map((s) => s.player_name)
        .filter((n) => isOfficialBotName(n))
    );
    const nextBotName = pickBotNames(1, usedBotNames)[0];
    const botKey = playerKeyForDifficulty(resolveRoomDifficulty(room));
    const nextSeats = [
      ...room.seats.map((s) => ({
        color: s.color,
        source_color: s.color,
        player_key: s.player_key,
        player_name: s.player_name,
      })),
      {
        color: nextColor,
        player_key: botKey,
        player_name: nextBotName,
      },
    ];
    roomEpochRef.current += 1;
    try {
      setError("");
      const updated = await updateRoom(room.room_code, {
        token: getStoredToken(room.room_code),
        seats: nextSeats,
      });
      setRoom(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.description ||
          "Não foi possível adicionar um assento."
      );
    }
  };

  const handleRemoveSeat = async (index: number) => {
    if (!room || !room.is_host || room.seats.length <= 2) return;
    if (room.seats[index]?.is_me) return;
    const filtered = room.seats
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({
        color: SEAT_COLORS[idx],
        source_color: s.color,
        player_key: s.player_key,
        player_name: s.player_name,
      }));
    roomEpochRef.current += 1;
    try {
      setError("");
      const updated = await updateRoom(room.room_code, {
        token: getStoredToken(room.room_code),
        seats: filtered,
      });
      setRoom(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.description ||
          "Não foi possível remover o assento."
      );
    }
  };

  const handleStartGame = async () => {
    if (!room) return;
    try {
      setStarting(true);
      const res = await startRoomGame(room.room_code, getStoredToken(room.room_code));
      saveGameSeat(res.game_id, res.room.my_color);
      saveGameRoomCode(res.game_id, res.room.room_code || room.room_code);
      const query = res.room.my_color ? `?seat=${res.room.my_color}` : "";
      navigate(`/games/${res.game_id}${query}`);
    } catch (err: any) {
      setStarting(false);
      setError(
        err?.response?.data?.description || "Erro ao iniciar a partida."
      );
    }
  };

  const handleCloseRoom = async () => {
    if (!room) return;
    try {
      setClosingRoom(true);
      setError("");
      await closeRoom(room.room_code, getStoredToken(room.room_code));
      setRoomGone(true);
      navigate("/");
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 410) {
        setRoomGone(true);
        navigate("/");
        return;
      }
      setClosingRoom(false);
      setConfirmCloseOpen(false);
      setError(
        err?.response?.data?.description ||
          err?.message ||
          "Não foi possível encerrar a sala."
      );
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) return;
    try {
      setLeavingRoom(true);
      setError("");
      await leaveRoom(room.room_code, getStoredToken(room.room_code));
      navigate("/");
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 410) {
        setRoomGone(true);
        navigate("/");
        return;
      }
      setLeavingRoom(false);
      setError(
        err?.response?.data?.description ||
          err?.message ||
          "Não foi possível sair da sala."
      );
    }
  };

  if (!room && !error) {
    return (
      <div className="room-lobby-page">
        <GridLoader color="#FACC15" size={60} />
      </div>
    );
  }

  const roomDifficulty = room ? resolveRoomDifficulty(room) : "medium";
  const roomBotSpeed = room ? resolveRoomBotSpeed(room) : "normal";
  const roomDiceMode = room ? resolveRoomDiceMode(room) : "random";

  return (
    <div className="room-lobby-page">
      <div className="room-lobby-card">
        <div className="room-lobby-header">
          <Link to="/" className="room-lobby-back">
            ← Voltar
          </Link>
          <div className="room-lobby-title-group">
            <h1>Sala Privada #{roomCode.toUpperCase()}</h1>
            <p>
              Envie o link abaixo para seus amigos entrarem no {OPEN_SEAT_LABEL} ou escolha os bots da mesa
            </p>
          </div>
          {room && room.is_host && (
            <div className="room-lobby-header__actions">
              {confirmCloseOpen ? (
                <div
                  className="room-lobby-confirm-close"
                  role="group"
                  aria-label={`Confirmar encerramento da sala ${room.room_code}`}
                >
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    className="room-lobby-confirm-btn"
                    disabled={closingRoom}
                    onClick={handleCloseRoom}
                  >
                    {closingRoom ? "Encerrando..." : "Confirmar"}
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    className="room-lobby-cancel-btn"
                    disabled={closingRoom}
                    onClick={() => setConfirmCloseOpen(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  className="room-lobby-close-btn"
                  onClick={() => setConfirmCloseOpen(true)}
                >
                  🗑️ Encerrar Sala
                </Button>
              )}
            </div>
          )}
          {room &&
            !room.is_host &&
            room.my_color &&
            room.status === "WAITING" && (
              <div className="room-lobby-header__actions">
                <Button
                  size="small"
                  variant="outlined"
                  className="room-lobby-leave-btn"
                  disabled={leavingRoom}
                  onClick={handleLeaveRoom}
                >
                  {leavingRoom ? "Saindo..." : "🚪 Sair da Sala"}
                </Button>
              </div>
            )}
        </div>

        {error && <div className="room-lobby-error">{error}</div>}

        {room && (
          <>
            {/* Shareable Link Box */}
            <div className="invite-link-box">
              <div className="invite-link-box__url">
                <span className="invite-link-box__badge">LINK DE CONVITE</span>
                <code>{inviteUrl}</code>
              </div>
              <Button
                variant="contained"
                className="invite-copy-btn"
                onClick={handleCopyInvite}
              >
                {copied ? "✅ Link Copiado!" : "📋 Copiar Link"}
              </Button>
            </div>

            {/* Player Name Input & Quick Claim */}
            <div className="guest-identity-bar">
              <label htmlFor="player-nickname-input">Seu Nome na Mesa:</label>
              <input
                id="player-nickname-input"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Digite seu apelido..."
                maxLength={24}
              />
              <Button
                variant="outlined"
                size="small"
                className="identity-save-btn"
                onClick={() => handleClaimSeat(room.my_color ?? undefined)}
              >
                {room.my_color
                  ? `Atualizar Nome (${PLAYER_COLOR_META[room.my_color].label})`
                  : "🪑 Ocupar Assento Livre"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                className="identity-avatar-btn"
                onClick={() => setAvatarStudioOpen(true)}
              >
                🎨 Editar Meu Avatar
              </Button>
            </div>

            {/* Bot Difficulty Selector (Single Global Room Setting) */}
            <div className="lobby-difficulty-bar">
              <div className="lobby-difficulty-bar__header">
                <span>Dificuldade dos Bots</span>
                <strong>{formatBotDifficultyLabel(roomDifficulty)}</strong>
              </div>
              <div
                className="lobby-difficulty-bar__options"
                role="group"
                aria-label="Dificuldade dos Bots"
              >
                {BOT_DIFFICULTY_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant="contained"
                    size="small"
                    disabled={!room.is_host || room.status !== "WAITING"}
                    aria-pressed={roomDifficulty === opt.value}
                    title={opt.description}
                    className={`lobby-difficulty-btn ${
                      roomDifficulty === opt.value ? "selected" : ""
                    }`}
                    onClick={() => handleDifficultyChange(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Bot Speed Selector (Locked Pre-Match Room Setting) */}
            <div className="lobby-speed-bar">
              <div className="lobby-speed-bar__header">
                <span className="lobby-inline-title">
                  Velocidade dos Bots
                  <Tooltip
                    title="Define o ritmo das animações e jogadas dos bots durante toda esta partida online. Depois de iniciada, não poderá ser alterada."
                    arrow
                    enterTouchDelay={0}
                    leaveTouchDelay={3000}
                  >
                    <IconButton
                      size="small"
                      className="lobby-help-btn"
                      aria-label="Ajuda sobre Velocidade dos Bots"
                    >
                      <HelpOutlineRoundedIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </span>
                <strong>{formatBotSpeedLabel(roomBotSpeed)}</strong>
              </div>
              <div
                className="lobby-speed-bar__options"
                role="group"
                aria-label="Velocidade dos Bots"
              >
                {BOT_SPEED_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant="contained"
                    size="small"
                    disabled={!room.is_host || room.status !== "WAITING"}
                    aria-pressed={roomBotSpeed === opt.value}
                    title={opt.description}
                    className={`lobby-speed-btn ${
                      roomBotSpeed === opt.value ? "selected" : ""
                    }`}
                    onClick={() => handleBotSpeedChange(opt.value)}
                  >
                    {opt.icon} {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Dice Mode Selector */}
            <div className="lobby-dice-bar">
              <div className="lobby-dice-bar__header">
                <span className="lobby-inline-title">
                  Modo dos Dados
                  <Tooltip
                    title="Padrão usa 2 dados clássicos (2d6). Equilibrados usa um baralho de 36 pares embaralhados, reembaralhando ao restarem 5 cartas."
                    arrow
                    enterTouchDelay={0}
                    leaveTouchDelay={3000}
                  >
                    <IconButton
                      size="small"
                      className="lobby-help-btn"
                      aria-label="Ajuda sobre Modo dos Dados"
                    >
                      <HelpOutlineRoundedIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </span>
                <strong>
                  {roomDiceMode === "balanced"
                    ? "Equilibrados (Baralho 36)"
                    : "Padrão (2d6)"}
                </strong>
              </div>
              <div
                className="lobby-dice-bar__options"
                role="group"
                aria-label="Modo dos Dados"
              >
                <Button
                  variant="contained"
                  size="small"
                  disabled={!room.is_host || room.status !== "WAITING"}
                  aria-pressed={roomDiceMode === "random"}
                  className={`lobby-dice-btn ${
                    roomDiceMode === "random" ? "selected" : ""
                  }`}
                  onClick={() => handleDiceModeChange("random")}
                >
                  🎲 Padrão (2d6)
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!room.is_host || room.status !== "WAITING"}
                  aria-pressed={roomDiceMode === "balanced"}
                  className={`lobby-dice-btn ${
                    roomDiceMode === "balanced" ? "selected" : ""
                  }`}
                  onClick={() => handleDiceModeChange("balanced")}
                >
                  🎴 Equilibrados (Baralho 36)
                </Button>
              </div>
            </div>

            {/* Seats List */}
            <div className="lobby-seats-section">
              <div className="lobby-seats-header">
                <span>Assentos da Partida ({room.seats.length}/4)</span>
                <small>
                  Deixe em {OPEN_SEAT_LABEL} para amigos entrarem pelo link ou selecione um perfil de bot
                </small>
              </div>

              <div className="lobby-seats-grid">
                {room.seats.map((seat, idx) => {
                  const palette = PLAYER_COLOR_META[seat.color];
                  const isOpenHuman =
                    seat.player_key === "HUMAN" && !seat.claimed;
                  const displaySeatName = seat.is_bot
                    ? isOfficialBotName(seat.player_name)
                      ? seat.player_name
                      : pickBotNameDeterministic(idx)
                    : isOpenHuman
                      ? OPEN_SEAT_LABEL
                      : seat.player_name;
                  const resolvedAvatar = !isOpenHuman
                    ? resolveSeatAvatarProps({
                        color: seat.color,
                        isBot: seat.is_bot,
                        seatIndex: idx,
                        seatName: displaySeatName,
                        seatAvatar: {
                          seat_kind:
                            seat.seat_kind ||
                            (seat.is_bot
                              ? "BOT"
                              : seat.username
                                ? "USER"
                                : "GUEST"),
                          username: seat.username ?? null,
                          avatar_config: seat.avatar_config,
                        },
                        isMySeat: seat.is_me,
                        accountAvatar: account?.avatar_config,
                        accountUsername: account?.username,
                        guestCustomAvatar: guestProfile.customized
                          ? guestProfile.avatar_config
                          : undefined,
                      })
                    : null;

                  const selectValue = seat.is_bot
                    ? `BOT:${displaySeatName}`
                    : "HUMAN";

                  const canEditSeat =
                    room.is_host &&
                    room.status === "WAITING" &&
                    !seat.is_me;

                  return (
                    <div
                      key={seat.color}
                      className={`lobby-seat-row ${seat.is_me ? "lobby-seat-row--me" : ""}`}
                      style={{
                        borderLeftColor: palette.primary,
                      }}
                    >
                      <div className="lobby-seat-row__color">
                        {resolvedAvatar ? (
                          <PlayerAvatar
                            config={resolvedAvatar.config}
                            username={resolvedAvatar.username}
                            size={42}
                          />
                        ) : (
                          <span
                            className="lobby-seat-row__open-badge"
                            style={{
                              borderColor: palette.primary,
                              background: palette.primary,
                              color: palette.textOnFill,
                            }}
                          >
                            ➕
                          </span>
                        )}
                        <div>
                          <strong>{palette.label}</strong>
                          <small>
                            {seat.is_me
                              ? `★ Seu Assento (${displaySeatName})`
                              : isOpenHuman
                                ? `🔓 ${OPEN_SEAT_LABEL}`
                                : displaySeatName}
                          </small>
                        </div>
                      </div>

                      <div className="lobby-seat-row__selector">
                        <Select
                          size="small"
                          fullWidth
                          SelectDisplayProps={{
                            "aria-label": `Assento ${palette.label}`,
                          }}
                          disabled={!canEditSeat}
                          value={selectValue}
                          onChange={(e) =>
                            handleSeatChange(idx, e.target.value as string)
                          }
                        >
                          {!seat.is_bot && seat.claimed ? (
                            <MenuItem value="HUMAN">
                              <span className="lobby-select-option">
                                <span>
                                  👤 {displaySeatName}
                                  {seat.is_me ? " (Você)" : ""}
                                </span>
                              </span>
                            </MenuItem>
                          ) : (
                            <MenuItem value="HUMAN">
                              <span className="lobby-select-option">
                                <span>🪑 {OPEN_SEAT_LABEL}</span>
                              </span>
                            </MenuItem>
                          )}

                          {!seat.is_bot && seat.claimed && !seat.is_me && (
                            <MenuItem value="RELEASE_HUMAN">
                              <span className="lobby-select-option">
                                <span>🪑 {OPEN_SEAT_LABEL} (Liberar vaga)</span>
                              </span>
                            </MenuItem>
                          )}

                          {OFFICIAL_BOT_NAMES.map((botName) => {
                            const botVal = `BOT:${botName}`;
                            const takenElsewhere = room.seats.some(
                              (other, otherIdx) =>
                                otherIdx !== idx &&
                                other.is_bot &&
                                other.player_name === botName
                            );
                            return (
                              <MenuItem
                                key={botVal}
                                value={botVal}
                                disabled={takenElsewhere}
                              >
                                <span className="lobby-select-option">
                                  <PlayerAvatar
                                    config={BOT_AVATAR_PROFILES[botName]}
                                    username={botName}
                                    size={22}
                                  />
                                  <span>{botName}</span>
                                  {takenElsewhere && (
                                    <span className="lobby-option-hint">
                                      (na mesa)
                                    </span>
                                  )}
                                </span>
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </div>

                      <div className="lobby-seat-row__actions">
                        {seat.player_key === "HUMAN" &&
                          !seat.claimed &&
                          !seat.is_me && (
                            <Button
                              size="small"
                              variant="outlined"
                              className="claim-seat-btn"
                              onClick={() => handleClaimSeat(seat.color)}
                            >
                              Sentar Aqui
                            </Button>
                          )}
                        {room.is_host &&
                          room.seats.length > 2 &&
                          !seat.is_me && (
                            <Button
                              size="small"
                              variant="text"
                              className="remove-seat-btn"
                              onClick={() => handleRemoveSeat(idx)}
                            >
                              Remover
                            </Button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {room.is_host && room.seats.length < 4 && (
                <Button
                  variant="outlined"
                  className="add-seat-btn"
                  onClick={handleAddSeat}
                >
                  + Adicionar Jogador ou Bot ({room.seats.length}/4)
                </Button>
              )}
            </div>

            {/* Map Preview & Rules Summary */}
            <MapTemplatePreview template={room.config.map_template} compact />

            <div className="lobby-rules-summary">
              <span>
                🗺️ Mapa:{" "}
                <strong>{formatMapTemplateLabel(room.config.map_template)}</strong>
              </span>
              <span>
                🤖 Bots:{" "}
                <strong>{formatBotDifficultyLabel(roomDifficulty)}</strong>
              </span>
              <span>
                ⚡ Velocidade:{" "}
                <strong>{formatBotSpeedLabel(roomBotSpeed)}</strong>
              </span>
              <span>
                🎲 Dados:{" "}
                <strong>
                  {roomDiceMode === "balanced" ? "Equilibrados" : "Padrão (2d6)"}
                </strong>
              </span>
              <span>🏆 Vitória: <strong>{room.config.vps_to_win} PV</strong></span>
              <span>🃏 Limite Descarte: <strong>{room.config.discard_limit} cartas</strong></span>
              <span>
                🥷 Ladrão Amigável:{" "}
                <strong>{room.config.friendly_robber ? "Ativo" : "Desativado"}</strong>
              </span>
            </div>

            <Button
              variant="contained"
              className="start-room-btn"
              disabled={starting}
              onClick={handleStartGame}
            >
              {starting
                ? "Iniciando Partida..."
                : "🚀 Iniciar Partida (Todos na Sala entram juntos)"}
            </Button>
          </>
        )}
      </div>

      <AvatarStudioModal
        open={avatarStudioOpen}
        onClose={() => setAvatarStudioOpen(false)}
        account={account}
        guestProfile={guestProfile}
        onSaved={async (updated) => {
          setAccount(updated);
          setPlayerName(updated.display_name);
          localStorage.setItem("catan_player_name", updated.display_name);
          if (room?.my_color && roomCode) {
            try {
              const res = await joinRoom(roomCode, {
                playerName: updated.display_name,
                preferredColor: room.my_color,
                token: getStoredToken(roomCode),
              });
              saveStoredToken(roomCode, res.seat_token);
              setRoom(res.room);
              return;
            } catch {
              // fallback to polling refresh
            }
          }
          fetchRoomState();
        }}
        onGuestSaved={async (saved) => {
          setGuestProfile(saved);
          setPlayerName(saved.display_name);
          if (room?.my_color && roomCode) {
            try {
              const res = await joinRoom(roomCode, {
                playerName: saved.display_name,
                preferredColor: room.my_color,
                token: getStoredToken(roomCode),
              });
              saveStoredToken(roomCode, res.seat_token);
              setRoom(res.room);
              return;
            } catch {
              // fallback to polling refresh
            }
          }
          fetchRoomState();
        }}
      />
    </div>
  );
}
