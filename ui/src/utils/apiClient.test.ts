import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";

import { saveGuestProfile } from "../config/avatarCatalog";
import { OFFICIAL_BOT_NAMES } from "../config/botCatalog";
import {
  closeRoom,
  createGame,
  fetchCurrentAccount,
  getLeaderboard,
  getMatchHistory,
  getRoom,
  getSavedAccount,
  leaveRoom,
  listActiveRooms,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveAccount,
  updateProfile,
} from "./apiClient";
import {
  localCloseRoom,
  localCreateGame,
  localCreateRoom,
  localGetLeaderboard,
  localGetMatchHistory,
  localGetRoom,
  localGetState,
  localGetUserRankAndStats,
  localJoinRoom,
  localLeaveRoom,
  localListActiveRooms,
  localRecordCompletedMatch,
  localStartRoomGame,
  localUpdateProfile,
  localUpdateRoom,
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

    // HTTP 5xx (ex: falha no Postgres/Vercel) também propaga em vez de criar conta falsa só no localStorage
    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 500, data: { description: "Database connection failed" } },
    });
    await expect(
      registerAccount({ username: "joao500", password: "1234" })
    ).rejects.toMatchObject({ response: { status: 500 } });

    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 503, data: "Service Unavailable" },
    });
    await expect(
      loginAccount({ username: "joao500", password: "1234" })
    ).rejects.toMatchObject({ response: { status: 503 } });
  });

  test("fetchCurrentAccount preserves local_ accounts without calling /api/auth/me and localEngine keeps accented usernames", async () => {
    vi.spyOn(axios, "post").mockRejectedValueOnce(new Error("Offline"));
    const registered = await registerAccount({
      username: "João",
      password: "segredo123",
      displayName: "João Silva",
    });
    expect(registered.username).toBe("joão");
    expect(registered.auth_token.startsWith("local_")).toBe(true);

    // Se o servidor estiver online e responderia 401 para token local_, fetchCurrentAccount não deve enviar /api/auth/me nem apagar a conta
    const getSpy = vi.spyOn(axios, "get").mockRejectedValue({
      response: { status: 401, data: { description: "Sessão inválida" } },
    });
    const hydrated = await fetchCurrentAccount();
    expect(getSpy).not.toHaveBeenCalled();
    expect(hydrated?.username).toBe("joão");
    expect(getSavedAccount()?.username).toBe("joão");

    // Novo login offline com acento funciona de forma idêntica ao backend
    vi.spyOn(axios, "post").mockRejectedValueOnce(new Error("Offline"));
    const relogged = await loginAccount({
      username: "João",
      password: "segredo123",
    });
    expect(relogged.username).toBe("joão");
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

  test("assigns unique official bot names (never color/legacy names) and preserves guest custom avatar", async () => {
    saveGuestProfile({
      displayName: "Marechal",
      avatarConfig: { hat: "explorer", outfit: "captain", background: "forest" },
    });

    const gameId = localCreateGame({
      players: ["HUMAN", "CATANATRON", "F", "MCTS"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const st = localGetState(gameId);

    expect(st.seat_names?.RED).toBe("Marechal");
    expect(st.seat_avatars?.RED?.seat_kind).toBe("GUEST");
    expect(st.seat_avatars?.RED?.avatar_config?.hat).toBe("explorer");

    const botNames = [st.seat_names?.BLUE, st.seat_names?.ORANGE, st.seat_names?.WHITE];
    expect(new Set(botNames).size).toBe(3);
    for (const botName of botNames) {
      expect((OFFICIAL_BOT_NAMES as readonly string[]).includes(botName!)).toBe(true);
    }

    const roomRes = localCreateRoom({
      hostName: "Marechal",
      players: ["HUMAN", "CATANATRON", "MCTS", "VP"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const roomBots = roomRes.room.seats.filter((s) => s.is_bot).map((s) => s.player_name);
    expect(new Set(roomBots).size).toBe(3);
    for (const botName of roomBots) {
      expect((OFFICIAL_BOT_NAMES as readonly string[]).includes(botName)).toBe(true);
    }

    const postSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: { game_id: "srv-guest-1" },
    });
    await createGame({
      players: ["HUMAN", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/games"),
      expect.objectContaining({
        host_name: "Marechal",
        avatar_config: expect.objectContaining({ hat: "explorer" }),
      }),
      expect.any(Object)
    );
  });
});

describe("multiplayer room closing, leaving, ownership, and lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("localCloseRoom deletes WAITING and IN_PROGRESS rooms, blocks non-hosts with 403, and prevents resurrection", () => {
    const waiting = localCreateRoom({
      hostName: "Anfitrião",
      players: ["HUMAN", "HUMAN", "CATANATRON", "W"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const started = localCreateRoom({
      hostName: "Anfitrião",
      players: ["HUMAN", "HUMAN", "CATANATRON", "W"],
      mapTemplate: "MINI",
      vpsToWin: 7,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const { game_id: gameId } = localStartRoomGame(started.room_code, started.seat_token);

    expect(localListActiveRooms().map((r) => r.room_code).sort()).toEqual(
      [waiting.room_code, started.room_code].sort()
    );

    // Convidado sem token de anfitrião recebe 403
    const joined = localJoinRoom(waiting.room_code, { playerName: "Convidada Bia" });
    expect(() => localCloseRoom(waiting.room_code, joined.seat_token)).toThrow(
      /anfitrião/i
    );

    // Encerrar sala WAITING e sala IN_PROGRESS funciona e nenhuma reaparece
    const res1 = localCloseRoom(waiting.room_code, waiting.seat_token);
    expect(res1.closed).toBe(true);
    const res2 = localCloseRoom(started.room_code, started.seat_token);
    expect(res2).toEqual({
      closed: true,
      room_code: started.room_code,
      game_id: gameId,
    });

    expect(localListActiveRooms()).toHaveLength(0);
    expect(() => localGetRoom(waiting.room_code)).toThrow(/encerrada/i);
    expect(() => localGetRoom(started.room_code)).toThrow(/encerrada/i);
  });

  test("preserves host ownership after session renewal and for legacy stored rooms without host_username", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Offline"));
    const firstSession = await registerAccount({
      username: "joao",
      password: "pw_joao_1",
      displayName: "João",
    });

    const created = localCreateRoom({
      hostName: "João",
      players: ["HUMAN", "HUMAN", "CATANATRON", "W"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
      token: firstSession.auth_token,
    });

    // Simula perda de catan_room_token + novo login gerando novo auth_token
    await logoutAccount();
    saveAccount({
      ...firstSession,
      auth_token: "sess_renewed_joao",
    });

    const roomsAfterRelogin = localListActiveRooms("sess_renewed_joao");
    const mine = roomsAfterRelogin.find((r) => r.room_code === created.room_code);
    expect(mine?.is_host).toBe(true);
    expect(mine?.my_color).toBe("RED");
    expect(localCloseRoom(created.room_code).closed).toBe(true);

    // Sala legada salva antes de host_username existir
    const rawRooms = {
      LEG999: {
        room_code: "LEG999",
        status: "IN_PROGRESS",
        game_id: "g-legacy-999",
        is_host: true,
        my_color: "RED",
        config: {
          map_template: "BASE",
          vps_to_win: 10,
          discard_limit: 7,
          friendly_robber: true,
        },
        seats: [
          {
            color: "RED",
            player_key: "HUMAN",
            player_name: "Anfitrião",
            is_bot: false,
            claimed: true,
            is_me: true,
            seat_kind: "USER",
            username: "joao",
            avatar_config: {},
          },
        ],
        host_token: "old_dead_token",
        seat_tokens: { RED: "old_dead_token", BLUE: null, ORANGE: null, WHITE: null },
      },
    };
    localStorage.setItem("catan_local_rooms_v1", JSON.stringify(rawRooms));
    const legacyListed = localListActiveRooms("sess_renewed_joao");
    expect(legacyListed[0].is_host).toBe(true);
    expect(localCloseRoom("LEG999").closed).toBe(true);
    expect(localListActiveRooms("sess_renewed_joao")).toHaveLength(0);
  });

  test("localLeaveRoom releases non-host WAITING seat and finished rooms drop out of localListActiveRooms", () => {
    const created = localCreateRoom({
      hostName: "Anfitrião",
      players: ["HUMAN", "HUMAN", "CATANATRON", "W"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const joined = localJoinRoom(created.room_code, { playerName: "Convidado" });
    expect(joined.room.is_host).toBe(false);
    expect(joined.room.my_color).toBe("BLUE");

    const leftRes = localLeaveRoom(created.room_code, joined.seat_token);
    expect(leftRes.left).toBe(true);
    expect(leftRes.room.my_color).toBeNull();
    expect(
      leftRes.room.seats.find((s) => s.color === "BLUE")?.claimed
    ).toBe(false);

    const started = localStartRoomGame(created.room_code, created.seat_token);
    expect(localListActiveRooms(created.seat_token)).toHaveLength(1);

    localRecordCompletedMatch({
      game_id: started.game_id,
      room_code: created.room_code,
      mode: "MULTIPLAYER",
      map_template: "BASE",
      vps_to_win: 10,
      num_turns: 35,
      winning_color: "RED",
      winner_name: "Anfitrião",
      winner_username: null,
      winner_is_bot: false,
      participants: [
        {
          color: "RED",
          seat_kind: "GUEST",
          username: null,
          player_key: "HUMAN",
          display_name: "Anfitrião",
          victory_points: 10,
          is_winner: true,
        },
      ],
    });
    expect(localListActiveRooms(created.seat_token)).toHaveLength(0);
  });

  test("apiClient closeRoom, leaveRoom, getRoom, and listActiveRooms handle HTTP 405/403/404, offline fallback, and X-Room-Tokens", async () => {
    // 1) DELETE 405 -> POST /close fallback
    const delSpy = vi.spyOn(axios, "delete").mockRejectedValueOnce({
      response: { status: 405, data: { description: "Method Not Allowed" } },
    });
    const postSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: { closed: true, room_code: "RM4050", game_id: null },
    });
    const closed405 = await closeRoom("RM4050", "tok_host");
    expect(delSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/rooms/RM4050/close"),
      { token: "tok_host" },
      expect.any(Object)
    );
    expect(closed405.closed).toBe(true);

    // 2) HTTP 403 autoritativo propaga erro em vez de cair no offline
    vi.spyOn(axios, "delete").mockRejectedValueOnce({
      response: {
        status: 403,
        data: { description: "Apenas o anfitrião pode encerrar esta sala." },
      },
    });
    await expect(closeRoom("RM4030", "tok_guest")).rejects.toMatchObject({
      response: { status: 403 },
    });

    // 3) getRoom 404 autoritativo NÃO ressuscita sala via localGetRoom
    vi.spyOn(axios, "get").mockRejectedValueOnce({
      response: { status: 404, data: { description: "Sala não encontrada" } },
    });
    await expect(getRoom("DEAD44")).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect(() => localGetRoom("DEAD44")).toThrow(/encerrada/i);

    // 4) Fallback offline (erro 500 de proxy Vite sem Flask) fecha sala local com sucesso
    const local = localCreateRoom({
      hostName: "OfflineHost",
      players: ["HUMAN", "HUMAN", "CATANATRON", "W"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    localStorage.setItem(`catan_room_token_${local.room_code}`, local.seat_token);

    vi.spyOn(axios, "delete").mockRejectedValueOnce({
      response: { status: 500, data: "" },
    });
    const offlineClose = await closeRoom(local.room_code);
    expect(offlineClose.closed).toBe(true);
    expect(localListActiveRooms()).toHaveLength(0);

    // 5) listActiveRooms envia tokens salvos via cabeçalho X-Room-Tokens e leaveRoom limpa token salvo
    localStorage.setItem("catan_room_token_JOIN12", "tok_join_12");
    const getSpy = vi.spyOn(axios, "get").mockResolvedValueOnce({
      data: { rooms: [] },
    });
    await listActiveRooms();
    expect(getSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/rooms"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Room-Tokens": expect.stringContaining("JOIN12"),
        }),
      })
    );

    vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        left: true,
        room: {
          room_code: "JOIN12",
          status: "WAITING",
          game_id: null,
          is_host: false,
          my_color: null,
          config: {
            map_template: "BASE",
            vps_to_win: 10,
            discard_limit: 7,
            friendly_robber: true,
          },
          seats: [],
        },
      },
    });
    const leaveRes = await leaveRoom("JOIN12");
    expect(leaveRes.left).toBe(true);
    expect(localStorage.getItem("catan_room_token_JOIN12")).toBeNull();
  });

  test("local TOURNAMENT map is deterministic, difficulties work, and Assento livre + bot names persist into game", () => {
    const extractLandSignature = (gameId: string) => {
      const state = localGetState(gameId);
      return state.tiles
        .filter((t) => t.tile.type === "RESOURCE_TILE" || t.tile.type === "DESERT")
        .map((t) => ({
          coord: t.coordinate,
          type: t.tile.type,
          resource: t.tile.type === "RESOURCE_TILE" ? t.tile.resource : null,
          number: t.tile.type === "RESOURCE_TILE" ? t.tile.number : null,
        }))
        .sort((a, b) => a.coord.join(",").localeCompare(b.coord.join(",")));
    };

    const gTour1 = localCreateGame({
      players: ["HUMAN", "W", "F", "CATANATRON"],
      mapTemplate: "TOURNAMENT",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
      seatNamesList: ["Anfitrião", "Angeleri", "Guiri", "Creitu"],
      hostSeatIndex: 0,
    });
    const gTour2 = localCreateGame({
      players: ["HUMAN", "W", "CATANATRON", "F"],
      mapTemplate: "TOURNAMENT",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });

    expect(extractLandSignature(gTour1)).toEqual(extractLandSignature(gTour2));
    const tState = localGetState(gTour1);
    const centerTile = tState.tiles.find(
      (t) => t.coordinate.join(",") === "0,0,0"
    );
    const westBrick = tState.tiles.find(
      (t) => t.coordinate.join(",") === "-2,0,2"
    );
    expect(centerTile?.tile.type).toBe("DESERT");
    expect(westBrick?.tile).toMatchObject({
      type: "RESOURCE_TILE",
      resource: "BRICK",
      number: 8,
    });

    // Nomes escolhidos dos bots e do anfitrião são preservados na mesa
    expect(tState.seat_names).toMatchObject({
      RED: "Anfitrião",
      BLUE: "Angeleri",
      ORANGE: "Guiri",
      WHITE: "Creitu",
    });

    // Sala com "Assento livre" na posição 3 (ORANGE) e dificuldade única
    const created = localCreateRoom({
      hostName: "Anfitrião",
      botDifficulty: "hard",
      seats: [
        { player_key: "HUMAN", player_name: "Anfitrião", is_host: true },
        { player_key: "CATANATRON", player_name: "Angeleri", is_host: false },
        { player_key: "HUMAN", player_name: "Assento livre", is_host: false },
        { player_key: "CATANATRON", player_name: "Guiri", is_host: false },
      ],
      mapTemplate: "TOURNAMENT",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    expect(created.room.config.bot_difficulty).toBe("hard");
    expect(created.room.seats[1]).toMatchObject({
      color: "BLUE",
      is_bot: true,
      player_name: "Angeleri",
    });
    expect(created.room.seats[2]).toMatchObject({
      color: "ORANGE",
      is_bot: false,
      claimed: false,
      player_name: "Assento livre",
    });

    // Outro jogador entrando sem cor específica ocupa o "Assento livre" (ORANGE)
    const marinaJoin = localJoinRoom(created.room_code, {
      playerName: "Marina",
      token: "tok_marina_join",
    });
    expect(marinaJoin.seat_color).toBe("ORANGE");
    expect(marinaJoin.room.seats[2]).toMatchObject({
      color: "ORANGE",
      claimed: true,
      player_name: "Marina",
    });

    // Sala sem mais "Assento livre" recusa novo visitante
    expect(() =>
      localJoinRoom(created.room_code, {
        playerName: "Intruso",
        token: "tok_intruso",
      })
    ).toThrow(/Não há assentos livres/i);

    // Remover Angeleri (BLUE) mantendo Marina via source_color preserva o token e o nome dela em BLUE
    const afterRemove = localUpdateRoom(created.room_code, {
      token: created.seat_token,
      seats: [
        {
          color: "RED",
          source_color: "RED",
          player_key: "HUMAN",
          player_name: "Anfitrião",
        },
        {
          color: "BLUE",
          source_color: "ORANGE",
          player_key: "HUMAN",
          player_name: "Marina",
        },
        {
          color: "ORANGE",
          source_color: "WHITE",
          player_key: "CATANATRON",
          player_name: "Guiri",
        },
      ],
    });
    expect(afterRemove.seats[1]).toMatchObject({
      color: "BLUE",
      claimed: true,
      player_name: "Marina",
    });
    expect(localGetRoom(created.room_code, "tok_marina_join").my_color).toBe(
      "BLUE"
    );

    // Quando Marina sai, assento volta para "Assento livre" e pode receber outro jogador ("Pedro")
    const leftRes = localLeaveRoom(created.room_code, "tok_marina_join");
    expect(leftRes.room.seats[1]).toMatchObject({
      color: "BLUE",
      claimed: false,
      player_name: "Assento livre",
    });

    const pedroJoin = localJoinRoom(created.room_code, {
      playerName: "Pedro",
      token: "tok_pedro_join",
    });
    expect(pedroJoin.seat_color).toBe("BLUE");
    expect(pedroJoin.room.seats[1].player_name).toBe("Pedro");

    // Ao iniciar partida da sala, mesa respeita todos os nomes escolhidos
    const started = localStartRoomGame(created.room_code, created.seat_token);
    const liveGame = localGetState(started.game_id);
    expect(liveGame.seat_names).toEqual({
      RED: "Anfitrião",
      BLUE: "Pedro",
      ORANGE: "Guiri",
    });
  });
});
