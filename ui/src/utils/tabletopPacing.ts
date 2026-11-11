import type { Color, GameActionRecord, GameState } from "./api.types";

export type GameSpeed = "normal" | "fast";

export const GAME_SPEED_STORAGE_KEY = "catan_game_speed_v1";

export function getSavedGameSpeed(): GameSpeed {
  try {
    return localStorage.getItem(GAME_SPEED_STORAGE_KEY) === "fast"
      ? "fast"
      : "normal";
  } catch {
    return "normal";
  }
}

export function saveGameSpeed(speed: GameSpeed): void {
  try {
    localStorage.setItem(GAME_SPEED_STORAGE_KEY, speed);
  } catch {
    // ignore storage errors
  }
}

export function getSpeedMultiplier(speed: GameSpeed): number {
  return speed === "fast" ? 0.5 : 1;
}

export function getRollSpinDurationMs(speed: GameSpeed): number {
  return Math.round(550 * getSpeedMultiplier(speed));
}

export function getActionDelayMs(
  record: GameActionRecord | undefined,
  speed: GameSpeed,
  options?: { requiresLocalHumanPrompt?: boolean }
): number {
  const mult = getSpeedMultiplier(speed);
  if (options?.requiresLocalHumanPrompt) {
    return Math.round(250 * mult);
  }
  if (!record || !record[0]) {
    return Math.round(650 * mult);
  }
  switch (record[0][1]) {
    case "ROLL":
      return Math.round(1800 * mult);
    case "END_TURN":
      return Math.round(650 * mult);
    case "DISCARD_RESOURCE":
      return Math.round(400 * mult);
    case "OFFER_TRADE":
    case "ACCEPT_TRADE":
    case "REJECT_TRADE":
    case "CONFIRM_TRADE":
    case "CANCEL_TRADE":
      return Math.round(950 * mult);
    default:
      return Math.round(1200 * mult);
  }
}

export type TransitionVisuals = {
  recentNodeId: number | null;
  recentEdgeId: string | null;
  boughtDevColor: Color | null;
  rollDice: [number, number] | null;
  rollColor: Color | null;
  actionIcon: string;
};

export function extractTransitionVisuals(
  record?: GameActionRecord
): TransitionVisuals {
  if (!record || !record[0]) {
    return {
      recentNodeId: null,
      recentEdgeId: null,
      boughtDevColor: null,
      rollDice: null,
      rollColor: null,
      actionIcon: "🎲",
    };
  }
  const [action, result] = record;
  const [color, actionType, value] = action;
  switch (actionType) {
    case "ROLL": {
      const pair =
        Array.isArray(result) && result.length === 2
          ? ([Number(result[0]), Number(result[1])] as [number, number])
          : null;
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: pair,
        rollColor: color,
        actionIcon: "🎲",
      };
    }
    case "BUILD_SETTLEMENT":
      return {
        recentNodeId: Number(value),
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🏠",
      };
    case "BUILD_CITY":
      return {
        recentNodeId: Number(value),
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🏰",
      };
    case "BUILD_ROAD": {
      const pair = Array.isArray(value) ? value : [0, 0];
      const u = Math.min(Number(pair[0]), Number(pair[1]));
      const v = Math.max(Number(pair[0]), Number(pair[1]));
      return {
        recentNodeId: null,
        recentEdgeId: `${u},${v}`,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🛤️",
      };
    }
    case "BUY_DEVELOPMENT_CARD":
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: color,
        rollDice: null,
        rollColor: null,
        actionIcon: "🃏",
      };
    case "MOVE_ROBBER":
    case "PLAY_KNIGHT_CARD":
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🥷",
      };
    case "OFFER_TRADE":
    case "ACCEPT_TRADE":
    case "REJECT_TRADE":
    case "CONFIRM_TRADE":
    case "CANCEL_TRADE":
    case "MARITIME_TRADE":
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "⚖️",
      };
    case "END_TURN":
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "⏭️",
      };
    default:
      return {
        recentNodeId: null,
        recentEdgeId: null,
        boughtDevColor: null,
        rollDice: null,
        rollColor: null,
        actionIcon: "🧭",
      };
  }
}

export function electBotCoordinator(
  gameState: Pick<
    GameState,
    "room_code" | "colors" | "bot_colors" | "seat_takeover"
  >,
  mySeatColor: Color | null
): boolean {
  const activeHumans = gameState.colors.filter(
    (c) => !gameState.bot_colors.includes(c)
  );
  const origHumanCount = new Set([
    ...activeHumans,
    ...Object.keys(gameState.seat_takeover || {}),
  ]).size;
  const isMultiplayer = Boolean(gameState.room_code) || origHumanCount >= 2;

  if (!isMultiplayer) {
    if (activeHumans.length === 0) return true;
    return mySeatColor === null || activeHumans.includes(mySeatColor);
  }
  if (activeHumans.length === 0) {
    return false;
  }
  return mySeatColor !== null && mySeatColor === activeHumans[0];
}
