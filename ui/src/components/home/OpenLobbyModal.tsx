import { useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import { PLAYER_COLOR_META } from "../../config/assetRegistry";
import {
  isOfficialBotName,
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
};

export default function OpenLobbyModal({
  open,
  onClose,
  rooms,
  onJoinRoom,
  onOpenMatch,
  onCreateRoomClick,
  onRefresh,
}: OpenLobbyModalProps) {
  const [filter, setFilter] = useState<LobbyFilter>("all");
  const [joinCodeInput, setJoinCodeInput] = useState("");

  const openRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.status === "WAITING" && r.seats.some((s) => !s.is_bot && !s.claimed)
      ),
    [rooms]
  );

  const myRooms = useMemo(
    () => rooms.filter((r) => Boolean(r.my_color)),
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
                    room.my_color ? "open-lobby-card--mine" : ""
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
                      Mapa {room.config.map_template} • {room.config.vps_to_win} PV
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
                              {isOpen ? "Vaga Aberta" : displayName}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      size="small"
                      variant="contained"
                      className="open-lobby-join-btn"
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
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
