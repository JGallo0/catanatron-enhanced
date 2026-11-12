import { afterEach, describe, expect, test, vi } from "vitest";
import type { Color, GameState, ResourceCard } from "./api.types";
import {
  localCreateGame,
  localGetState,
  localPostAction,
} from "./localEngine";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const RESOURCE_ORDER: ResourceCard[] = ["WOOD", "BRICK", "SHEEP", "WHEAT", "ORE"];

function getHandArray(state: GameState, color: Color): number[] {
  const idx = state.colors.indexOf(color);
  const k = `P${idx}`;
  return RESOURCE_ORDER.map((r) => state.player_state[`${k}_${r}_IN_HAND`] ?? 0);
}

function getHandTotal(state: GameState, color: Color): number {
  return getHandArray(state, color).reduce((a, b) => a + b, 0);
}

function advanceInitialPhase(gameId: string): GameState {
  let state = localGetState(gameId);
  while (state.is_initial_build_phase) {
    state = state.bot_colors.includes(state.current_color)
      ? localPostAction(gameId)
      : localPostAction(gameId, state.current_playable_actions[0]);
  }
  return state;
}

function mutateRawGame(
  gameId: string,
  mutator: (entry: any, state: GameState) => void
): GameState {
  const raw = JSON.parse(localStorage.getItem("catan_local_games_v1") || "{}");
  const entry = raw[gameId];
  mutator(entry, entry.state);
  localStorage.setItem("catan_local_games_v1", JSON.stringify(raw));
  return localGetState(gameId);
}

function setHand(
  state: GameState,
  color: Color,
  counts: [number, number, number, number, number]
) {
  const idx = state.colors.indexOf(color);
  const k = `P${idx}`;
  RESOURCE_ORDER.forEach((res, i) => {
    state.player_state[`${k}_${res}_IN_HAND`] = counts[i];
  });
  state.player_state[`${k}_NUM_RESOURCES_IN_HAND`] = counts.reduce(
    (a, b) => a + b,
    0
  );
}

describe("localEngine 7-roll discard, 25-card dev deck, road building & anti-hoarding", () => {
  test("initializes full 25-card development_listdeck and decrements with same-turn lock", () => {
    const gameId = localCreateGame({
      players: ["HUMAN", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });

    const initial = localGetState(gameId);
    expect(initial.development_listdeck).toEqual({
      KNIGHT: 14,
      YEAR_OF_PLENTY: 2,
      ROAD_BUILDING: 2,
      MONOPOLY: 2,
      VICTORY_POINT: 5,
    });
    const deckSum = Object.values(initial.development_listdeck || {}).reduce(
      (a, b) => a + b,
      0
    );
    expect(deckSum).toBe(25);

    let state = advanceInitialPhase(gameId);
    while (state.current_color !== "RED") {
      state = localPostAction(gameId);
    }

    // Roll non-7 so RED is post-roll PLAY_TURN
    vi.spyOn(Math, "random").mockReturnValue(0.3); // d1=2, d2=2 -> sum=4
    state = localPostAction(gameId, ["RED", "ROLL", null]);
    expect(state.current_prompt).toBe("PLAY_TURN");

    // Give RED enough to buy a dev card
    state = mutateRawGame(gameId, (_entry, st) => {
      setHand(st, "RED", [0, 0, 1, 1, 1]);
    });
    // Refresh playable actions via an invalid-free non-mutating check? Re-enter PLAY_TURN by applying a harmless turn check:
    // Actually trigger recompute by forcing knight draw or setting RED post-roll:
    state = mutateRawGame(gameId, (_entry, st) => {
      const k = `P${st.colors.indexOf("RED")}`;
      st.player_state[`${k}_HAS_ROLLED`] = false;
      st.current_playable_actions = [["RED", "ROLL", null]];
    });
    state = localPostAction(gameId, ["RED", "ROLL", null]);
    const beforeDeck = Object.values(state.development_listdeck || {}).reduce(
      (a, b) => a + b,
      0
    );
    const sheepBankBefore = state.resource_freqdeck?.[2] ?? 19;

    // Mock Math.random -> 0 picks KNIGHT (non-VP card) from development_listdeck
    vi.spyOn(Math, "random").mockReturnValue(0);
    state = localPostAction(gameId, ["RED", "BUY_DEVELOPMENT_CARD", null]);

    const afterDeck = Object.values(state.development_listdeck || {}).reduce(
      (a, b) => a + b,
      0
    );
    expect(afterDeck).toBe(beforeDeck - 1);
    expect(state.resource_freqdeck?.[2]).toBe(sheepBankBefore + 1);
    // Bought KNIGHT cannot be played in the same turn
    expect(
      state.current_playable_actions.some((a) => a[1] === "PLAY_KNIGHT_CARD")
    ).toBe(false);
  });

  test("triggers DISCARD phase on rolling 7 (human + bots), respects discardLimit, and enforces friendly_robber", () => {
    const gameId = localCreateGame({
      players: ["HUMAN", "CATANATRON", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });

    let state = advanceInitialPhase(gameId);
    // Force RED turn pre-roll with RED=9 cards, BLUE=10 cards, ORANGE=4 cards (<3 VP)
    // and push BLUE to 3 VPs so friendly_robber allows robbing BLUE while protecting ORANGE.
    state = mutateRawGame(gameId, (entry, st) => {
      const redIdx = st.colors.indexOf("RED");
      const blueIdx = st.colors.indexOf("BLUE");
      st.current_turn_index = redIdx;
      st.current_player_index = redIdx;
      st.current_color = "RED";
      st.current_prompt = "PLAY_TURN";
      st.player_state[`P${redIdx}_HAS_ROLLED`] = false;
      st.player_state[`P${blueIdx}_VICTORY_POINT_IN_HAND`] = 1;
      setHand(st, "RED", [3, 2, 2, 1, 1]); // 9 cards > 7 -> discard 4
      setHand(st, "BLUE", [4, 2, 2, 1, 1]); // 10 cards > 7 -> discard 5
      setHand(st, "ORANGE", [1, 1, 1, 1, 0]); // 4 cards <= 7, 2 VPs
      entry.discardCounts = st.colors.map(() => 0);
      st.current_playable_actions = [["RED", "ROLL", null]];
    });

    const discardOrder = state.colors.filter(
      (c): c is "RED" | "BLUE" => c === "RED" || c === "BLUE"
    );

    // Mock dice to 3 + 4 = 7 (floor(0.4*6)+1=3, floor(0.55*6)+1=4)
    const randSpy = vi.spyOn(Math, "random");
    randSpy.mockReturnValueOnce(0.4).mockReturnValueOnce(0.55);

    state = localPostAction(gameId, ["RED", "ROLL", null]);
    expect(state.current_prompt).toBe("DISCARD");
    for (const c of discardOrder) {
      expect(state.current_color).toBe(c);
      const expectedDiscard = c === "RED" ? 4 : 5;
      expect(state.current_discard_count).toBe(expectedDiscard);
      expect(
        state.current_playable_actions.every((a) => a[1] === "DISCARD_RESOURCE")
      ).toBe(true);
      for (let i = 0; i < expectedDiscard; i++) {
        state =
          c === "RED"
            ? localPostAction(gameId, state.current_playable_actions[0])
            : localPostAction(gameId);
      }
      expect(getHandTotal(state, c)).toBe(c === "RED" ? 5 : 5);
    }

    expect(state.current_prompt).toBe("MOVE_ROBBER");
    expect(state.current_color).toBe("RED");
    expect(state.current_discard_count).toBe(0);

    // friendly_robber should prevent targeting ORANGE (who has 2 VPs) if any friendly alternative exists
    const robberActions = state.current_playable_actions.filter(
      (a) => a[1] === "MOVE_ROBBER"
    );
    expect(robberActions.length).toBeGreaterThan(0);
    const blueActions = robberActions.filter((a) => a[2][1] === "BLUE");
    expect(blueActions.length).toBeGreaterThan(0);
    // Find hexes where ORANGE is settled
    const orangeNodeIds = new Set(
      Object.values(state.nodes)
        .filter((n) => n.color === "ORANGE")
        .map((n) => n.id)
    );
    const orangeTileIds = new Set<number>();
    for (const nid of orangeNodeIds) {
      for (const t of state.adjacent_tiles[String(nid)] || []) {
        if ("id" in t) orangeTileIds.add(t.id);
      }
    }
    const movesHittingOrange = robberActions.filter((a) => {
      const tile = state.tiles.find(
        (pt) =>
          pt.coordinate[0] === a[2][0][0] &&
          pt.coordinate[1] === a[2][0][1] &&
          pt.coordinate[2] === a[2][0][2]
      );
      return tile && "id" in tile.tile && orangeTileIds.has(tile.tile.id);
    });
    expect(movesHittingOrange).toHaveLength(0);
  });

  test("PLAY_ROAD_BUILDING grants 2 free roads without deducting Wood/Brick", () => {
    const gameId = localCreateGame({
      players: ["HUMAN", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: false,
    });

    let state = advanceInitialPhase(gameId);
    state = mutateRawGame(gameId, (_entry, st) => {
      const redIdx = st.colors.indexOf("RED");
      st.current_turn_index = redIdx;
      st.current_player_index = redIdx;
      st.current_color = "RED";
      st.current_prompt = "PLAY_TURN";
      st.player_state[`P${redIdx}_HAS_ROLLED`] = true;
      st.player_state[`P${redIdx}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`] = false;
      st.player_state[`P${redIdx}_ROAD_BUILDING_IN_HAND`] = 1;
      st.player_state[`P${redIdx}_ROAD_BUILDING_BOUGHT_THIS_TURN`] = 0;
      setHand(st, "RED", [0, 0, 0, 0, 0]);
      st.current_playable_actions = [
        ["RED", "END_TURN", null],
        ["RED", "PLAY_ROAD_BUILDING", null],
      ];
    });

    const roadsBefore = state.edges.filter((e) => e.color === "RED").length;
    state = localPostAction(gameId, ["RED", "PLAY_ROAD_BUILDING", null]);
    expect(state.is_road_building).toBe(true);
    expect(
      state.current_playable_actions.every((a) => a[1] === "BUILD_ROAD")
    ).toBe(true);

    // Build first free road
    state = localPostAction(gameId, state.current_playable_actions[0]);
    expect(state.is_road_building).toBe(true);
    // Build second free road
    state = localPostAction(gameId, state.current_playable_actions[0]);
    expect(state.is_road_building).toBe(false);
    expect(state.edges.filter((e) => e.color === "RED").length).toBe(
      roadsBefore + 2
    );
    expect(getHandTotal(state, "RED")).toBe(0);
    expect(
      state.current_playable_actions.some((a) => a[1] === "END_TURN")
    ).toBe(true);
  });

  test("anti-hoarding: offline bot with 19 cards builds/buys/trades down to <= discardLimit instead of passing turn", () => {
    const scenarios: [number, number, number, number, number][] = [
      [7, 4, 4, 2, 2], // 19 cards mixed (roads, settlements, dev, maritime)
      [8, 0, 6, 0, 5], // 19 cards with zero brick/wheat (must maritime trade & buy/build)
    ];

    for (const startHand of scenarios) {
      localStorage.clear();
      const gameId = localCreateGame({
        players: ["HUMAN", "CATANATRON", "CATANATRON", "CATANATRON"],
        mapTemplate: "BASE",
        vpsToWin: 10,
        discardLimit: 7,
        friendlyRobber: true,
      });

      let state = advanceInitialPhase(gameId);
      const targetBot: Color = "ORANGE";

      // Advance cleanly or force post-roll PLAY_TURN on ORANGE with 19 cards in hand
      state = mutateRawGame(gameId, (entry, st) => {
        const idx = st.colors.indexOf(targetBot);
        st.current_turn_index = idx;
        st.current_player_index = idx;
        st.current_color = targetBot;
        st.current_prompt = "PLAY_TURN";
        st.player_state[`P${idx}_HAS_ROLLED`] = false;
        setHand(st, targetBot, startHand);
        entry.tradesThisTurn = 0;
        st.current_playable_actions = [[targetBot, "ROLL", null]];
      });

      // Roll non-7 so ORANGE keeps all 19 cards and enters post-roll decision loop
      vi.spyOn(Math, "random").mockReturnValue(0.0); // 1+1 = 2
      state = localPostAction(gameId, [targetBot, "ROLL", null]);
      vi.restoreAllMocks();
      expect(getHandTotal(state, targetBot)).toBeGreaterThanOrEqual(19);

      let steps = 0;
      while (state.current_color === targetBot && !state.winning_color && steps < 25) {
        steps += 1;
        state = localPostAction(gameId);
      }

      expect(steps).toBeLessThan(25);
      // After finishing its turn, ORANGE must not end turn hoarding 19 cards!
      expect(getHandTotal(state, targetBot)).toBeLessThanOrEqual(7);
    }
  });

  test("4-bot offline full games finish without stalling and keep end-of-turn hands bounded", () => {
    let maxEndTurnHand = 0;
    let endTurnsOver10 = 0;

    for (let gIdx = 0; gIdx < 3; gIdx++) {
      localStorage.clear();
      const gameId = localCreateGame({
        players: ["CATANATRON", "CATANATRON", "CATANATRON", "CATANATRON"],
        mapTemplate: "BASE",
        vpsToWin: 8,
        discardLimit: 7,
        friendlyRobber: true,
      });

      let state = localGetState(gameId);
      let steps = 0;
      while (!state.winning_color && steps < 1800) {
        steps += 1;
        const actingColor = state.current_color;
        const prevLen = state.action_records.length;
        state = localPostAction(gameId);
        const lastRec = state.action_records[state.action_records.length - 1];
        if (
          state.action_records.length > prevLen &&
          lastRec?.[0]?.[1] === "END_TURN"
        ) {
          const cardsLeft = getHandTotal(state, actingColor);
          if (cardsLeft > maxEndTurnHand) maxEndTurnHand = cardsLeft;
          if (cardsLeft >= 10) endTurnsOver10 += 1;
        }
      }

      expect(state.winning_color).not.toBeNull();
    }

    expect(endTurnsOver10).toBe(0);
    expect(maxEndTurnHand).toBeLessThanOrEqual(9);
  }, 15000);
});
