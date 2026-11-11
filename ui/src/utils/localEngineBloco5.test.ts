import { afterEach, describe, expect, test, vi } from "vitest";
import axios from "axios";
import {
  BOT_AVATAR_PROFILES,
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { saveGuestProfile } from "../config/avatarCatalog";
import {
  abandonGame,
  getGameRoomCode,
  getGameSeatToken,
  getState,
  postAction,
  reclaimGame,
  saveAccount,
  saveGameRoomCode,
  sendGameHeartbeat,
} from "./apiClient";
import {
  localAbandonGame,
  localCreateGame,
  localCreateRoom,
  localGameHeartbeat,
  localGetMatchHistory,
  localGetState,
  localJoinRoom,
  localPostAction,
  localReclaimGame,
  localRegisterUser,
  localStartRoomGame,
} from "./localEngine";
import { makeGameState } from "../test/fixtures";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Bloco 5 turn order shuffle, takeover names and offline presence", () => {
  test("localCreateGame shuffles turn order and starter across games while keeping color assignments", () => {
    saveGuestProfile({
      displayName: "Navegante",
      avatarConfig: { hat: "explorer", background: "sunset", frame: "wood" },
    });

    const starters = new Set<string>();
    for (let i = 0; i < 30; i++) {
      localStorage.removeItem("catan_local_games_v1");
      const gid = localCreateGame({
        players: ["HUMAN", "CATANATRON", "F", "MCTS"],
        mapTemplate: "BASE",
        vpsToWin: 10,
        discardLimit: 7,
        friendlyRobber: true,
      });
      const st = localGetState(gid);
      starters.add(st.colors[0]);
      expect(st.current_color).toBe(st.colors[0]);
      expect(st.seat_names?.RED).toBe("Navegante");
      expect(st.bot_colors).not.toContain("RED");
      expect(st.bot_colors).toHaveLength(3);
    }

    expect(starters.size).toBeGreaterThanOrEqual(2);
  });

  test("taken-over seat keeps '<OrigName> (Bot)' name and original avatar instead of replacing with Creitu", () => {
    const st = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["BLUE"],
      taken_over_colors: ["BLUE"],
      seat_names: { RED: "Alice", BLUE: "João (Bot)" },
      seat_avatars: {
        RED: { seat_kind: "USER", username: "alice", avatar_config: {} },
        BLUE: {
          seat_kind: "BOT",
          username: null,
          avatar_config: { hat: "captain", background: "ocean", frame: "wood" },
        },
      },
      seat_takeover: {
        BLUE: {
          taken_over: true,
          reason: "ABANDONED",
          original_username: "joao",
          original_display_name: "João",
        },
      },
    });

    expect(resolvePlayerDisplayName(st, "BLUE", "Azul")).toBe("João (Bot)");
    const resolved = resolveSeatAvatarProps({
      color: "BLUE",
      isBot: true,
      isTakenOver: true,
      seatIndex: 1,
      seatName: "João (Bot)",
      seatAvatar: st.seat_avatars?.BLUE,
      originalUsername: st.seat_takeover?.BLUE?.original_username,
    });
    expect(resolved.config?.hat).toBe("captain");
    expect(resolved.username).toBe("joao");
    expect(resolved.config).not.toEqual(BOT_AVATAR_PROFILES.Creitu);
  });

  test("localAbandonGame and localReclaimGame toggle bot control while preserving board and hand", () => {
    const hostRoom = localCreateRoom({
      hostName: "Ana",
      players: ["HUMAN", "HUMAN"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    localJoinRoom(hostRoom.room_code, { playerName: "Beto" });
    const started = localStartRoomGame(hostRoom.room_code, hostRoom.seat_token);

    const before = localGetState(started.game_id);
    expect(before.bot_colors).toEqual([]);

    // botOnly no-op when current player is human
    const noOpState = localPostAction(started.game_id, undefined, {
      botOnly: true,
    });
    expect(noOpState.state_index).toBe(before.state_index);

    const abandoned = localAbandonGame(started.game_id, "BLUE");
    expect(abandoned.bot_colors).toContain("BLUE");
    expect(abandoned.seat_names?.BLUE).toBe("Beto (Bot)");
    expect(abandoned.seat_takeover?.BLUE?.taken_over).toBe(true);
    expect(abandoned.seat_takeover?.BLUE?.reason).toBe("ABANDONED");

    const hb = localGameHeartbeat(started.game_id, "RED");
    expect(hb.ok).toBe(true);
    expect(hb.bot_colors).toContain("BLUE");
    expect(hb.taken_over_colors).toContain("BLUE");

    const reclaimed = localReclaimGame(started.game_id, "BLUE");
    expect(reclaimed.bot_colors).not.toContain("BLUE");
    expect(reclaimed.seat_names?.BLUE).toBe("Beto");
    expect(reclaimed.seat_takeover?.BLUE?.taken_over).toBe(false);
  });

  test("local match completion records taken-over seat as BOT with no user ranking credit", () => {
    const carlos = localRegisterUser({
      username: "carlos",
      password: "pw",
      displayName: "Carlos",
    });
    saveAccount(carlos);
    const room = localCreateRoom({
      hostName: "Carlos",
      players: ["HUMAN", "HUMAN"],
      mapTemplate: "BASE",
      vpsToWin: 3,
      discardLimit: 7,
      friendlyRobber: true,
      token: carlos.auth_token,
    });

    const diana = localRegisterUser({
      username: "diana",
      password: "pw",
      displayName: "Diana",
    });
    saveAccount(diana);
    localJoinRoom(room.room_code, {
      playerName: "Diana",
      token: diana.auth_token,
    });

    const started = localStartRoomGame(room.room_code, room.seat_token);
    let st = localGetState(started.game_id);
    while (st.is_initial_build_phase) {
      st = localPostAction(started.game_id, st.current_playable_actions[0]);
    }

    localAbandonGame(started.game_id, "BLUE");

    // Grant BLUE 1 VP dev card on top of 2 initial settlements -> 3 VPs on next action
    const rawGames = JSON.parse(localStorage.getItem("catan_local_games_v1") || "{}");
    const blueIdx = rawGames[started.game_id].state.colors.indexOf("BLUE");
    rawGames[started.game_id].state.player_state[`P${blueIdx}_VICTORY_POINT_IN_HAND`] = 1;
    localStorage.setItem("catan_local_games_v1", JSON.stringify(rawGames));

    st = localGetState(started.game_id);
    const activeAction = st.current_playable_actions[0];
    const finalState = localPostAction(started.game_id, activeAction);
    expect(finalState.winning_color).toBe("BLUE");

    const matches = localGetMatchHistory();
    expect(matches).toHaveLength(1);
    expect(matches[0].mode).toBe("MULTIPLAYER");
    expect(matches[0].winner_is_bot).toBe(true);
    expect(matches[0].winner_username).toBeNull();
    expect(matches[0].winner_name).toBe("Diana (Bot)");
    const dianaPart = matches[0].participants.find((p) => p.color === "BLUE");
    expect(dianaPart).toMatchObject({
      seat_kind: "BOT",
      username: null,
      player_key: "CATANATRON",
      display_name: "Diana (Bot)",
      is_winner: true,
    });
  });

  test("apiClient room-token mapping, X-Seat-Token presence headers, and bot_only query param", async () => {
    saveGameRoomCode("srv-game-1", "ab12cd");
    expect(getGameRoomCode("srv-game-1")).toBe("AB12CD");
    localStorage.setItem("catan_room_token_AB12CD", "seat_tok_xyz");
    expect(getGameSeatToken("srv-game-1")).toBe("seat_tok_xyz");

    const mockStateSrv2 = makeGameState({
      room_code: "ZZ99AA",
      game: { id: "srv-game-2", vps_to_win: 10, discard_limit: 7, friendly_robber: true },
    });
    vi.spyOn(axios, "get").mockResolvedValueOnce({ data: mockStateSrv2 });
    await getState("srv-game-2");
    expect(getGameRoomCode("srv-game-2")).toBe("ZZ99AA");

    const mockStateSrv1 = makeGameState({
      room_code: "AB12CD",
      game: { id: "srv-game-1", vps_to_win: 10, discard_limit: 7, friendly_robber: true },
    });
    const postSpy = vi
      .spyOn(axios, "post")
      .mockResolvedValueOnce({ data: mockStateSrv1 })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          bot_colors: ["BLUE"],
          taken_over_colors: [],
          my_seat_taken_over: false,
        },
      })
      .mockResolvedValueOnce({ data: mockStateSrv1 })
      .mockResolvedValueOnce({ data: mockStateSrv1 });

    await postAction("srv-game-1", undefined, { botOnly: true });
    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/games/srv-game-1/actions"),
      undefined,
      expect.objectContaining({
        params: expect.objectContaining({ bot_only: "1" }),
        headers: expect.objectContaining({ "X-Seat-Token": "seat_tok_xyz" }),
      })
    );

    const hb = await sendGameHeartbeat("srv-game-1", "RED");
    expect(hb.ok).toBe(true);
    expect(postSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/games/srv-game-1/heartbeat"),
      { color: "RED" },
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Seat-Token": "seat_tok_xyz" }),
      })
    );

    await abandonGame("srv-game-1", "RED");
    expect(postSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/api/games/srv-game-1/abandon"),
      { color: "RED" },
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Seat-Token": "seat_tok_xyz" }),
      })
    );

    await reclaimGame("srv-game-1", "RED");
    expect(postSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("/api/games/srv-game-1/reclaim"),
      { color: "RED" },
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Seat-Token": "seat_tok_xyz" }),
      })
    );
  });
});
