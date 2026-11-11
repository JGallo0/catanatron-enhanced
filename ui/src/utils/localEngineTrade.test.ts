import { afterEach, describe, expect, test } from "vitest";
import {
  localCreateGame,
  localGetState,
  localPostAction,
} from "./localEngine";
import type { Color, GameState } from "./api.types";

afterEach(() => {
  localStorage.clear();
});

function setHandsInLocalGame(
  gameId: string,
  hands: Partial<Record<Color, [number, number, number, number, number]>>
): GameState {
  const raw = JSON.parse(localStorage.getItem("catan_local_games_v1") || "{}");
  const entry = raw[gameId];
  const st: GameState = entry.state;
  for (const [col, counts] of Object.entries(hands)) {
    const idx = st.colors.indexOf(col as Color);
    const k = `P${idx}`;
    const [wood, brick, sheep, wheat, ore] = counts!;
    st.player_state[`${k}_WOOD_IN_HAND`] = wood;
    st.player_state[`${k}_BRICK_IN_HAND`] = brick;
    st.player_state[`${k}_SHEEP_IN_HAND`] = sheep;
    st.player_state[`${k}_WHEAT_IN_HAND`] = wheat;
    st.player_state[`${k}_ORE_IN_HAND`] = ore;
    st.player_state[`${k}_NUM_RESOURCES_IN_HAND`] =
      wood + brick + sheep + wheat + ore;
  }
  localStorage.setItem("catan_local_games_v1", JSON.stringify(raw));
  return localGetState(gameId);
}

function advanceToPostRollHumanTurn(gameId: string): GameState {
  let state = localGetState(gameId);
  while (state.is_initial_build_phase) {
    state = localPostAction(gameId, state.current_playable_actions[0]);
  }
  // Ensure BLUE (index 1 human or RED index 0) is active and post-roll
  if (state.current_prompt === "PLAY_TURN") {
    const k = `P${state.colors.indexOf(state.current_color)}`;
    if (!state.player_state[`${k}_HAS_ROLLED`]) {
      state = localPostAction(gameId, [state.current_color, "ROLL", null]);
    }
    if (state.current_prompt === "MOVE_ROBBER") {
      state = localPostAction(gameId, state.current_playable_actions[0]);
    }
  }
  return state;
}

describe("localEngine domestic P2P trade", () => {
  test("completes 3-step domestic trade roundtrip against smart offline bot", () => {
    const gameId = localCreateGame({
      players: ["HUMAN", "CATANATRON", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });

    let state = advanceToPostRollHumanTurn(gameId);
    expect(state.current_color).toBe("RED");
    expect(state.current_prompt).toBe("PLAY_TURN");

    // RED offers 1 Wheat and asks 1 Brick.
    // BLUE holds [1 Wood, 2 Brick, 1 Sheep, 0 Wheat, 0 Ore] -> gaining Wheat unlocks Settlement!
    // ORANGE holds [0, 0, 0, 0, 2] -> lacks Brick, can only REJECT_TRADE.
    state = setHandsInLocalGame(gameId, {
      RED: [1, 0, 1, 2, 0],
      BLUE: [1, 2, 1, 0, 0],
      ORANGE: [0, 0, 0, 0, 2],
    });

    // Reject overlapping resource offer
    expect(() =>
      localPostAction(gameId, [
        "RED",
        "OFFER_TRADE",
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
      ])
    ).toThrow();

    // Valid offer
    state = localPostAction(gameId, [
      "RED",
      "OFFER_TRADE",
      [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    ]);
    expect(state.is_resolving_trade).toBe(true);
    expect(state.current_prompt).toBe("DECIDE_TRADE");
    expect(state.current_color).toBe("BLUE");

    // BLUE bot evaluates and accepts!
    state = localPostAction(gameId);
    expect(state.current_prompt).toBe("DECIDE_TRADE");
    expect(state.current_color).toBe("ORANGE");

    // ORANGE bot lacks Brick -> rejects!
    state = localPostAction(gameId);
    expect(state.current_prompt).toBe("DECIDE_ACCEPTEES");
    expect(state.current_color).toBe("RED");
    expect(state.acceptees).toEqual([false, true, false]);

    // Human confirms trade with BLUE
    const confirmAction = state.current_playable_actions.find(
      (a) => a[1] === "CONFIRM_TRADE" && a[2][10] === "BLUE"
    );
    expect(confirmAction).toBeDefined();

    state = localPostAction(gameId, confirmAction);
    expect(state.is_resolving_trade).toBe(false);
    expect(state.current_prompt).toBe("PLAY_TURN");
    expect(state.player_state.P0_BRICK_IN_HAND).toBe(1);
    expect(state.player_state.P0_WHEAT_IN_HAND).toBe(1);
    expect(state.player_state.P1_BRICK_IN_HAND).toBe(1);
    expect(state.player_state.P1_WHEAT_IN_HAND).toBe(1);
  });

  test("smart offline bot rejects unfavorable giveaway offer and resumes PLAY_TURN", () => {
    const gameId = localCreateGame({
      players: ["HUMAN", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });

    let state = advanceToPostRollHumanTurn(gameId);
    // Bot BLUE has [1,1,1,1,3] (City+Settlement ready), scam offer asks 1 Wheat + 2 Ore for 1 Wood!
    state = setHandsInLocalGame(gameId, {
      RED: [2, 0, 0, 0, 0],
      BLUE: [1, 1, 1, 1, 3],
    });

    state = localPostAction(gameId, [
      "RED",
      "OFFER_TRADE",
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 2],
    ]);
    expect(state.current_prompt).toBe("DECIDE_TRADE");

    // Bot BLUE evaluates and rejects!
    state = localPostAction(gameId);
    expect(state.is_resolving_trade).toBe(false);
    expect(state.current_prompt).toBe("PLAY_TURN");
    expect(state.current_color).toBe("RED");
    expect(state.player_state.P1_ORE_IN_HAND).toBe(3);
  });
});
