import { afterEach, describe, expect, test } from "vitest";
import type { GameAction, GameState } from "./api.types";
import {
  localCreateGame,
  localGetState,
  localPostAction,
} from "./localEngine";

afterEach(() => {
  localStorage.clear();
});

function chooseSimulatedHumanAction(state: GameState): GameAction {
  const playable = state.current_playable_actions;
  // Greedy priority for simulated human: Cities > Settlements > Buy Dev > Road > Robber > Discard > Roll > End Turn
  const city = playable.find((a) => a[1] === "BUILD_CITY");
  if (city) return city;
  const settlement = playable.find((a) => a[1] === "BUILD_SETTLEMENT");
  if (settlement) return settlement;
  const buyDev = playable.find((a) => a[1] === "BUY_DEVELOPMENT_CARD");
  if (buyDev && Math.random() < 0.6) return buyDev;
  const road = playable.find((a) => a[1] === "BUILD_ROAD");
  if (road && Math.random() < 0.7) return road;
  const moveRobber = playable.find((a) => a[1] === "MOVE_ROBBER");
  if (moveRobber) return moveRobber;
  const discard = playable.find((a) => a[1] === "DISCARD_RESOURCE");
  if (discard) return discard;
  const roll = playable.find((a) => a[1] === "ROLL");
  if (roll) return roll;
  const endTurn = playable.find((a) => a[1] === "END_TURN");
  if (endTurn) return endTurn;
  return playable[0];
}

function runSimulatedMatch(
  config: {
    players: string[];
    mapTemplate?: "BASE" | "MINI" | "TOURNAMENT";
    vpsToWin?: number;
    discardLimit?: number;
    friendlyRobber?: boolean;
    diceMode?: "balanced" | "random";
  },
  maxSteps = 2000
) {
  const gameId = localCreateGame({
    players: config.players,
    mapTemplate: config.mapTemplate ?? "BASE",
    vpsToWin: config.vpsToWin ?? 10,
    discardLimit: config.discardLimit ?? 7,
    friendlyRobber: config.friendlyRobber ?? true,
    diceMode: config.diceMode ?? "balanced",
  });

  let state = localGetState(gameId);
  let step = 0;

  while (!state.winning_color && step < maxSteps) {
    step++;
    const currentColor = state.current_color;
    const isBot = state.bot_colors.includes(currentColor);
    const playable = state.current_playable_actions || [];

    if (playable.length === 0) {
      throw new Error(
        `DEADLOCK: 0 playable actions at step ${step} for ${currentColor}, prompt=${state.current_prompt}`
      );
    }

    if (isBot) {
      state = localPostAction(gameId, undefined, { botOnly: true });
    } else {
      const act = chooseSimulatedHumanAction(state);
      state = localPostAction(gameId, act);
    }
  }

  if (!state.winning_color) {
    throw new Error(
      `STALL: Match did not conclude within ${maxSteps} steps. VPs: ${state.colors.map(
        (c, i) => `${c}=${state.player_state?.[`P${i}_VICTORY_POINTS`]}`
      ).join(", ")}`
    );
  }

  const vpsToWin = config.vpsToWin ?? 10;
  const winIdx = state.colors.indexOf(state.winning_color);
  const actualVp = state.player_state?.[`P${winIdx}_ACTUAL_VICTORY_POINTS`] ?? state.player_state?.[`P${winIdx}_VICTORY_POINTS`] ?? 0;
  expect(actualVp).toBeGreaterThanOrEqual(vpsToWin);

  return {
    gameId,
    steps: step,
    winner: state.winning_color,
    winnerVp: actualVp,
    turnIndex: state.current_turn_index,
  };
}

describe("Real match simulations and AI gameplay / stall stress tests", () => {
  test("simulates 4 competitive CATANATRON bots on Base Map (balanced dice) to completion", () => {
    for (let i = 0; i < 5; i++) {
      const res = runSimulatedMatch({
        players: ["CATANATRON", "CATANATRON", "CATANATRON", "CATANATRON"],
        mapTemplate: "BASE",
        diceMode: "balanced",
        vpsToWin: 10,
      });
      expect(res.winner).toBeDefined();
      expect(res.steps).toBeLessThan(1500);
      expect(res.winnerVp).toBeGreaterThanOrEqual(10);
    }
  }, 60000);

  test("simulates 4 mixed bots (CATANATRON, F, MCTS, RANDOM) on Base Map to completion", () => {
    for (let i = 0; i < 5; i++) {
      const res = runSimulatedMatch({
        players: ["CATANATRON", "F", "MCTS", "RANDOM"],
        mapTemplate: "BASE",
        diceMode: "balanced",
        vpsToWin: 10,
      });
      expect(res.winner).toBeDefined();
      expect(res.steps).toBeLessThan(1500);
    }
  }, 60000);

  test("simulates 1 Human + 3 Bots (CATANATRON, VP, W) on Base Map to completion", () => {
    for (let i = 0; i < 5; i++) {
      const res = runSimulatedMatch({
        players: ["HUMAN", "CATANATRON", "VP", "W"],
        mapTemplate: "BASE",
        diceMode: "balanced",
        vpsToWin: 10,
      });
      expect(res.winner).toBeDefined();
      expect(res.steps).toBeLessThan(1500);
    }
  }, 60000);

  test("simulates fast game on Mini Map with 8 VPs to win and random dice", () => {
    for (let i = 0; i < 5; i++) {
      const res = runSimulatedMatch({
        players: ["CATANATRON", "CATANATRON", "CATANATRON", "CATANATRON"],
        mapTemplate: "MINI",
        vpsToWin: 8,
        diceMode: "random",
      });
      expect(res.winner).toBeDefined();
      expect(res.steps).toBeLessThan(2000);
    }
  }, 60000);

  test("simulates Tournament Map without friendly robber to completion", () => {
    for (let i = 0; i < 5; i++) {
      const res = runSimulatedMatch({
        players: ["CATANATRON", "F", "CATANATRON", "F"],
        mapTemplate: "TOURNAMENT",
        friendlyRobber: false,
        diceMode: "random",
        vpsToWin: 10,
      });
      expect(res.winner).toBeDefined();
      expect(res.steps).toBeLessThan(1500);
    }
  }, 60000);
});
