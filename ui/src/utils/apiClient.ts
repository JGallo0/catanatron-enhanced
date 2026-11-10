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

export type MapTemplate = "BASE" | "MINI" | "TOURNAMENT";
export type StateIndex = number | `${number}` | "latest";

type CreateGameOptions = {
  players: PlayerKey[];
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
};

export async function getPlayers(): Promise<PlayerEntry[]> {
  const response = await axios.get<PlayerEntry[]>(API_URL + "/api/players");
  return response.data;
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

// ===== Private Rooms & Shareable Invite Links =====
export async function createRoom(options: {
  hostName: string;
  players: PlayerKey[];
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
}): Promise<{ room_code: string; seat_token: string; room: RoomState }> {
  const response = await axios.post(`${API_URL}/api/rooms`, {
    host_name: options.hostName,
    players: options.players,
    map_template: options.mapTemplate,
    vps_to_win: options.vpsToWin,
    discard_limit: options.discardLimit,
    friendly_robber: options.friendlyRobber,
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
