import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button, MenuItem, Select } from "@mui/material";
import { GridLoader } from "react-spinners";
import {
  getPlayers,
  getRoom,
  joinRoom,
  updateRoom,
  startRoomGame,
  type PlayerEntry,
} from "../utils/apiClient";
import type { Color, RoomState } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";

import "./RoomLobbyPage.scss";

const SEAT_COLORS: Color[] = ["RED", "BLUE", "ORANGE", "WHITE"];

function getStoredToken(roomCode: string): string | null {
  try {
    return localStorage.getItem(`catan_room_token_${roomCode.toUpperCase()}`);
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

export function saveGameSeat(gameId: string, color: Color | null) {
  try {
    if (color) {
      localStorage.setItem(`catan_game_seat_${gameId}`, color);
    }
  } catch {
    // ignore storage errors
  }
}

export function getSavedGameSeat(gameId: string): Color | null {
  try {
    return (localStorage.getItem(`catan_game_seat_${gameId}`) as Color) || null;
  } catch {
    return null;
  }
}

export default function RoomLobbyPage() {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomState | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerEntry[]>([]);
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem("catan_player_name") || "Jogador"
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const token = getStoredToken(roomCode);

  const fetchRoomState = useCallback(async () => {
    if (!roomCode) return;
    try {
      const data = await getRoom(roomCode, getStoredToken(roomCode));
      setRoom(data);
      if (data.status === "IN_PROGRESS" && data.game_id) {
        saveGameSeat(data.game_id, data.my_color);
        const query = data.my_color ? `?seat=${data.my_color}` : "";
        navigate(`/games/${data.game_id}${query}`);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.description ||
          "Sala não encontrada ou expirada."
      );
    }
  }, [roomCode, navigate]);

  useEffect(() => {
    getPlayers()
      .then(setAvailablePlayers)
      .catch(() => setAvailablePlayers([]));
  }, []);

  useEffect(() => {
    fetchRoomState();
    const interval = setInterval(fetchRoomState, 1500);
    return () => clearInterval(interval);
  }, [fetchRoomState]);

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

  const handleSeatTypeChange = async (index: number, newPlayerKey: string) => {
    if (!room) return;
    const nextSeats = room.seats.map((s, idx) => {
      if (idx !== index) {
        return {
          color: s.color,
          player_key: s.player_key,
          player_name: s.player_name,
        };
      }
      const botEntry = availablePlayers.find((p) => p.key === newPlayerKey);
      return {
        color: s.color,
        player_key: newPlayerKey,
        player_name:
          newPlayerKey === "HUMAN"
            ? s.is_me
              ? playerName
              : "Aguardando Amigo..."
            : `🤖 ${botEntry?.name || newPlayerKey}`,
      };
    });
    const updated = await updateRoom(room.room_code, {
      token,
      seats: nextSeats,
    });
    setRoom(updated);
  };

  const handleAddSeat = async () => {
    if (!room || room.seats.length >= 4) return;
    const nextColor = SEAT_COLORS[room.seats.length];
    const nextSeats = [
      ...room.seats.map((s) => ({
        color: s.color,
        player_key: s.player_key,
        player_name: s.player_name,
      })),
      {
        color: nextColor,
        player_key: "CATANATRON",
        player_name: "🤖 Catanatron (AlphaBeta)",
      },
    ];
    const updated = await updateRoom(room.room_code, {
      token,
      seats: nextSeats,
    });
    setRoom(updated);
  };

  const handleRemoveSeat = async (index: number) => {
    if (!room || room.seats.length <= 2) return;
    const filtered = room.seats
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({
        color: SEAT_COLORS[idx],
        player_key: s.player_key,
        player_name: s.player_name,
      }));
    const updated = await updateRoom(room.room_code, {
      token,
      seats: filtered,
    });
    setRoom(updated);
  };

  const handleStartGame = async () => {
    if (!room) return;
    try {
      setStarting(true);
      const res = await startRoomGame(room.room_code, token);
      saveGameSeat(res.game_id, res.room.my_color);
      const query = res.room.my_color ? `?seat=${res.room.my_color}` : "";
      navigate(`/games/${res.game_id}${query}`);
    } catch (err: any) {
      setStarting(false);
      setError(
        err?.response?.data?.description || "Erro ao iniciar a partida."
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
              Envie o link abaixo para seus amigos entrarem na sala e adicione bots nas vagas restantes
            </p>
          </div>
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
                  : "🪑 Ocupar Vaga Humana"}
              </Button>
            </div>

            {/* Seats List */}
            <div className="lobby-seats-section">
              <div className="lobby-seats-header">
                <span>Assentos da Partida ({room.seats.length}/4)</span>
                <small>
                  Misture amigos humanos (via link) e bots de IA (Catanatron AlphaBeta, MCTS, etc.)
                </small>
              </div>

              <div className="lobby-seats-grid">
                {room.seats.map((seat, idx) => {
                  const palette = PLAYER_COLOR_META[seat.color];
                  const isOpenHuman =
                    seat.player_key === "HUMAN" && !seat.claimed;

                  return (
                    <div
                      key={seat.color}
                      className={`lobby-seat-row ${seat.is_me ? "lobby-seat-row--me" : ""}`}
                      style={{
                        borderLeftColor: palette.primary,
                      }}
                    >
                      <div className="lobby-seat-row__color">
                        <span
                          className="lobby-seat-row__dot"
                          style={{
                            background: palette.primary,
                            boxShadow: `0 0 8px ${palette.glow}`,
                          }}
                        />
                        <div>
                          <strong>{palette.label}</strong>
                          <small>
                            {seat.is_me
                              ? "★ Seu Assento"
                              : isOpenHuman
                                ? "🔓 Vaga Aberta"
                                : seat.player_name}
                          </small>
                        </div>
                      </div>

                      <div className="lobby-seat-row__selector">
                        <Select
                          size="small"
                          fullWidth
                          value={seat.player_key}
                          onChange={(e) =>
                            handleSeatTypeChange(idx, e.target.value as string)
                          }
                        >
                          <MenuItem value="HUMAN">
                            👤 Humano ({seat.claimed ? seat.player_name : "Vaga para Amigo"})
                          </MenuItem>
                          {availablePlayers
                            .filter((p) => p.is_bot)
                            .map((bot) => (
                              <MenuItem key={bot.key} value={bot.key}>
                                🤖 Bot: {bot.name}
                              </MenuItem>
                            ))}
                        </Select>
                      </div>

                      <div className="lobby-seat-row__actions">
                        {seat.player_key === "HUMAN" && !seat.is_me && (
                          <Button
                            size="small"
                            variant="outlined"
                            className="claim-seat-btn"
                            onClick={() => handleClaimSeat(seat.color)}
                          >
                            Sentar Aqui
                          </Button>
                        )}
                        {room.seats.length > 2 && (
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

              {room.seats.length < 4 && (
                <Button
                  variant="outlined"
                  className="add-seat-btn"
                  onClick={handleAddSeat}
                >
                  + Adicionar Jogador ou Bot ({room.seats.length}/4)
                </Button>
              )}
            </div>

            {/* Rules Summary */}
            <div className="lobby-rules-summary">
              <span>🗺️ Mapa: <strong>{room.config.map_template}</strong></span>
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
    </div>
  );
}
