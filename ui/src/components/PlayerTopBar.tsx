import cn from "classnames";

import "./PlayerTopBar.scss";
import type { Color, GameState } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { playerKey } from "../utils/stateUtils";

function PlayerChip({
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

  const vps = ps[`${key}_ACTUAL_VICTORY_POINTS`] ?? ps[`${key}_VICTORY_POINTS`];
  const resources = ps[`${key}_NUM_RESOURCES_IN_HAND`] ?? 0;
  const devCards = ps[`${key}_NUM_DEVELOPMENT_CARDS_IN_HAND`] ?? 0;
  const knights = ps[`${key}_PLAYED_KNIGHT`] ?? 0;
  const road = ps[`${key}_LONGEST_ROAD_LENGTH`] ?? 0;
  const hasArmy = Boolean(ps[`${key}_HAS_ARMY`]);
  const hasRoad = Boolean(ps[`${key}_HAS_ROAD`]);
  const settlements = Math.max(0, 5 - (ps[`${key}_SETTLEMENTS_AVAILABLE`] ?? 5));
  const cities = Math.max(0, 4 - (ps[`${key}_CITIES_AVAILABLE`] ?? 4));
  const roads = Math.max(0, 15 - (ps[`${key}_ROADS_AVAILABLE`] ?? 15));

  return (
    <div
      className={cn("ptb-chip", color, {
        "ptb-chip--active": isActive,
        "ptb-chip--winner": isWinner,
      })}
      style={
        {
          "--ptb-color": meta.primary,
          "--ptb-secondary": meta.secondary,
          "--ptb-glow": meta.glow,
        } as React.CSSProperties
      }
      title={`${name} — ${isBot ? "Bot" : "Humano"} • ${settlements} aldeias, ${cities} cidades, ${roads} estradas`}
    >
      <div className="ptb-chip__avatar">
        <span aria-hidden="true">{isBot ? "🤖" : "🧑"}</span>
        {isActive && <span className="ptb-chip__turn-ring" />}
      </div>

      <div className="ptb-chip__body">
        <div className="ptb-chip__name">{name}</div>
        <div className="ptb-chip__stats">
          <span title="Cartas de recurso na mão">
            🂠 <b>{resources}</b>
          </span>
          <span title="Cartas de desenvolvimento na mão">
            🃏 <b>{devCards}</b>
          </span>
          <span
            className={cn({ "ptb-chip__award": hasArmy })}
            title={hasArmy ? "Maior Exército (+2 PV)" : "Cavaleiros jogados"}
          >
            ⚔️ <b>{knights}</b>
          </span>
          <span
            className={cn({ "ptb-chip__award": hasRoad })}
            title={hasRoad ? "Maior Estrada (+2 PV)" : "Maior sequência de estrada"}
          >
            🛤️ <b>{road}</b>
          </span>
        </div>
        <div className="ptb-chip__pieces" aria-hidden="true">
          <span>🏠 {settlements}/5</span>
          <span>🏰 {cities}/4</span>
          <span>▬ {roads}/15</span>
        </div>
      </div>

      <div className="ptb-chip__vp" title="Victory Points">
        <b>{vps}</b>
        <span aria-hidden="true">🏆</span>
      </div>
    </div>
  );
}

export default function PlayerTopBar({ gameState }: { gameState: GameState }) {
  return (
    <nav className="player-top-bar" aria-label="Jogadores">
      {gameState.colors.map((color) => (
        <PlayerChip key={color} gameState={gameState} color={color} />
      ))}
    </nav>
  );
}
