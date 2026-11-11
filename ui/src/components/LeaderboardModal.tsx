import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, Tab, Tabs, Button } from "@mui/material";
import { getLeaderboard, getMatchHistory } from "../utils/apiClient";
import type { LeaderboardEntry, MatchRecord } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import "./LeaderboardModal.scss";

export default function LeaderboardModal({
  open,
  onClose,
  currentUsername,
}: {
  open: boolean;
  onClose: () => void;
  currentUsername?: string;
}) {
  const [tab, setTab] = useState<"ranking" | "history">("ranking");
  const [onlyMine, setOnlyMine] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [offlineFallback, setOfflineFallback] = useState(false);

  useEffect(() => {
    if (!open) return;
    getLeaderboard()
      .then((res) => {
        setLeaderboard(res.leaderboard);
        setOfflineFallback((prev) => prev || res.is_offline_fallback);
      })
      .catch(() => {});
    getMatchHistory(onlyMine && currentUsername ? currentUsername : undefined)
      .then((res) => {
        setMatches(res.matches);
        setOfflineFallback((prev) => prev || res.is_offline_fallback);
      })
      .catch(() => {});
  }, [open, onlyMine, currentUsername]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ className: "catan-modal-paper leaderboard-modal-paper" }}
    >
      <DialogTitle className="catan-modal-title leaderboard-modal-header">
        <span>🏆 Ranking Global & Histórico</span>
        <Button size="small" onClick={onClose} className="leaderboard-close-btn">
          Fechar
        </Button>
      </DialogTitle>
      <DialogContent className="catan-modal-content">
        {offlineFallback && (
          <div className="leaderboard-offline-banner">
            ⚠️ Modo local offline: exibindo registros salvos apenas neste navegador.
          </div>
        )}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          className="leaderboard-tabs"
        >
          <Tab value="ranking" label="🏆 Ranking de Vitórias" />
          <Tab value="history" label="📜 Histórico de Partidas" />
        </Tabs>

        {tab === "ranking" ? (
          <div className="leaderboard-table-wrap">
            {leaderboard.length === 0 ? (
              <p className="leaderboard-empty">Nenhum usuário cadastrado ainda.</p>
            ) : (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jogador</th>
                    <th>Vitórias</th>
                    <th>Partidas</th>
                    <th>% Vitórias</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.username}
                      className={row.username === currentUsername ? "is-me" : ""}
                    >
                      <td>#{row.rank}</td>
                      <td>
                        <strong>{row.display_name}</strong>{" "}
                        <small>@{row.username}</small>
                      </td>
                      <td>{row.wins}</td>
                      <td>{row.games_played}</td>
                      <td>{row.win_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="match-history-wrap">
            {currentUsername && (
              <div className="match-history-filter">
                <Button
                  size="small"
                  variant={onlyMine ? "contained" : "outlined"}
                  onClick={() => setOnlyMine((v) => !v)}
                >
                  {onlyMine ? "Mostrando: Minhas Partidas" : "Filtrar: Só Minhas Partidas"}
                </Button>
              </div>
            )}
            {matches.length === 0 ? (
              <p className="leaderboard-empty">Nenhuma partida concluída registrada ainda.</p>
            ) : (
              matches.map((m) => (
                <div key={m.game_id} className="match-history-card">
                  <div className="match-history-card__top">
                    <span>
                      {m.winner_is_bot ? "🤖" : "👑"} Vencedor:{" "}
                      <strong>{m.winner_name}</strong>
                    </span>
                    <small>
                      {m.mode === "MULTIPLAYER" ? "Multiplayer" : "Solo vs IA"} • Mapa{" "}
                      {m.map_template} • {m.num_turns} turnos
                    </small>
                  </div>
                  <div className="match-history-card__seats">
                    {m.participants.map((p) => (
                      <span
                        key={p.color}
                        className={`match-seat-chip ${p.is_winner ? "winner" : ""}`}
                        style={{ borderColor: PLAYER_COLOR_META[p.color]?.primary }}
                      >
                        {p.display_name} — {p.victory_points} PV
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
