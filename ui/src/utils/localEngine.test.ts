import { afterEach, describe, expect, test } from "vitest";
import type { GameEdge } from "./api.types";
import {
  localCreateGame,
  localCreateRoom,
  localGetGameMessages,
  localGetState,
  localPostAction,
  localPostGameMessage,
  localStartRoomGame,
  localUpdateRoom,
} from "./localEngine";

afterEach(() => {
  localStorage.clear();
});

function buildConnectedChain(
  edges: GameEdge[],
  color: "RED" | "BLUE",
  targetLen: number,
  forbiddenNodes: Set<number>
): number[] {
  const unowned = edges.filter((e) => e.color === null);
  for (const seed of unowned) {
    if (forbiddenNodes.has(seed.id[0]) || forbiddenNodes.has(seed.id[1])) {
      continue;
    }
    const chosen: GameEdge[] = [seed];
    const usedNodes = new Set<number>([seed.id[0], seed.id[1]]);
    let tip = seed.id[1];
    while (chosen.length < targetLen) {
      const nextEdge = unowned.find((e) => {
        if (chosen.includes(e)) return false;
        const [u, v] = e.id;
        if (u === tip && !usedNodes.has(v) && !forbiddenNodes.has(v)) return true;
        if (v === tip && !usedNodes.has(u) && !forbiddenNodes.has(u)) return true;
        return false;
      });
      if (!nextEdge) break;
      chosen.push(nextEdge);
      const nextNode = nextEdge.id[0] === tip ? nextEdge.id[1] : nextEdge.id[0];
      usedNodes.add(nextNode);
      tip = nextNode;
    }
    if (chosen.length === targetLen) {
      chosen.forEach((e) => {
        e.color = color;
      });
      return Array.from(usedNodes);
    }
  }
  throw new Error(`Could not find connected chain of length ${targetLen}`);
}

describe("localEngine chat messages and longest road star ownership", () => {
  test("persists local chat messages and supports afterId incremental reads", () => {
    const gameId = localCreateGame({
      players: ["HUMAN", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
      hostName: "Mariana",
    });

    expect(() =>
      localPostGameMessage(gameId, { color: "RED", body: "   " })
    ).toThrow(/vazia/i);
    expect(() =>
      localPostGameMessage(gameId, { color: "RED", body: "x".repeat(241) })
    ).toThrow(/longa/i);

    const m1 = localPostGameMessage(gameId, {
      color: "RED",
      body: "Boa sorte a todos!",
    });
    expect(m1.sender_name).toBe("Mariana");
    expect(m1.kind).toBe("CHAT");

    const m2 = localPostGameMessage(gameId, {
      color: "RED",
      body: "Vamos negociar?",
      kind: "TAUNT",
    });
    expect(m2.id).toBeGreaterThan(m1.id);
    expect(m2.kind).toBe("TAUNT");

    expect(localGetGameMessages(gameId)).toHaveLength(2);
    const inc = localGetGameMessages(gameId, m1.id);
    expect(inc).toHaveLength(1);
    expect(inc[0].body).toBe("Vamos negociar?");
  });

  test("HAS_ROAD transfers only when another player strictly exceeds current holder's road length", () => {
    const gameId = localCreateGame({
      players: ["HUMAN", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });

    let state = localGetState(gameId);
    while (state.is_initial_build_phase) {
      state = state.bot_colors.includes(state.current_color)
        ? localPostAction(gameId)
        : localPostAction(gameId, state.current_playable_actions[0]);
    }
    while (state.current_color !== "RED") {
      state = localPostAction(gameId);
    }

    const raw = JSON.parse(localStorage.getItem("catan_local_games_v1") || "{}");
    const entry = raw[gameId];
    const s = entry.state;
    const redKey = `P${s.colors.indexOf("RED")}`;
    const blueKey = `P${s.colors.indexOf("BLUE")}`;

    // Reset edges/nodes cleanly on test board and give RED a 6-road chain with HAS_ROAD
    s.edges.forEach((e: GameEdge) => {
      e.color = null;
    });
    Object.values(s.nodes).forEach((n: any) => {
      n.color = null;
      n.building = null;
    });

    const redNodes = new Set(buildConnectedChain(s.edges, "RED", 6, new Set()));
    buildConnectedChain(s.edges, "BLUE", 5, redNodes);
    s.player_state[`${redKey}_HAS_ROAD`] = true;
    s.player_state[`${blueKey}_HAS_ROAD`] = false;
    s.player_state[`${redKey}_HAS_ROLLED`] = true;
    localStorage.setItem("catan_local_games_v1", JSON.stringify(raw));

    // Recompute via END_TURN: RED has 6 roads, BLUE has 5 -> RED MUST keep HAS_ROAD!
    const afterEndTurn = localPostAction(gameId, ["RED", "END_TURN", null]);
    expect(afterEndTurn.player_state[`${redKey}_LONGEST_ROAD_LENGTH`]).toBe(6);
    expect(afterEndTurn.player_state[`${blueKey}_LONGEST_ROAD_LENGTH`]).toBe(5);
    expect(afterEndTurn.player_state[`${redKey}_HAS_ROAD`]).toBe(true);
    expect(afterEndTurn.player_state[`${blueKey}_HAS_ROAD`]).toBe(false);

    // Now BLUE extends to 7 (> 6) -> HAS_ROAD transfers cleanly to BLUE!
    const raw2 = JSON.parse(localStorage.getItem("catan_local_games_v1") || "{}");
    const s2 = raw2[gameId].state;
    s2.edges.forEach((e: GameEdge) => {
      e.color = null;
    });
    const redNodes2 = new Set(buildConnectedChain(s2.edges, "RED", 6, new Set()));
    buildConnectedChain(s2.edges, "BLUE", 7, redNodes2);
    localStorage.setItem("catan_local_games_v1", JSON.stringify(raw2));

    const afterOvertake = localPostAction(gameId);
    expect(afterOvertake.player_state[`${redKey}_LONGEST_ROAD_LENGTH`]).toBe(6);
    expect(afterOvertake.player_state[`${blueKey}_LONGEST_ROAD_LENGTH`]).toBe(7);
    expect(afterOvertake.player_state[`${redKey}_HAS_ROAD`]).toBe(false);
    expect(afterOvertake.player_state[`${blueKey}_HAS_ROAD`]).toBe(true);
  });

  test("balanced dice mode draws 31 unique pairs without replacement, decrements dice_deck_remaining, and reshuffles at threshold <= 5", () => {
    const gameId = localCreateGame({
      players: ["HUMAN", "HUMAN"],
      mapTemplate: "MINI",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: false,
      diceMode: "balanced",
    });

    let state = localGetState(gameId);
    expect(state.game.dice_mode).toBe("balanced");
    expect(state.dice_deck_remaining).toBe(36);

    while (state.is_initial_build_phase) {
      state = localPostAction(gameId, state.current_playable_actions[0]);
    }

    const drawnPairs = new Set<string>();
    for (let rollIdx = 0; rollIdx < 31; rollIdx++) {
      // Force non-7 discard interference off by draining hands if needed isn't required since no buildings are placed on 7 or hands stay small,
      // and if 7 hits discard/move_robber, resolve until PLAY_TURN + END_TURN
      state = localPostAction(gameId, [state.current_color, "ROLL", null]);
      const lastRoll = state.action_records[state.action_records.length - 1];
      const pair = lastRoll[1] as [number, number];
      drawnPairs.add(`${pair[0]},${pair[1]}`);
      expect(state.dice_deck_remaining).toBe(36 - (rollIdx + 1));

      while (state.current_prompt === "DISCARD" || state.current_prompt === "MOVE_ROBBER") {
        state = localPostAction(gameId, state.current_playable_actions[0]);
      }
      if (!state.winning_color) {
        state = localPostAction(gameId, [state.current_color, "END_TURN", null]);
      }
    }

    expect(state.dice_deck_remaining).toBe(5);
    expect(drawnPairs.size).toBe(31);

    // 32nd roll crosses <= 5 threshold -> fresh 36-card deck shuffled, pops 1 -> 35 remaining
    state = localPostAction(gameId, [state.current_color, "ROLL", null]);
    expect(state.dice_deck_remaining).toBe(35);
  });

  test("persists bot_speed on local rooms and propagates it to started multiplayer GameState", () => {
    const created = localCreateRoom({
      hostName: "Anfitrião",
      players: ["HUMAN", "HUMAN", "F", "F"],
      botDifficulty: "medium",
      botSpeed: "fast",
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    expect(created.room.config.bot_speed).toBe("fast");

    const updated = localUpdateRoom(created.room_code, {
      token: created.seat_token,
      config: { bot_speed: "turbo" },
    });
    expect(updated.config.bot_speed).toBe("turbo");

    const started = localStartRoomGame(created.room_code, created.seat_token);
    const gs = localGetState(started.game_id);
    expect(gs.room_code).toBe(created.room_code);
    expect(gs.bot_speed).toBe("turbo");
  });
});
