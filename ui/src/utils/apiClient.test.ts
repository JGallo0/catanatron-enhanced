import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";

import {
  getLeaderboard,
  getMatchHistory,
  loginAccount,
  registerAccount,
} from "./apiClient";
import {
  localGetLeaderboard,
  localGetMatchHistory,
  localRecordCompletedMatch,
} from "./localEngine";

describe("local match history and leaderboard calculations", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("records AI wins in match history while ranking only registered human users", () => {
    localRecordCompletedMatch({
      game_id: "g-human-win",
      mode: "SOLO",
      map_template: "BASE",
      vps_to_win: 10,
      num_turns: 42,
      winning_color: "RED",
      winner_name: "João",
      winner_username: "joao",
      winner_is_bot: false,
      participants: [
        {
          color: "RED",
          seat_kind: "USER",
          username: "joao",
          player_key: "HUMAN",
          display_name: "João",
          victory_points: 10,
          is_winner: true,
        },
        {
          color: "BLUE",
          seat_kind: "BOT",
          username: null,
          player_key: "CATANATRON",
          display_name: "IA (CATANATRON)",
          victory_points: 6,
          is_winner: false,
        },
      ],
    });

    localRecordCompletedMatch({
      game_id: "g-bot-win",
      mode: "SOLO",
      map_template: "BASE",
      vps_to_win: 10,
      num_turns: 50,
      winning_color: "BLUE",
      winner_name: "IA (CATANATRON)",
      winner_username: null,
      winner_is_bot: true,
      participants: [
        {
          color: "RED",
          seat_kind: "USER",
          username: "joao",
          player_key: "HUMAN",
          display_name: "João",
          victory_points: 7,
          is_winner: false,
        },
        {
          color: "BLUE",
          seat_kind: "BOT",
          username: null,
          player_key: "CATANATRON",
          display_name: "IA (CATANATRON)",
          victory_points: 10,
          is_winner: true,
        },
      ],
    });

    const matches = localGetMatchHistory();
    expect(matches).toHaveLength(2);
    expect(matches.some((m) => m.winner_is_bot)).toBe(true);

    const lb = localGetLeaderboard([
      { username: "joao", display_name: "João" },
      { username: "ana", display_name: "Ana" },
    ]);
    expect(lb.map((e) => e.username)).toEqual(["joao", "ana"]);
    expect(lb[0]).toMatchObject({
      wins: 1,
      losses: 1,
      games_played: 2,
      win_rate: 50.0,
      rank: 1,
    });
    expect(lb[1]).toMatchObject({
      wins: 0,
      games_played: 0,
      win_rate: 0.0,
      rank: 2,
    });
  });

  test("registerAccount and loginAccount propagate backend errors instead of silently falling back on 401/409", async () => {
    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 409, data: { description: "Usuário já existe" } },
    });
    await expect(
      registerAccount({ username: "joao", password: "1234" })
    ).rejects.toBeDefined();

    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 401, data: { description: "Senha incorreta" } },
    });
    await expect(
      loginAccount({ username: "joao", password: "wrong" })
    ).rejects.toBeDefined();
  });

  test("getLeaderboard and getMatchHistory mark offline fallback when backend is unavailable", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("Network Error"));
    const lbRes = await getLeaderboard();
    expect(lbRes.is_offline_fallback).toBe(true);
    const matchRes = await getMatchHistory();
    expect(matchRes.is_offline_fallback).toBe(true);
  });
});
