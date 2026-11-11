import type {
  AccountStats,
  AvatarConfig,
  Color,
  DevelopmentCard,
  Direction,
  GameAction,
  GameEdge,
  GameNode,
  GameState,
  LeaderboardEntry,
  MatchParticipant,
  MatchRecord,
  PlacedTile,
  ResourceCard,
  RoomState,
  SeatAvatarMeta,
  Tile,
  TileCoordinate,
} from "./api.types";
import type { MapTemplate, MCTSProbabilities, PlayerAccount } from "./apiClient";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import {
  AVATAR_UNLOCK_REQUIREMENTS,
  DEFAULT_GUEST_DISPLAY_NAME,
  filterUnlockedAvatarConfig,
  getGuestProfile,
  isAvatarItemUnlocked,
  sanitizeAvatarConfig,
} from "../config/avatarCatalog";
import {
  BOT_AVATAR_PROFILES,
  isOfficialBotName,
  pickBotNameDeterministic,
  pickBotNames,
} from "../config/botCatalog";

const SEAT_COLORS: Color[] = ["RED", "BLUE", "ORANGE", "WHITE"];
const RESOURCES: ResourceCard[] = ["WOOD", "BRICK", "SHEEP", "WHEAT", "ORE"];

type NodeRef =
  | "NORTH"
  | "NORTHEAST"
  | "SOUTHEAST"
  | "SOUTH"
  | "SOUTHWEST"
  | "NORTHWEST";
type EdgeRef =
  | "EAST"
  | "SOUTHEAST"
  | "SOUTHWEST"
  | "WEST"
  | "NORTHWEST"
  | "NORTHEAST";

const NODE_REFS: NodeRef[] = [
  "NORTH",
  "NORTHEAST",
  "SOUTHEAST",
  "SOUTH",
  "SOUTHWEST",
  "NORTHWEST",
];
const EDGE_REFS: EdgeRef[] = [
  "EAST",
  "SOUTHEAST",
  "SOUTHWEST",
  "WEST",
  "NORTHWEST",
  "NORTHEAST",
];

const UNIT_VECTORS: Record<EdgeRef, TileCoordinate> = {
  NORTHEAST: [1, 0, -1],
  SOUTHWEST: [-1, 0, 1],
  NORTHWEST: [0, 1, -1],
  SOUTHEAST: [0, -1, 1],
  EAST: [1, -1, 0],
  WEST: [-1, 1, 0],
};

function addCoord(a: TileCoordinate, b: TileCoordinate): TileCoordinate {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function coordKey(c: TileCoordinate): string {
  return `${c[0]},${c[1]},${c[2]}`;
}

function getEdgeNodes(edgeRef: EdgeRef): [NodeRef, NodeRef] {
  switch (edgeRef) {
    case "EAST":
      return ["NORTHEAST", "SOUTHEAST"];
    case "SOUTHEAST":
      return ["SOUTHEAST", "SOUTH"];
    case "SOUTHWEST":
      return ["SOUTH", "SOUTHWEST"];
    case "WEST":
      return ["SOUTHWEST", "NORTHWEST"];
    case "NORTHWEST":
      return ["NORTHWEST", "NORTH"];
    case "NORTHEAST":
      return ["NORTH", "NORTHEAST"];
  }
}

const PORT_DIRECTION_TO_NODEREFS: Record<EdgeRef, [NodeRef, NodeRef]> = {
  WEST: ["NORTHWEST", "SOUTHWEST"],
  NORTHWEST: ["NORTH", "NORTHWEST"],
  NORTHEAST: ["NORTHEAST", "NORTH"],
  EAST: ["SOUTHEAST", "NORTHEAST"],
  SOUTHEAST: ["SOUTH", "SOUTHEAST"],
  SOUTHWEST: ["SOUTHWEST", "SOUTH"],
};

type TopologyEntry =
  | { kind: "LAND" }
  | { kind: "WATER" }
  | { kind: "PORT"; direction: EdgeRef };

const BASE_TOPOLOGY: Array<[TileCoordinate, TopologyEntry]> = [
  [[0, 0, 0], { kind: "LAND" }],
  [[1, -1, 0], { kind: "LAND" }],
  [[0, -1, 1], { kind: "LAND" }],
  [[-1, 0, 1], { kind: "LAND" }],
  [[-1, 1, 0], { kind: "LAND" }],
  [[0, 1, -1], { kind: "LAND" }],
  [[1, 0, -1], { kind: "LAND" }],
  [[2, -2, 0], { kind: "LAND" }],
  [[1, -2, 1], { kind: "LAND" }],
  [[0, -2, 2], { kind: "LAND" }],
  [[-1, -1, 2], { kind: "LAND" }],
  [[-2, 0, 2], { kind: "LAND" }],
  [[-2, 1, 1], { kind: "LAND" }],
  [[-2, 2, 0], { kind: "LAND" }],
  [[-1, 2, -1], { kind: "LAND" }],
  [[0, 2, -2], { kind: "LAND" }],
  [[1, 1, -2], { kind: "LAND" }],
  [[2, 0, -2], { kind: "LAND" }],
  [[2, -1, -1], { kind: "LAND" }],
  [[3, -3, 0], { kind: "PORT", direction: "WEST" }],
  [[2, -3, 1], { kind: "WATER" }],
  [[1, -3, 2], { kind: "PORT", direction: "NORTHWEST" }],
  [[0, -3, 3], { kind: "WATER" }],
  [[-1, -2, 3], { kind: "PORT", direction: "NORTHWEST" }],
  [[-2, -1, 3], { kind: "WATER" }],
  [[-3, 0, 3], { kind: "PORT", direction: "NORTHEAST" }],
  [[-3, 1, 2], { kind: "WATER" }],
  [[-3, 2, 1], { kind: "PORT", direction: "EAST" }],
  [[-3, 3, 0], { kind: "WATER" }],
  [[-2, 3, -1], { kind: "PORT", direction: "EAST" }],
  [[-1, 3, -2], { kind: "WATER" }],
  [[0, 3, -3], { kind: "PORT", direction: "SOUTHEAST" }],
  [[1, 2, -3], { kind: "WATER" }],
  [[2, 1, -3], { kind: "PORT", direction: "SOUTHWEST" }],
  [[3, 0, -3], { kind: "WATER" }],
  [[3, -1, -2], { kind: "PORT", direction: "SOUTHWEST" }],
  [[3, -2, -1], { kind: "WATER" }],
];

const MINI_TOPOLOGY: Array<[TileCoordinate, TopologyEntry]> = [
  [[0, 0, 0], { kind: "LAND" }],
  [[1, -1, 0], { kind: "LAND" }],
  [[0, -1, 1], { kind: "LAND" }],
  [[-1, 0, 1], { kind: "LAND" }],
  [[-1, 1, 0], { kind: "LAND" }],
  [[0, 1, -1], { kind: "LAND" }],
  [[1, 0, -1], { kind: "LAND" }],
  [[2, -2, 0], { kind: "WATER" }],
  [[1, -2, 1], { kind: "WATER" }],
  [[0, -2, 2], { kind: "WATER" }],
  [[-1, -1, 2], { kind: "WATER" }],
  [[-2, 0, 2], { kind: "WATER" }],
  [[-2, 1, 1], { kind: "WATER" }],
  [[-2, 2, 0], { kind: "WATER" }],
  [[-1, 2, -1], { kind: "WATER" }],
  [[0, 2, -2], { kind: "WATER" }],
  [[1, 1, -2], { kind: "WATER" }],
  [[2, 0, -2], { kind: "WATER" }],
  [[2, -1, -1], { kind: "WATER" }],
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type InternalTile = {
  coordinate: TileCoordinate;
  tile: Tile;
  nodes: Record<NodeRef, number>;
  edges: Record<EdgeRef, [number, number]>;
};

type BuiltMap = {
  placedTiles: PlacedTile[];
  nodes: Record<string, GameNode>;
  edges: GameEdge[];
  adjacentTiles: Record<string, Tile[]>;
  nodeNeighbors: Record<number, number[]>;
  portNodes: Record<string, number[]>; // "WOOD" | ... | "ANY" => nodeIds
  robberCoordinate: TileCoordinate;
};

function buildLocalMap(template: MapTemplate): BuiltMap {
  const isMini = template === "MINI";
  const topology = isMini ? MINI_TOPOLOGY : BASE_TOPOLOGY;

  const tileResources = isMini
    ? shuffle<ResourceCard | null>([
        "WOOD",
        null,
        "BRICK",
        "SHEEP",
        "WHEAT",
        "WHEAT",
        "ORE",
      ])
    : shuffle<ResourceCard | null>([
        "WOOD",
        "WOOD",
        "WOOD",
        "WOOD",
        "BRICK",
        "BRICK",
        "BRICK",
        "SHEEP",
        "SHEEP",
        "SHEEP",
        "SHEEP",
        "WHEAT",
        "WHEAT",
        "WHEAT",
        "WHEAT",
        "ORE",
        "ORE",
        "ORE",
        null,
      ]);

  const numbers = isMini
    ? shuffle([3, 4, 5, 6, 8, 9, 10])
    : [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

  const portResources = isMini
    ? []
    : shuffle<ResourceCard | null>([
        "WOOD",
        "BRICK",
        "SHEEP",
        "WHEAT",
        "ORE",
        null,
        null,
        null,
        null,
      ]);

  const placedByCoord = new Map<string, InternalTile>();
  let nodeAutoinc = 0;
  let tileAutoinc = 0;
  let portAutoinc = 0;
  let numIdx = 0;
  let robberCoordinate: TileCoordinate = [0, 0, 0];

  for (const [coordinate, entry] of topology) {
    const nodes: Partial<Record<NodeRef, number>> = {};
    const edges: Partial<Record<EdgeRef, [number, number]>> = {};

    for (const d of EDGE_REFS) {
      const nCoord = addCoord(coordinate, UNIT_VECTORS[d]);
      const neighbor = placedByCoord.get(coordKey(nCoord));
      if (!neighbor) continue;

      if (d === "EAST") {
        nodes.NORTHEAST = neighbor.nodes.NORTHWEST;
        nodes.SOUTHEAST = neighbor.nodes.SOUTHWEST;
        edges.EAST = neighbor.edges.WEST;
      } else if (d === "SOUTHEAST") {
        nodes.SOUTH = neighbor.nodes.NORTHWEST;
        nodes.SOUTHEAST = neighbor.nodes.NORTH;
        edges.SOUTHEAST = neighbor.edges.NORTHWEST;
      } else if (d === "SOUTHWEST") {
        nodes.SOUTH = neighbor.nodes.NORTHEAST;
        nodes.SOUTHWEST = neighbor.nodes.NORTH;
        edges.SOUTHWEST = neighbor.edges.NORTHEAST;
      } else if (d === "WEST") {
        nodes.NORTHWEST = neighbor.nodes.NORTHEAST;
        nodes.SOUTHWEST = neighbor.nodes.SOUTHEAST;
        edges.WEST = neighbor.edges.EAST;
      } else if (d === "NORTHWEST") {
        nodes.NORTH = neighbor.nodes.SOUTHEAST;
        nodes.NORTHWEST = neighbor.nodes.SOUTH;
        edges.NORTHWEST = neighbor.edges.SOUTHEAST;
      } else if (d === "NORTHEAST") {
        nodes.NORTH = neighbor.nodes.SOUTHWEST;
        nodes.NORTHEAST = neighbor.nodes.SOUTH;
        edges.NORTHEAST = neighbor.edges.SOUTHWEST;
      }
    }

    for (const nr of NODE_REFS) {
      if (nodes[nr] === undefined) {
        nodes[nr] = nodeAutoinc++;
      }
    }
    const finalNodes = nodes as Record<NodeRef, number>;

    for (const er of EDGE_REFS) {
      if (edges[er] === undefined) {
        const [a, b] = getEdgeNodes(er);
        edges[er] = [finalNodes[a], finalNodes[b]];
      }
    }
    const finalEdges = edges as Record<EdgeRef, [number, number]>;

    let tileObj: Tile;
    if (entry.kind === "LAND") {
      const res = tileResources.pop() ?? null;
      if (res === null) {
        robberCoordinate = coordinate;
        tileObj = { id: tileAutoinc++, type: "DESERT" };
      } else {
        const num = numbers[numIdx++ % numbers.length];
        tileObj = {
          id: tileAutoinc++,
          type: "RESOURCE_TILE",
          resource: res,
          number: num,
        };
      }
    } else if (entry.kind === "PORT") {
      const portRes = portResources.pop() ?? null;
      tileObj = {
        id: portAutoinc++,
        type: "PORT",
        direction: entry.direction as Direction,
        resource: portRes,
      };
    } else {
      tileObj = { type: "WATER" };
    }

    placedByCoord.set(coordKey(coordinate), {
      coordinate,
      tile: tileObj,
      nodes: finalNodes,
      edges: finalEdges,
    });
  }

  const placedTiles: PlacedTile[] = [];
  const gameNodes: Record<string, GameNode> = {};
  const edgeMap = new Map<string, GameEdge>();
  const adjacentTiles: Record<string, Tile[]> = {};
  const nodeNeighbors: Record<number, number[]> = {};
  const portNodes: Record<string, number[]> = { ANY: [] };

  for (const internal of placedByCoord.values()) {
    placedTiles.push({
      coordinate: internal.coordinate,
      tile: internal.tile,
    });

    if (internal.tile.type === "PORT") {
      const dir = internal.tile.direction as EdgeRef;
      const [refA, refB] = PORT_DIRECTION_TO_NODEREFS[dir];
      const nA = internal.nodes[refA];
      const nB = internal.nodes[refB];
      const key = internal.tile.resource || "ANY";
      if (!portNodes[key]) portNodes[key] = [];
      if (!portNodes[key].includes(nA)) portNodes[key].push(nA);
      if (!portNodes[key].includes(nB)) portNodes[key].push(nB);
    }

    if (
      internal.tile.type === "RESOURCE_TILE" ||
      internal.tile.type === "DESERT"
    ) {
      for (const nr of NODE_REFS) {
        const nid = internal.nodes[nr];
        if (!gameNodes[String(nid)]) {
          gameNodes[String(nid)] = {
            id: nid,
            tile_coordinate: internal.coordinate,
            direction: nr as Direction,
            building: null,
            color: null,
          };
        }
        if (!adjacentTiles[String(nid)]) {
          adjacentTiles[String(nid)] = [];
        }
        adjacentTiles[String(nid)].push(internal.tile);
      }

      for (const er of EDGE_REFS) {
        const [u, v] = internal.edges[er];
        const eKey = u < v ? `${u}-${v}` : `${v}-${u}`;
        if (!edgeMap.has(eKey)) {
          edgeMap.set(eKey, {
            id: [u, v],
            color: null,
            direction: er as Direction,
            tile_coordinate: internal.coordinate,
          });
        }
        if (!nodeNeighbors[u]) nodeNeighbors[u] = [];
        if (!nodeNeighbors[v]) nodeNeighbors[v] = [];
        if (!nodeNeighbors[u].includes(v)) nodeNeighbors[u].push(v);
        if (!nodeNeighbors[v].includes(u)) nodeNeighbors[v].push(u);
      }
    }
  }

  return {
    placedTiles,
    nodes: gameNodes,
    edges: Array.from(edgeMap.values()),
    adjacentTiles,
    nodeNeighbors,
    portNodes,
    robberCoordinate,
  };
}

export type LocalSeatMeta = {
  color: Color;
  seat_kind: "USER" | "GUEST" | "BOT";
  username: string | null;
  player_key: string;
  display_name: string;
  avatar_config?: Partial<AvatarConfig> | null;
};

type StoredLocalGame = {
  state: GameState;
  nodeNeighbors: Record<number, number[]>;
  portNodes: Record<string, number[]>;
  initialQueue: Array<{ color: Color; type: "SETTLEMENT" | "ROAD"; secondRound: boolean }>;
  lastInitialSettlementNode: number | null;
  history: GameState[];
  seatMeta?: Record<Color, LocalSeatMeta>;
};

const GAMES_STORAGE_KEY = "catan_local_games_v1";
const ROOMS_STORAGE_KEY = "catan_local_rooms_v1";

function getSavedPlayerAccount(): PlayerAccount | null {
  try {
    const raw = localStorage.getItem("catan_player_account");
    return raw ? (JSON.parse(raw) as PlayerAccount) : null;
  } catch {
    return null;
  }
}

function getLocalUserDirectory(): Record<
  string,
  { username: string; display_name: string; avatar_config: Partial<AvatarConfig> }
> {
  const dir: Record<
    string,
    { username: string; display_name: string; avatar_config: Partial<AvatarConfig> }
  > = {};
  for (const [k, u] of Object.entries(loadLocalUsers())) {
    dir[k] = {
      username: u.username,
      display_name: u.display_name,
      avatar_config: sanitizeAvatarConfig(u.avatar_config),
    };
  }
  const saved = getSavedPlayerAccount();
  if (saved?.username) {
    const clean = saved.username
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 24);
    if (clean) {
      dir[clean] = {
        username: clean,
        display_name: saved.display_name || dir[clean]?.display_name || clean,
        avatar_config: {
          ...(dir[clean]?.avatar_config || {}),
          ...sanitizeAvatarConfig(saved.avatar_config),
        },
      };
    }
  }
  return dir;
}

function buildSeatViewsFromMeta(
  seatMeta?: Partial<Record<Color, LocalSeatMeta>>
): {
  seatNames: Partial<Record<Color, string>>;
  seatAvatars: Partial<Record<Color, SeatAvatarMeta>>;
} {
  const seatNames: Partial<Record<Color, string>> = {};
  const seatAvatars: Partial<Record<Color, SeatAvatarMeta>> = {};
  if (!seatMeta) return { seatNames, seatAvatars };

  const dir = getLocalUserDirectory();
  const usedBotNames = new Set<string>();
  for (const [colorKey, meta] of Object.entries(seatMeta)) {
    const color = colorKey as Color;
    if (!meta) continue;
    if (meta.seat_kind === "BOT") {
      const candidate = meta.display_name?.trim();
      const botName =
        isOfficialBotName(candidate) && !usedBotNames.has(candidate)
          ? candidate
          : pickBotNameDeterministic(
              Math.max(0, SEAT_COLORS.indexOf(color)),
              usedBotNames
            );
      usedBotNames.add(botName);
      seatNames[color] = botName;
      const botAvatar = sanitizeAvatarConfig(meta.avatar_config);
      seatAvatars[color] = {
        seat_kind: "BOT",
        username: null,
        avatar_config:
          Object.keys(botAvatar).length > 0
            ? botAvatar
            : BOT_AVATAR_PROFILES[botName],
      };
      continue;
    }

    const uname = meta.seat_kind === "USER" ? meta.username : null;
    const liveUser = uname ? dir[uname] : undefined;
    seatNames[color] = liveUser?.display_name || meta.display_name;
    const guestOrMetaAvatar =
      meta.seat_kind === "GUEST"
        ? filterUnlockedAvatarConfig(meta.avatar_config, 0)
        : sanitizeAvatarConfig(meta.avatar_config);
    seatAvatars[color] = {
      seat_kind: meta.seat_kind,
      username: uname,
      avatar_config: uname
        ? liveUser?.avatar_config || guestOrMetaAvatar
        : guestOrMetaAvatar,
    };
  }
  return { seatNames, seatAvatars };
}

function loadGamesMap(): Record<string, StoredLocalGame> {
  try {
    const raw = localStorage.getItem(GAMES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Number of most recent state snapshots kept per game. Each snapshot is a full
// board state (tens of KB); keeping all of them blew past the ~5 MB
// localStorage quota around turn ~55, which silently stopped saving and froze
// the bots. Older entries become `null` (indices are preserved).
const MAX_PERSISTED_SNAPSHOTS = 8;

function compactGame(game: StoredLocalGame, keep: number) {
  const cut = game.history.length - keep;
  for (let i = 0; i < cut; i++) {
    game.history[i] = null as unknown as GameState;
  }
}

function saveGamesMap(map: Record<string, StoredLocalGame>) {
  const keys = Object.keys(map);
  while (keys.length > 8) {
    delete map[keys.shift() as string];
  }
  for (const k of keys) {
    compactGame(map[k], MAX_PERSISTED_SNAPSHOTS);
  }
  // Retry with progressively less data instead of failing silently.
  for (const keep of [MAX_PERSISTED_SNAPSHOTS, 2, 0]) {
    try {
      localStorage.setItem(GAMES_STORAGE_KEY, JSON.stringify(map));
      return;
    } catch {
      for (const k of keys) compactGame(map[k], keep);
      // Last resort: drop the oldest games, never the current one.
      if (keep === 0 && keys.length > 1) {
        delete map[keys[0]];
      }
    }
  }
}

function pKey(state: GameState, color: Color): string {
  const idx = state.colors.indexOf(color);
  return `P${idx >= 0 ? idx : 0}`;
}

function sameEdge(a: [number, number], b: [number, number]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

function computeLongestRoadForColor(
  edges: GameEdge[],
  nodes: Record<string, GameNode>,
  color: Color
): number {
  const myEdges = edges.filter((e) => e.color === color);
  if (myEdges.length === 0) return 0;

  const adj = new Map<number, Array<{ to: number; edgeIdx: number }>>();
  myEdges.forEach((e, idx) => {
    const [u, v] = e.id;
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u)!.push({ to: v, edgeIdx: idx });
    adj.get(v)!.push({ to: u, edgeIdx: idx });
  });

  let best = 0;
  const used = new Set<number>();

  function dfs(node: number, length: number) {
    if (length > best) best = length;
    const neighbors = adj.get(node) || [];
    for (const next of neighbors) {
      if (used.has(next.edgeIdx)) continue;
      const occupant = nodes[String(next.to)]?.color;
      const blocked = occupant !== null && occupant !== color;
      used.add(next.edgeIdx);
      if (blocked) {
        if (length + 1 > best) best = length + 1;
      } else {
        dfs(next.to, length + 1);
      }
      used.delete(next.edgeIdx);
    }
  }

  for (const startNode of adj.keys()) {
    dfs(startNode, 0);
  }
  return best;
}

function recomputeScoresAndPlayableActions(game: StoredLocalGame) {
  const { state, nodeNeighbors, portNodes, initialQueue } = game;
  const ps = state.player_state;

  // Longest road & largest army
  let currentArmyOwner: Color | null = null;
  let maxArmy = 2;
  let currentRoadOwner: Color | null = null;
  let maxRoad = 4;

  for (const c of state.colors) {
    const k = pKey(state, c);
    if (ps[`${k}_HAS_ARMY`]) {
      currentArmyOwner = c;
      maxArmy = ps[`${k}_PLAYED_KNIGHT`] ?? 3;
    }
    if (ps[`${k}_HAS_ROAD`]) {
      currentRoadOwner = c;
    }
  }

  for (const c of state.colors) {
    const k = pKey(state, c);
    const roadLen = computeLongestRoadForColor(state.edges, state.nodes, c);
    ps[`${k}_LONGEST_ROAD_LENGTH`] = roadLen;
    state.longest_roads_by_player[c] = roadLen;
    if (roadLen > maxRoad) {
      maxRoad = roadLen;
      currentRoadOwner = c;
    }
    const knights = ps[`${k}_PLAYED_KNIGHT`] ?? 0;
    if (knights > maxArmy) {
      maxArmy = knights;
      currentArmyOwner = c;
    }
  }

  for (const c of state.colors) {
    const k = pKey(state, c);
    ps[`${k}_HAS_ROAD`] = currentRoadOwner === c;
    ps[`${k}_HAS_ARMY`] = currentArmyOwner === c;

    let settlements = 0;
    let cities = 0;
    for (const n of Object.values(state.nodes)) {
      if (n.color === c) {
        if (n.building === "SETTLEMENT") settlements++;
        if (n.building === "CITY") cities++;
      }
    }
    let roads = 0;
    for (const e of state.edges) {
      if (e.color === c) roads++;
    }

    ps[`${k}_SETTLEMENTS_AVAILABLE`] = Math.max(0, 5 - settlements);
    ps[`${k}_CITIES_AVAILABLE`] = Math.max(0, 4 - cities);
    ps[`${k}_ROADS_AVAILABLE`] = Math.max(0, 15 - roads);

    const vpCards = ps[`${k}_VICTORY_POINT_IN_HAND`] ?? 0;
    const publicVps =
      settlements +
      cities * 2 +
      (ps[`${k}_HAS_ROAD`] ? 2 : 0) +
      (ps[`${k}_HAS_ARMY`] ? 2 : 0);
    const actualVps = publicVps + vpCards;
    ps[`${k}_VICTORY_POINTS`] = publicVps;
    ps[`${k}_ACTUAL_VICTORY_POINTS`] = actualVps;

    const totalRes = RESOURCES.reduce(
      (sum, r) => sum + (ps[`${k}_${r}_IN_HAND`] ?? 0),
      0
    );
    const totalDev =
      (ps[`${k}_KNIGHT_IN_HAND`] ?? 0) +
      (ps[`${k}_MONOPOLY_IN_HAND`] ?? 0) +
      (ps[`${k}_YEAR_OF_PLENTY_IN_HAND`] ?? 0) +
      (ps[`${k}_ROAD_BUILDING_IN_HAND`] ?? 0) +
      vpCards;
    ps[`${k}_NUM_RESOURCES_IN_HAND`] = totalRes;
    ps[`${k}_NUM_DEVELOPMENT_CARDS_IN_HAND`] = totalDev;

    if (actualVps >= state.game.vps_to_win && !state.winning_color) {
      state.winning_color = c;
    }
  }

  if (state.winning_color) {
    state.current_playable_actions = [];
    return;
  }

  // Initial placement queue
  if (initialQueue.length > 0) {
    state.is_initial_build_phase = true;
    const step = initialQueue[0];
    state.current_color = step.color;
    const actions: GameAction[] = [];

    if (step.type === "SETTLEMENT") {
      state.current_prompt = "BUILD_INITIAL_SETTLEMENT";
      for (const n of Object.values(state.nodes)) {
        if (n.building !== null) continue;
        const neighborOccupied = (nodeNeighbors[n.id] || []).some(
          (nbId) => state.nodes[String(nbId)]?.building !== null
        );
        if (!neighborOccupied) {
          actions.push([step.color, "BUILD_SETTLEMENT", n.id]);
        }
      }
    } else {
      state.current_prompt = "BUILD_INITIAL_ROAD";
      const anchor = game.lastInitialSettlementNode;
      for (const e of state.edges) {
        if (e.color !== null) continue;
        if (anchor !== null && (e.id[0] === anchor || e.id[1] === anchor)) {
          actions.push([step.color, "BUILD_ROAD", e.id]);
        }
      }
    }
    state.current_playable_actions = actions;
    return;
  }

  state.is_initial_build_phase = false;
  const color = state.current_color;
  const k = pKey(state, color);

  if (state.current_prompt === "MOVE_ROBBER") {
    const actions: GameAction[] = [];
    for (const pt of state.tiles) {
      if (pt.tile.type !== "RESOURCE_TILE" && pt.tile.type !== "DESERT") {
        continue;
      }
      if (coordKey(pt.coordinate) === coordKey(state.robber_coordinate)) {
        continue;
      }
      // Find opponent colors with buildings on this hex
      const victims = new Set<Color>();
      for (const n of Object.values(state.nodes)) {
        if (n.color && n.color !== color) {
          const adj = state.adjacent_tiles[String(n.id)] || [];
          if (adj.some((t) => "id" in t && "id" in pt.tile && t.id === pt.tile.id)) {
            const vk = pKey(state, n.color);
            if ((ps[`${vk}_NUM_RESOURCES_IN_HAND`] ?? 0) > 0) {
              victims.add(n.color);
            }
          }
        }
      }
      if (victims.size === 0) {
        actions.push([color, "MOVE_ROBBER", [pt.coordinate]]);
      } else {
        for (const v of victims) {
          actions.push([color, "MOVE_ROBBER", [pt.coordinate, v]]);
        }
      }
    }
    state.current_playable_actions = actions;
    return;
  }

  // Normal PLAY_TURN
  state.current_prompt = "PLAY_TURN";
  if (!ps[`${k}_HAS_ROLLED`]) {
    state.current_playable_actions = [[color, "ROLL", null]];
    return;
  }

  const actions: GameAction[] = [[color, "END_TURN", null]];
  const wood = ps[`${k}_WOOD_IN_HAND`] ?? 0;
  const brick = ps[`${k}_BRICK_IN_HAND`] ?? 0;
  const sheep = ps[`${k}_SHEEP_IN_HAND`] ?? 0;
  const wheat = ps[`${k}_WHEAT_IN_HAND`] ?? 0;
  const ore = ps[`${k}_ORE_IN_HAND`] ?? 0;

  // Connected nodes/edges for this player
  const connectedNodes = new Set<number>();
  for (const e of state.edges) {
    if (e.color === color) {
      connectedNodes.add(e.id[0]);
      connectedNodes.add(e.id[1]);
    }
  }
  for (const n of Object.values(state.nodes)) {
    if (n.color === color) connectedNodes.add(n.id);
  }

  // BUILD_ROAD
  if (wood >= 1 && brick >= 1 && (ps[`${k}_ROADS_AVAILABLE`] ?? 0) > 0) {
    for (const e of state.edges) {
      if (e.color !== null) continue;
      if (connectedNodes.has(e.id[0]) || connectedNodes.has(e.id[1])) {
        actions.push([color, "BUILD_ROAD", e.id]);
      }
    }
  }

  // BUILD_SETTLEMENT
  if (
    wood >= 1 &&
    brick >= 1 &&
    sheep >= 1 &&
    wheat >= 1 &&
    (ps[`${k}_SETTLEMENTS_AVAILABLE`] ?? 0) > 0
  ) {
    for (const n of Object.values(state.nodes)) {
      if (n.building !== null) continue;
      if (!connectedNodes.has(n.id)) continue;
      const neighborOccupied = (nodeNeighbors[n.id] || []).some(
        (nbId) => state.nodes[String(nbId)]?.building !== null
      );
      if (!neighborOccupied) {
        actions.push([color, "BUILD_SETTLEMENT", n.id]);
      }
    }
  }

  // BUILD_CITY
  if (wheat >= 2 && ore >= 3 && (ps[`${k}_CITIES_AVAILABLE`] ?? 0) > 0) {
    for (const n of Object.values(state.nodes)) {
      if (n.color === color && n.building === "SETTLEMENT") {
        actions.push([color, "BUILD_CITY", n.id]);
      }
    }
  }

  // BUY_DEVELOPMENT_CARD
  if (sheep >= 1 && wheat >= 1 && ore >= 1) {
    actions.push([color, "BUY_DEVELOPMENT_CARD", null]);
  }

  // Playable dev cards
  if ((ps[`${k}_KNIGHT_IN_HAND`] ?? 0) > 0) {
    actions.push([color, "PLAY_KNIGHT_CARD", null]);
  }
  if ((ps[`${k}_ROAD_BUILDING_IN_HAND`] ?? 0) > 0) {
    actions.push([color, "PLAY_ROAD_BUILDING", null]);
  }
  if ((ps[`${k}_MONOPOLY_IN_HAND`] ?? 0) > 0) {
    for (const r of RESOURCES) {
      actions.push([color, "PLAY_MONOPOLY", r]);
    }
  }
  if ((ps[`${k}_YEAR_OF_PLENTY_IN_HAND`] ?? 0) > 0) {
    for (let i = 0; i < RESOURCES.length; i++) {
      for (let j = i; j < RESOURCES.length; j++) {
        actions.push([
          color,
          "PLAY_YEAR_OF_PLENTY",
          [RESOURCES[i], RESOURCES[j]],
        ]);
      }
    }
  }

  // MARITIME_TRADE (4:1, 3:1 generic port, 2:1 specialized port)
  const ownedNodeIds = new Set<number>(
    Object.values(state.nodes)
      .filter((n) => n.color === color)
      .map((n) => n.id)
  );
  const has3to1Port = (portNodes.ANY || []).some((nid) =>
    ownedNodeIds.has(nid)
  );

  for (const giveRes of RESOURCES) {
    const has2to1 = (portNodes[giveRes] || []).some((nid) =>
      ownedNodeIds.has(nid)
    );
    const rate = has2to1 ? 2 : has3to1Port ? 3 : 4;
    const count = ps[`${k}_${giveRes}_IN_HAND`] ?? 0;
    if (count >= rate) {
      for (const recvRes of RESOURCES) {
        if (recvRes === giveRes) continue;
        const tuple: (ResourceCard | null)[] = [
          null,
          null,
          null,
          null,
          recvRes,
        ];
        for (let rIdx = 0; rIdx < rate; rIdx++) {
          tuple[rIdx] = giveRes;
        }
        actions.push([color, "MARITIME_TRADE", tuple]);
      }
    }
  }

  state.current_playable_actions = actions;
}

function applyActionToGame(game: StoredLocalGame, action: GameAction) {
  const { state } = game;
  const ps = state.player_state;
  const color = action[0];
  const k = pKey(state, color);
  const actionType = action[1];

  if (actionType === "BUILD_SETTLEMENT") {
    const nodeId = action[2];
    const node = state.nodes[String(nodeId)];
    if (node) {
      node.color = color;
      node.building = "SETTLEMENT";
    }
    if (game.initialQueue.length > 0) {
      const step = game.initialQueue.shift()!;
      game.lastInitialSettlementNode = nodeId;
      if (step.secondRound) {
        // Grant starting resources for adjacent resource tiles
        const adj = state.adjacent_tiles[String(nodeId)] || [];
        for (const t of adj) {
          if (t.type === "RESOURCE_TILE") {
            ps[`${k}_${t.resource}_IN_HAND`] =
              (ps[`${k}_${t.resource}_IN_HAND`] ?? 0) + 1;
          }
        }
      }
    } else {
      ps[`${k}_WOOD_IN_HAND`]--;
      ps[`${k}_BRICK_IN_HAND`]--;
      ps[`${k}_SHEEP_IN_HAND`]--;
      ps[`${k}_WHEAT_IN_HAND`]--;
    }
    state.action_records.push([action, null]);
  } else if (actionType === "BUILD_ROAD") {
    const edgeId = action[2];
    const edge = state.edges.find((e) => sameEdge(e.id, edgeId));
    if (edge) {
      edge.color = color;
    }
    if (game.initialQueue.length > 0) {
      game.initialQueue.shift();
      game.lastInitialSettlementNode = null;
      if (game.initialQueue.length === 0) {
        state.current_color = state.colors[0];
      }
    } else {
      ps[`${k}_WOOD_IN_HAND`] = Math.max(0, (ps[`${k}_WOOD_IN_HAND`] ?? 0) - 1);
      ps[`${k}_BRICK_IN_HAND`] = Math.max(0, (ps[`${k}_BRICK_IN_HAND`] ?? 0) - 1);
    }
    state.action_records.push([action, null]);
  } else if (actionType === "BUILD_CITY") {
    const nodeId = action[2];
    const node = state.nodes[String(nodeId)];
    if (node) {
      node.building = "CITY";
    }
    ps[`${k}_WHEAT_IN_HAND`] -= 2;
    ps[`${k}_ORE_IN_HAND`] -= 3;
    state.action_records.push([action, null]);
  } else if (actionType === "ROLL") {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;
    ps[`${k}_HAS_ROLLED`] = true;
    state.action_records.push([action, [d1, d2]]);

    if (sum === 7) {
      state.current_prompt = "MOVE_ROBBER";
    } else {
      for (const n of Object.values(state.nodes)) {
        if (!n.color || !n.building) continue;
        const nk = pKey(state, n.color);
        const qty = n.building === "CITY" ? 2 : 1;
        for (const pt of state.tiles) {
          if (
            pt.tile.type === "RESOURCE_TILE" &&
            pt.tile.number === sum &&
            coordKey(pt.coordinate) !== coordKey(state.robber_coordinate)
          ) {
            const adj = state.adjacent_tiles[String(n.id)] || [];
            const targetTileId = pt.tile.id;
            if (adj.some((t) => "id" in t && t.id === targetTileId)) {
              ps[`${nk}_${pt.tile.resource}_IN_HAND`] =
                (ps[`${nk}_${pt.tile.resource}_IN_HAND`] ?? 0) + qty;
            }
          }
        }
      }
    }
  } else if (actionType === "MOVE_ROBBER") {
    const [coord, victimColor] = action[2];
    state.robber_coordinate = coord;
    let stolen: ResourceCard | null = null;
    if (victimColor) {
      const vk = pKey(state, victimColor as Color);
      const availableRes = RESOURCES.filter(
        (r) => (ps[`${vk}_${r}_IN_HAND`] ?? 0) > 0
      );
      if (availableRes.length > 0) {
        stolen = availableRes[Math.floor(Math.random() * availableRes.length)];
        ps[`${vk}_${stolen}_IN_HAND`]--;
        ps[`${k}_${stolen}_IN_HAND`] = (ps[`${k}_${stolen}_IN_HAND`] ?? 0) + 1;
      }
    }
    state.current_prompt = "PLAY_TURN";
    state.action_records.push([action, stolen]);
  } else if (actionType === "BUY_DEVELOPMENT_CARD") {
    ps[`${k}_SHEEP_IN_HAND`]--;
    ps[`${k}_WHEAT_IN_HAND`]--;
    ps[`${k}_ORE_IN_HAND`]--;
    const deck: Array<DevelopmentCard | "VICTORY_POINT"> = [
      "KNIGHT",
      "KNIGHT",
      "KNIGHT",
      "YEAR_OF_PLENTY",
      "MONOPOLY",
      "ROAD_BUILDING",
      "VICTORY_POINT",
    ];
    const drawn = deck[Math.floor(Math.random() * deck.length)];
    ps[`${k}_${drawn}_IN_HAND`] = (ps[`${k}_${drawn}_IN_HAND`] ?? 0) + 1;
    state.action_records.push([action, drawn as DevelopmentCard]);
  } else if (actionType === "PLAY_KNIGHT_CARD") {
    ps[`${k}_KNIGHT_IN_HAND`] = Math.max(0, (ps[`${k}_KNIGHT_IN_HAND`] ?? 0) - 1);
    ps[`${k}_PLAYED_KNIGHT`] = (ps[`${k}_PLAYED_KNIGHT`] ?? 0) + 1;
    state.current_prompt = "MOVE_ROBBER";
    state.action_records.push([action, null]);
  } else if (actionType === "PLAY_MONOPOLY") {
    const targetRes = action[2];
    ps[`${k}_MONOPOLY_IN_HAND`] = Math.max(
      0,
      (ps[`${k}_MONOPOLY_IN_HAND`] ?? 0) - 1
    );
    let totalClaimed = 0;
    for (const c of state.colors) {
      if (c === color) continue;
      const ck = pKey(state, c);
      const amt = ps[`${ck}_${targetRes}_IN_HAND`] ?? 0;
      ps[`${ck}_${targetRes}_IN_HAND`] = 0;
      totalClaimed += amt;
    }
    ps[`${k}_${targetRes}_IN_HAND`] =
      (ps[`${k}_${targetRes}_IN_HAND`] ?? 0) + totalClaimed;
    state.action_records.push([action, null]);
  } else if (actionType === "PLAY_YEAR_OF_PLENTY") {
    ps[`${k}_YEAR_OF_PLENTY_IN_HAND`] = Math.max(
      0,
      (ps[`${k}_YEAR_OF_PLENTY_IN_HAND`] ?? 0) - 1
    );
    for (const r of action[2]) {
      ps[`${k}_${r}_IN_HAND`] = (ps[`${k}_${r}_IN_HAND`] ?? 0) + 1;
    }
    state.action_records.push([action, null]);
  } else if (actionType === "MARITIME_TRADE") {
    const Offer = action[2];
    const giveList = Offer.slice(0, 4).filter(
      (r): r is ResourceCard => r !== null
    );
    const recv = Offer[4];
    if (giveList.length > 0 && recv) {
      const giveRes = giveList[0];
      ps[`${k}_${giveRes}_IN_HAND`] -= giveList.length;
      ps[`${k}_${recv}_IN_HAND`] = (ps[`${k}_${recv}_IN_HAND`] ?? 0) + 1;
    }
    state.action_records.push([action, null]);
  } else if (actionType === "END_TURN") {
    ps[`${k}_HAS_ROLLED`] = false;
    const curIdx = state.colors.indexOf(color);
    const nextIdx = (curIdx + 1) % state.colors.length;
    state.current_color = state.colors[nextIdx];
    state.current_player_index = nextIdx;
    state.current_turn_index = nextIdx;
    state.num_turns = (state.num_turns ?? 0) + 1;
    state.action_records.push([action, null]);
  }

  state.state_index = state.action_records.length;
  recomputeScoresAndPlayableActions(game);
  game.history.push(JSON.parse(JSON.stringify(state)));

  if (state.winning_color) {
    const winnerColor = state.winning_color;
    const meta: Partial<Record<Color, LocalSeatMeta>> = game.seatMeta || {};
    const participants: MatchParticipant[] = state.colors.map((c) => {
      const pIndexKey = pKey(state, c);
      const vps = state.player_state[`${pIndexKey}_ACTUAL_VICTORY_POINTS`] ?? 0;
      const m = meta[c];
      const isWinner = c === winnerColor;
      return {
        color: c,
        seat_kind: m?.seat_kind ?? (state.bot_colors.includes(c) ? "BOT" : "GUEST"),
        username: m?.username ?? null,
        player_key: m?.player_key ?? (state.bot_colors.includes(c) ? "CATANATRON" : "HUMAN"),
        display_name: m?.display_name ?? state.seat_names?.[c] ?? c,
        victory_points: vps,
        is_winner: isWinner,
      };
    });
    const winnerPart = participants.find((p) => p.color === winnerColor);
    const winnerIsBot = winnerPart?.seat_kind === "BOT";
    localRecordCompletedMatch({
      game_id: state.game.id,
      room_code: state.room_code || null,
      mode: state.room_code ? "MULTIPLAYER" : "SOLO",
      map_template: "BASE",
      vps_to_win: state.game.vps_to_win,
      num_turns: state.num_turns,
      winning_color: winnerColor,
      winner_name: winnerPart?.display_name || winnerColor,
      winner_username: winnerPart?.seat_kind === "USER" ? winnerPart.username : null,
      winner_is_bot: winnerIsBot,
      participants,
    });
  }
}

function chooseBotAction(game: StoredLocalGame): GameAction | null {
  const { state } = game;
  const playable = state.current_playable_actions;
  if (playable.length === 0) return null;

  // Priority heuristic for Catanatron AI fallback
  const roll = playable.find((a) => a[1] === "ROLL");
  if (roll) return roll;

  if (state.is_initial_build_phase) {
    const settlements = playable.filter((a) => a[1] === "BUILD_SETTLEMENT");
    if (settlements.length > 0) {
      // Score each node by pip count of adjacent resource tiles
      let best = settlements[0];
      let bestScore = -1;
      for (const act of settlements) {
        const nid = act[2] as number;
        const adj = state.adjacent_tiles[String(nid)] || [];
        const score = adj.reduce((acc, t) => {
          if (t.type !== "RESOURCE_TILE") return acc;
          const pips = 6 - Math.abs(7 - t.number);
          return acc + pips;
        }, 0);
        if (score > bestScore) {
          bestScore = score;
          best = act;
        }
      }
      return best;
    }
    return playable[Math.floor(Math.random() * playable.length)];
  }

  const city = playable.find((a) => a[1] === "BUILD_CITY");
  if (city) return city;

  const settlement = playable.find((a) => a[1] === "BUILD_SETTLEMENT");
  if (settlement) return settlement;

  const knight = playable.find((a) => a[1] === "PLAY_KNIGHT_CARD");
  if (knight) return knight;

  const moveRobber = playable.filter((a) => a[1] === "MOVE_ROBBER");
  if (moveRobber.length > 0) {
    const withVictim = moveRobber.filter((a) => a[2][1] !== undefined);
    return withVictim.length > 0
      ? withVictim[Math.floor(Math.random() * withVictim.length)]
      : moveRobber[0];
  }

  const buyDev = playable.find((a) => a[1] === "BUY_DEVELOPMENT_CARD");
  if (buyDev && Math.random() < 0.55) return buyDev;

  const road = playable.filter((a) => a[1] === "BUILD_ROAD");
  if (road.length > 0 && Math.random() < 0.65) {
    return road[Math.floor(Math.random() * road.length)];
  }

  const trade = playable.filter((a) => a[1] === "MARITIME_TRADE");
  if (trade.length > 0 && Math.random() < 0.35) {
    return trade[0];
  }

  const endTurn = playable.find((a) => a[1] === "END_TURN");
  return endTurn || playable[0];
}

export function localCreateGame(options: {
  players: string[];
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
  seatNames?: Partial<Record<Color, string>>;
  roomCode?: string;
  seatMeta?: Record<Color, LocalSeatMeta>;
  hostAvatarConfig?: Partial<AvatarConfig>;
}): string {
  const built = buildLocalMap(options.mapTemplate);
  const colors = SEAT_COLORS.slice(0, Math.max(2, Math.min(4, options.players.length)));
  const botColors = colors.filter((_, idx) => options.players[idx] !== "HUMAN");
  const gameId =
    "local-" + Math.random().toString(36).substring(2, 10);

  const savedAcct = getSavedPlayerAccount();
  const defaultUser = savedAcct?.username
    ? {
        username: savedAcct.username,
        display_name: savedAcct.display_name || savedAcct.username,
        avatar_config: sanitizeAvatarConfig(savedAcct.avatar_config),
      }
    : null;

  const resolvedSeatMeta: Record<Color, LocalSeatMeta> = options.seatMeta
    ? { ...options.seatMeta }
    : ({} as Record<Color, LocalSeatMeta>);

  if (!options.seatMeta) {
    const guestProfile = !defaultUser ? getGuestProfile() : null;
    const resolvedGuestAvatar = !defaultUser
      ? filterUnlockedAvatarConfig(
          options.hostAvatarConfig ??
            (guestProfile?.customized ? guestProfile.avatar_config : undefined),
          0
        )
      : {};
    const usedBotNames = new Set<string>();
    let userAssigned = false;
    let guestHostAssigned = false;
    colors.forEach((c, idx) => {
      const pKey = options.players[idx] || "HUMAN";
      if (pKey === "HUMAN") {
        if (defaultUser && !userAssigned) {
          resolvedSeatMeta[c] = {
            color: c,
            seat_kind: "USER",
            username: defaultUser.username,
            player_key: "HUMAN",
            display_name: options.seatNames?.[c] || defaultUser.display_name,
            avatar_config: defaultUser.avatar_config,
          };
          userAssigned = true;
        } else {
          const isPrimaryGuest = !defaultUser && !guestHostAssigned;
          if (isPrimaryGuest) {
            guestHostAssigned = true;
          }
          const guestFallbackName =
            isPrimaryGuest &&
            guestProfile?.display_name &&
            guestProfile.display_name !== DEFAULT_GUEST_DISPLAY_NAME
              ? guestProfile.display_name
              : undefined;
          resolvedSeatMeta[c] = {
            color: c,
            seat_kind: "GUEST",
            username: null,
            player_key: "HUMAN",
            display_name:
              options.seatNames?.[c] ||
              guestFallbackName ||
              PLAYER_COLOR_META[c].label,
            avatar_config: isPrimaryGuest ? resolvedGuestAvatar : {},
          };
        }
      } else {
        const requestedName = options.seatNames?.[c];
        const botName =
          isOfficialBotName(requestedName) && !usedBotNames.has(requestedName)
            ? requestedName
            : pickBotNames(1, usedBotNames)[0];
        usedBotNames.add(botName);
        resolvedSeatMeta[c] = {
          color: c,
          seat_kind: "BOT",
          username: null,
          player_key: pKey,
          display_name: botName,
          avatar_config: BOT_AVATAR_PROFILES[botName],
        };
      }
    });
  }

  const { seatNames: metaNames, seatAvatars } = buildSeatViewsFromMeta(resolvedSeatMeta);

  const playerState: Record<string, any> = {};
  colors.forEach((_, idx) => {
    const k = `P${idx}`;
    playerState[`${k}_ACTUAL_VICTORY_POINTS`] = 0;
    playerState[`${k}_VICTORY_POINTS`] = 0;
    playerState[`${k}_WOOD_IN_HAND`] = 0;
    playerState[`${k}_BRICK_IN_HAND`] = 0;
    playerState[`${k}_SHEEP_IN_HAND`] = 0;
    playerState[`${k}_WHEAT_IN_HAND`] = 0;
    playerState[`${k}_ORE_IN_HAND`] = 0;
    playerState[`${k}_KNIGHT_IN_HAND`] = 0;
    playerState[`${k}_MONOPOLY_IN_HAND`] = 0;
    playerState[`${k}_YEAR_OF_PLENTY_IN_HAND`] = 0;
    playerState[`${k}_ROAD_BUILDING_IN_HAND`] = 0;
    playerState[`${k}_VICTORY_POINT_IN_HAND`] = 0;
    playerState[`${k}_PLAYED_KNIGHT`] = 0;
    playerState[`${k}_LONGEST_ROAD_LENGTH`] = 0;
    playerState[`${k}_HAS_ARMY`] = false;
    playerState[`${k}_HAS_ROAD`] = false;
    playerState[`${k}_HAS_ROLLED`] = false;
    playerState[`${k}_SETTLEMENTS_AVAILABLE`] = 5;
    playerState[`${k}_CITIES_AVAILABLE`] = 4;
    playerState[`${k}_ROADS_AVAILABLE`] = 15;
  });

  const initialQueue: StoredLocalGame["initialQueue"] = [];
  for (const c of colors) {
    initialQueue.push({ color: c, type: "SETTLEMENT", secondRound: false });
    initialQueue.push({ color: c, type: "ROAD", secondRound: false });
  }
  for (const c of [...colors].reverse()) {
    initialQueue.push({ color: c, type: "SETTLEMENT", secondRound: true });
    initialQueue.push({ color: c, type: "ROAD", secondRound: true });
  }

  const state: GameState = {
    tiles: built.placedTiles,
    adjacent_tiles: built.adjacentTiles,
    bot_colors: botColors,
    colors,
    current_color: colors[0],
    winning_color: null,
    current_prompt: "BUILD_INITIAL_SETTLEMENT",
    player_state: playerState,
    action_records: [],
    robber_coordinate: built.robberCoordinate,
    current_discard_count: 0,
    nodes: built.nodes,
    edges: built.edges,
    current_playable_actions: [],
    is_initial_build_phase: true,
    longest_roads_by_player: {},
    state_index: 0,
    seat_names: { ...metaNames, ...(options.seatNames || {}) },
    seat_avatars: seatAvatars,
    room_code: options.roomCode,
    schema_version: 2,
    game: {
      id: gameId,
      vps_to_win: options.vpsToWin,
      discard_limit: options.discardLimit,
      friendly_robber: options.friendlyRobber,
    },
    num_turns: 0,
    current_player_index: 0,
    current_turn_index: 0,
    resource_freqdeck: [19, 19, 19, 19, 19],
    development_listdeck: { KNIGHT: 14, VICTORY_POINT: 5 },
  };

  const stored: StoredLocalGame = {
    state,
    nodeNeighbors: built.nodeNeighbors,
    portNodes: built.portNodes,
    initialQueue,
    lastInitialSettlementNode: null,
    history: [JSON.parse(JSON.stringify(state))],
    seatMeta: resolvedSeatMeta,
  };

  recomputeScoresAndPlayableActions(stored);
  stored.history = [JSON.parse(JSON.stringify(stored.state))];

  const map = loadGamesMap();
  map[gameId] = stored;
  saveGamesMap(map);
  return gameId;
}

export function localGetState(
  gameId: string,
  stateIndex: number | string = "latest"
): GameState {
  const map = loadGamesMap();
  let game = map[gameId];
  if (!game) {
    // Auto-create a game if user navigated directly to a URL
    const createdId = localCreateGame({
      players: ["HUMAN", "CATANATRON", "CATANATRON", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const freshMap = loadGamesMap();
    game = freshMap[createdId];
    game.state.game.id = gameId;
    freshMap[gameId] = game;
    saveGamesMap(freshMap);
  }
  const idx = Number(stateIndex);
  const rawState =
    stateIndex === "latest"
      ? game.state
      : game.history[idx] || game.state;
  const cloned = JSON.parse(JSON.stringify(rawState)) as GameState;
  if (game.seatMeta) {
    const { seatNames, seatAvatars } = buildSeatViewsFromMeta(game.seatMeta);
    cloned.seat_names = { ...(cloned.seat_names || {}), ...seatNames };
    cloned.seat_avatars = seatAvatars;
  }
  return cloned;
}

export function localPostAction(
  gameId: string,
  action?: GameAction
): GameState {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game) {
    return localGetState(gameId, "latest");
  }
  const chosen = action ?? chooseBotAction(game);
  if (chosen) {
    applyActionToGame(game, chosen);
    saveGamesMap(map);
  }
  const cloned = JSON.parse(JSON.stringify(game.state)) as GameState;
  if (game.seatMeta) {
    const { seatNames, seatAvatars } = buildSeatViewsFromMeta(game.seatMeta);
    cloned.seat_names = { ...(cloned.seat_names || {}), ...seatNames };
    cloned.seat_avatars = seatAvatars;
  }
  return cloned;
}

export function localGetMctsAnalysis(gameId: string): {
  success: true;
  probabilities: MCTSProbabilities;
  state_index: number;
} {
  const state = localGetState(gameId, "latest");
  const weights: Record<string, number> = {};
  let total = 0;
  for (const c of state.colors) {
    const k = pKey(state, c);
    const vps = state.player_state[`${k}_ACTUAL_VICTORY_POINTS`] ?? 2;
    const w = Math.pow(Math.max(1, vps), 2);
    weights[c] = w;
    total += w;
  }
  const probabilities = {} as MCTSProbabilities;
  for (const c of state.colors) {
    probabilities[c] = Math.round(((weights[c] || 1) / (total || 1)) * 100);
  }
  return {
    success: true,
    probabilities,
    state_index: state.state_index,
  };
}

// ===== Local Account & Room Manager Fallback =====
const LOCAL_USERS_KEY = "rule_isle_local_users_v1";
const LOCAL_MATCHES_KEY = "rule_isle_local_matches_v1";

type LocalUserRecord = {
  username: string;
  display_name: string;
  password: string;
  avatar_config?: Partial<AvatarConfig>;
};

function loadLocalUsers(): Record<string, LocalUserRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function localGetUserRankAndStats(username: string): {
  leaderboard_rank: number | null;
  stats: AccountStats;
} {
  const cleanUser = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  if (!cleanUser) {
    return {
      leaderboard_rank: null,
      stats: { wins: 0, losses: 0, games_played: 0, win_rate: 0 },
    };
  }
  const lb = localGetLeaderboard();
  const row = lb.find((e) => e.username === cleanUser);
  if (!row) {
    return {
      leaderboard_rank: null,
      stats: { wins: 0, losses: 0, games_played: 0, win_rate: 0 },
    };
  }
  return {
    leaderboard_rank: row.rank,
    stats: {
      wins: row.wins,
      losses: row.losses,
      games_played: row.games_played,
      win_rate: row.win_rate,
    },
  };
}

export function localRegisterUser(options: {
  username: string;
  password: string;
  displayName?: string;
  avatarConfig?: Partial<AvatarConfig>;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  if (cleanUser.length < 2) {
    throw new Error("Usuário deve ter pelo menos 2 caracteres.");
  }
  const users = loadLocalUsers();
  if (users[cleanUser]) {
    throw new Error("Este usuário já está cadastrado localmente.");
  }
  const display_name = (options.displayName || options.username).trim() || cleanUser;
  const cleanAvatar = filterUnlockedAvatarConfig(options.avatarConfig, 0);
  users[cleanUser] = {
    username: cleanUser,
    display_name,
    password: options.password,
    avatar_config: cleanAvatar,
  };
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
  const rankMeta = localGetUserRankAndStats(cleanUser);
  return {
    username: cleanUser,
    display_name,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: cleanAvatar,
    stats: rankMeta.stats,
    leaderboard_rank: rankMeta.leaderboard_rank,
    is_new: true,
  };
}

export function localLoginUser(options: {
  username: string;
  password: string;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  const users = loadLocalUsers();
  const existing = users[cleanUser];
  if (!existing || existing.password !== options.password) {
    throw new Error("Usuário ou senha incorretos.");
  }
  const rankMeta = localGetUserRankAndStats(existing.username);
  return {
    username: existing.username,
    display_name: existing.display_name,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: sanitizeAvatarConfig(existing.avatar_config),
    stats: rankMeta.stats,
    leaderboard_rank: rankMeta.leaderboard_rank,
    is_new: false,
  };
}

export function localUpdateProfile(options: {
  username: string;
  displayName?: string;
  avatarConfig?: Partial<AvatarConfig> | null;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  if (!cleanUser) {
    throw new Error("Usuário inválido.");
  }

  const users = loadLocalUsers();
  let existing = users[cleanUser];
  if (!existing) {
    const saved = getSavedPlayerAccount();
    const savedMatches = saved?.username === cleanUser;
    existing = {
      username: cleanUser,
      display_name: savedMatches ? saved.display_name || cleanUser : cleanUser,
      password: "",
      avatar_config: savedMatches
        ? sanitizeAvatarConfig(saved.avatar_config)
        : {},
    };
  }

  const existingAvatar = sanitizeAvatarConfig(existing.avatar_config);
  const incomingAvatar = sanitizeAvatarConfig(options.avatarConfig || {});
  const mergedAvatar: Partial<AvatarConfig> = {
    ...existingAvatar,
    ...incomingAvatar,
  };

  const statsEntry = localGetLeaderboard().find((e) => e.username === cleanUser);
  const wins = statsEntry?.wins ?? 0;

  for (const [field, rules] of Object.entries(AVATAR_UNLOCK_REQUIREMENTS)) {
    const val = (mergedAvatar as Record<string, string | undefined>)[field];
    if (
      val &&
      rules &&
      val in rules &&
      !isAvatarItemUnlocked(field as keyof AvatarConfig, val, wins)
    ) {
      const reqWins = rules[val];
      const msg = `Este item requer ${reqWins} vitória(s) no Ranking para ser desbloqueado (você tem ${wins}).`;
      const err = new Error(msg) as Error & {
        response?: { status: number; data: { description: string } };
      };
      err.response = { status: 403, data: { description: msg } };
      throw err;
    }
  }

  const nextDisplay =
    options.displayName && options.displayName.trim()
      ? options.displayName.trim().slice(0, 32)
      : existing.display_name;

  users[cleanUser] = {
    ...existing,
    display_name: nextDisplay,
    avatar_config: mergedAvatar,
  };
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    const saved = getSavedPlayerAccount();
    if (saved?.username === cleanUser) {
      localStorage.setItem(
        "catan_player_account",
        JSON.stringify({
          ...saved,
          display_name: nextDisplay,
          avatar_config: mergedAvatar,
          leaderboard_rank: statsEntry?.rank ?? saved.leaderboard_rank ?? null,
        })
      );
    }
  } catch {
    // ignore
  }

  return {
    username: cleanUser,
    display_name: nextDisplay,
    auth_token: `local_${cleanUser}_${btoa(cleanUser)}`,
    avatar_config: mergedAvatar,
    leaderboard_rank: statsEntry?.rank ?? null,
    stats: statsEntry
      ? {
          wins: statsEntry.wins,
          losses: statsEntry.losses,
          games_played: statsEntry.games_played,
          win_rate: statsEntry.win_rate,
        }
      : { wins: 0, losses: 0, games_played: 0, win_rate: 0 },
    is_new: false,
  };
}

export function localRecordCompletedMatch(
  input: Omit<MatchRecord, "finished_at"> & { finished_at?: number }
): MatchRecord {
  const matches = localGetMatchHistory();
  const existing = matches.find((m) => m.game_id === input.game_id);
  if (existing) return existing;

  const entry: MatchRecord = {
    ...input,
    finished_at: input.finished_at ?? Math.floor(Date.now() / 1000),
  };
  const next = [entry, ...matches].slice(0, 100);
  try {
    localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage limits
  }
  return entry;
}

export function localGetMatchHistory(username?: string): MatchRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_MATCHES_KEY);
    const list: MatchRecord[] = raw ? JSON.parse(raw) : [];
    const filtered = username
      ? list.filter((m) =>
          m.participants.some(
            (p) => p.seat_kind === "USER" && p.username === username.toLowerCase().trim()
          )
        )
      : list;
    return filtered.sort((a, b) => b.finished_at - a.finished_at);
  } catch {
    return [];
  }
}

export function localGetLeaderboard(
  extraUsers?: Array<{
    username: string;
    display_name: string;
    avatar_config?: Partial<AvatarConfig>;
  }>
): LeaderboardEntry[] {
  const usersMap = getLocalUserDirectory();
  for (const u of extraUsers || []) {
    const existing = usersMap[u.username];
    usersMap[u.username] = {
      username: u.username,
      display_name: u.display_name,
      avatar_config: sanitizeAvatarConfig(
        u.avatar_config ?? existing?.avatar_config
      ),
    };
  }

  const counts: Record<string, { wins: number; games: number }> = {};
  for (const match of localGetMatchHistory()) {
    for (const p of match.participants) {
      if (p.seat_kind !== "USER" || !p.username) continue;
      if (!usersMap[p.username]) {
        usersMap[p.username] = {
          username: p.username,
          display_name: p.display_name,
          avatar_config: {},
        };
      }
      const bucket = counts[p.username] || { wins: 0, games: 0 };
      bucket.games += 1;
      if (p.is_winner) bucket.wins += 1;
      counts[p.username] = bucket;
    }
  }

  const rows: LeaderboardEntry[] = Object.values(usersMap).map((u) => {
    const { wins, games } = counts[u.username] || { wins: 0, games: 0 };
    const losses = Math.max(0, games - wins);
    const win_rate = games > 0 ? Math.round((wins / games) * 1000) / 10 : 0.0;
    return {
      rank: 0,
      username: u.username,
      display_name: u.display_name,
      avatar_config: sanitizeAvatarConfig(u.avatar_config),
      wins,
      losses,
      games_played: games,
      win_rate,
    };
  });

  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.win_rate - a.win_rate ||
      b.games_played - a.games_played ||
      a.username.localeCompare(b.username)
  );
  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

export function localLoginOrRegister(options: {
  username: string;
  pin: string;
  displayName?: string;
}): PlayerAccount {
  const cleanUser = options.username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  const token = `acct_${cleanUser}_${btoa(cleanUser + ":" + options.pin.trim()).replace(/=/g, "")}`;
  return {
    username: cleanUser || "jogador",
    display_name: (options.displayName || options.username).trim() || "Jogador",
    auth_token: token,
    is_new: false,
  };
}

function loadRoomsMap(): Record<string, RoomState & { host_token: string; seat_tokens: Record<string, string | null> }> {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRoomsMap(
  map: Record<string, RoomState & { host_token: string; seat_tokens: Record<string, string | null> }>
) {
  try {
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function localCreateRoom(options: {
  hostName: string;
  players: string[];
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
  token?: string | null;
  hostAvatarConfig?: Partial<AvatarConfig>;
}): { room_code: string; seat_token: string; room: RoomState } {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const hostToken = options.token || "tok_" + Math.random().toString(36).slice(2, 10);
  const savedAcct = getSavedPlayerAccount();
  const guestProfile = !savedAcct ? getGuestProfile() : null;
  const guestHostAvatar = !savedAcct
    ? filterUnlockedAvatarConfig(
        options.hostAvatarConfig ??
          (guestProfile?.customized ? guestProfile.avatar_config : undefined),
        0
      )
    : {};
  const seatTokens: Record<string, string | null> = {};
  const usedBotNames = new Set<string>();
  let hostSeated = false;

  const seats = options.players.slice(0, 4).map((pk, idx) => {
    const color = SEAT_COLORS[idx];
    if (pk === "HUMAN" && !hostSeated) {
      hostSeated = true;
      seatTokens[color] = hostToken;
      return {
        color,
        player_key: "HUMAN",
        player_name: options.hostName || "Anfitrião",
        is_bot: false,
        claimed: true,
        is_me: true,
        seat_kind: savedAcct?.username ? ("USER" as const) : ("GUEST" as const),
        username: savedAcct?.username ?? null,
        avatar_config: savedAcct?.username
          ? sanitizeAvatarConfig(savedAcct.avatar_config)
          : guestHostAvatar,
      };
    } else if (pk === "HUMAN") {
      seatTokens[color] = null;
      return {
        color,
        player_key: "HUMAN",
        player_name: "Aguardando Amigo...",
        is_bot: false,
        claimed: false,
        is_me: false,
        seat_kind: "GUEST" as const,
        username: null,
        avatar_config: {},
      };
    } else {
      seatTokens[color] = null;
      const botName = pickBotNames(1, usedBotNames)[0];
      usedBotNames.add(botName);
      return {
        color,
        player_key: pk,
        player_name: botName,
        is_bot: true,
        claimed: true,
        is_me: false,
        seat_kind: "BOT" as const,
        username: null,
        avatar_config: BOT_AVATAR_PROFILES[botName],
      };
    }
  });

  const room: RoomState = {
    room_code: code,
    status: "WAITING",
    game_id: null,
    is_host: true,
    my_color: seats.find((s) => s.is_me)?.color || "RED",
    config: {
      map_template: options.mapTemplate,
      vps_to_win: options.vpsToWin,
      discard_limit: options.discardLimit,
      friendly_robber: options.friendlyRobber,
    },
    seats,
  };

  const rooms = loadRoomsMap();
  rooms[code] = { ...room, host_token: hostToken, seat_tokens: seatTokens };
  saveRoomsMap(rooms);

  return { room_code: code, seat_token: hostToken, room };
}

export function localGetRoom(
  roomCode: string,
  token?: string | null
): RoomState {
  const code = roomCode.toUpperCase();
  const rooms = loadRoomsMap();
  let stored = rooms[code];
  if (!stored) {
    // Auto-create room if friend opened invite link directly on a new browser without shared DB
    const created = localCreateRoom({
      hostName: "Anfitrião",
      players: ["HUMAN", "HUMAN", "CATANATRON", "CATANATRON"],
      mapTemplate: "BASE",
      vpsToWin: 10,
      discardLimit: 7,
      friendlyRobber: true,
    });
    const freshRooms = loadRoomsMap();
    stored = {
      ...created.room,
      room_code: code,
      host_token: created.seat_token,
      seat_tokens: { RED: created.seat_token, BLUE: null, ORANGE: null, WHITE: null },
    };
    freshRooms[code] = stored;
    saveRoomsMap(freshRooms);
  }

  let myColor: Color | null = null;
  const dir = getLocalUserDirectory();
  const usedBotNames = new Set<string>();
  const seats = stored.seats.map((s, idx) => {
    const isMe = Boolean(token && stored.seat_tokens[s.color] === token);
    if (isMe) myColor = s.color;
    if (s.is_bot) {
      const botName =
        isOfficialBotName(s.player_name) && !usedBotNames.has(s.player_name)
          ? s.player_name
          : pickBotNameDeterministic(idx, usedBotNames);
      usedBotNames.add(botName);
      const botAvatar = sanitizeAvatarConfig(s.avatar_config);
      return {
        ...s,
        player_name: botName,
        seat_kind: "BOT" as const,
        username: null,
        avatar_config:
          Object.keys(botAvatar).length > 0
            ? botAvatar
            : BOT_AVATAR_PROFILES[botName],
        claimed: true,
        is_me: false,
      };
    }

    const uname = s.seat_kind === "USER" ? s.username || null : null;
    const resolvedKind: "USER" | "GUEST" =
      s.seat_kind === "USER" && uname ? "USER" : "GUEST";
    const guestAvatar = filterUnlockedAvatarConfig(s.avatar_config, 0);
    return {
      ...s,
      seat_kind: resolvedKind,
      username: uname,
      avatar_config: uname
        ? dir[uname]?.avatar_config || sanitizeAvatarConfig(s.avatar_config)
        : guestAvatar,
      claimed: Boolean(stored.seat_tokens[s.color]),
      is_me: isMe,
    };
  });

  return {
    room_code: stored.room_code,
    status: stored.status,
    game_id: stored.game_id,
    is_host: Boolean(token && stored.host_token === token),
    my_color: myColor,
    config: stored.config,
    seats,
  };
}

export function localJoinRoom(
  roomCode: string,
  options: {
    playerName: string;
    preferredColor?: Color;
    token?: string | null;
    avatarConfig?: Partial<AvatarConfig>;
  }
): { seat_token: string; seat_color: Color; room: RoomState } {
  const code = roomCode.toUpperCase();
  localGetRoom(code, options.token); // ensure exists
  const rooms = loadRoomsMap();
  const stored = rooms[code];
  const token =
    options.token || "tok_" + Math.random().toString(36).slice(2, 10);
  const savedAcct = getSavedPlayerAccount();
  const guestProfile = !savedAcct ? getGuestProfile() : null;
  const seatKind: "USER" | "GUEST" = savedAcct?.username ? "USER" : "GUEST";
  const seatUsername = savedAcct?.username ?? null;
  const seatAvatar = savedAcct?.username
    ? sanitizeAvatarConfig(savedAcct.avatar_config)
    : filterUnlockedAvatarConfig(
        options.avatarConfig ??
          (guestProfile?.customized ? guestProfile.avatar_config : undefined),
        0
      );

  let targetSeat = options.preferredColor
    ? stored.seats.find((s) => s.color === options.preferredColor)
    : stored.seats.find(
        (s) => !s.is_bot && (!stored.seat_tokens[s.color] || stored.seat_tokens[s.color] === token)
      );

  if (!targetSeat) {
    targetSeat = stored.seats[0];
  }

  // Clear previous seat of this token
  for (const s of stored.seats) {
    if (stored.seat_tokens[s.color] === token && s.color !== targetSeat.color) {
      stored.seat_tokens[s.color] = null;
      s.player_name = "Aguardando Amigo...";
      s.claimed = false;
      s.seat_kind = "GUEST";
      s.username = null;
      s.avatar_config = {};
    }
  }

  targetSeat.player_key = "HUMAN";
  targetSeat.is_bot = false;
  targetSeat.player_name = options.playerName || "Jogador";
  targetSeat.claimed = true;
  targetSeat.seat_kind = seatKind;
  targetSeat.username = seatUsername;
  targetSeat.avatar_config = seatAvatar;
  stored.seat_tokens[targetSeat.color] = token;
  saveRoomsMap(rooms);

  return {
    seat_token: token,
    seat_color: targetSeat.color,
    room: localGetRoom(code, token),
  };
}

export function localUpdateRoom(
  roomCode: string,
  payload: {
    token?: string | null;
    config?: Partial<RoomState["config"]>;
    seats?: Array<{ color: Color; player_key: string; player_name?: string }>;
  }
): RoomState {
  const code = roomCode.toUpperCase();
  localGetRoom(code, payload.token);
  const rooms = loadRoomsMap();
  const stored = rooms[code];

  if (payload.config) {
    stored.config = { ...stored.config, ...payload.config };
  }
  if (payload.seats) {
    const oldByColor = Object.fromEntries(
      stored.seats.map((s) => [s.color, s])
    );
    const usedBotNames = new Set<string>();
    stored.seats = payload.seats.map((item, idx) => {
      const color = SEAT_COLORS[idx];
      const prev = oldByColor[color];
      const isBot = item.player_key !== "HUMAN";
      if (isBot) {
        stored.seat_tokens[color] = null;
        const requested = item.player_name?.trim() || (prev?.is_bot ? prev.player_name : "");
        const botName =
          isOfficialBotName(requested) && !usedBotNames.has(requested)
            ? requested
            : pickBotNames(1, usedBotNames)[0];
        usedBotNames.add(botName);
        return {
          color,
          player_key: item.player_key,
          player_name: botName,
          is_bot: true,
          claimed: true,
          is_me: false,
          seat_kind: "BOT" as const,
          username: null,
          avatar_config: BOT_AVATAR_PROFILES[botName],
        };
      }
      const hasClaim = Boolean(stored.seat_tokens[color]);
      return {
        color,
        player_key: "HUMAN",
        player_name: item.player_name || "Aguardando Amigo...",
        is_bot: false,
        claimed: hasClaim,
        is_me: Boolean(
          payload.token && stored.seat_tokens[color] === payload.token
        ),
        seat_kind: hasClaim ? prev?.seat_kind || "GUEST" : ("GUEST" as const),
        username: hasClaim ? prev?.username ?? null : null,
        avatar_config: hasClaim ? prev?.avatar_config ?? {} : {},
      };
    });
  }

  saveRoomsMap(rooms);
  return localGetRoom(code, payload.token);
}

export function localStartRoomGame(
  roomCode: string,
  token?: string | null
): { game_id: string; room: RoomState } {
  const code = roomCode.toUpperCase();
  const resolvedRoom = localGetRoom(code, token);
  const rooms = loadRoomsMap();
  const stored = rooms[code];

  if (!stored.game_id) {
    const seatNames: Partial<Record<Color, string>> = {};
    const seatMeta = {} as Record<Color, LocalSeatMeta>;
    for (const s of resolvedRoom.seats) {
      const cleanLabel =
        s.player_name === "Aguardando Amigo..."
          ? PLAYER_COLOR_META[s.color].label
          : s.player_name;
      seatNames[s.color] = cleanLabel;
      seatMeta[s.color] = {
        color: s.color,
        seat_kind: s.is_bot
          ? "BOT"
          : s.username
            ? "USER"
            : "GUEST",
        username: s.is_bot ? null : s.username ?? null,
        player_key: s.player_key,
        display_name: cleanLabel,
        avatar_config: s.avatar_config ?? {},
      };
    }
    stored.game_id = localCreateGame({
      players: stored.seats.map((s) => s.player_key),
      mapTemplate: stored.config.map_template,
      vpsToWin: stored.config.vps_to_win,
      discardLimit: stored.config.discard_limit,
      friendlyRobber: stored.config.friendly_robber,
      seatNames,
      seatMeta,
      roomCode: code,
    });
    stored.status = "IN_PROGRESS";
    saveRoomsMap(rooms);
  }

  return {
    game_id: stored.game_id,
    room: localGetRoom(code, token),
  };
}

export function localListActiveRooms(token?: string | null): RoomState[] {
  const rooms = loadRoomsMap();
  return Object.keys(rooms).map((code) => localGetRoom(code, token));
}
