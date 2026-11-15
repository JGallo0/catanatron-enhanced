import { useMemo, useState } from "react";
import type { AvatarConfig, Color, GameState } from "../utils/api.types";
import { playerKey } from "../utils/stateUtils";
import { getPlayerColorMeta } from "../config/assetRegistry";
import {
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { useLanguage } from "../i18n";
import PlayerAvatar from "./PlayerAvatar";
import "./VictoryScreenOverlay.scss";

type RankedPlayerEntry = {
  color: Color;
  rank: number;
  isWinner: boolean;
  name: string;
  colorHex: string;
  colorLabel: string;
  victoryPoints: number;
  settlementsBuilt: number;
  citiesBuilt: number;
  roadLength: number;
  knightsPlayed: number;
  vpDevCards: number;
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  avatarConfig: Partial<AvatarConfig> | Record<string, unknown> | null;
};

const MEDAL_BY_RANK: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
  4: "🏅",
};

export default function VictoryScreenOverlay({
  gameState,
  mySeatColor = null,
  localAvatarConfig = null,
  onReturnLobby,
  onRematch,
  rematchBusy = false,
}: {
  gameState: GameState;
  mySeatColor?: Color | null;
  localAvatarConfig?: Partial<AvatarConfig> | Record<string, unknown> | null;
  onReturnLobby: () => void;
  onRematch?: () => void;
  rematchBusy?: boolean;
}) {
  const { language, t } = useLanguage();
  const [minimized, setMinimized] = useState(false);
  const winningColor = gameState.winning_color;

  const rankedPlayers = useMemo<RankedPlayerEntry[]>(() => {
    if (!winningColor) return [];
    const colorMeta = getPlayerColorMeta(language);
    const ps = gameState.player_state || {};
    const activeHumans = (gameState.colors || []).filter(
      (c) => !(gameState.bot_colors || []).includes(c)
    );

    const entries = (gameState.colors || []).map((color) => {
      const key = playerKey(gameState, color);
      const meta = colorMeta[color];
      const name = resolvePlayerDisplayName(
        gameState,
        color,
        meta?.label || color
      );
      const victoryPoints = Number(
        ps[`${key}_ACTUAL_VICTORY_POINTS`] ?? ps[`${key}_VICTORY_POINTS`] ?? 0
      );
      const settlementsAvail = Number(
        ps[`${key}_SETTLEMENTS_AVAILABLE`] ?? 5
      );
      const citiesAvail = Number(ps[`${key}_CITIES_AVAILABLE`] ?? 4);
      const settlementsBuilt = Math.max(0, 5 - settlementsAvail);
      const citiesBuilt = Math.max(0, 4 - citiesAvail);
      const roadLength = Number(ps[`${key}_LONGEST_ROAD_LENGTH`] ?? 0);
      const knightsPlayed = Number(ps[`${key}_PLAYED_KNIGHT`] ?? 0);
      const vpDevCards =
        Number(ps[`${key}_VICTORY_POINT_IN_HAND`] ?? 0) +
        Number(ps[`${key}_PLAYED_VICTORY_POINT`] ?? 0);
      const hasLongestRoad = Boolean(ps[`${key}_HAS_ROAD`]);
      const hasLargestArmy = Boolean(ps[`${key}_HAS_ARMY`]);

      const isSingleLocalHuman =
        !(gameState.bot_colors || []).includes(color) &&
        (mySeatColor ? color === mySeatColor : activeHumans.length === 1);
      const seatIndex = Math.max(0, (gameState.colors || []).indexOf(color));
      const isBot = (gameState.bot_colors || []).includes(color);
      const resolvedSeatAvatar = resolveSeatAvatarProps({
        color,
        isBot,
        seatIndex,
        seatName: name,
        seatAvatar: gameState.seat_avatars?.[color],
      });
      const avatarConfig =
        (isSingleLocalHuman && localAvatarConfig) ||
        resolvedSeatAvatar.config ||
        null;

      return {
        color,
        rank: 1,
        isWinner: color === winningColor,
        name,
        colorHex: meta?.primary || "#f59e0b",
        colorLabel: meta?.label || color,
        victoryPoints,
        settlementsBuilt,
        citiesBuilt,
        roadLength,
        knightsPlayed,
        vpDevCards,
        hasLongestRoad,
        hasLargestArmy,
        avatarConfig,
      };
    });

    entries.sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (b.victoryPoints !== a.victoryPoints) {
        return b.victoryPoints - a.victoryPoints;
      }
      if (b.roadLength !== a.roadLength) {
        return b.roadLength - a.roadLength;
      }
      return b.knightsPlayed - a.knightsPlayed;
    });

    return entries.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  }, [gameState, language, localAvatarConfig, mySeatColor, winningColor]);

  if (!winningColor || rankedPlayers.length === 0) return null;

  const winner = rankedPlayers[0];
  const isLocalWinner = mySeatColor !== null && winningColor === mySeatColor;

  if (minimized) {
    return (
      <div
        className="victory-minimized-pill"
        data-testid="victory-screen-minimized"
      >
        <span className="victory-minimized-pill__badge">
          🏆 {t("Fim de Jogo", "Game Over")} •{" "}
          <strong>{winner.name}</strong> ({winner.victoryPoints}{" "}
          {t("PV", "VP")})
        </span>
        <button
          type="button"
          className="victory-minimized-pill__btn victory-minimized-pill__btn--primary"
          onClick={() => setMinimized(false)}
        >
          👑 {t("Ver Ranking Final", "View Final Ranking")}
        </button>
        <button
          type="button"
          className="victory-minimized-pill__btn"
          onClick={onReturnLobby}
        >
          🏠 {t("Lobby", "Lobby")}
        </button>
      </div>
    );
  }

  return (
    <div
      className="victory-screen-overlay"
      data-testid="victory-screen-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-screen-title"
    >
      <div className="victory-screen-card">
        <div className="victory-screen-sparkles" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <header className="victory-screen-header">
          <div className="victory-screen-eyebrow">
            👑 {t("REPÚBLICA A PRAÇA É NOSSA • FIM DE JOGO", "END OF MATCH • FINAL RANKING")}
          </div>
          <h2 id="victory-screen-title" className="victory-screen-title">
            🏆{" "}
            {isLocalWinner
              ? t(
                  `PARABÉNS, ${winner.name.toUpperCase()}! VOCÊ VENCEU!`,
                  `CONGRATULATIONS, ${winner.name.toUpperCase()}! YOU WON!`
                )
              : t(
                  `PARABÉNS, ${winner.name.toUpperCase()}!`,
                  `CONGRATULATIONS, ${winner.name.toUpperCase()}!`
                )}
          </h2>
          <p className="victory-screen-subtitle">
            {t(
              `${winner.name} conquistou a ilha com ${winner.victoryPoints} Pontos de Vitória após ${
                gameState.num_turns || 0
              } turnos! Confira o ranking completo abaixo:`,
              `${winner.name} conquered the island with ${winner.victoryPoints} Victory Points after ${
                gameState.num_turns || 0
              } turns! Check the full ranking below:`
            )}
          </p>
        </header>

        <div
          className="victory-ranking-grid"
          data-testid="victory-ranking-grid"
        >
          {rankedPlayers.map((player) => {
            const medal = MEDAL_BY_RANK[player.rank] || "🎖️";
            return (
              <article
                key={player.color}
                data-testid={`victory-rank-card-${player.color}`}
                className={`victory-rank-card ${
                  player.isWinner ? "victory-rank-card--winner" : ""
                } victory-rank-card--rank-${player.rank}`}
                style={
                  {
                    "--player-accent": player.colorHex,
                  } as React.CSSProperties
                }
              >
                <div className="victory-rank-card__top-ribbon">
                  <span className="victory-rank-card__place">
                    {medal} {player.rank}º {t("Lugar", "Place")}
                  </span>
                  {player.isWinner && (
                    <span className="victory-rank-card__champion-tag">
                      👑 {t("CAMPEÃO DA ILHA", "ISLAND CHAMPION")}
                    </span>
                  )}
                </div>

                <div className="victory-rank-card__avatar-stage">
                  <PlayerAvatar
                    config={player.avatarConfig}
                    username={player.name}
                    size={player.isWinner ? 112 : 94}
                    fullBody={true}
                    showFrameLabel={true}
                    testId={`victory-fullbody-avatar-${player.color}`}
                  />
                </div>

                <div className="victory-rank-card__identity">
                  <span
                    className="victory-rank-card__color-dot"
                    style={{ backgroundColor: player.colorHex }}
                  />
                  <h3 className="victory-rank-card__name">{player.name}</h3>
                </div>

                <div className="victory-rank-card__vp-pill">
                  <span className="victory-rank-card__vp-value">
                    {player.victoryPoints}
                  </span>
                  <span className="victory-rank-card__vp-label">
                    {t("PONTOS DE VITÓRIA", "VICTORY POINTS")}
                  </span>
                </div>

                {(player.hasLongestRoad || player.hasLargestArmy) && (
                  <div className="victory-rank-card__titles">
                    {player.hasLongestRoad && (
                      <span className="victory-title-chip victory-title-chip--road">
                        🛤️ {t("Maior Estrada (+2 PV)", "Longest Road (+2 VP)")}
                      </span>
                    )}
                    {player.hasLargestArmy && (
                      <span className="victory-title-chip victory-title-chip--army">
                        ⚔️ {t("Maior Exército (+2 PV)", "Largest Army (+2 VP)")}
                      </span>
                    )}
                  </div>
                )}

                <div className="victory-rank-card__stats">
                  <div
                    className="victory-stat-cell"
                    title={t("Aldeias no tabuleiro", "Settlements on board")}
                  >
                    <span className="victory-stat-cell__icon">🏠</span>
                    <span className="victory-stat-cell__val">
                      {player.settlementsBuilt}
                    </span>
                    <span className="victory-stat-cell__lbl">
                      {t("Aldeias", "Settlements")}
                    </span>
                  </div>
                  <div
                    className="victory-stat-cell"
                    title={t("Cidades no tabuleiro", "Cities on board")}
                  >
                    <span className="victory-stat-cell__icon">🏰</span>
                    <span className="victory-stat-cell__val">
                      {player.citiesBuilt}
                    </span>
                    <span className="victory-stat-cell__lbl">
                      {t("Cidades", "Cities")}
                    </span>
                  </div>
                  <div
                    className="victory-stat-cell"
                    title={t("Comprimento da maior estrada", "Longest road length")}
                  >
                    <span className="victory-stat-cell__icon">🛤️</span>
                    <span className="victory-stat-cell__val">
                      {player.roadLength}
                    </span>
                    <span className="victory-stat-cell__lbl">
                      {t("Estrada", "Road")}
                    </span>
                  </div>
                  <div
                    className="victory-stat-cell"
                    title={t("Cavaleiros usados", "Knights played")}
                  >
                    <span className="victory-stat-cell__icon">⚔️</span>
                    <span className="victory-stat-cell__val">
                      {player.knightsPlayed}
                    </span>
                    <span className="victory-stat-cell__lbl">
                      {t("Exército", "Army")}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="victory-screen-actions">
          <button
            type="button"
            className="victory-action-btn victory-action-btn--secondary"
            onClick={() => setMinimized(true)}
          >
            🔍 {t("Ver Tabuleiro Final", "Inspect Final Board")}
          </button>
          {onRematch && (
            <button
              type="button"
              className="victory-action-btn victory-action-btn--rematch"
              disabled={rematchBusy}
              onClick={onRematch}
            >
              🔄{" "}
              {rematchBusy
                ? t("Criando Revanche...", "Creating Rematch...")
                : t("Jogar Revanche", "Play Rematch")}
            </button>
          )}
          <button
            type="button"
            className="victory-action-btn victory-action-btn--primary"
            onClick={onReturnLobby}
          >
            🏠 {t("Voltar ao Lobby", "Return to Lobby")}
          </button>
        </footer>
      </div>
    </div>
  );
}
