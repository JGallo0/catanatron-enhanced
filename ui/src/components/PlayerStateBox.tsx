import cn from "classnames";

import "./PlayerStateBox.scss";
import { type Color, type PlayerState } from "../utils/api.types";
import ResourceCards from "./ResourceCards";
import { PLAYER_COLOR_META } from "../config/assetRegistry";

export default function PlayerStateBox({
  playerState,
  playerKey,
  color,
  isCurrentTurn = false,
  isBot = false,
}: {
  playerState: PlayerState;
  playerKey: string;
  color: Color;
  isCurrentTurn?: boolean;
  isBot?: boolean;
}) {
  const actualVps =
    playerState[`${playerKey}_ACTUAL_VICTORY_POINTS`] ??
    playerState[`${playerKey}_VICTORY_POINTS`];
  const hasArmy = Boolean(playerState[`${playerKey}_HAS_ARMY`]);
  const hasRoad = Boolean(playerState[`${playerKey}_HAS_ROAD`]);
  const knightsPlayed = playerState[`${playerKey}_PLAYED_KNIGHT`] ?? 0;
  const longestRoad = playerState[`${playerKey}_LONGEST_ROAD_LENGTH`] ?? 0;
  const settlementsLeft = playerState[`${playerKey}_SETTLEMENTS_AVAILABLE`];
  const citiesLeft = playerState[`${playerKey}_CITIES_AVAILABLE`];
  const roadsLeft = playerState[`${playerKey}_ROADS_AVAILABLE`];
  const colorMeta = PLAYER_COLOR_META[color];

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
          <span className="player-state-box__name">{colorMeta.label}</span>
          <span className="player-state-box__role-badge">
            {isBot ? "BOT" : "VOCÊ"}
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
          <span>⚔️ {knightsPlayed}</span>
          <small>{hasArmy ? "Exército ★" : "Cavaleiros"}</small>
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
          <span>🛤️ {longestRoad}</span>
          <small>{hasRoad ? "Estrada ★" : "Estradas"}</small>
        </div>

        {settlementsLeft !== undefined && (
          <div
            className="piece-stock-pill"
            title={`Estoque restante: ${settlementsLeft} Aldeias, ${citiesLeft ?? 0} Cidades, ${roadsLeft ?? 0} Estradas`}
          >
            <span>🏠{5 - settlementsLeft}/5</span>
            <span>🏰{4 - (citiesLeft ?? 4)}/4</span>
          </div>
        )}
      </div>
    </div>
  );
}
