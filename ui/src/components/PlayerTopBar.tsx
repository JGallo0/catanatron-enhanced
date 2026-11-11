import React from "react";
import cn from "classnames";

import "./PlayerTopBar.scss";
import type { Color, GameState } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { playerKey } from "../utils/stateUtils";
import { HybridIllustration } from "./icons/GameIcons";

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
    <path d="M11 2h2v13h-2z" />
    <polygon points="12,0.5 9.5,3.5 14.5,3.5" />
    <rect x="6.5" y="14" width="11" height="2" rx="0.5" />
    <rect x="11" y="16" width="2" height="4.5" rx="0.5" />
    <circle cx="12" cy="21.5" r="1.5" />
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
    <path d="M7 4 C 7 10, 17 8, 17 14 C 17 18, 12 20, 10 21" />
    <circle cx="7" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="21" r="1" fill="currentColor" stroke="none" />
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

function PlayerCard({
  gameState,
  color,
}: {
  gameState: GameState;
  color: Color;
}) {
  const key = playerKey(gameState, color);
  const ps = gameState.player_state;
  const meta = PLAYER_COLOR_META[color];
  const isBot = gameState.bot_colors.includes(color);
  const isActive = gameState.current_color === color;
  const isWinner = gameState.winning_color === color;
  const name = gameState.seat_names?.[color] || meta.label;

  const vps = ps[`${key}_ACTUAL_VICTORY_POINTS`] ?? ps[`${key}_VICTORY_POINTS`] ?? 0;
  const resources = ps[`${key}_NUM_RESOURCES_IN_HAND`] ?? 0;
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

  const avatarSrc = `/assets/illustrations/avatars/${color.toLowerCase()}.webp`;

  return (
    <div
      className={cn("cu-player-card", color, {
        "cu-player-card--active": isActive,
        "cu-player-card--winner": isWinner,
      })}
      style={
        {
          "--cu-color": meta.primary,
          "--cu-secondary": meta.secondary,
          "--cu-glow": meta.glow,
        } as React.CSSProperties
      }
      title={`${name} (${isBot ? "Bot" : "Humano"}) • Peças: ${builtSettlements}/5 Aldeias, ${builtCities}/4 Cidades, ${builtRoads}/15 Estradas`}
    >
      {/* LEFT HALF: Player Portrait & Name on Solid Color */}
      <div className="cu-player-card__portrait-col">
        <div className="cu-player-card__name-bar">
          {isActive && (
            <span
              className="cu-player-card__turn-badge"
              title="Jogador Ativo — É a vez deste jogador!"
            >
              <TurnSpinSvg />
            </span>
          )}
          <span className="cu-player-card__name" title={name}>
            {name}
          </span>
        </div>
        <div className="cu-player-card__avatar-wrap">
          <HybridIllustration
            src={avatarSrc}
            alt={name}
            fallback={
              <div className="cu-player-card__avatar-fallback">
                {isBot ? "🤖" : "🧑"}
              </div>
            }
          />
        </div>
      </div>

      {/* RIGHT HALF: Crisp 2x3 Stat Grid on Dark Slate */}
      <div className="cu-player-card__stats-col">
        {/* Row 1: Knights & Longest Road */}
        <div className="cu-stat-row">
          <div
            className={cn("cu-stat", { "cu-stat--awarded": hasArmy })}
            title={hasArmy ? "Maior Exército (+2 PV)" : "Cavaleiros Jogados"}
          >
            <span className="cu-stat__num">{knights}</span>
            {hasArmy ? (
              <span className="cu-stat__medallion">
                <HybridIllustration
                  src="/assets/illustrations/ui/largest_army.webp"
                  alt="Maior Exército"
                  fallback={<SwordStatSvg />}
                />
              </span>
            ) : (
              <SwordStatSvg />
            )}
          </div>
          <div
            className={cn("cu-stat", { "cu-stat--awarded": hasRoad })}
            title={hasRoad ? "Maior Estrada (+2 PV)" : "Sequência de Estrada"}
          >
            <span className="cu-stat__num">{roadLength}</span>
            {hasRoad ? (
              <span className="cu-stat__medallion">
                <HybridIllustration
                  src="/assets/illustrations/ui/longest_road.webp"
                  alt="Maior Estrada"
                  fallback={<RoadStatSvg />}
                />
              </span>
            ) : (
              <RoadStatSvg />
            )}
          </div>
        </div>

        {/* Row 2: Resources & Dev Cards */}
        <div className="cu-stat-row">
          <div
            className={cn("cu-stat", { "cu-stat--danger": resources > 7 })}
            title={
              resources > 7
                ? `Atenção: ${resources} cartas! Perderá metade se rolar 7.`
                : "Cartas de Recurso na mão"
            }
          >
            <span className="cu-stat__num">{resources}</span>
            <ResourceStatSvg />
          </div>
          <div
            className="cu-stat"
            title="Cartas de Desenvolvimento na mão"
          >
            <span className="cu-stat__num">{devCards}</span>
            <DevCardStatSvg />
          </div>
        </div>

        {/* Row 3: Victory Points + Built Pieces Summary */}
        <div className="cu-stat-row cu-stat-row--vp">
          <div
            className="cu-stat cu-stat--vp"
            title="Victory Points"
          >
            <span className="cu-stat__num cu-stat__num--vp">{vps}</span>
            <TrophyStatSvg />
          </div>

          <div
            className="cu-pieces-mini"
            title={`Peças no mapa: ${builtSettlements}/5 Aldeias · ${builtCities}/4 Cidades · ${builtRoads}/15 Estradas`}
          >
            <span
              className="cu-piece-chip"
              title={`${builtSettlements} Aldeia(s) construída(s) (${settlementsLeft} restante(s))`}
            >
              <MiniSettlementIcon />
              <span>{builtSettlements}</span>
            </span>
            <span
              className="cu-piece-chip"
              title={`${builtCities} Cidade(s) construída(s) (${citiesLeft} restante(s))`}
            >
              <MiniCityIcon />
              <span>{builtCities}</span>
            </span>
            <span
              className="cu-piece-chip"
              title={`${builtRoads} Estrada(s) construída(s) (${roadsLeft} restante(s))`}
            >
              <MiniRoadIcon />
              <span>{builtRoads}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Bar Component                                                         */
/* -------------------------------------------------------------------------- */

export default function PlayerTopBar({ gameState }: { gameState: GameState }) {
  return (
    <header className="cu-player-top-bar" aria-label="Jogadores">
      {gameState.colors.map((color) => (
        <PlayerCard key={color} gameState={gameState} color={color} />
      ))}
    </header>
  );
}
