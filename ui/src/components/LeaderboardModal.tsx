import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, Tab, Tabs, Button } from "@mui/material";
import { getLeaderboard, getMatchHistory } from "../utils/apiClient";
import type { LeaderboardEntry, MatchRecord } from "../utils/api.types";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { formatMapTemplateLabel, localizeSeatLabel } from "../config/botCatalog";
import { useLanguage } from "../i18n";
import PlayerAvatar from "./PlayerAvatar";
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
  const { language, t } = useLanguage();
  const colorMeta = getPlayerColorMeta(language);
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
        <span>🏆 {t("Ranking Global & Histórico", "Global Ranking & History")}</span>
        <Button size="small" onClick={onClose} className="leaderboard-close-btn">
          {t("Fechar", "Close")}
        </Button>
      </DialogTitle>
      <DialogContent className="catan-modal-content">
        {offlineFallback && (
          <div className="leaderboard-offline-banner">
            ⚠️{" "}
            {t(
              "Modo local offline: exibindo registros salvos apenas neste navegador.",
              "Local offline mode: showing records saved only in this browser."
            )}
          </div>
        )}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          className="leaderboard-tabs"
        >
          <Tab
            value="ranking"
            label={t("🏆 Ranking de Vitórias", "🏆 Win Leaderboard")}
          />
          <Tab
            value="history"
            label={t("📜 Histórico de Partidas", "📜 Match History")}
          />
        </Tabs>

        {tab === "ranking" ? (
          <div className="leaderboard-table-wrap">
            {leaderboard.length === 0 ? (
              <p className="leaderboard-empty">
                {t("Nenhum usuário cadastrado ainda.", "No registered players yet.")}
              </p>
            ) : (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("Jogador", "Player")}</th>
                    <th>{t("Vitórias", "Wins")}</th>
                    <th>{t("Partidas", "Matches")}</th>
                    <th>{t("% Vitórias", "Win %")}</th>
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
                        <div className="leaderboard-player-cell">
                          <PlayerAvatar
                            config={row.avatar_config}
                            username={row.username}
                            size={34}
                          />
                          <div>
                            <strong>{row.display_name}</strong>{" "}
                            <small>@{row.username}</small>
                          </div>
                        </div>
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
                  {onlyMine
                    ? t("Mostrando: Minhas Partidas", "Showing: My Matches")
                    : t("Filtrar: Só Minhas Partidas", "Filter: Only My Matches")}
                </Button>
              </div>
            )}
            {matches.length === 0 ? (
              <p className="leaderboard-empty">
                {t(
                  "Nenhuma partida concluída registrada ainda.",
                  "No completed matches recorded yet."
                )}
              </p>
            ) : (
              matches.map((m) => (
                <div key={m.game_id} className="match-history-card">
                  <div className="match-history-card__top">
                    <span>
                      {m.winner_is_bot ? "🤖" : "👑"}{" "}
                      {t("Vencedor:", "Winner:")}{" "}
                      <strong>{localizeSeatLabel(m.winner_name, language)}</strong>
                    </span>
                    <small>
                      {m.mode === "MULTIPLAYER"
                        ? "Multiplayer"
                        : t("Solo vs IA", "Solo vs AI")}{" "}
                      • {t("Mapa", "Map")}{" "}
                      {formatMapTemplateLabel(m.map_template, language)} •{" "}
                      {m.num_turns} {t("turnos", "turns")}
                    </small>
                  </div>
                  <div className="match-history-card__seats">
                    {m.participants.map((p) => (
                      <span
                        key={p.color}
                        className={`match-seat-chip ${p.is_winner ? "winner" : ""}`}
                        style={{ borderColor: colorMeta[p.color]?.primary }}
                      >
                        {localizeSeatLabel(p.display_name, language)} —{" "}
                        {p.victory_points} {t("PV", "VP")}
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
