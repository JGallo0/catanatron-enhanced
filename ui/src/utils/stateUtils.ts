import type { Color, GameState } from "./api.types";

/**
 * Check if it's the local human player's turn.
 * If seated in a specific multiplayer perspective, checks that current_color matches their seat.
 */
export function isPlayersTurn(
  gameState: GameState,
  perspective?: Color | null
): boolean {
  if (gameState.bot_colors.includes(gameState.current_color)) {
    return false;
  }
  const isNativeBot =
    Boolean(
      perspective &&
      gameState.bot_colors.includes(perspective) &&
      !gameState.taken_over_colors?.includes(perspective) &&
      !gameState.seat_takeover?.[perspective]?.taken_over
    );
  if (perspective && !isNativeBot) {
    return gameState.current_color === perspective;
  }
  return true;
}

export function playerKey(gameState: GameState, color: Color): string {
  return `P${gameState.colors.indexOf(color)}`;
}

export function countPlayerResources(gameState: GameState, color: Color): number {
  const key = playerKey(gameState, color);
  const total = gameState.player_state[`${key}_NUM_RESOURCES_IN_HAND`];
  if (typeof total === "number") return total;
  const counts = ["WOOD", "BRICK", "SHEEP", "WHEAT", "ORE"].map((r) => gameState.player_state[`${key}_${r}_IN_HAND`]);
  // Private hands have only a public total; never treat missing cards as zero.
  return counts.every((n) => typeof n === "number")
    ? counts.reduce((sum, n) => sum + n, 0)
    : Number(gameState.player_state[`${key}_NUM_RESOURCES_IN_HAND`] ?? 0);
}

export function getHumanColor(
  gameState: GameState,
  perspective?: Color | null
): Color {
  if (perspective && !gameState.bot_colors.includes(perspective)) {
    return perspective;
  }
  if (
    gameState.current_color &&
    !gameState.bot_colors.includes(gameState.current_color)
  ) {
    return gameState.current_color;
  }
  return gameState.colors.find(
    (color) => !gameState.bot_colors.includes(color)
  ) as Color;
}
