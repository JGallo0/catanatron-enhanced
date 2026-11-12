import type { Color } from "./api.types";

export function saveGameSeat(gameId: string, color: Color | null) {
  try {
    if (color) {
      localStorage.setItem(`catan_game_seat_${gameId}`, color);
    }
  } catch {
    // ignore storage errors
  }
}

export function getSavedGameSeat(gameId: string): Color | null {
  try {
    return (localStorage.getItem(`catan_game_seat_${gameId}`) as Color) || null;
  } catch {
    return null;
  }
}
