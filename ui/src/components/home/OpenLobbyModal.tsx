import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import { PLAYER_COLOR_META } from "../../config/assetRegistry";
import {
  formatMapTemplateLabel,
  isOfficialBotName,
  OPEN_SEAT_LABEL,
  pickBotNameDeterministic,
  resolveSeatAvatarProps,
} from "../../config/botCatalog";
import type { Color, RoomState } from "../../utils/api.types";
import PlayerAvatar from "../PlayerAvatar";
import "./OpenLobbyModal.scss";

type LobbyFilter = "all" | "open" | "mine";

export type OpenLobbyModalProps = {
  open: boolean;
  onClose: () => void;
  rooms: RoomState[];
  onJoinRoom: (roomCode: string) => void;
  onOpenMatch: (gameId: string, myColor: Color | null) => void;
  onCreateRoomClick: () => void;
  onRefresh: () => void;
  onCloseRoom?: (roomCode: string) => Promise<void> | void;
  onLeaveRoom?: (roomCode: string) => Promise<void> | void;
};

export default function OpenLobbyModal({
  open,
  onClose,
  rooms,
  onJoinRoom,
  onOpenMatch,
  onCreateRoomClick,
  onRefresh,
  onCloseRoom,
  onLeaveRoom,
}: OpenLobbyModalProps) {
  const [filter, setFilter] = useState<LobbyFilter>("all");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [confirmingCloseCode, setConfirmingCloseCode] = useState<string | null>(
    null
  );
  const [closingCode, setClosingCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmingCloseCode(null);
      setClosingCode(null);
      setActionError("");
    }
  }, [open]);

  const openRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.status === "WAITING" && r.seats.some((s) => !s.is_bot && !s.claimed)
      ),
    [rooms]
  );

  const myRooms = useMemo(
    () => rooms.filter((r) => Boolean(r.my_color) || r.is_host),
    [rooms]
  );

  const filteredRooms = useMemo(() => {
    if (filter === "open") return openRooms;
    if (filter === "mine") return myRooms;
    return rooms;
  }, [filter, openRooms, myRooms, rooms]);

  const cleanCode = joinCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  const handleJoinByCode = () => {
    if (cleanCode.length >= 4) {
      onJoinRoom(cleanCode);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ className: "catan-modal-paper open-lobby-paper" }}
    >
      <DialogTitle className="open-lobby-header">
        <span>🧭 Salas Abertas & Lobby Online</span>
        <div className="open-lobby-header__right">
          <Button
            size="small"
            variant="outlined"
            className="open-lobby-refresh-btn"
            onClick={onRefresh}
          >
            ↻ Atualizar
          </Button>
          <Button
            size="small"
            variant="outlined"
            className="home-modal-close-btn"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </DialogTitle>

      <DialogContent className="open-lobby-body">
        <div className="open-lobby-code-bar">
          <input
            type="text"
            className="home-modal-input open-lobby-code-input"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoinByCode();
            }}
            placeholder="Código da sala (ex: K7M4P9)"
            maxLength={10}
          />
          <Button
            variant="outlined"
            className="open-lobby-code-btn"
            disabled={cleanCode.length < 4}
            onClick={handleJoinByCode}
          >
            Entrar com Código
          </Button>
        </div>

        <div className="open-lobby-filters">
          <button
            type="button"
            aria-pressed={filter === "all"}
            className={`open-lobby-filter-pill ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Todas ({rooms.length})
          </button>
          <button
            type="button"
            aria-pressed={filter === "open"}
            className={`open-lobby-filter-pill ${filter === "open" ? "active" : ""}`}
            onClick={() => setFilter("open")}
          >
            Com Vagas ({openRooms.length})
          </button>
          <button
            type="button"
            aria-pressed={filter === "mine"}
            className={`open-lobby-filter-pill ${filter === "mine" ? "active" : ""}`}
            onClick={() => setFilter("mine")}
          >
            Minhas ({myRooms.length})
          </button>
        </div>

        {actionError && (
          <div className="open-lobby-error" role="alert">
            {actionError}
          </div>
        )}

        {filteredRooms.length === 0 ? (
          <div className="open-lobby-empty">
            <p>Nenhuma sala encontrada neste filtro no momento.</p>
            <Button
              variant="contained"
              className="open-lobby-create-btn"
              onClick={onCreateRoomClick}
            >
              🌐 Criar Nova Sala Online
            </Button>
          </div>
        ) : (
          <div className="open-lobby-list">
            {filteredRooms.map((room) => {
              const openHumans = room.seats.filter(
                (s) => !s.is_bot && !s.claimed
              ).length;
              const myColorLabel = room.my_color
                ? PLAYER_COLOR_META[room.my_color]?.label
                : null;

              return (
                <div
                  key={room.room_code}
                  className={`open-lobby-card ${
                    room.my_color || room.is_host ? "open-lobby-card--mine" : ""
                  }`}
                >
                  <div className="open-lobby-card__top">
                    <div className="open-lobby-card__badges">
                      <strong>#{room.room_code}</strong>
                      <span
                        className={`open-lobby-status ${
                          room.status === "WAITING" ? "waiting" : "playing"
                        }`}
                      >
                        {room.status === "WAITING"
                          ? `Aberta (${openHumans} vaga${openHumans === 1 ? "" : "s"})`
                          : "Em Andamento"}
                      </span>
                      {myColorLabel && (
                        <span className="open-lobby-my-seat">
                          ★ Seu Assento: {myColorLabel}
                        </span>
                      )}
                    </div>
                    <small className="open-lobby-card__rules">
                      Mapa {formatMapTemplateLabel(room.config.map_template)} •{" "}
                      {room.config.vps_to_win} PV
                    </small>
                  </div>

                  <div className="open-lobby-card__bottom">
                    <div className="open-lobby-seats">
                      {room.seats.map((seat, seatIdx) => {
                        const palette = PLAYER_COLOR_META[seat.color];
                        const isOpen = !seat.is_bot && !seat.claimed;
                        const displayName = seat.is_bot
                          ? isOfficialBotName(seat.player_name)
                            ? seat.player_name
                            : pickBotNameDeterministic(seatIdx)
                          : seat.player_name;
                        const avatarProps = !isOpen
                          ? resolveSeatAvatarProps({
                              color: seat.color,
                              isBot: seat.is_bot,
                              seatIndex: seatIdx,
                              seatName: displayName,
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
                            })
                          : null;
                        return (
                          <div
                            key={seat.color}
                            className={`open-lobby-seat-chip ${
                              isOpen ? "open-lobby-seat-chip--open" : ""
                            }`}
                            style={{ borderColor: palette.primary }}
                          >
                            {avatarProps ? (
                              <PlayerAvatar
                                config={avatarProps.config}
                                username={avatarProps.username}
                                size={28}
                              />
                            ) : (
                              <span
                                className="open-lobby-seat-icon"
                                style={{
                                  background: palette.primary,
                                  color: palette.textOnFill,
                                }}
                              >
                                ➕
                              </span>
                            )}
                            <span>
                              {isOpen ? OPEN_SEAT_LABEL : displayName}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="open-lobby-card__actions">
                      {onCloseRoom && room.is_host && (
                        confirmingCloseCode === room.room_code ? (
                          <div
                            className="open-lobby-confirm-close"
                            role="group"
                            aria-label={`Confirmar encerramento da sala ${room.room_code}`}
                          >
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              className="open-lobby-confirm-btn"
                              disabled={closingCode === room.room_code}
                              onClick={async () => {
                                try {
                                  setClosingCode(room.room_code);
                                  setActionError("");
                                  await onCloseRoom(room.room_code);
                                  setConfirmingCloseCode(null);
                                } catch (err: any) {
                                  setActionError(
                                    err?.response?.data?.description ||
                                      err?.message ||
                                      "Não foi possível encerrar a sala."
                                  );
                                } finally {
                                  setClosingCode(null);
                                }
                              }}
                            >
                              {closingCode === room.room_code
                                ? "Encerrando..."
                                : "Confirmar"}
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              className="open-lobby-cancel-close-btn"
                              disabled={closingCode === room.room_code}
                              onClick={() => setConfirmingCloseCode(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            className="open-lobby-close-room-btn"
                            disabled={Boolean(closingCode)}
                            aria-label={`Encerrar sala ${room.room_code}`}
                            onClick={() => {
                              setActionError("");
                              setConfirmingCloseCode(room.room_code);
                            }}
                          >
                            🗑️ Encerrar Sala
                          </Button>
                        )
                      )}

                      {onLeaveRoom &&
                        !room.is_host &&
                        Boolean(room.my_color) &&
                        room.status === "WAITING" && (
                          <Button
                            size="small"
                            variant="outlined"
                            className="open-lobby-leave-room-btn"
                            disabled={Boolean(closingCode)}
                            aria-label={`Sair da sala ${room.room_code}`}
                            onClick={async () => {
                              try {
                                setClosingCode(room.room_code);
                                setActionError("");
                                await onLeaveRoom(room.room_code);
                              } catch (err: any) {
                                setActionError(
                                  err?.response?.data?.description ||
                                    err?.message ||
                                    "Não foi possível sair da sala."
                                );
                              } finally {
                                setClosingCode(null);
                              }
                            }}
                          >
                            🚪 Sair da Sala
                          </Button>
                        )}

                      <Button
                        size="small"
                        variant="contained"
                        className="open-lobby-join-btn"
                        disabled={closingCode === room.room_code}
                        onClick={() => {
                          if (room.status === "IN_PROGRESS" && room.game_id) {
                            onOpenMatch(room.game_id, room.my_color);
                          } else {
                            onJoinRoom(room.room_code);
                          }
                        }}
                      >
                        {room.status === "IN_PROGRESS"
                          ? room.my_color
                            ? "▶ Retomar"
                            : "👁 Assistir"
                          : "Entrar"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
