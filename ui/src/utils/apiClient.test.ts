import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";

import {
  fetchCurrentAccount,
  getLeaderboard,
  getMatchHistory,
  getSavedAccount,
  loginAccount,
  registerAccount,
  updateProfile,
} from "./apiClient";
import {
  localCreateGame,
  localGetLeaderboard,
  localGetMatchHistory,
  localGetState,
  localGetUserRankAndStats,
  localRecordCompletedMatch,
  localUpdateProfile,
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

  test("updateProfile propagates 403 error and offline mirror enforces unlock thresholds and updates leaderboard/games", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Offline"));
    const acct = await registerAccount({
      username: "helena",
      password: "pw1234",
      displayName: "Helena",
    });

    // 403 vindo do backend deve propagar e NÃO cair silenciosamente no offline
    vi.spyOn(axios, "patch").mockRejectedValueOnce({
      response: {
        status: 403,
        data: {
          description:
            "Este item requer 3 vitória(s) no Ranking para ser desbloqueado (você tem 0).",
        },
      },
    });
    await expect(
      updateProfile({ displayName: "Helena", avatarConfig: { frame: "silver" } })
    ).rejects.toMatchObject({ response: { status: 403 } });

    // Offline fallback valida bloqueio de moldura com 0 vitórias
    vi.spyOn(axios, "patch").mockRejectedValue(new Error("Network Error"));
    await expect(
      updateProfile({ displayName: "Helena", avatarConfig: { frame: "bronze" } })
    ).rejects.toBeDefined();

    // Atualizar item gratuito offline funciona e aparece no leaderboard e localCreateGame
    const updated = await updateProfile({
      displayName: "Cap. Helena",
      avatarConfig: { frame: "wood", hat: "captain", background: "ocean" },
    });
    expect(updated.display_name).toBe("Cap. Helena");
    expect(updated.avatar_config?.hat).toBe("captain");
    expect(acct.username).toBe("helena");

    const lb = localGetLeaderboard();
    const helenaRow = lb.find((r) => r.username === "helena");
    expect(helenaRow?.avatar_config?.hat).toBe("captain");

    const localGameId = localCreateGame({
      players: ["HUMAN", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const st = localGetState(localGameId);
    expect(st.seat_avatars?.RED?.seat_kind).toBe("USER");
    expect(st.seat_avatars?.RED?.avatar_config?.hat).toBe("captain");
    expect(st.seat_avatars?.BLUE?.seat_kind).toBe("BOT");

    // Verificar também chamada direta a localUpdateProfile
    expect(() =>
      localUpdateProfile({
        username: "helena",
        avatarConfig: { hat: "crown_gold" },
      })
    ).toThrow(/7 vitória/);
  });

  test("computes offline leaderboard_rank and stats on register, login, update and fetchCurrentAccount", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Offline"));

    const bruno = await registerAccount({
      username: "bruno_rank",
      password: "pw1234",
      displayName: "Bruno",
    });
    expect(bruno.leaderboard_rank).toBe(1);
    expect(bruno.stats).toEqual({
      wins: 0,
      losses: 0,
      games_played: 0,
      win_rate: 0,
    });

    localRecordCompletedMatch({
      game_id: "g-bruno-win",
      mode: "SOLO",
      map_template: "BASE",
      vps_to_win: 10,
      num_turns: 20,
      winning_color: "RED",
      winner_name: "Bruno",
      winner_username: "bruno_rank",
      winner_is_bot: false,
      participants: [
        {
          color: "RED",
          seat_kind: "USER",
          username: "bruno_rank",
          player_key: "HUMAN",
          display_name: "Bruno",
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

    vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("Offline"));
    const hydrated = await fetchCurrentAccount();
    expect(hydrated?.leaderboard_rank).toBe(1);
    expect(hydrated?.stats).toMatchObject({
      wins: 1,
      games_played: 1,
      win_rate: 100,
    });

    const direct = localGetUserRankAndStats("bruno_rank");
    expect(direct.leaderboard_rank).toBe(1);
    expect(getSavedAccount()?.leaderboard_rank).toBe(1);

    const loggedIn = await loginAccount({
      username: "bruno_rank",
      password: "pw1234",
    });
    expect(loggedIn.leaderboard_rank).toBe(1);
    expect(loggedIn.stats).toMatchObject({
      wins: 1,
      games_played: 1,
      win_rate: 100,
    });

    vi.spyOn(axios, "patch").mockRejectedValueOnce(new Error("Offline"));
    const updated = await updateProfile({
      displayName: "Bruno Atualizado",
    });
    expect(updated.leaderboard_rank).toBe(1);
    expect(updated.stats).toMatchObject({
      wins: 1,
      games_played: 1,
      win_rate: 100,
    });
    expect(getSavedAccount()?.leaderboard_rank).toBe(1);
  });
});
