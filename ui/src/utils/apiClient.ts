import axios from "axios";

import { API_URL } from "../configuration";
import type { Color, GameAction, GameState, RoomState } from "./api.types";

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
  is_new?: boolean;
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

export async function loginOrRegisterAccount(options: {
  username: string;
  pin: string;
  displayName?: string;
}): Promise<PlayerAccount> {
  const response = await axios.post<PlayerAccount>(
    `${API_URL}/api/auth/login`,
    {
      username: options.username,
      pin: options.pin,
      display_name: options.displayName,
    }
  );
  saveAccount(response.data);
  return response.data;
}

const PLAYER_PT_NAMES: Record<string, { name: string; description: string }> = {
  HUMAN: {
    name: "Humano (Você / Amigo)",
    description: "Jogador controlado por pessoa na mesa ou via link.",
  },
  CATANATRON: {
    name: "IA: Catanatron (AlphaBeta Forte)",
    description: "Bot mais forte do Catanatron com busca Alpha-Beta.",
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
}: CreateGameOptions) {
  const response = await axios.post(API_URL + "/api/games", {
    players,
    map_template: mapTemplate,
    vps_to_win: vpsToWin,
    discard_limit: discardLimit,
    friendly_robber: friendlyRobber,
  });
  return response.data.game_id;
}

// ===== Private & Online Rooms + Shareable Invite Links =====
export async function listActiveRooms(
  token?: string | null
): Promise<RoomState[]> {
  const resolvedToken = token ?? getSavedAccount()?.auth_token ?? undefined;
  const response = await axios.get<{ rooms: RoomState[] }>(
    `${API_URL}/api/rooms`,
    {
      params: resolvedToken ? { token: resolvedToken } : {},
    }
  );
  return response.data.rooms || [];
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
  const resolvedToken =
    options.token ?? getSavedAccount()?.auth_token ?? undefined;
  const response = await axios.post(`${API_URL}/api/rooms`, {
    host_name: options.hostName,
    players: options.players,
    map_template: options.mapTemplate,
    vps_to_win: options.vpsToWin,
    discard_limit: options.discardLimit,
    friendly_robber: options.friendlyRobber,
    token: resolvedToken,
  });
  return response.data;
}

export async function getRoom(
  roomCode: string,
  token?: string | null
): Promise<RoomState> {
  const response = await axios.get<RoomState>(
    `${API_URL}/api/rooms/${roomCode}`,
    {
      params: token ? { token } : {},
    }
  );
  return response.data;
}

export async function joinRoom(
  roomCode: string,
  options: {
    playerName: string;
    preferredColor?: Color;
    token?: string | null;
  }
): Promise<{ seat_token: string; seat_color: Color; room: RoomState }> {
  const response = await axios.post(`${API_URL}/api/rooms/${roomCode}/join`, {
    player_name: options.playerName,
    preferred_color: options.preferredColor,
    token: options.token,
  });
  return response.data;
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
  const response = await axios.patch<RoomState>(
    `${API_URL}/api/rooms/${roomCode}`,
    payload
  );
  return response.data;
}

export async function startRoomGame(
  roomCode: string,
  token?: string | null
): Promise<{ game_id: string; room: RoomState }> {
  const response = await axios.post(`${API_URL}/api/rooms/${roomCode}/start`, {
    token,
  });
  return response.data;
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
  const response = await axios.get(
    `${API_URL}/api/games/${gameId}/states/${stateIndex}`,
    { params: viewParams() }
  );
  return response.data;
}

/** action=undefined means bot action */
export async function postAction(gameId: string, action?: GameAction) {
  const response = await axios.post<GameState>(
    `${API_URL}/api/games/${gameId}/actions`,
    action,
    { params: viewParams() }
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
) {
  if (!gameId) {
    throw new Error("No gameId provided to getMctsAnalysis");
  }
  const response = await axios.get<MCTSSuccessBody | MCTSErrorBody>(
    `${API_URL}/api/games/${gameId}/states/${stateIndex}/mcts-analysis`
  );
  return response.data;
}
