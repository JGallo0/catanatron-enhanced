import { afterEach, describe, expect, test } from "vitest";
import {
  electBotCoordinator,
  extractTransitionVisuals,
  getActionDelayMs,
  getRollSpinDurationMs,
  getSavedGameSpeed,
  saveGameSpeed,
} from "./tabletopPacing";
import { makeGameState } from "../test/fixtures";

afterEach(() => {
  localStorage.clear();
});

describe("tabletopPacing", () => {
  test("persists normal (default) and fast (0.5x) speed multipliers", () => {
    expect(getSavedGameSpeed()).toBe("normal");
    expect(getActionDelayMs([["RED", "ROLL", null], [3, 5]], "normal")).toBe(1800);
    expect(getRollSpinDurationMs("normal")).toBe(550);

    saveGameSpeed("fast");
    expect(getSavedGameSpeed()).toBe("fast");
    expect(getActionDelayMs([["RED", "ROLL", null], [3, 5]], "fast")).toBe(900);
    expect(getRollSpinDurationMs("fast")).toBe(275);
    expect(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "normal")).toBe(1200);
    expect(getActionDelayMs([["RED", "BUILD_SETTLEMENT", 4], null], "fast")).toBe(600);
    expect(getActionDelayMs([["RED", "END_TURN", null], null], "normal")).toBe(650);
    expect(getActionDelayMs([["RED", "DISCARD_RESOURCE", "WOOD"], "WOOD"], "normal")).toBe(400);
    expect(
      getActionDelayMs([["RED", "OFFER_TRADE", [1,0,0,0,0,0,1,0,0,0]], null], "normal", {
        requiresLocalHumanPrompt: true,
      })
    ).toBeLessThanOrEqual(400);
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
});
