import type {
  Color,
  GameActionRecord,
  GameState,
  ResourceCard,
} from "./api.types";
import { playerKey } from "./stateUtils";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { resolvePlayerDisplayName } from "../config/botCatalog";
import { getCurrentLanguage, type AppLanguage } from "../i18n";

export type GameSpeed = "slow" | "normal" | "fast" | "turbo";

export const GAME_SPEED_STORAGE_KEY = "catan_game_speed_v1";
export const INTRO_SPLASH_MS = 10000;
export const TURN_TRANSITION_MS = 3000;

export function getSavedGameSpeed(): GameSpeed {
  try {
    const saved = localStorage.getItem(GAME_SPEED_STORAGE_KEY);
    if (saved === "slow" || saved === "fast" || saved === "turbo") {
      return saved;
    }
    return "normal";
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

export function cycleGameSpeed(current: GameSpeed): GameSpeed {
  switch (current) {
    case "normal":
      return "fast";
    case "fast":
      return "turbo";
    case "turbo":
      return "slow";
    case "slow":
      return "normal";
  }
}

/**
 * Slow uses 6x pauses plus a visible thinking interval before each bot action.
 * Normal is 4x slower than the original 1x pacing (comfortable real tabletop pace);
 * Rápida matches the original 1x pacing; Turbo is 2x faster (0.5x).
 */
export function getSpeedMultiplier(speed: GameSpeed): number {
  switch (speed) {
    case "slow": return 6;
    case "turbo":
      return 0.5;
    case "fast":
      return 1;
    case "normal":
    default:
      return 4;
  }
}

export function getRollSpinDurationMs(speed: GameSpeed): number {
  switch (speed) {
    case "slow": return 4200;
    case "turbo":
      return 840;
    case "fast":
      return 1700;
    case "normal":
    default:
      return 3300;
  }
}

export function getDiceOverlayDurationMs(speed: GameSpeed): number {
  switch (speed) {
    case "slow": return 9600;
    case "turbo":
      return 2500;
    case "fast":
      return 4800;
    case "normal":
    default:
      return 8400;
  }
}

export function getActionDelayMs(
  record: GameActionRecord | undefined,
  speed: GameSpeed,
  options?: { requiresLocalHumanPrompt?: boolean }
): number {
  const mult = getSpeedMultiplier(speed);
  if (options?.requiresLocalHumanPrompt) {
    return Math.min(500, Math.round(250 * mult));
  }
  if (!record || !record[0]) {
    return Math.round(1300 * mult);
  }
  switch (record[0][1]) {
    case "ROLL":
      return Math.round(3600 * mult);
    case "END_TURN":
      return Math.round(1300 * mult);
    case "DISCARD_RESOURCE":
      return Math.round(800 * mult);
    case "OFFER_TRADE":
    case "ACCEPT_TRADE":
    case "REJECT_TRADE":
    case "CONFIRM_TRADE":
    case "CANCEL_TRADE":
      return Math.round(1900 * mult);
    default:
      return Math.round(2400 * mult);
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

const VALID_RESOURCES = new Set<ResourceCard>([
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
]);

export type DiscardDropItem = {
  color: Color;
  resource: ResourceCard;
};

export type ResourceYieldItem = {
  color: Color;
  resource: ResourceCard;
  amount: number;
};

export type VpDeltaItem = {
  color: Color;
  delta: number;
};

export type RobberNoticeFX = {
  attackerColor: Color;
  victimColor: Color | null;
  message: string;
  tone: "safe" | "victim" | "attacker" | "neutral";
};

export type TurnHandoffFX = {
  color: Color;
  name: string;
  isLocal: boolean;
};

export type BatchTransitionFX = {
  newRecords: GameActionRecord[];
  discards: DiscardDropItem[];
  yields: ResourceYieldItem[];
  vpDeltas: VpDeltaItem[];
  robberEvent: RobberNoticeFX | null;
  turnHandoff: TurnHandoffFX | null;
};

export function extractBatchTransitionFX(
  prevState: GameState | null,
  nextState: GameState,
  mySeatColor: Color | null = null,
  lang: AppLanguage = getCurrentLanguage()
): BatchTransitionFX {
  const prevLen = prevState?.action_records?.length ?? 0;
  const allRecords = nextState.action_records || [];
  const newRecords =
    allRecords.length > prevLen
      ? allRecords.slice(prevLen)
      : allRecords.slice(-1);

  const discards: DiscardDropItem[] = [];
  const yieldTotals = new Map<string, number>();

  let robbedTileId: number | null = null;
  const robberKey = JSON.stringify(nextState.robber_coordinate);
  for (const pt of nextState.tiles || []) {
    if (
      JSON.stringify(pt.coordinate) === robberKey &&
      "id" in pt.tile &&
      typeof pt.tile.id === "number"
    ) {
      robbedTileId = pt.tile.id;
      break;
    }
  }

  let latestRobberRecord: GameActionRecord | null = null;

  for (const record of newRecords) {
    if (!record || !record[0]) continue;
    const [action, result] = record;
    const [actorColor, actionType, value] = action;

    if (actionType === "DISCARD_RESOURCE") {
      const res = (result || value) as ResourceCard | undefined;
      if (res && VALID_RESOURCES.has(res)) {
        discards.push({ color: actorColor, resource: res });
      }
    } else if (
      actionType === "ROLL" &&
      Array.isArray(result) &&
      result.length === 2
    ) {
      const sum = Number(result[0]) + Number(result[1]);
      if (sum !== 7) {
        for (const node of Object.values(nextState.nodes || {})) {
          if (!node.color || !node.building) continue;
          const mult = node.building === "CITY" ? 2 : 1;
          const adjTiles = nextState.adjacent_tiles?.[String(node.id)] || [];
          for (const tile of adjTiles) {
            if (
              tile.type === "RESOURCE_TILE" &&
              tile.number === sum &&
              tile.id !== robbedTileId
            ) {
              const key = `${node.color}:${tile.resource}`;
              yieldTotals.set(key, (yieldTotals.get(key) ?? 0) + mult);
            }
          }
        }
      }
    } else if (actionType === "PLAY_YEAR_OF_PLENTY" && Array.isArray(value)) {
      for (const r of value) {
        if (r && VALID_RESOURCES.has(r)) {
          const key = `${actorColor}:${r}`;
          yieldTotals.set(key, (yieldTotals.get(key) ?? 0) + 1);
        }
      }
    } else if (actionType === "MOVE_ROBBER") {
      latestRobberRecord = record;
    }
  }

  const yields: ResourceYieldItem[] = [];
  for (const [compoundKey, amount] of yieldTotals.entries()) {
    if (amount <= 0) continue;
    const [colorStr, resStr] = compoundKey.split(":");
    yields.push({
      color: colorStr as Color,
      resource: resStr as ResourceCard,
      amount,
    });
  }

  const vpDeltas: VpDeltaItem[] = [];
  if (prevState) {
    for (const c of nextState.colors) {
      const kPrev = playerKey(prevState, c);
      const kNext = playerKey(nextState, c);
      const prevVp = Number(
        prevState.player_state?.[`${kPrev}_ACTUAL_VICTORY_POINTS`] ??
          prevState.player_state?.[`${kPrev}_VICTORY_POINTS`] ??
          0
      );
      const nextVp = Number(
        nextState.player_state?.[`${kNext}_ACTUAL_VICTORY_POINTS`] ??
          nextState.player_state?.[`${kNext}_VICTORY_POINTS`] ??
          0
      );
      if (nextVp > prevVp) {
        vpDeltas.push({ color: c, delta: nextVp - prevVp });
      }
    }
  }

  let robberEvent: RobberNoticeFX | null = null;
  if (latestRobberRecord && latestRobberRecord[0]) {
    const colorMeta = getPlayerColorMeta(lang);
    const en = lang === "en";
    const [action] = latestRobberRecord;
    const attackerColor = action[0];
    const attackerName = resolvePlayerDisplayName(
      nextState,
      attackerColor,
      colorMeta[attackerColor]?.label || attackerColor
    );
    const moveVal = Array.isArray(action[2]) ? action[2] : [];
    const rawVictim = moveVal[1] as Color | null | undefined;
    const victimColor = rawVictim ?? null;
    const victimName = victimColor
      ? resolvePlayerDisplayName(
          nextState,
          victimColor,
          colorMeta[victimColor]?.label || victimColor
        )
      : null;

    if (!victimColor) {
      const spared =
        mySeatColor !== null && attackerColor !== mySeatColor;
      robberEvent = {
        attackerColor,
        victimColor: null,
        tone: "safe",
        message: spared
          ? en
            ? `🛡️ You were spared! (${attackerName} moved the Robber)`
            : `🛡️ Você não foi roubado! (${attackerName} moveu o Ladrão)`
          : en
            ? `🥷 ${attackerName} moved the Robber (nobody was robbed)`
            : `🥷 ${attackerName} moveu o Ladrão (ninguém foi roubado)`,
      };
    } else if (mySeatColor !== null && victimColor === mySeatColor) {
      robberEvent = {
        attackerColor,
        victimColor,
        tone: "victim",
        message: en
          ? `🥷 ${attackerName} stole 1 card from You!`
          : `🥷 ${attackerName} roubou 1 carta de Você!`,
      };
    } else if (
      mySeatColor !== null &&
      attackerColor === mySeatColor
    ) {
      robberEvent = {
        attackerColor,
        victimColor,
        tone: "attacker",
        message: en
          ? `🥷 You stole 1 resource from ${victimName}!`
          : `🥷 Você roubou 1 recurso de ${victimName}!`,
      };
    } else {
      const isObserverNotHit =
        mySeatColor !== null && attackerColor !== mySeatColor;
      robberEvent = {
        attackerColor,
        victimColor,
        tone: isObserverNotHit ? "safe" : "neutral",
        message: isObserverNotHit
          ? en
            ? `🥷 ${attackerName} stole 1 card from ${victimName} • You were spared!`
            : `🥷 ${attackerName} roubou 1 carta de ${victimName} • Você não foi roubado!`
          : en
            ? `🥷 ${attackerName} stole 1 card from ${victimName}!`
            : `🥷 ${attackerName} roubou 1 carta de ${victimName}!`,
      };
    }
  }

  let turnHandoff: TurnHandoffFX | null = null;
  if (prevState && !nextState.winning_color) {
    const colorMeta = getPlayerColorMeta(lang);
    const prevWasSub =
      prevState.current_prompt === "DISCARD" ||
      prevState.current_prompt === "DECIDE_TRADE" ||
      prevState.current_prompt === "DECIDE_ACCEPTEES";
    const nextIsSub =
      nextState.current_prompt === "DISCARD" ||
      nextState.current_prompt === "DECIDE_TRADE" ||
      nextState.current_prompt === "DECIDE_ACCEPTEES";
    if (!prevWasSub && !nextIsSub && prevState.current_color !== nextState.current_color) {
      const nextColor = nextState.current_color;
      const activeHumans = nextState.colors.filter(
        (c) => !nextState.bot_colors.includes(c)
      );
      const isLocal =
        !nextState.bot_colors.includes(nextColor) &&
        (mySeatColor !== null
          ? nextColor === mySeatColor
          : activeHumans.length === 1);
      const name = resolvePlayerDisplayName(
        nextState,
        nextColor,
        colorMeta[nextColor]?.label || nextColor
      );
      turnHandoff = {
        color: nextColor,
        name,
        isLocal,
      };
    }
  }

  return {
    newRecords,
    discards,
    yields,
    vpDeltas,
    robberEvent,
    turnHandoff,
  };
}

/** Stable variation keeps re-renders from restarting a bot's thinking deadline. */
export function getBotThinkDelayMs(stateIndex: number, speed: GameSpeed): number {
  return speed === "slow" ? 3200 + (stateIndex % 5) * 650 : 0;
}
