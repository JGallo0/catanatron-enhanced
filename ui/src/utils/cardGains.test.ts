import { expect, test } from "vitest";
import { makeGameState } from "../test/fixtures";
import { getCardGains } from "./cardGains";
import { countPlayerResources } from "./stateUtils";

test("queues each gained card separately, including development, without counting spent resources", () => {
  const before = makeGameState();
  const after = makeGameState({ state_index: before.state_index + 1, player_state: { ...before.player_state,
    P1_WOOD_IN_HAND: 1, P1_SHEEP_IN_HAND: 2, P1_KNIGHT_IN_HAND: 1 } });
  expect(getCardGains(before, after, "BLUE")).toEqual(["SHEEP", "SHEEP", "KNIGHT"]);
  expect(getCardGains(null, after, "BLUE")).toEqual([]);
  expect(getCardGains(after, after, "BLUE")).toEqual([]);
  expect(getCardGains(after, before, "BLUE")).toEqual([]);
  expect(getCardGains(before, after, "RED")).toEqual([]);
});

test("counts a visible hand without a summary and preserves public totals for hidden hands", () => {
  const state = makeGameState();
  expect(countPlayerResources(state, "BLUE")).toBe(2);
  state.player_state = { P0_NUM_RESOURCES_IN_HAND: 9, P0_NUM_DEVELOPMENT_CARDS_IN_HAND: 3 };
  expect(countPlayerResources(state, "RED")).toBe(9);
  expect(getCardGains(makeGameState(), state, "RED")).toEqual([]);
});
