import type { Card, Color, GameState } from "./api.types";
import { playerKey } from "./stateUtils";

export const RESOURCE_TYPES = ["WOOD", "BRICK", "SHEEP", "WHEAT", "ORE"] as const;
const CARD_TYPES: Card[] = [...RESOURCE_TYPES, "KNIGHT", "VICTORY_POINT", "MONOPOLY", "YEAR_OF_PLENTY", "ROAD_BUILDING"];

/** Actual hand deltas cover production, setup, trades, theft and development cards.
 * Never infer hidden hands or replay cards that were already held on page load. */
export function getCardGains(before: GameState | null, after: GameState, color: Color | null): Card[] {
  if (!before || !color || before.game.id !== after.game.id || after.state_index <= before.state_index ||
    !before.colors.includes(color) || !after.colors.includes(color)) return [];
  const prev = playerKey(before, color);
  const next = playerKey(after, color);
  return CARD_TYPES.flatMap((card) => {
    const a = before.player_state[`${prev}_${card}_IN_HAND`];
    const b = after.player_state[`${next}_${card}_IN_HAND`];
    if (typeof a !== "number" || typeof b !== "number") return [];
    return Array.from({ length: Math.max(0, b - a) }, () => card);
  });
}
