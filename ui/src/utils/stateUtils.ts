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
  if (perspective) {
    return gameState.current_color === perspective;
  }
  return true;
}

export function playerKey(gameState: GameState, color: Color): string {
  return `P${gameState.colors.indexOf(color)}`;
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
