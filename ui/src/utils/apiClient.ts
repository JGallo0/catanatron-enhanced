import axios from "axios";

import { API_URL } from "../configuration";
import {
  getCustomGuestAvatarPayload,
  getGuestProfile,
} from "../config/avatarCatalog";
import type {
  AccountStats,
  AvatarConfig,
  Color,
  GameAction,
  GameState,
  LeaderboardEntry,
  MatchRecord,
  RoomState,
} from "./api.types";
import {
  localAbandonGame,
  localCreateGame,
  localCreateRoom,
  localGameHeartbeat,
  localGetLeaderboard,
  localGetMatchHistory,
  localGetMctsAnalysis,
  localGetRoom,
  localGetState,
  localGetUserRankAndStats,
  localJoinRoom,
  localListActiveRooms,
  localLoginOrRegister,
  localLoginUser,
  localPostAction,
  localReclaimGame,
  localRegisterUser,
  localStartRoomGame,
  localUpdateProfile,
  localUpdateRoom,
} from "./localEngine";

/** A registry key, e.g. "CATANATRON" or "AB". The server decides what exists. */
export type PlayerKey = string;

export type PlayerParam = {
  name: string;
  type: "int" | "float" | "str" | "bool";
  default: number | string | boolean | null;
  choices?: Array<string | number>;
  help: string;
};

export type PlayerEntry = {
  key: PlayerKey;
  name: string;
  description: string;
  is_bot: boolean;
  source: string;
  params: PlayerParam[];
};

export type PlayerAccount = {
  username: string;
  display_name: string;
  auth_token: string;
  has_google?: boolean;
  avatar_config?: Partial<AvatarConfig>;
  stats?: AccountStats;
  leaderboard_rank?: number | null;
  is_new?: boolean;
};

export type AuthConfig = {
  google_enabled: boolean;
  google_client_id: string | null;
};

export type MapTemplate = "BASE" | "MINI" | "TOURNAMENT";
export type StateIndex = number | `${number}` | "latest";

type CreateGameOptions = {
  players: PlayerKey[];
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
};

const ACCOUNT_STORAGE_KEY = "catan_player_account";

export function getSavedAccount(): PlayerAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerAccount;
  } catch {
    return null;
  }
}

export function saveAccount(account: PlayerAccount) {
  try {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
    localStorage.setItem("catan_player_name", account.display_name);
  } catch {
    // ignore storage errors
  }
}

export function clearSavedAccount() {
  try {
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function authHeaders(token?: string | null): Record<string, string> {
  const resolved = token ?? getSavedAccount()?.auth_token;
  return resolved ? { Authorization: `Bearer ${resolved}` } : {};
}

export function getFallbackGoogleClientId(): string | null {
  try {
    const raw = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";
    const trimmed = raw.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const envClientId = getFallbackGoogleClientId();
  try {
    const response = await axios.get<AuthConfig>(`${API_URL}/api/auth/config`);
    if (response.data && typeof response.data.google_enabled === "boolean") {
      const clientId = response.data.google_client_id || envClientId;
      return {
        google_enabled:
          Boolean(clientId) && (response.data.google_enabled || Boolean(envClientId)),
        google_client_id: clientId,
      };
    }
  } catch {
    // Offline / dev fallback: use Vite build-time client ID if provided
  }
  return {
    google_enabled: Boolean(envClientId),
    google_client_id: envClientId,
  };
}

export async function registerAccount(options: {
  username: string;
  password: string;
  displayName?: string;
  avatarConfig?: Partial<AvatarConfig>;
}): Promise<PlayerAccount> {
  const resolvedAvatar = options.avatarConfig ?? getCustomGuestAvatarPayload();
  try {
    const response = await axios.post<PlayerAccount>(
      `${API_URL}/api/auth/register`,
      {
        username: options.username,
        password: options.password,
        display_name: options.displayName,
        ...(resolvedAvatar ? { avatar_config: resolvedAvatar } : {}),
      }
    );
    if (response.data?.username) {
      saveAccount(response.data);
      return response.data;
    }
  } catch (err: any) {
    if (err?.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
  }
  const fallback = localRegisterUser({
    ...options,
    avatarConfig: resolvedAvatar,
  });
  saveAccount(fallback);
  return fallback;
}

export async function loginAccount(options: {
  username: string;
  password: string;
}): Promise<PlayerAccount> {
  try {
    const response = await axios.post<PlayerAccount>(
      `${API_URL}/api/auth/login`,
      {
        username: options.username,
        password: options.password,
      }
    );
    if (response.data?.username) {
      saveAccount(response.data);
      return response.data;
    }
  } catch (err: any) {
    if (err?.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
  }
  const fallback = localLoginUser(options);
  saveAccount(fallback);
  return fallback;
}

export async function loginWithGoogle(
  credential: string,
  avatarConfig?: Partial<AvatarConfig>
): Promise<PlayerAccount> {
  const resolvedAvatar = avatarConfig ?? getCustomGuestAvatarPayload();
  const response = await axios.post<PlayerAccount>(`${API_URL}/api/auth/google`, {
    credential,
    ...(resolvedAvatar ? { avatar_config: resolvedAvatar } : {}),
  });
  saveAccount(response.data);
  return response.data;
}

export async function fetchCurrentAccount(): Promise<PlayerAccount | null> {
  const saved = getSavedAccount();
  if (!saved?.auth_token) return null;
  try {
    const response = await axios.get<PlayerAccount>(`${API_URL}/api/auth/me`, {
      headers: authHeaders(saved.auth_token),
    });
    if (response.data?.username) {
      const merged: PlayerAccount = {
        ...saved,
        ...response.data,
        auth_token: saved.auth_token,
      };
      saveAccount(merged);
      return merged;
    }
  } catch (err: any) {
    if (err?.response?.status === 401) {
      clearSavedAccount();
      return null;
    }
  }
  const offline = localGetUserRankAndStats(saved.username);
  const hydrated: PlayerAccount = {
    ...saved,
    stats: offline.stats,
    leaderboard_rank: offline.leaderboard_rank,
  };
  saveAccount(hydrated);
  return hydrated;
}

export async function logoutAccount(): Promise<void> {
  const saved = getSavedAccount();
  clearSavedAccount();
  if (!saved?.auth_token) return;
  try {
    await axios.post(
      `${API_URL}/api/auth/logout`,
      {},
      { headers: authHeaders(saved.auth_token) }
    );
  } catch {
    // Ignore network failures on logout
  }
}

export async function updateProfile(payload: {
  displayName?: string;
  avatarConfig?: Partial<AvatarConfig>;
}): Promise<PlayerAccount> {
  const saved = getSavedAccount();
  if (!saved?.auth_token) throw new Error("Não autenticado");
  try {
    const response = await axios.patch<PlayerAccount>(
      `${API_URL}/api/auth/profile`,
      {
        display_name: payload.displayName,
        avatar_config: payload.avatarConfig,
      },
      { headers: authHeaders(saved.auth_token) }
    );
    const updated: PlayerAccount = {
      ...saved,
      ...response.data,
      auth_token: saved.auth_token,
    };
    saveAccount(updated);
    return updated;
  } catch (err: any) {
    if (err?.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
    const localUpdated = localUpdateProfile({
      username: saved.username,
      displayName: payload.displayName,
      avatarConfig: payload.avatarConfig,
    });
    const merged: PlayerAccount = {
      ...saved,
      ...localUpdated,
      auth_token: saved.auth_token,
    };
    saveAccount(merged);
    return merged;
  }
}

export async function getLeaderboard(): Promise<{
  leaderboard: LeaderboardEntry[];
  is_offline_fallback: boolean;
}> {
  try {
    const response = await axios.get<{ leaderboard: LeaderboardEntry[] }>(
      `${API_URL}/api/leaderboard`
    );
    if (response.data && Array.isArray(response.data.leaderboard)) {
      return { leaderboard: response.data.leaderboard, is_offline_fallback: false };
    }
  } catch {
    // Offline fallback
  }
  return { leaderboard: localGetLeaderboard(), is_offline_fallback: true };
}

export async function getMatchHistory(username?: string): Promise<{
  matches: MatchRecord[];
  is_offline_fallback: boolean;
}> {
  try {
    const response = await axios.get<{ matches: MatchRecord[] }>(
      `${API_URL}/api/matches`,
      { params: username ? { username } : {} }
    );
    if (response.data && Array.isArray(response.data.matches)) {
      return { matches: response.data.matches, is_offline_fallback: false };
    }
  } catch {
    // Offline fallback
  }
  return { matches: localGetMatchHistory(username), is_offline_fallback: true };
}

export async function loginOrRegisterAccount(options: {
  username: string;
  pin: string;
  displayName?: string;
}): Promise<PlayerAccount> {
  try {
    const response = await axios.post<PlayerAccount>(
      `${API_URL}/api/auth/login`,
      {
        username: options.username,
        pin: options.pin,
        display_name: options.displayName,
      }
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      typeof response.data.username === "string"
    ) {
      saveAccount(response.data);
      return response.data;
    }
  } catch (err: any) {
    if (err?.response?.status === 401) {
      throw err;
    }
  }
  const fallback = localLoginOrRegister(options);
  saveAccount(fallback);
  return fallback;
}

const PLAYER_PT_NAMES: Record<string, { name: string; description: string }> = {
  HUMAN: {
    name: "Humano (Você / Amigo)",
    description: "Jogador controlado por pessoa na mesa ou via link.",
  },
  CATANATRON: {
    name: "IA: Mestre da Ilha (AlphaBeta Forte)",
    description: "Bot estratégico mais forte do motor de jogo com busca Alpha-Beta.",
  },
  AB: {
    name: "IA: AlphaBeta Configurável",
    description: "Busca em árvore Alpha-Beta com profundidade ajustável.",
  },
  F: {
    name: "IA: Função de Valor (Rápida)",
    description: "Avalia a melhor jogada imediata por heurística.",
  },
  MCTS: {
    name: "IA: Monte Carlo (MCTS)",
    description: "Simula partidas completas para decidir a jogada.",
  },
  G: {
    name: "IA: Gananciosa (Greedy)",
    description: "Prioriza ganhos imediatos de produção.",
  },
  VP: {
    name: "IA: Caçadora de Pontos (VP)",
    description: "Foca diretamente em ações que geram pontos de vitória.",
  },
  W: {
    name: "IA: Aleatória Ponderada",
    description: "Escolhe jogadas aleatórias com peso maior para construções.",
  },
  WEIGHTED_RANDOM: {
    name: "IA: Aleatória Ponderada",
    description: "Escolhe jogadas aleatórias com peso maior para construções.",
  },
  R: {
    name: "IA: Aleatória Simples (Fácil)",
    description: "Escolhe qualquer ação válida aleatoriamente.",
  },
  RANDOM: {
    name: "IA: Aleatória Simples (Fácil)",
    description: "Escolhe qualquer ação válida aleatoriamente.",
  },
};

export const DEFAULT_PLAYERS: PlayerEntry[] = [
  {
    key: "HUMAN",
    name: PLAYER_PT_NAMES.HUMAN.name,
    description: PLAYER_PT_NAMES.HUMAN.description,
    is_bot: false,
    source: "builtin",
    params: [],
  },
  {
    key: "CATANATRON",
    name: PLAYER_PT_NAMES.CATANATRON.name,
    description: PLAYER_PT_NAMES.CATANATRON.description,
    is_bot: true,
    source: "builtin",
    params: [],
  },
  {
    key: "F",
    name: PLAYER_PT_NAMES.F.name,
    description: PLAYER_PT_NAMES.F.description,
    is_bot: true,
    source: "builtin",
    params: [],
  },
  {
    key: "MCTS",
    name: PLAYER_PT_NAMES.MCTS.name,
    description: PLAYER_PT_NAMES.MCTS.description,
    is_bot: true,
    source: "builtin",
    params: [],
  },
  {
    key: "VP",
    name: PLAYER_PT_NAMES.VP.name,
    description: PLAYER_PT_NAMES.VP.description,
    is_bot: true,
    source: "builtin",
    params: [],
  },
  {
    key: "W",
    name: PLAYER_PT_NAMES.W.name,
    description: PLAYER_PT_NAMES.W.description,
    is_bot: true,
    source: "builtin",
    params: [],
  },
  {
    key: "RANDOM",
    name: PLAYER_PT_NAMES.RANDOM.name,
    description: PLAYER_PT_NAMES.RANDOM.description,
    is_bot: true,
    source: "builtin",
    params: [],
  },
];

export async function getPlayers(): Promise<PlayerEntry[]> {
  try {
    const response = await axios.get<PlayerEntry[]>(API_URL + "/api/players");
    if (!Array.isArray(response.data) || response.data.length === 0) {
      return DEFAULT_PLAYERS;
    }
    return response.data.map((entry) => {
      const pt = PLAYER_PT_NAMES[entry.key];
      return pt
        ? { ...entry, name: pt.name, description: pt.description }
        : entry;
    });
  } catch {
    return DEFAULT_PLAYERS;
  }
}

export async function createGame({
  players,
  mapTemplate,
  vpsToWin,
  discardLimit,
  friendlyRobber,
}: CreateGameOptions): Promise<string> {
  const acct = getSavedAccount();
  const guest = !acct ? getGuestProfile() : null;
  const guestAvatar = !acct ? getCustomGuestAvatarPayload() : undefined;
  const resolvedHostName =
    acct?.display_name ||
    (guest?.customized ||
    (guest?.display_name && guest.display_name !== "Explorador da Ilha")
      ? guest?.display_name
      : undefined);
  try {
    const response = await axios.post(
      API_URL + "/api/games",
      {
        players,
        map_template: mapTemplate,
        vps_to_win: vpsToWin,
        discard_limit: discardLimit,
        friendly_robber: friendlyRobber,
        host_name: resolvedHostName,
        ...(guestAvatar ? { avatar_config: guestAvatar } : {}),
      },
      { headers: authHeaders() }
    );
    if (response.data && typeof response.data.game_id === "string") {
      return response.data.game_id;
    }
  } catch {
    // Fallback to local engine if backend is unreachable
  }
  return localCreateGame({
    players,
    mapTemplate,
    vpsToWin,
    discardLimit,
    friendlyRobber,
    seatNames: resolvedHostName ? { RED: resolvedHostName } : undefined,
    hostAvatarConfig: guestAvatar,
  });
}

// ===== Private & Online Rooms + Shareable Invite Links =====
export async function listActiveRooms(
  token?: string | null
): Promise<RoomState[]> {
  const resolvedToken = token ?? getSavedAccount()?.auth_token ?? undefined;
  try {
    const response = await axios.get<{ rooms: RoomState[] }>(
      `${API_URL}/api/rooms`,
      {
        params: resolvedToken ? { token: resolvedToken } : {},
      }
    );
    if (response.data && Array.isArray(response.data.rooms)) {
      const localRooms = localListActiveRooms(resolvedToken);
      const remoteCodes = new Set(response.data.rooms.map((r) => r.room_code));
      return [
        ...response.data.rooms,
        ...localRooms.filter((r) => !remoteCodes.has(r.room_code)),
      ];
    }
  } catch {
    // Fallback to local rooms
  }
  return localListActiveRooms(resolvedToken);
}

export async function createRoom(options: {
  hostName: string;
  players: PlayerKey[];
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
  token?: string | null;
}): Promise<{ room_code: string; seat_token: string; room: RoomState }> {
  const acct = getSavedAccount();
  const guestAvatar = !acct ? getCustomGuestAvatarPayload() : undefined;
  const resolvedToken = options.token ?? acct?.auth_token ?? undefined;
  try {
    const response = await axios.post(
      `${API_URL}/api/rooms`,
      {
        host_name: options.hostName,
        players: options.players,
        map_template: options.mapTemplate,
        vps_to_win: options.vpsToWin,
        discard_limit: options.discardLimit,
        friendly_robber: options.friendlyRobber,
        token: resolvedToken,
        ...(guestAvatar ? { avatar_config: guestAvatar } : {}),
      },
      { headers: authHeaders(resolvedToken) }
    );
    if (
      response.data &&
      typeof response.data.room_code === "string" &&
      response.data.room
    ) {
      return response.data;
    }
  } catch {
    // Fallback to local room manager
  }
  return localCreateRoom({
    ...options,
    token: resolvedToken,
    hostAvatarConfig: guestAvatar,
  });
}

export async function getRoom(
  roomCode: string,
  token?: string | null
): Promise<RoomState> {
  try {
    const response = await axios.get<RoomState>(
      `${API_URL}/api/rooms/${roomCode}`,
      {
        params: token ? { token } : {},
      }
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      typeof response.data.room_code === "string"
    ) {
      return response.data;
    }
  } catch {
    // Fallback to local room
  }
  return localGetRoom(roomCode, token);
}

export async function joinRoom(
  roomCode: string,
  options: {
    playerName: string;
    preferredColor?: Color;
    token?: string | null;
  }
): Promise<{ seat_token: string; seat_color: Color; room: RoomState }> {
  const acct = getSavedAccount();
  const guestAvatar = !acct ? getCustomGuestAvatarPayload() : undefined;
  const resolvedToken = options.token ?? acct?.auth_token;
  try {
    const response = await axios.post(
      `${API_URL}/api/rooms/${roomCode}/join`,
      {
        player_name: options.playerName,
        preferred_color: options.preferredColor,
        token: resolvedToken,
        ...(guestAvatar ? { avatar_config: guestAvatar } : {}),
      },
      { headers: authHeaders() }
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      response.data.room
    ) {
      return response.data;
    }
  } catch {
    // Fallback to local room
  }
  return localJoinRoom(roomCode, {
    ...options,
    avatarConfig: guestAvatar,
  });
}

export async function updateRoom(
  roomCode: string,
  payload: {
    token?: string | null;
    config?: Partial<{
      map_template: MapTemplate;
      vps_to_win: number;
      discard_limit: number;
      friendly_robber: boolean;
    }>;
    seats?: Array<{
      color: Color;
      player_key: string;
      player_name?: string;
    }>;
  }
): Promise<RoomState> {
  try {
    const response = await axios.patch<RoomState>(
      `${API_URL}/api/rooms/${roomCode}`,
      payload,
      { headers: authHeaders() }
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      typeof response.data.room_code === "string"
    ) {
      return response.data;
    }
  } catch {
    // Fallback to local room
  }
  return localUpdateRoom(roomCode, payload);
}

export async function startRoomGame(
  roomCode: string,
  token?: string | null
): Promise<{ game_id: string; room: RoomState }> {
  try {
    const response = await axios.post(
      `${API_URL}/api/rooms/${roomCode}/start`,
      {
        token,
      }
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      typeof response.data.game_id === "string"
    ) {
      return response.data;
    }
  } catch {
    // Fallback to local room game start
  }
  return localStartRoomGame(roomCode, token);
}

export function saveGameRoomCode(gameId: string, roomCode?: string | null) {
  try {
    if (gameId && roomCode) {
      localStorage.setItem(`catan_game_room_${gameId}`, roomCode.toUpperCase());
    }
  } catch {
    // ignore storage errors
  }
}

export function getGameRoomCode(gameId: string): string | null {
  try {
    return localStorage.getItem(`catan_game_room_${gameId}`);
  } catch {
    return null;
  }
}

export function getGameSeatToken(
  gameId: string,
  explicitRoomCode?: string | null
): string | null {
  try {
    const code = explicitRoomCode?.toUpperCase() || getGameRoomCode(gameId);
    if (code) {
      const roomTok = localStorage.getItem(`catan_room_token_${code}`);
      if (roomTok) return roomTok;
    }
    return getSavedAccount()?.auth_token ?? null;
  } catch {
    return null;
  }
}

function presenceHeaders(
  gameId: string,
  roomCode?: string | null
): Record<string, string> {
  const seatTok = getGameSeatToken(gameId, roomCode);
  return {
    ...authHeaders(),
    ...(seatTok ? { "X-Seat-Token": seatTok } : {}),
  };
}

let perspective: Color | null = null;

export function setPerspective(color: Color | null) {
  perspective = color;
}

function viewParams() {
  return perspective ? { as: perspective } : {};
}

export async function getState(
  gameId: string,
  stateIndex: StateIndex = "latest"
): Promise<GameState> {
  if (gameId.startsWith("local-")) {
    return localGetState(gameId, stateIndex);
  }
  try {
    const response = await axios.get(
      `${API_URL}/api/games/${gameId}/states/${stateIndex}`,
      { params: viewParams() }
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      Array.isArray(response.data.tiles)
    ) {
      if (response.data.room_code) {
        saveGameRoomCode(gameId, response.data.room_code);
      }
      return response.data;
    }
  } catch {
    // Fallback to local engine if backend state not found
  }
  return localGetState(gameId, stateIndex);
}

/** action=undefined means bot action */
export async function postAction(
  gameId: string,
  action?: GameAction,
  options?: { botOnly?: boolean }
): Promise<GameState> {
  if (gameId.startsWith("local-")) {
    return localPostAction(gameId, action, options);
  }
  try {
    const params = {
      ...viewParams(),
      ...(options?.botOnly ? { bot_only: "1" } : {}),
    };
    const response = await axios.post<GameState>(
      `${API_URL}/api/games/${gameId}/actions`,
      action,
      { params, headers: presenceHeaders(gameId) }
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      Array.isArray(response.data.tiles)
    ) {
      if (response.data.room_code) {
        saveGameRoomCode(gameId, response.data.room_code);
      }
      return response.data;
    }
  } catch {
    // Fallback to local engine
  }
  return localPostAction(gameId, action, options);
}

export async function sendGameHeartbeat(
  gameId: string,
  color?: Color | null
): Promise<{
  ok: boolean;
  bot_colors: Color[];
  taken_over_colors: Color[];
  my_seat_taken_over: boolean;
}> {
  if (gameId.startsWith("local-")) {
    return localGameHeartbeat(gameId, color);
  }
  try {
    const response = await axios.post(
      `${API_URL}/api/games/${gameId}/heartbeat`,
      { color: color ?? undefined },
      { params: viewParams(), headers: presenceHeaders(gameId) }
    );
    if (response.data && response.data.ok) {
      return response.data;
    }
  } catch {
    // Ignore transient errors cleanly
  }
  return {
    ok: false,
    bot_colors: [],
    taken_over_colors: [],
    my_seat_taken_over: false,
  };
}

export async function abandonGame(
  gameId: string,
  color?: Color | null
): Promise<GameState> {
  if (gameId.startsWith("local-")) {
    return localAbandonGame(gameId, color);
  }
  const response = await axios.post<GameState>(
    `${API_URL}/api/games/${gameId}/abandon`,
    { color: color ?? undefined },
    { params: viewParams(), headers: presenceHeaders(gameId) }
  );
  return response.data;
}

export async function reclaimGame(
  gameId: string,
  color?: Color | null
): Promise<GameState> {
  if (gameId.startsWith("local-")) {
    return localReclaimGame(gameId, color);
  }
  const response = await axios.post<GameState>(
    `${API_URL}/api/games/${gameId}/reclaim`,
    { color: color ?? undefined },
    { params: viewParams(), headers: presenceHeaders(gameId) }
  );
  return response.data;
}

export type MCTSProbabilities = {
  [K in Color]: number;
};

type MCTSSuccessBody = {
  success: true;
  probabilities: MCTSProbabilities;
  state_index: number;
};
type MCTSErrorBody = {
  success: false;
  error: string;
  trace: string;
};

export async function getMctsAnalysis(
  gameId: string,
  stateIndex: StateIndex = "latest"
): Promise<MCTSSuccessBody | MCTSErrorBody> {
  if (!gameId) {
    throw new Error("No gameId provided to getMctsAnalysis");
  }
  if (gameId.startsWith("local-")) {
    return localGetMctsAnalysis(gameId);
  }
  try {
    const response = await axios.get<MCTSSuccessBody | MCTSErrorBody>(
      `${API_URL}/api/games/${gameId}/states/${stateIndex}/mcts-analysis`
    );
    if (
      response.data &&
      typeof response.data === "object" &&
      "success" in response.data
    ) {
      return response.data;
    }
  } catch {
    // Fallback to local MCTS probability estimator
  }
  return localGetMctsAnalysis(gameId);
}
