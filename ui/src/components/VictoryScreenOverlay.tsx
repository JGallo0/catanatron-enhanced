import { Suspense, lazy, useMemo, useState, type CSSProperties } from "react";
import cn from "classnames";

import type { AvatarConfig, Color, GameState } from "../utils/api.types";
import { getPlayerColorMeta } from "../config/assetRegistry";
import {
  getGuestProfile,
  getSavedAccountAvatarSummary,
  resolveAvatarConfig,
} from "../config/avatarCatalog";
import {
  isTakenOverSeat,
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { useLanguage } from "../i18n";
import { playerKey } from "../utils/stateUtils";
import PlayerAvatar from "./PlayerAvatar";
import "./VictoryScreenOverlay.scss";

const LazyAvatar3DCanvas = lazy(() => import("./avatar3d/Avatar3DCanvas"));

type RankedPlayerEntry = {
  color: Color;
  rank: number;
  isWinner: boolean;
  name: string;
  colorHex: string;
  colorGlow: string;
  colorLabel: string;
  victoryPoints: number;
  settlementsBuilt: number;
  citiesBuilt: number;
  roadsBuilt: number;
  roadLength: number;
  knightsPlayed: number;
  vpDevCards: number;
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  avatarConfig: Partial<AvatarConfig> | Record<string, unknown> | null;
};

type DiceStatsSummary = {
  counts: Record<number, number>;
  totalRolls: number;
  maxCount: number;
  rollsByPlayer: Partial<Record<Color, number>>;
};

const DICE_SUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const THEORETICAL_WEIGHTS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

function computeDiceStats(
  gameState: GameState,
  selectedPlayer: Color | "ALL"
): DiceStatsSummary {
  const counts: Record<number, number> = {};
  for (const s of DICE_SUMS) {
    counts[s] = 0;
  }
  const rollsByPlayer: Partial<Record<Color, number>> = {};
  let totalRolls = 0;

  for (const rec of gameState.action_records || []) {
    const action = rec?.[0];
    const result = rec?.[1];
    if (
      action &&
      action[1] === "ROLL" &&
      Array.isArray(result) &&
      result.length >= 2
    ) {
      const roller = action[0];
      rollsByPlayer[roller] = (rollsByPlayer[roller] ?? 0) + 1;

      if (selectedPlayer === "ALL" || roller === selectedPlayer) {
        const sum = Number(result[0]) + Number(result[1]);
        if (sum >= 2 && sum <= 12) {
          counts[sum] = (counts[sum] ?? 0) + 1;
          totalRolls += 1;
        }
      }
    }
  }

  let maxCount = 1;
  for (const s of DICE_SUMS) {
    const c = counts[s] ?? 0;
    const expected = (THEORETICAL_WEIGHTS[s] / 36) * totalRolls;
    maxCount = Math.max(maxCount, c, expected);
  }

  return {
    counts,
    totalRolls,
    maxCount,
    rollsByPlayer,
  };
}

/**
 * Distributes non-winner players symmetrically around the central Throne:
 * - Even indices (0, 2, ...) -> Left wing of the throne
 * - Odd indices (1, 3, ...) -> Right wing of the throne
 */
function splitCourtFlanks(challengers: RankedPlayerEntry[]): {
  leftWing: RankedPlayerEntry[];
  rightWing: RankedPlayerEntry[];
} {
  const leftWing: RankedPlayerEntry[] = [];
  const rightWing: RankedPlayerEntry[] = [];

  challengers.forEach((player, index) => {
    if (index % 2 === 0) {
      leftWing.push(player);
    } else {
      rightWing.push(player);
    }
  });

  return { leftWing, rightWing };
}

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
  const [selectedDicePlayer, setSelectedDicePlayer] = useState<Color | "ALL">(
    "ALL"
  );

  const winningColor = gameState.winning_color;
  const colorMeta = useMemo(() => getPlayerColorMeta(language), [language]);
  const savedAcct = useMemo(() => getSavedAccountAvatarSummary(), []);
  const guestProfile = useMemo(
    () => (!savedAcct ? getGuestProfile() : null),
    [savedAcct]
  );

  const rankedPlayers = useMemo<RankedPlayerEntry[]>(() => {
    if (!winningColor) return [];
    const ps = gameState.player_state || {};
    const activeHumans = (gameState.colors || []).filter(
      (c) => !(gameState.bot_colors || []).includes(c)
    );

    const entries = (gameState.colors || []).map((color, idx) => {
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
      const roadsAvail = Number(ps[`${key}_ROADS_AVAILABLE`] ?? 15);
      const settlementsBuilt = Math.max(0, 5 - settlementsAvail);
      const citiesBuilt = Math.max(0, 4 - citiesAvail);
      const roadsBuilt = Math.max(0, 15 - roadsAvail);
      const roadLength = Number(
        ps[`${key}_LONGEST_ROAD_LENGTH`] ??
          gameState.longest_roads_by_player?.[color] ??
          roadsBuilt
      );
      const knightsPlayed = Number(ps[`${key}_PLAYED_KNIGHT`] ?? 0);
      const vpDevCards =
        Number(ps[`${key}_VICTORY_POINT_IN_HAND`] ?? 0) +
        Number(ps[`${key}_PLAYED_VICTORY_POINT`] ?? 0);
      const hasLongestRoad = Boolean(ps[`${key}_HAS_ROAD`]);
      const hasLargestArmy = Boolean(ps[`${key}_HAS_ARMY`]);

      const isBot = (gameState.bot_colors || []).includes(color);
      const isTakenOver = isTakenOverSeat(gameState, color);
      const seatAvatar = gameState.seat_avatars?.[color];
      const originalUsername =
        gameState.seat_takeover?.[color]?.original_username ??
        seatAvatar?.username ??
        null;
      const isMySeat =
        (!isBot || isTakenOver) &&
        (mySeatColor !== null
          ? mySeatColor === color
          : savedAcct
            ? (seatAvatar?.seat_kind === "USER" &&
                seatAvatar.username === savedAcct.username) ||
              originalUsername === savedAcct.username
            : !isBot && activeHumans.length === 1);

      const resolvedSeatAvatar = resolveSeatAvatarProps({
        color,
        isBot,
        isTakenOver,
        seatIndex: idx,
        seatName: name,
        seatAvatar,
        originalUsername,
        isMySeat,
        accountAvatar: localAvatarConfig ?? savedAcct?.avatar_config,
        accountUsername: savedAcct?.username,
        guestCustomAvatar:
          localAvatarConfig ??
          (guestProfile?.customized ? guestProfile.avatar_config : undefined),
      });
      const avatarConfig =
        resolvedSeatAvatar.config ||
        (isMySeat && localAvatarConfig ? localAvatarConfig : null);

      return {
        color,
        rank: 1,
        isWinner: color === winningColor,
        name,
        colorHex: meta?.primary || "#f59e0b",
        colorGlow: meta?.glow || "rgba(250, 204, 21, 0.45)",
        colorLabel: meta?.label || color,
        victoryPoints,
        settlementsBuilt,
        citiesBuilt,
        roadsBuilt,
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
  }, [
    gameState,
    colorMeta,
    localAvatarConfig,
    mySeatColor,
    winningColor,
    savedAcct,
    guestProfile,
  ]);

  const diceStats = useMemo(
    () => computeDiceStats(gameState, selectedDicePlayer),
    [gameState, selectedDicePlayer]
  );

  const winner = rankedPlayers[0];
  const challengers = useMemo(() => rankedPlayers.slice(1), [rankedPlayers]);
  const { leftWing, rightWing } = useMemo(
    () => splitCourtFlanks(challengers),
    [challengers]
  );

  const longestRoadHolder = useMemo(
    () => rankedPlayers.find((p) => p.hasLongestRoad) ?? null,
    [rankedPlayers]
  );
  const largestArmyHolder = useMemo(
    () => rankedPlayers.find((p) => p.hasLargestArmy) ?? null,
    [rankedPlayers]
  );

  if (!winningColor || !winner) return null;

  const isLocalVictory = Boolean(
    !mySeatColor || winningColor === mySeatColor
  );

  if (minimized) {
    return (
      <div
        className="victory-minimized-pill"
        data-testid="victory-screen-minimized"
        style={
          {
            "--winner-color": winner.colorHex,
            "--winner-glow": winner.colorGlow,
          } as CSSProperties
        }
      >
        <span className="victory-minimized-pill__crown" aria-hidden="true">
          👑
        </span>
        <span className="victory-minimized-pill__text">
          <strong>{winner.name}</strong>{" "}
          {t("venceu a partida!", "won the match!")} ({winner.victoryPoints}{" "}
          {t("PV", "VP")})
        </span>
        <button
          type="button"
          className="victory-minimized-pill__btn"
          onClick={() => setMinimized(false)}
        >
          {t("Ver Salão do Trono", "View Throne Room")}
        </button>
        {onRematch && (
          <button
            type="button"
            className="victory-minimized-pill__btn victory-minimized-pill__btn--rematch"
            disabled={rematchBusy}
            onClick={onRematch}
          >
            {rematchBusy
              ? t("Criando...", "Creating...")
              : t("⚔️ Revanche", "⚔️ Rematch")}
          </button>
        )}
        <button
          type="button"
          className="victory-minimized-pill__btn victory-minimized-pill__btn--lobby"
          onClick={onReturnLobby}
        >
          {t("Sair ao Lobby", "Exit to Lobby")}
        </button>
      </div>
    );
  }

  const renderCourtMemberFigure = (
    player: RankedPlayerEntry,
    isWinner: boolean,
    wingPosition: "left" | "center" | "right"
  ) => {
    const resolvedConfig = resolveAvatarConfig(
      player.avatarConfig,
      player.name
    );
    const stageAvatarConfig = resolvedConfig;

    return (
      <article
        key={player.color}
        className={cn(
          "victory-throne-member",
          `victory-throne-member--${wingPosition}`,
          {
            "is-winner": isWinner,
            "is-local-player": player.color === mySeatColor,
          }
        )}
        data-testid={
          isWinner
            ? `victory-throne-winner-${player.color}`
            : `victory-court-member-${player.color}`
        }
        style={
          {
            "--member-color": player.colorHex,
            "--member-glow": player.colorGlow,
          } as CSSProperties
        }
      >
        {isWinner && (
          <div className="victory-throne-member__regalia" aria-hidden="true">
            <span className="victory-throne-member__sunburst" />
            <span className="victory-throne-member__arch-halo" />
            <div className="victory-throne-member__sparks">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        )}

        {isWinner && (
          <div className="victory-throne-member__rank-crest">
            <span
              className="victory-throne-member__crown-badge"
              data-testid="victory-winner-badge"
            >
              👑 {t("VENCEDOR", "WINNER")}
            </span>
          </div>
        )}

        <div
          className={cn("victory-throne-member__avatar-stage", {
            "victory-throne-member__avatar-stage--throne": isWinner,
          })}
        >
          <Suspense
            fallback={
              <PlayerAvatar
                config={stageAvatarConfig}
                username={player.name}
                size={isWinner ? 148 : 112}
                fullBody={true}
                onThrone={isWinner}
                testId={`victory-fullbody-avatar-${player.color}`}
              />
            }
          >
            <LazyAvatar3DCanvas
              config={stageAvatarConfig}
              username={player.name}
              mode="hero"
              backgroundMode="transparent"
              cameraFocus="full"
              stagePose={isWinner ? "throne" : "applaud"}
              interactive={true}
              fallbackSize={isWinner ? 148 : 112}
              fallbackTestId={`victory-fullbody-avatar-${player.color}`}
              className={cn("victory-throne-member__canvas3d", {
                "victory-throne-member__canvas3d--throne": isWinner,
              })}
            />
          </Suspense>
        </div>

        <div
          className="victory-throne-member__pedestal-plate"
          data-testid={`victory-rank-card-${player.color}`}
        >
          <div className="victory-throne-member__identity-row">
            <span
              className="victory-throne-member__color-dot"
              style={{ background: player.colorHex }}
            />
            <strong
              className="victory-throne-member__name"
              title={player.name}
            >
              {player.name}
            </strong>
            {player.color === mySeatColor && (
              <span className="victory-throne-member__you-pill">
                {t("VOCÊ", "YOU")}
              </span>
            )}
          </div>

          <div className="victory-throne-member__vp-row">
            <span className="victory-throne-member__vp-score">
              <strong>{player.victoryPoints}</strong>{" "}
              <small>{t("PV", "VP")}</small>
            </span>

            <div className="victory-throne-member__mini-stats">
              <span title={t("Aldeias construídas", "Settlements built")}>
                🏠 {player.settlementsBuilt}
              </span>
              <span title={t("Cidades construídas", "Cities built")}>
                🏰 {player.citiesBuilt}
              </span>
              <span title={t("Maior estrada", "Longest road")}>
                🛤️ {player.roadLength}
              </span>
              <span title={t("Cavaleiros usados", "Knights played")}>
                ⚔️ {player.knightsPlayed}
              </span>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderTitlesSection = () => (
    <section
      className="victory-stats-card victory-stats-card--titles"
      data-testid="victory-titles-panel"
      aria-label={t("Detentores de Títulos", "Title Holders")}
    >
      <header className="victory-stats-card__header">
        <span className="victory-stats-card__eyebrow">
          🏅 {t("HONRARIAS IMPERIAIS", "IMPERIAL HONORS")}
        </span>
        <h3 className="victory-stats-card__title">
          {t("Detentores de Títulos (+2 PV)", "Title Holders (+2 VP)")}
        </h3>
      </header>

      <div className="victory-titles-grid">
        {/* Maior Estrada */}
        <div
          className={cn("victory-title-plaque", {
            "is-claimed": Boolean(longestRoadHolder),
          })}
          data-testid="victory-title-longest-road"
          style={
            longestRoadHolder
              ? ({
                  "--holder-color": longestRoadHolder.colorHex,
                } as CSSProperties)
              : undefined
          }
        >
          <img
            src="/assets/illustrations/ui/longest-road-crest.png"
            alt={t("Brasão Maior Estrada", "Longest Road Crest")}
            className="victory-title-plaque__crest"
          />
          <div className="victory-title-plaque__body">
            <span className="victory-title-plaque__label">
              {t("Maior Estrada Comercial", "Longest Trade Road")}
            </span>
            {longestRoadHolder ? (
              <>
                <strong className="victory-title-plaque__holder">
                  <span
                    className="victory-title-plaque__dot"
                    style={{
                      background: longestRoadHolder.colorHex,
                    }}
                  />
                  {longestRoadHolder.name}
                </strong>
                <span className="victory-title-plaque__metric">
                  {longestRoadHolder.roadLength}{" "}
                  {t("estradas conectadas • +2 PV", "connected roads • +2 VP")}
                </span>
              </>
            ) : (
              <span className="victory-title-plaque__unclaimed">
                {t(
                  "Nenhum jogador atingiu 5+ estradas",
                  "No player reached 5+ roads"
                )}
              </span>
            )}
          </div>
        </div>

        {/* Maior Exército */}
        <div
          className={cn("victory-title-plaque", {
            "is-claimed": Boolean(largestArmyHolder),
          })}
          data-testid="victory-title-largest-army"
          style={
            largestArmyHolder
              ? ({
                  "--holder-color": largestArmyHolder.colorHex,
                } as CSSProperties)
              : undefined
          }
        >
          <img
            src="/assets/illustrations/ui/largest-army-crest.png"
            alt={t("Brasão Maior Exército", "Largest Army Crest")}
            className="victory-title-plaque__crest"
          />
          <div className="victory-title-plaque__body">
            <span className="victory-title-plaque__label">
              {t("Maior Exército da Ilha", "Largest Army of the Isle")}
            </span>
            {largestArmyHolder ? (
              <>
                <strong className="victory-title-plaque__holder">
                  <span
                    className="victory-title-plaque__dot"
                    style={{
                      background: largestArmyHolder.colorHex,
                    }}
                  />
                  {largestArmyHolder.name}
                </strong>
                <span className="victory-title-plaque__metric">
                  {largestArmyHolder.knightsPlayed}{" "}
                  {t("cavaleiros mobilizados • +2 PV", "knights deployed • +2 VP")}
                </span>
              </>
            ) : (
              <span className="victory-title-plaque__unclaimed">
                {t(
                  "Nenhum jogador mobilizou 3+ cavaleiros",
                  "No player deployed 3+ knights"
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  const renderDiceStatsSection = () => (
    <section
      className="victory-stats-card victory-stats-card--dice"
      data-testid="victory-dice-panel"
      aria-label={t("Crônicas das rolagens", "Chronicle of rolls")}
    >
      <header className="victory-stats-card__header">
        <div className="victory-dice-header-title">
          <span className="victory-stats-card__eyebrow">
            🎲 {t("CRÔNICAS DAS ROLAGENS", "CHRONICLE OF ROLLS")}
          </span>
        </div>

        <div className="victory-dice-controls">
          <div
            className="victory-dice-player-filters"
            role="group"
            aria-label={t(
              "Filtrar rolagens por jogador",
              "Filter rolls by player"
            )}
            data-testid="victory-dice-player-filters"
          >
            <button
              type="button"
              className={cn("victory-dice-filter-chip", {
                "is-active": selectedDicePlayer === "ALL",
              })}
              data-testid="victory-dice-filter-ALL"
              onClick={() => setSelectedDicePlayer("ALL")}
            >
              {t("Todos", "All")}
            </button>
            {rankedPlayers.map((player) => (
              <button
                key={player.color}
                type="button"
                className={cn("victory-dice-filter-chip", {
                  "is-active": selectedDicePlayer === player.color,
                })}
                data-testid={`victory-dice-filter-${player.color}`}
                onClick={() => setSelectedDicePlayer(player.color)}
                style={
                  {
                    "--filter-player-color": player.colorHex,
                  } as CSSProperties
                }
              >
                <span
                  className="victory-dice-filter-chip__dot"
                  style={{ background: player.colorHex }}
                />
                <span className="victory-dice-filter-chip__name">
                  {player.name}
                </span>
              </button>
            ))}
          </div>

          <div className="victory-dice-kpis">
            <span
              className="victory-dice-kpi"
              data-testid="victory-dice-kpi-total"
            >
              <small>{t("Total", "Total")}</small>
              <strong>{diceStats.totalRolls}</strong>
            </span>
          </div>
        </div>
      </header>

      <div
        className="victory-dice-chart"
        role="img"
        aria-label={t(
          `Distribuição de ${diceStats.totalRolls} rolagens de dados`,
          `Distribution of ${diceStats.totalRolls} dice rolls`
        )}
      >
        {DICE_SUMS.map((sum) => {
          const count = diceStats.counts[sum] ?? 0;
          const heightPct =
            diceStats.totalRolls > 0
              ? Math.max(count > 0 ? 10 : 3, (count / diceStats.maxCount) * 100)
              : 4;
          const isHot = sum === 6 || sum === 8;
          const isSeven = sum === 7;

          return (
            <div
              key={sum}
              className={cn("victory-dice-bar-col", {
                "is-hot": isHot,
                "is-seven": isSeven,
              })}
              data-testid={`victory-dice-col-${sum}`}
            >
              <span className="victory-dice-bar-col__count">{count}</span>
              <div className="victory-dice-bar-col__track">
                <div
                  className="victory-dice-bar-col__fill"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="victory-dice-bar-col__sum">{sum}</span>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div
      className={cn(
        "victory-screen-overlay",
        "victory-screen-overlay--variant-court",
        {
          "victory-screen-overlay--local-win": isLocalVictory,
        }
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-screen-title"
      data-testid="victory-screen-overlay"
      data-design-variant="court"
      style={
        {
          "--winner-color": winner.colorHex,
          "--winner-glow": winner.colorGlow,
        } as CSSProperties
      }
    >
      {/* Animated Royal Confetti & God-Rays Backdrop */}
      <div className="victory-screen-overlay__rays" aria-hidden="true" />
      <div className="victory-screen-overlay__confetti" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, idx) => (
          <i
            key={idx}
            style={
              {
                "--confetti-idx": idx,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="victory-throne-shell">
        {/* Top Royal Header */}
        <header className="victory-throne-header">
          <div className="victory-throne-header__brand">
            <img
              src="/assets/illustrations/ui/longest-road-crest.png"
              alt=""
              aria-hidden="true"
              className="victory-throne-header__laurel"
            />
            <div className="victory-throne-header__titles">
              <span className="victory-throne-header__kicker">
                {isLocalVictory
                  ? t(
                      "✨ COROAÇÃO IMPERIAL • A ILHA SE CURVA A VOCÊ!",
                      "✨ IMPERIAL CORONATION • THE ISLE BOWS TO YOU!"
                    )
                  : t(
                      "👑 COROAÇÃO IMPERIAL • FIM DE PARTIDA",
                      "👑 IMPERIAL CORONATION • MATCH COMPLETE"
                    )}
              </span>
              <h2
                id="victory-screen-title"
                className="victory-throne-header__headline"
              >
                {t(
                  `${winner.name} Governa o Trono de Catan!`,
                  `${winner.name} Rules the Throne of Catan!`
                )}
              </h2>
            </div>
          </div>

          <div className="victory-throne-header__controls">
            <div className="victory-throne-header__champion-chip">
              <span
                className="victory-throne-header__champion-dot"
                style={{ background: winner.colorHex }}
              />
              <span>
                🏆 <strong>{winner.victoryPoints}</strong>{" "}
                {t("Pontos de Vitória", "Victory Points")}
              </span>
            </div>
          </div>
        </header>

        {/* Central Royal Throne Lineup Stage: Left Wing | Winner Seated on Throne | Right Wing */}
        <section
          className="victory-throne-stage"
          data-testid="victory-ranking-grid"
          aria-label={t(
            "Corte Real dos Jogadores",
            "Royal Court of Players"
          )}
        >
          <div
            className="victory-throne-stage__wing victory-throne-stage__wing--left"
            data-testid="victory-left-wing"
          >
            {leftWing.map((player) =>
              renderCourtMemberFigure(player, false, "left")
            )}
          </div>

          <div
            className="victory-throne-stage__center"
            data-testid="victory-throne-center"
          >
            {renderCourtMemberFigure(winner, true, "center")}
          </div>

          <div
            className="victory-throne-stage__wing victory-throne-stage__wing--right"
            data-testid="victory-right-wing"
          >
            {rightWing.map((player) =>
              renderCourtMemberFigure(player, false, "right")
            )}
          </div>
        </section>

        {/* Match Statistics Dock: Title Holders + Chronicle of Rolls */}
        <div className="victory-stats-dock" data-testid="victory-stats-dock">
          {renderTitlesSection()}
          {renderDiceStatsSection()}
        </div>

        {/* Footer Actions */}
        <footer className="victory-throne-footer">
          <button
            type="button"
            className="victory-throne-btn victory-throne-btn--inspect"
            onClick={() => setMinimized(true)}
          >
            🗺️ {t("Ver Tabuleiro Final", "Inspect Final Board")}
          </button>
          {onRematch && (
            <button
              type="button"
              className="victory-throne-btn victory-throne-btn--rematch"
              disabled={rematchBusy}
              onClick={onRematch}
            >
              {rematchBusy
                ? t("Preparando Revanche...", "Preparing Rematch...")
                : t("⚔️ Jogar Revanche", "⚔️ Play Rematch")}
            </button>
          )}
          <button
            type="button"
            className="victory-throne-btn victory-throne-btn--lobby"
            onClick={onReturnLobby}
          >
            🏰 {t("Voltar ao Lobby", "Return to Lobby")}
          </button>
        </footer>
      </div>
    </div>
  );
}
