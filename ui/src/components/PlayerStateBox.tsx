import cn from "classnames";

import "./PlayerStateBox.scss";
import { type Color, type PlayerState } from "../utils/api.types";
import ResourceCards from "./ResourceCards";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import {
  AwardStarSvg,
  CitySvgPiece,
  RoadSvgPiece,
  SettlementSvgPiece,
} from "./icons/GameIcons";
import { RoadStatSvg, SwordStatSvg } from "./PlayerTopBar";

export default function PlayerStateBox({
  playerState,
  playerKey,
  color,
  isCurrentTurn = false,
  isBot = false,
  customName,
}: {
  playerState: PlayerState;
  playerKey: string;
  color: Color;
  isCurrentTurn?: boolean;
  isBot?: boolean;
  customName?: string;
}) {
  const actualVps =
    playerState[`${playerKey}_ACTUAL_VICTORY_POINTS`] ??
    playerState[`${playerKey}_VICTORY_POINTS`];
  const hasArmy = Boolean(playerState[`${playerKey}_HAS_ARMY`]);
  const hasRoad = Boolean(playerState[`${playerKey}_HAS_ROAD`]);
  const knightsPlayed = playerState[`${playerKey}_PLAYED_KNIGHT`] ?? 0;
  const longestRoad = playerState[`${playerKey}_LONGEST_ROAD_LENGTH`] ?? 0;
  const settlementsLeft = playerState[`${playerKey}_SETTLEMENTS_AVAILABLE`] ?? 5;
  const citiesLeft = playerState[`${playerKey}_CITIES_AVAILABLE`] ?? 4;
  const roadsLeft = playerState[`${playerKey}_ROADS_AVAILABLE`] ?? 15;

  const builtSettlements = Math.max(0, 5 - settlementsLeft);
  const builtCities = Math.max(0, 4 - citiesLeft);
  const builtRoads = Math.max(0, 15 - roadsLeft);

  const colorMeta = PLAYER_COLOR_META[color];
  const displayName = customName || colorMeta.label;

  return (
    <div
      className={cn("player-state-box foreground", color, {
        "player-state-box--active": isCurrentTurn,
      })}
      style={{
        borderLeftColor: colorMeta.primary,
      }}
    >
      <div className="player-state-box__header">
        <div className="player-state-box__identity">
          <span
            className="player-state-box__swatch"
            style={{
              background: colorMeta.primary,
              boxShadow: `0 0 8px ${colorMeta.glow}`,
            }}
          />
          <span className="player-state-box__name">{displayName}</span>
          <span className="player-state-box__role-badge">
            {isBot ? "BOT" : "HUMANO"}
          </span>
          {isCurrentTurn && (
            <span className="player-state-box__turn-pill">vez atual</span>
          )}
        </div>

        <div
          className={cn("victory-points center-text", {
            bold: actualVps >= 10,
          })}
          title="Victory Points"
        >
          <span className="victory-points__num">{actualVps}</span>
          <small>PV</small>
        </div>
      </div>

      <ResourceCards
        playerState={playerState}
        playerKey={playerKey}
        compact={true}
      />

      <div
        className="player-pieces-strip"
        title={`Peças de ${displayName}: ${builtSettlements} Aldeias no mapa (${settlementsLeft} restantes), ${builtCities} Cidades no mapa (${citiesLeft} restantes), ${builtRoads} Estradas no mapa (${roadsLeft} restantes)`}
      >
        <div
          className="player-piece-badge"
          title={`Aldeias construídas: ${builtSettlements} (Restam ${settlementsLeft} no estoque)`}
        >
          <svg
            width="24"
            height="24"
            viewBox="-24 -30 48 52"
            aria-hidden="true"
          >
            <SettlementSvgPiece color={color} scale={1.0} />
          </svg>
          <div className="player-piece-badge__text">
            <strong>{builtSettlements}/5</strong>
            <small>Aldeias</small>
          </div>
        </div>

        <div
          className="player-piece-badge"
          title={`Cidades construídas: ${builtCities} (Restam ${citiesLeft} no estoque)`}
        >
          <svg
            width="24"
            height="24"
            viewBox="-24 -30 48 52"
            aria-hidden="true"
          >
            <CitySvgPiece color={color} scale={0.96} />
          </svg>
          <div className="player-piece-badge__text">
            <strong>{builtCities}/4</strong>
            <small>Cidades</small>
          </div>
        </div>

        <div
          className="player-piece-badge"
          title={`Estradas construídas: ${builtRoads} (Restam ${roadsLeft} no estoque)`}
        >
          <span className="player-piece-badge__road-svg" aria-hidden="true">
            <RoadSvgPiece color={color} />
          </span>
          <div className="player-piece-badge__text">
            <strong>{builtRoads}/15</strong>
            <small>Estradas</small>
          </div>
        </div>
      </div>

      <div className="scores">
        <div
          className={cn("num-knights center-text", {
            bold: hasArmy,
            "score-pill--award": hasArmy,
          })}
          title={
            hasArmy
              ? "Knights Played — Maior Exército (+2 PV)"
              : "Knights Played"
          }
        >
          <SwordStatSvg />
          <span>{knightsPlayed}</span>
          {hasArmy && (
            <AwardStarSvg
              size={13}
              className="score-pill__star"
              label="Maior Exército"
            />
          )}
          <small>{hasArmy ? "Maior Exército" : "Cavaleiros"}</small>
        </div>

        <div
          className={cn("num-roads center-text", {
            bold: hasRoad,
            "score-pill--award": hasRoad,
          })}
          title={
            hasRoad ? "Longest Road — Maior Estrada (+2 PV)" : "Longest Road"
          }
        >
          <RoadStatSvg />
          <span>{longestRoad}</span>
          {hasRoad && (
            <AwardStarSvg
              size={13}
              className="score-pill__star"
              label="Maior Estrada"
            />
          )}
          <small>{hasRoad ? "Maior Estrada" : "Seq. Estrada"}</small>
        </div>
      </div>
    </div>
  );
}
