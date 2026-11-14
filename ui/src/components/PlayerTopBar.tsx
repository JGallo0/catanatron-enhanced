import React, { useContext, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import cn from "classnames";

import "./PlayerTopBar.scss";
import type { Color, GameState, ResourceCard } from "../utils/api.types";
import { getPlayerColorMeta, getResourceMeta } from "../config/assetRegistry";
import { useLanguage, type AppLanguage } from "../i18n";
import {
  getGuestProfile,
  getSavedAccountAvatarSummary,
} from "../config/avatarCatalog";
import {
  isTakenOverSeat,
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { store } from "../store";
import { countPlayerResources, playerKey } from "../utils/stateUtils";
import { AchievementMedalSvg, ResourceIcon } from "./icons/GameIcons";
import PlayerAvatar from "./PlayerAvatar";

/* -------------------------------------------------------------------------- */
/* Crisp Catan Universe Style Vector Stat Icons                               */
/* -------------------------------------------------------------------------- */

export const SwordStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden="true"
    className="cu-icon"
  >
    {/* Upright medieval sword */}
    <path d="M7 7 12 2l5 5-2.8 7h-4.4Z" />
    <path d="M6 15h12v2.4h-4.6V21h-2.8v-3.6H6Z" />
  </svg>
);

export const RoadStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="cu-icon"
  >
    {/* S-curve road segment matching Catan Universe */}
    <path d="M6 4h8.5a3.5 3.5 0 0 1 0 7H10a4.5 4.5 0 0 0 0 9h8" strokeWidth="5.4" />
    <path d="M6 4h8.5a3.5 3.5 0 0 1 0 7H10a4.5 4.5 0 0 0 0 9h8" stroke="#142235" strokeWidth="1.25" strokeDasharray="1.6 2.5" />
  </svg>
);

export const ResourceStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden="true"
    className="cu-icon"
  >
    {/* Playing card outline with center resource seal */}
    <rect
      x="5"
      y="2.5"
      width="14"
      height="19"
      rx="2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);

export const DevCardStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden="true"
    className="cu-icon"
  >
    {/* Development card outline with star/bookmark seal */}
    <rect
      x="5"
      y="2.5"
      width="14"
      height="19"
      rx="2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <polygon points="12,8 13.5,11.5 17,12 14.5,14.5 15,18 12,16.2 9,18 9.5,14.5 7,12 10.5,11.5" />
  </svg>
);

export const TrophyStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="currentColor"
    aria-hidden="true"
    className="cu-icon cu-icon--trophy"
  >
    {/* Championship trophy cup */}
    <path d="M6 3h12v4.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V3z" />
    <path
      d="M6 5H3.5C2.7 5 2 5.7 2 6.5c0 2.2 1.8 4 4 4.3V5zM18 5h2.5c.8 0 1.5.7 1.5 1.5 0 2.2-1.8 4-4 4.3V5z"
      fillOpacity="0.85"
    />
    <rect x="10.5" y="13.5" width="3" height="4" />
    <rect x="7" y="17.5" width="10" height="3" rx="1" />
  </svg>
);

const TurnSpinSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 17.5-5.5L21.5 8M22 12.5a10 10 0 0 1-17.5 5.5L2.5 16" />
  </svg>
);

const MiniSettlementIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
    <path d="M8 2L2 7v7h12V7L8 2z" />
  </svg>
);

const MiniCityIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
    <path d="M2 14V6l3-3 3 3v2h2V4l2-2 2 2v10H2z" />
  </svg>
);

const MiniRoadIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
    <rect x="2" y="6.5" width="12" height="3" rx="1.2" transform="rotate(-24 8 8)" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/* Individual Player Card                                                     */
/* -------------------------------------------------------------------------- */

type PlayerSeatStats = {
  color: Color;
  name: string;
  isBot: boolean;
  isTakenOver: boolean;
  isActive: boolean;
  isWinner: boolean;
  vps: number;
  resources: number;
  devCards: number;
  knights: number;
  roadLength: number;
  hasArmy: boolean;
  hasRoad: boolean;
  settlementsLeft: number;
  citiesLeft: number;
  roadsLeft: number;
  builtSettlements: number;
  builtCities: number;
  builtRoads: number;
  resolvedAvatar: ReturnType<typeof resolveSeatAvatarProps>;
};

function computeSeatStats(
  gameState: GameState,
  color: Color,
  perspective: Color | null,
  language: AppLanguage
): PlayerSeatStats {
  const key = playerKey(gameState, color);
  const ps = gameState.player_state;
  const meta = getPlayerColorMeta(language)[color];
  const isBot = gameState.bot_colors.includes(color);
  const isTakenOver = isTakenOverSeat(gameState, color);
  const isActive = gameState.current_color === color;
  const isWinner = gameState.winning_color === color;
  const name = resolvePlayerDisplayName(gameState, color, meta.label);
  const seatIndex = Math.max(0, gameState.colors.indexOf(color));

  const vps = ps[`${key}_ACTUAL_VICTORY_POINTS`] ?? ps[`${key}_VICTORY_POINTS`] ?? 0;
  const resources = countPlayerResources(gameState, color);
  const devCards = ps[`${key}_NUM_DEVELOPMENT_CARDS_IN_HAND`] ?? 0;
  const knights = ps[`${key}_PLAYED_KNIGHT`] ?? 0;
  const roadLength = ps[`${key}_LONGEST_ROAD_LENGTH`] ?? 0;
  const hasArmy = Boolean(ps[`${key}_HAS_ARMY`]);
  const hasRoad = Boolean(ps[`${key}_HAS_ROAD`]);

  const settlementsLeft = ps[`${key}_SETTLEMENTS_AVAILABLE`] ?? 5;
  const citiesLeft = ps[`${key}_CITIES_AVAILABLE`] ?? 4;
  const roadsLeft = ps[`${key}_ROADS_AVAILABLE`] ?? 15;
  const builtSettlements = Math.max(0, 5 - settlementsLeft);
  const builtCities = Math.max(0, 4 - citiesLeft);
  const builtRoads = Math.max(0, 15 - roadsLeft);

  const seatAvatar = gameState.seat_avatars?.[color];
  const originalUsername =
    gameState.seat_takeover?.[color]?.original_username ??
    seatAvatar?.username ??
    null;
  const savedAcct = getSavedAccountAvatarSummary();
  const guestProfile = !savedAcct ? getGuestProfile() : null;
  const humanColors = gameState.colors.filter(
    (c) => !gameState.bot_colors.includes(c)
  );
  const isMySeat =
    (!isBot || isTakenOver) &&
    (perspective !== null
      ? perspective === color
      : savedAcct
        ? (seatAvatar?.seat_kind === "USER" &&
            seatAvatar.username === savedAcct.username) ||
          originalUsername === savedAcct.username
        : !isBot && humanColors.length === 1);
  const resolvedAvatar = resolveSeatAvatarProps({
    color,
    isBot,
    isTakenOver,
    seatIndex,
    seatName: name,
    seatAvatar,
    originalUsername,
    isMySeat,
    accountAvatar: savedAcct?.avatar_config,
    accountUsername: savedAcct?.username,
    guestCustomAvatar: guestProfile?.customized
      ? guestProfile.avatar_config
      : undefined,
  });

  return {
    color,
    name,
    isBot,
    isTakenOver,
    isActive,
    isWinner,
    vps,
    resources,
    devCards,
    knights,
    roadLength,
    hasArmy,
    hasRoad,
    settlementsLeft,
    citiesLeft,
    roadsLeft,
    builtSettlements,
    builtCities,
    builtRoads,
    resolvedAvatar,
  };
}

export type FloatingDiscardFX = {
  id: number;
  color: Color;
  resource: ResourceCard;
};

export type FloatingYieldFX = {
  id: number;
  color: Color;
  resource: ResourceCard;
  amount: number;
};

export type FloatingVpFX = {
  id: number;
  color: Color;
  delta: number;
};

export type ActivePortraitTaunt = {
  id: string;
  emoji: string;
  label: string;
  bubbleText: string;
  tone: string;
  nonce: number;
};

function resolveTurnPhaseMicroIcon(
  gameState: GameState,
  language: AppLanguage
): {
  icon: string;
  label: string;
} {
  const en = language === "en";
  switch (gameState.current_prompt) {
    case "DISCARD":
      return {
        icon: "⚠️",
        label: en
          ? "Discarding cards (7 rolled)"
          : "Descartando cartas (7 nos dados)",
      };
    case "MOVE_ROBBER":
      return {
        icon: "🥷",
        label: en ? "Moving the Robber" : "Movendo o Ladrão",
      };
    case "DECIDE_TRADE":
    case "DECIDE_ACCEPTEES":
      return {
        icon: "🤝",
        label: en ? "Negotiating trade" : "Negociando troca",
      };
    case "BUILD_INITIAL_SETTLEMENT":
    case "BUILD_INITIAL_ROAD":
      return {
        icon: "🏠",
        label: en ? "Initial placement" : "Posicionamento inicial",
      };
    case "PLAY_TURN": {
      const k = playerKey(gameState, gameState.current_color);
      const hasRolled = Boolean(gameState.player_state?.[`${k}_HAS_ROLLED`]);
      return hasRolled
        ? {
            icon: "⏩",
            label: en ? "Building / trading" : "Construindo / negociando",
          }
        : {
            icon: "🎲",
            label: en ? "Ready to roll dice" : "Pronto para rolar os dados",
          };
    }
    default:
      return { icon: "🎲", label: en ? "Active player" : "Jogador ativo" };
  }
}

function PlayerCard({
  seat,
  discardLimit,
  isInspected,
  isRecentDev,
  isTradeProposer,
  turnPhase,
  discardDrops,
  yieldItems,
  vpItems,
  activeTaunt,
  onInspect,
}: {
  seat: PlayerSeatStats;
  discardLimit: number;
  isInspected: boolean;
  isRecentDev: boolean;
  isTradeProposer: boolean;
  turnPhase: { icon: string; label: string };
  discardDrops: FloatingDiscardFX[];
  yieldItems: FloatingYieldFX[];
  vpItems: FloatingVpFX[];
  activeTaunt?: ActivePortraitTaunt;
  onInspect: (color: Color) => void;
}) {
  const { language, t } = useLanguage();
  const meta = getPlayerColorMeta(language)[seat.color];
  const resourceMeta = getResourceMeta(language);

  return (
    <div className="cu-player-seat-slot">
      <div
        className={cn("cu-player-card", seat.color, {
          "cu-player-card--active": seat.isActive,
          "cu-player-card--winner": seat.isWinner,
          "cu-player-card--taken-over": seat.isTakenOver,
        })}
        style={
          {
            "--cu-color": meta.primary,
            "--cu-secondary": meta.secondary,
            "--cu-glow": meta.glow,
          } as React.CSSProperties
        }
        onClick={() => onInspect(seat.color)}
        title={`${seat.name}${seat.isTakenOver ? t(" (Bot assumiu)", " (Bot took over)") : ""} • ${t("Peças", "Pieces")}: ${seat.builtSettlements}/5 ${t("Aldeias", "Settlements")}, ${seat.builtCities}/4 ${t("Cidades", "Cities")}, ${seat.builtRoads}/15 ${t("Estradas", "Roads")}`}
      >
        <button
          type="button"
          className="cu-player-card__inspect-trigger"
          aria-label={t(`Inspecionar ${seat.name}`, `Inspect ${seat.name}`)}
          aria-expanded={isInspected}
          onClick={(e) => {
            e.stopPropagation();
            onInspect(seat.color);
          }}
        />

        {/* LEFT HALF: Player Portrait & Name on Solid Color */}
        <div className="cu-player-card__portrait-col">
          <div className="cu-player-card__name-bar">
            {seat.isActive && (
              <span
                className="cu-player-card__turn-badge"
                title={t(
                  `Jogador Ativo — ${turnPhase.label}`,
                  `Active Player — ${turnPhase.label}`
                )}
              >
                <span aria-hidden="true">{turnPhase.icon}</span>
                <TurnSpinSvg />
              </span>
            )}
            <span className="cu-player-card__name" title={seat.name}>
              {seat.name}
            </span>
          </div>
          <div
            className={cn("cu-player-card__avatar-wrap", {
              "cu-player-card__avatar-wrap--custom":
                seat.resolvedAvatar.isCustomUserOrGuest,
            })}
          >
            <PlayerAvatar
              config={seat.resolvedAvatar.config}
              username={seat.resolvedAvatar.username}
              size={58}
              className="cu-player-card__custom-avatar"
            />
            {isTradeProposer && (
              <span
                className="cu-player-card__trade-sack"
                title={t("Propôs uma troca", "Proposed a trade")}
                aria-label={t("Proponente da troca", "Trade proposer")}
              >
                💼
              </span>
            )}
            {activeTaunt && (
              <div
                key={activeTaunt.nonce}
                className={cn(
                  "cu-portrait-taunt-fx",
                  `cu-portrait-taunt-fx--${activeTaunt.id}`
                )}
                aria-label={`${seat.name}: ${activeTaunt.label}`}
              >
                <span className="cu-portrait-taunt-fx__emoji" aria-hidden="true">
                  {activeTaunt.emoji}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT HALF: Crisp 2x3 Stat Grid on Dark Slate */}
        <div className="cu-player-card__stats-col">
          {seat.isTakenOver && (
            <div
              className="cu-player-card__takeover-chip"
              title={t(
                "Jogador desconectou ou saiu — Bot IA assumiu o controle",
                "Player disconnected or left — AI Bot took over"
              )}
            >
              🤖 {t("Bot assumiu", "Bot took over")}
            </div>
          )}
          {/* Row 1: Knights & Longest Road */}
          <div className="cu-stat-row cu-stat-row--awards">
            <div
              className={cn("cu-stat cu-stat--knights", {
                "cu-stat--awarded": seat.hasArmy,
              })}
              title={
                seat.hasArmy
                  ? t("Maior Exército (+2 PV)", "Largest Army (+2 VP)")
                  : t("Cavaleiros Jogados", "Knights Played")
              }
            >
              {seat.hasArmy
                ? <AchievementMedalSvg award="army" label={t("Maior Exército", "Largest Army")} />
                : <SwordStatSvg />}
              <span className="cu-stat__num">{seat.knights}</span>
              <span className="cu-stat__label">
                {seat.knights === 1 ? t("Cavaleiro", "Knight") : t("Cavaleiros", "Knights")}
              </span>
            </div>
            <div
              className={cn("cu-stat cu-stat--roads", {
                "cu-stat--awarded": seat.hasRoad,
              })}
              title={
                seat.hasRoad
                  ? t("Maior Estrada (+2 PV)", "Longest Road (+2 VP)")
                  : t("Sequência de Estrada", "Longest Road Length")
              }
            >
              {seat.hasRoad
                ? <AchievementMedalSvg award="road" label={t("Maior Estrada", "Longest Road")} />
                : <RoadStatSvg />}
              <span className="cu-stat__num">{seat.roadLength}</span>
              <span className="cu-stat__label">{t("Estrada", "Road")}</span>
            </div>
          </div>

          {/* Row 2: Resources & Dev Cards */}
          <div className="cu-stat-row cu-stat-row--cards">
            <div
              className={cn("cu-stat cu-stat--resources", {
                "cu-stat--danger": seat.resources > discardLimit,
              })}
              title={
                seat.resources > discardLimit
                  ? t(
                      `Atenção: ${seat.resources}/${discardLimit} cartas! Perderá metade se rolar 7.`,
                      `Warning: ${seat.resources}/${discardLimit} cards! Will lose half if a 7 is rolled.`
                    )
                  : t("Cartas de Recurso na mão", "Resource Cards in hand")
              }
            >
              <ResourceStatSvg />
              <span className="cu-stat__num">{seat.resources}</span>
              <span className="cu-stat__label">
                {seat.resources === 1 ? t("Recurso", "Resource") : t("Recursos", "Resources")}
              </span>
            </div>
            <div
              className={cn("cu-stat cu-stat--devcards", {
                "cu-stat--recent": isRecentDev,
              })}
              title={t("Cartas de Desenvolvimento na mão", "Dev Cards in hand")}
            >
              <DevCardStatSvg />
              <span className="cu-stat__num">{seat.devCards}</span>
              <span className="cu-stat__label">
                {seat.devCards === 1 ? t("Carta Dev", "Dev card") : t("Cartas Dev", "Dev cards")}
              </span>
            </div>
          </div>

          {/* Row 3: Victory Points + Built Pieces Summary */}
          <div className="cu-stat-row cu-stat-row--vp">
            <div
              className="cu-stat cu-stat--vp"
              title={t("Pontos de Vitória", "Victory Points")}
            >
              <TrophyStatSvg />
              <span className="cu-stat__num cu-stat__num--vp">{seat.vps}</span>
              <span className="cu-stat__label">{t("PV", "VP")}</span>
            </div>

            <div
              className="cu-pieces-mini"
              title={t(
                `Peças no mapa: ${seat.builtSettlements}/5 Aldeias · ${seat.builtCities}/4 Cidades · ${seat.builtRoads}/15 Estradas`,
                `Pieces on board: ${seat.builtSettlements}/5 Settlements · ${seat.builtCities}/4 Cities · ${seat.builtRoads}/15 Roads`
              )}
            >
              <span
                className="cu-piece-chip"
                title={t(
                  `${seat.builtSettlements} Aldeia(s) construída(s) (${seat.settlementsLeft} restante(s))`,
                  `${seat.builtSettlements} Settlement(s) built (${seat.settlementsLeft} left)`
                )}
              >
                <MiniSettlementIcon />
                <span>{seat.builtSettlements}</span>
              </span>
              <span
                className="cu-piece-chip"
                title={t(
                  `${seat.builtCities} Cidade(s) construída(s) (${seat.citiesLeft} restante(s))`,
                  `${seat.builtCities} City/Cities built (${seat.citiesLeft} left)`
                )}
              >
                <MiniCityIcon />
                <span>{seat.builtCities}</span>
              </span>
              <span
                className="cu-piece-chip"
                title={t(
                  `${seat.builtRoads} Estrada(s) construída(s) (${seat.roadsLeft} restante(s))`,
                  `${seat.builtRoads} Road(s) built (${seat.roadsLeft} left)`
                )}
              >
                <MiniRoadIcon />
                <span>{seat.builtRoads}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Live Table Animations Outside Clipped Card */}
      {activeTaunt && (
        <div
          key={`bubble-${activeTaunt.nonce}`}
          className="cu-portrait-taunt-bubble"
          role="status"
        >
          {activeTaunt.bubbleText}
        </div>
      )}

      {(discardDrops.length > 0 || yieldItems.length > 0 || vpItems.length > 0) && (
        <div className="cu-player-seat-slot__fx" aria-live="polite">
          {vpItems.map((vp) => (
            <div key={vp.id} className="cu-float-vp-badge">
              🏆 +{vp.delta} {t("PV", "VP")}
            </div>
          ))}
          {yieldItems.map((y) => {
            const rMeta = resourceMeta[y.resource];
            return (
              <div
                key={y.id}
                className="cu-float-yield-pill"
                style={{ borderColor: rMeta?.borderColor || "#4ade80" }}
                title={`+${y.amount} ${rMeta?.label || y.resource}`}
              >
                <ResourceIcon resource={y.resource} size={14} />
                <span>
                  +{y.amount} {rMeta?.label || y.resource}
                </span>
              </div>
            );
          })}
          {discardDrops.length > 0 && (
            <div
              className="cu-discard-drop-row"
              aria-label={t(
                `${seat.name} descartou ${discardDrops.map((d) => resourceMeta[d.resource]?.label || d.resource).join(", ")}`,
                `${seat.name} discarded ${discardDrops.map((d) => resourceMeta[d.resource]?.label || d.resource).join(", ")}`
              )}
            >
              {discardDrops.map((drop, idx) => {
                const rMeta = resourceMeta[drop.resource];
                return (
                  <div
                    key={drop.id}
                    className="cu-discard-card-drop"
                    style={
                      {
                        borderColor: rMeta?.borderColor || "#ef4444",
                        animationDelay: `${Math.min(idx, 5) * 90}ms`,
                      } as React.CSSProperties
                    }
                    title={t(
                      `Descartou ${rMeta?.label || drop.resource}`,
                      `Discarded ${rMeta?.label || drop.resource}`
                    )}
                  >
                    <ResourceIcon resource={drop.resource} size={15} />
                    <span className="cu-discard-card-drop__label">
                      −{rMeta?.label || drop.resource}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Bar Component & Tap-to-Inspect Dialog                                 */
/* -------------------------------------------------------------------------- */

export default function PlayerTopBar({
  gameState,
  recentDevColor = null,
  discardDrops = [],
  yieldFX = [],
  vpFX = [],
  activeTaunts = {},
}: {
  gameState: GameState;
  recentDevColor?: Color | null;
  discardDrops?: FloatingDiscardFX[];
  yieldFX?: FloatingYieldFX[];
  vpFX?: FloatingVpFX[];
  activeTaunts?: Partial<Record<Color, ActivePortraitTaunt>>;
}) {
  const { state } = useContext(store);
  const { language, t } = useLanguage();
  const [inspectedColor, setInspectedColor] = useState<Color | null>(null);

  const colorMeta = getPlayerColorMeta(language);
  const discardLimit = gameState.game?.discard_limit ?? 7;
  const turnPhase = resolveTurnPhaseMicroIcon(gameState, language);
  const tradeProposerColor = gameState.is_resolving_trade
    ? gameState.colors[gameState.current_turn_index] ?? null
    : null;

  const seats = gameState.colors.map((color) =>
    computeSeatStats(gameState, color, state.perspective, language)
  );
  const inspectedSeat =
    seats.find((s) => s.color === inspectedColor) ?? null;

  return (
    <>
      <header className="cu-player-top-bar player-top-bar" aria-label={t("Jogadores", "Players")}>
        {seats.map((seat) => (
          <PlayerCard
            key={seat.color}
            seat={seat}
            discardLimit={discardLimit}
            isInspected={inspectedColor === seat.color}
            isRecentDev={recentDevColor === seat.color}
            isTradeProposer={tradeProposerColor === seat.color}
            turnPhase={turnPhase}
            discardDrops={discardDrops.filter((d) => d.color === seat.color)}
            yieldItems={yieldFX.filter((y) => y.color === seat.color)}
            vpItems={vpFX.filter((v) => v.color === seat.color)}
            activeTaunt={activeTaunts[seat.color]}
            onInspect={setInspectedColor}
          />
        ))}
      </header>

      <Dialog
        open={Boolean(inspectedSeat)}
        onClose={() => setInspectedColor(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          className: "catan-modal-paper cu-player-inspect-paper",
        }}
      >
        {inspectedSeat && (
          <>
            <DialogTitle className="cu-player-inspect-header">
              <div className="cu-player-inspect-header__left">
                <PlayerAvatar
                  config={inspectedSeat.resolvedAvatar.config}
                  username={inspectedSeat.resolvedAvatar.username}
                  size={52}
                />
                <div className="cu-player-inspect-header__meta">
                  <strong>{inspectedSeat.name}</strong>
                  <div className="cu-player-inspect-header__tags">
                    <span
                      className="cu-inspect-tag"
                      style={{
                        borderColor: colorMeta[inspectedSeat.color].primary,
                      }}
                    >
                      {colorMeta[inspectedSeat.color].label}
                    </span>
                    <span
                      className={cn("cu-inspect-tag", {
                        "cu-inspect-tag--takeover": inspectedSeat.isTakenOver,
                      })}
                    >
                      {inspectedSeat.isTakenOver
                        ? t("Substituto IA", "AI Substitute")
                        : inspectedSeat.isBot
                          ? t("Bot IA", "AI Bot")
                          : t("Jogador", "Player")}
                    </span>
                    {inspectedSeat.isActive && (
                      <span className="cu-inspect-tag cu-inspect-tag--active">
                        {t("Vez atual", "Current turn")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                size="small"
                variant="outlined"
                className="cu-player-inspect-close"
                onClick={() => setInspectedColor(null)}
              >
                {t("Fechar", "Close")}
              </Button>
            </DialogTitle>

            <DialogContent className="cu-player-inspect-body">
              <div className="cu-inspect-stats-grid">
                <div className="cu-inspect-stat-box cu-inspect-stat-box--vp">
                  <span>{t("Pontos de Vitória", "Victory Points")}</span>
                  <strong>
                    🏆 {inspectedSeat.vps} {t("PV", "VP")}
                  </strong>
                </div>
                <div
                  className={cn("cu-inspect-stat-box", {
                    "cu-inspect-stat-box--warn":
                      inspectedSeat.resources > discardLimit,
                  })}
                >
                  <span>{t("Cartas de Recurso", "Resource Cards")}</span>
                  <strong>🃏 {inspectedSeat.resources}</strong>
                </div>
                <div className="cu-inspect-stat-box">
                  <span>{t("Cartas Dev", "Dev Cards")}</span>
                  <strong>📜 {inspectedSeat.devCards}</strong>
                </div>
                <div
                  className={cn("cu-inspect-stat-box", {
                    "cu-inspect-stat-box--award": inspectedSeat.hasArmy,
                  })}
                >
                  <span>{t("Cavaleiros", "Knights")}</span>
                  <strong>
                    ⚔️ {inspectedSeat.knights}
                    {inspectedSeat.hasArmy
                      ? t(" • Maior Exército", " • Largest Army")
                      : ""}
                  </strong>
                </div>
                <div
                  className={cn("cu-inspect-stat-box cu-inspect-stat-box--full", {
                    "cu-inspect-stat-box--award": inspectedSeat.hasRoad,
                  })}
                >
                  <span>{t("Maior Estrada", "Longest Road")}</span>
                  <strong>
                    🛤️ {inspectedSeat.roadLength} {t("segmentos", "segments")}
                    {inspectedSeat.hasRoad
                      ? t(" • +2 PV Ativo", " • +2 VP Active")
                      : ""}
                  </strong>
                </div>
              </div>

              <div className="cu-inspect-pieces-card">
                <h4>{t("Peças no Tabuleiro", "Board Pieces")}</h4>
                <div className="cu-inspect-pieces-row">
                  <div>
                    <small>{t("Aldeias", "Settlements")}</small>
                    <strong>{inspectedSeat.builtSettlements}/5</strong>
                    <span>
                      {inspectedSeat.settlementsLeft} {t("rest.", "left")}
                    </span>
                  </div>
                  <div>
                    <small>{t("Cidades", "Cities")}</small>
                    <strong>{inspectedSeat.builtCities}/4</strong>
                    <span>
                      {inspectedSeat.citiesLeft} {t("rest.", "left")}
                    </span>
                  </div>
                  <div>
                    <small>{t("Estradas", "Roads")}</small>
                    <strong>{inspectedSeat.builtRoads}/15</strong>
                    <span>
                      {inspectedSeat.roadsLeft} {t("rest.", "left")}
                    </span>
                  </div>
                </div>
              </div>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
