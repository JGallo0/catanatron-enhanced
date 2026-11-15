import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@mui/material";
import { GridLoader } from "react-spinners";
import {
  closeRoom,
  fetchCurrentAccount,
  getRoom,
  getSavedAccount,
  joinRoom,
  leaveRoom,
  saveGameRoomCode,
  startRoomGame,
  type PlayerAccount,
} from "../utils/apiClient";
import type { Color, RoomState } from "../utils/api.types";
import { getPlayerColorMeta } from "../config/assetRegistry";
import {
  getGuestProfile,
  localizeGuestDisplayName,
  type GuestProfile,
} from "../config/avatarCatalog";
import {
  getOpenSeatLabel,
  isOfficialBotName,
  localizeSeatLabel,
  pickBotNameDeterministic,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { useLanguage } from "../i18n";
import LanguageToggle from "../components/LanguageToggle";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarStudioModal from "../components/AvatarStudioModal";
import { getSavedGameSeat, saveGameSeat } from "../utils/seatStorage";

import "./RoomLobbyPage.scss";

const LazyAvatar3DCanvas = lazy(
  () => import("../components/avatar3d/Avatar3DCanvas")
);

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
  const { language, t } = useLanguage();
  const colorMeta = getPlayerColorMeta(language);
  const openSeatLabel = getOpenSeatLabel(language);

  const { roomCode = "" } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerName, setPlayerName] = useState(() => {
    const saved = getSavedAccount();
    if (saved?.display_name) return saved.display_name;
    const guest = getGuestProfile();
    if (guest.customized && guest.display_name) {
      return localizeGuestDisplayName(guest.display_name, language);
    }
    return localStorage.getItem("catan_player_name") || t("Jogador", "Player");
  });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [claimingColor, setClaimingColor] = useState<Color | "AUTO" | null>(null);
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
          t("Sala não encontrada ou encerrada.", "Room not found or closed.")
      );
    }
  }, [roomCode, roomGone, closingRoom, navigate, t]);

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
    setClaimingColor(preferredColor ?? "AUTO");
    try {
      setError("");
      const cleanName = playerName.trim() || t("Amigo", "Friend");
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
          t(
            "Não foi possível ocupar este assento.",
            "Could not claim this seat."
          )
      );
    } finally {
      setClaimingColor(null);
    }
  };

  const handleStartGame = async () => {
    if (!room || !room.is_host) return;
    try {
      setStarting(true);
      const res = await startRoomGame(
        room.room_code,
        getStoredToken(room.room_code)
      );
      saveGameSeat(res.game_id, res.room.my_color);
      saveGameRoomCode(res.game_id, res.room.room_code || room.room_code);
      const query = res.room.my_color ? `?seat=${res.room.my_color}` : "";
      navigate(`/games/${res.game_id}${query}`);
    } catch (err: any) {
      setStarting(false);
      setError(
        err?.response?.data?.description ||
          t("Erro ao iniciar a partida.", "Failed to start match.")
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
          t("Não foi possível encerrar a sala.", "Could not close the room.")
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
          t("Não foi possível sair da sala.", "Could not leave the room.")
      );
    }
  };

  if (!room && !error) {
    return (
      <div
        className="room-lobby-page room-lobby-stage room-lobby-stage--centered"
        data-testid="room-lobby-stage"
      >
        <GridLoader color="#FACC15" size={60} />
      </div>
    );
  }

  const normalizedCode = roomCode.toUpperCase();
  const hasOpenHumanSlot = Boolean(
    room?.seats.some((seat) => seat.player_key === "HUMAN" && !seat.claimed)
  );

  return (
    <div
      className="room-lobby-page room-lobby-stage"
      data-testid="room-lobby-stage"
    >
      <header className="room-lobby-topbar">
        <div className="room-lobby-topbar__left">
          <Link to="/" className="room-lobby-back">
            ← {t("Voltar", "Back")}
          </Link>
          <span className="room-lobby-code-pill">
            {t(`Sala #${normalizedCode}`, `Room #${normalizedCode}`)}
          </span>
        </div>

        <div className="room-lobby-topbar__brand">
          <span className="room-lobby-brand-title">RULE THE ISLE</span>
          <small className="room-lobby-brand-sub">
            {t("Lobby Pré-Partida", "Pre-Match Lobby")}
          </small>
        </div>

        <div className="room-lobby-topbar__actions">
          <LanguageToggle compact />
          {room &&
            room.is_host &&
            (confirmCloseOpen ? (
              <div
                className="room-lobby-confirm-close"
                role="group"
                aria-label={t(
                  `Confirmar encerramento da sala ${room.room_code}`,
                  `Confirm closing room ${room.room_code}`
                )}
              >
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  className="room-lobby-confirm-btn"
                  disabled={closingRoom}
                  onClick={handleCloseRoom}
                >
                  {closingRoom
                    ? t("Encerrando...", "Closing...")
                    : t("Confirmar", "Confirm")}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  className="room-lobby-cancel-btn"
                  disabled={closingRoom}
                  onClick={() => setConfirmCloseOpen(false)}
                >
                  {t("Cancelar", "Cancel")}
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
                🗑️ {t("Encerrar Sala", "Close Room")}
              </Button>
            ))}
          {room &&
            !room.is_host &&
            room.my_color &&
            room.status === "WAITING" && (
              <Button
                size="small"
                variant="outlined"
                className="room-lobby-leave-btn"
                disabled={leavingRoom}
                onClick={handleLeaveRoom}
              >
                {leavingRoom
                  ? t("Saindo...", "Leaving...")
                  : t("🚪 Sair da Sala", "🚪 Leave Room")}
              </Button>
            )}
        </div>
      </header>

      {error && (
        <div
          className={
            room
              ? "room-lobby-error room-lobby-error--floating"
              : "room-lobby-error-panel"
          }
          role="alert"
        >
          <div className="room-lobby-error">{error}</div>
          {!room && (
            <Link to="/" className="room-lobby-back room-lobby-back--cta">
              ← {t("Voltar para o Início", "Back to Home")}
            </Link>
          )}
        </div>
      )}

      {room && (
        <>
          <main className="lobby-stage-window">
            <div
              className="lobby-hero-lineup"
              style={
                { "--seat-count": room.seats.length } as React.CSSProperties
              }
            >
              {room.seats.map((seat, idx) => {
                const palette = colorMeta[seat.color];
                const isOpenHuman =
                  seat.player_key === "HUMAN" && !seat.claimed;
                const displaySeatName = seat.is_bot
                  ? isOfficialBotName(seat.player_name)
                    ? seat.player_name
                    : pickBotNameDeterministic(idx)
                  : isOpenHuman
                    ? openSeatLabel
                    : localizeGuestDisplayName(
                        localizeSeatLabel(seat.player_name, language),
                        language
                      );

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

                const seatRoleText = seat.is_bot
                  ? t("🤖 Bot", "🤖 Bot")
                  : isOpenHuman
                    ? t("🔓 Livre", "🔓 Open")
                    : seat.is_me
                      ? t("★ Você", "★ You")
                      : seat.seat_kind === "USER"
                        ? t("👤 Conta", "👤 Account")
                        : t("👤 Jogador", "👤 Player");

                return (
                  <div
                    key={seat.color}
                    className={`lobby-lineup-slot ${
                      seat.is_me ? "lobby-lineup-slot--me" : ""
                    } ${isOpenHuman ? "lobby-lineup-slot--open" : ""}`}
                    data-testid={`lobby-hero-card-${seat.color}`}
                    style={
                      { "--seat-color": palette.primary } as React.CSSProperties
                    }
                  >
                    <div className="lobby-lineup-slot__stage">
                      {resolvedAvatar ? (
                        <Suspense
                          fallback={
                            <div
                              className="lobby-lineup-slot__suspense"
                              aria-hidden="true"
                            >
                              <PlayerAvatar
                                config={resolvedAvatar.config ?? {}}
                                username={resolvedAvatar.username}
                                size={92}
                                testId={`lobby-seat-suspense-${idx}`}
                              />
                            </div>
                          }
                        >
                          <LazyAvatar3DCanvas
                            config={resolvedAvatar.config ?? {}}
                            username={resolvedAvatar.username}
                            mode="hero"
                            backgroundMode="transparent"
                            cameraFocus="full"
                            interactive={true}
                            fallbackSize={92}
                            fallbackTestId={`lobby-seat-fallback-${idx}`}
                          />
                        </Suspense>
                      ) : (
                        <div className="lobby-open-pedestal">
                          <span
                            className="lobby-open-pedestal__icon"
                            style={{
                              borderColor: palette.primary,
                              color: palette.primary,
                            }}
                          >
                            ➕
                          </span>
                          <strong>{t("Vaga Aberta", "Open Slot")}</strong>
                          <small>
                            {t(
                              "Espaço reservado para amigo",
                              "Reserved spot for a friend"
                            )}
                          </small>
                          {room.status === "WAITING" && (
                            <Button
                              variant="contained"
                              size="small"
                              className="lobby-seat-claim-btn"
                              disabled={claimingColor === seat.color}
                              onClick={() => handleClaimSeat(seat.color)}
                            >
                              {claimingColor === seat.color
                                ? t("Entrando...", "Joining...")
                                : t("🪑 Sentar Aqui", "🪑 Take Seat")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="lobby-lineup-pill">
                      <div className="lobby-lineup-pill__top">
                        <span
                          className="lobby-lineup-pill__dot"
                          style={{ backgroundColor: palette.primary }}
                        />
                        <strong className="lobby-lineup-pill__name">
                          {displaySeatName}
                        </strong>
                      </div>
                      <div className="lobby-lineup-pill__meta">
                        <span className="lobby-lineup-pill__color">
                          {palette.label}
                        </span>
                        <span className="lobby-lineup-pill__role">
                          {seatRoleText}
                        </span>
                      </div>
                      {seat.is_me && room.status === "WAITING" && (
                        <Button
                          size="small"
                          variant="outlined"
                          className="lobby-edit-avatar-btn"
                          onClick={() => setAvatarStudioOpen(true)}
                        >
                          🎨 {t("Editar Avatar", "Edit Avatar")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>

          <footer className="lobby-dock-wrap">
            {!room.my_color &&
              hasOpenHumanSlot &&
              room.status === "WAITING" && (
                <div className="lobby-guest-join-pill">
                  <label htmlFor="player-nickname-input">
                    {t("Seu Nome:", "Your Name:")}
                  </label>
                  <input
                    id="player-nickname-input"
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder={t("Seu apelido...", "Your nickname...")}
                    maxLength={24}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    className="identity-save-btn"
                    disabled={claimingColor !== null}
                    onClick={() => handleClaimSeat()}
                  >
                    {claimingColor === "AUTO"
                      ? t("Entrando...", "Joining...")
                      : t("🪑 Ocupar Assento Livre", "🪑 Claim Open Seat")}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    className="identity-avatar-btn"
                    onClick={() => setAvatarStudioOpen(true)}
                  >
                    🎨 {t("Editar Meu Avatar", "Edit My Avatar")}
                  </Button>
                </div>
              )}

            <div className="lobby-action-dock">
              <Button
                variant="outlined"
                className="invite-copy-btn"
                onClick={handleCopyInvite}
              >
                {copied
                  ? t("✅ Link Copiado!", "✅ Link Copied!")
                  : t("📋 Copiar Link", "📋 Copy Link")}
              </Button>

              {room.is_host ? (
                <Button
                  variant="contained"
                  className="start-room-btn"
                  disabled={starting}
                  onClick={handleStartGame}
                >
                  {starting
                    ? t("Iniciando Partida...", "Starting Match...")
                    : t("🚀 Iniciar Partida", "🚀 Start Match")}
                </Button>
              ) : (
                <div className="lobby-waiting-host-note" role="status">
                  ⏳{" "}
                  {t(
                    "Aguardando quem criou a sala iniciar a partida...",
                    "Waiting for the room creator to start the match..."
                  )}
                </div>
              )}
            </div>
          </footer>
        </>
      )}

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
