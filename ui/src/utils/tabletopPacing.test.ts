import { afterEach, describe, expect, test } from "vitest";
import {
  INTRO_SPLASH_MS,
  TURN_TRANSITION_MS,
  cycleGameSpeed,
  electBotCoordinator,
  extractBatchTransitionFX,
  extractTransitionVisuals,
  getActionDelayMs,
  getDiceOverlayDurationMs,
  getRollSpinDurationMs,
  getSavedGameSpeed,
  saveGameSpeed,
} from "./tabletopPacing";
import { makeGameState } from "../test/fixtures";

afterEach(() => {
  localStorage.clear();
});

describe("tabletopPacing", () => {
  test("persists normal (4x slower default), fast (Rápida), and turbo speeds and extended 10s intro, 3s turn banner, and 2x timings", () => {
    expect(INTRO_SPLASH_MS).toBe(10000);
    expect(TURN_TRANSITION_MS).toBe(3000);
    expect(getSavedGameSpeed()).toBe("normal");
    expect(getActionDelayMs([["RED", "ROLL", null], [3, 5]], "normal")).toBe(14400);
    expect(getRollSpinDurationMs("normal")).toBe(3300);
    expect(getDiceOverlayDurationMs("normal")).toBe(8400);
    expect(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "normal")).toBe(9600);
    expect(getActionDelayMs([["RED", "END_TURN", null], null], "normal")).toBe(5200);
    expect(getActionDelayMs([["RED", "DISCARD_RESOURCE", "WOOD"], "WOOD"], "normal")).toBe(3200);

    saveGameSpeed("fast");
    expect(getSavedGameSpeed()).toBe("fast");
    expect(getActionDelayMs([["RED", "ROLL", null], [3, 5]], "fast")).toBe(3600);
    expect(getRollSpinDurationMs("fast")).toBe(1700);
    expect(getDiceOverlayDurationMs("fast")).toBe(4800);
    expect(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "fast")).toBe(2400);

    saveGameSpeed("turbo");
    expect(getSavedGameSpeed()).toBe("turbo");
    expect(getActionDelayMs([["RED", "ROLL", null], [3, 5]], "turbo")).toBe(1800);
    expect(getRollSpinDurationMs("turbo")).toBe(840);
    expect(getDiceOverlayDurationMs("turbo")).toBe(2500);
    expect(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "turbo")).toBe(1200);

    expect(cycleGameSpeed("normal")).toBe("fast");
    expect(cycleGameSpeed("fast")).toBe("turbo");
    expect(cycleGameSpeed("turbo")).toBe("slow");
    expect(cycleGameSpeed("slow")).toBe("normal");
    saveGameSpeed("slow");
    expect(getSavedGameSpeed()).toBe("slow");
    expect(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "slow")).toBeGreaterThan(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "normal"));

    expect(
      getActionDelayMs([["RED", "OFFER_TRADE", [1,0,0,0,0,0,1,0,0,0]], null], "normal", {
        requiresLocalHumanPrompt: true,
      })
    ).toBeLessThanOrEqual(500);
  });

  test("extracts canonical recent node, edge, dev card and roll metadata", () => {
    expect(
      extractTransitionVisuals([["BLUE", "BUILD_ROAD", [9, 3]], null])
    ).toMatchObject({
      recentNodeId: null,
      recentEdgeId: "3,9",
      boughtDevColor: null,
    });
    expect(
      extractTransitionVisuals([["RED", "BUILD_CITY", 14], null])
    ).toMatchObject({
      recentNodeId: 14,
      recentEdgeId: null,
    });
    expect(
      extractTransitionVisuals([["ORANGE", "BUY_DEVELOPMENT_CARD", null], "KNIGHT"])
    ).toMatchObject({
      boughtDevColor: "ORANGE",
    });
    expect(
      extractTransitionVisuals([["RED", "ROLL", null], [2, 6]])
    ).toMatchObject({
      rollDice: [2, 6],
      rollColor: "RED",
    });
  });

  test("elects only first active non-bot human seat as multiplayer bot coordinator", () => {
    const mpState = makeGameState({
      room_code: "ROOM42",
      colors: ["RED", "BLUE", "ORANGE"],
      bot_colors: ["RED"],
    });
    expect(electBotCoordinator(mpState, "BLUE")).toBe(true);
    expect(electBotCoordinator(mpState, "ORANGE")).toBe(false);
    expect(electBotCoordinator(mpState, null)).toBe(false);

    const soloState = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["RED"],
    });
    expect(electBotCoordinator(soloState, "BLUE")).toBe(true);
    expect(electBotCoordinator(soloState, null)).toBe(true);
  });

  test("extracts discards, public non-robbed roll yields, VP deltas, robber event, and turn handoff", () => {
    const prev = makeGameState({
      state_index: 10,
      current_color: "RED",
      current_prompt: "PLAY_TURN",
      robber_coordinate: [2, -2, 0],
      seat_names: { RED: "Jaó", BLUE: "João" },
      action_records: [],
      player_state: {
        ...makeGameState().player_state,
        P0_ACTUAL_VICTORY_POINTS: 2,
        P1_ACTUAL_VICTORY_POINTS: 2,
      },
    });
    const next = makeGameState({
      state_index: 14,
      current_color: "BLUE",
      current_prompt: "PLAY_TURN",
      robber_coordinate: [2, -2, 0],
      seat_names: { RED: "Jaó", BLUE: "João" },
      action_records: [
        [["RED", "ROLL", null], [5, 6]],
        [["RED", "DISCARD_RESOURCE", "BRICK"], "BRICK"],
        [["RED", "DISCARD_RESOURCE", "WOOD"], "WOOD"],
        [["RED", "END_TURN", null], null],
      ] as any,
      player_state: {
        ...makeGameState().player_state,
        P0_ACTUAL_VICTORY_POINTS: 3,
        P1_ACTUAL_VICTORY_POINTS: 2,
      },
    });

    const fx = extractBatchTransitionFX(prev, next, "BLUE");
    expect(fx.discards).toEqual([
      { color: "RED", resource: "BRICK" },
      { color: "RED", resource: "WOOD" },
    ]);
    expect(fx.yields).toEqual([
      { color: "RED", resource: "WHEAT", amount: 1 },
    ]);
    expect(fx.vpDeltas).toEqual([{ color: "RED", delta: 1 }]);
    expect(fx.turnHandoff).toEqual({
      color: "BLUE",
      name: "João",
      isLocal: true,
    });

    const robberNext = makeGameState({
      state_index: 15,
      current_color: "RED",
      current_prompt: "PLAY_TURN",
      seat_names: { RED: "Creitu", BLUE: "João" },
      action_records: [
        ...next.action_records,
        [["RED", "MOVE_ROBBER", [[0, 0, 0], "WHITE"]], null],
      ] as any,
    });
    const robFx = extractBatchTransitionFX(next, robberNext, "BLUE");
    expect(robFx.robberEvent?.tone).toBe("safe");
    expect(robFx.robberEvent?.message).toMatch(/Você não foi roubado!/i);
  });
});
