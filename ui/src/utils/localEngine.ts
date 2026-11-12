import type {
  AccountStats,
  ActiveTradeTuple,
  AvatarConfig,
  BotDifficulty,
  BotSpeed,
  Color,
  ConfirmTradeAction,
  DevelopmentCard,
  DiceMode,
  Direction,
  GameAction,
  GameEdge,
  GameMessage,
  GameMessageKind,
  GameNode,
  GameState,
  LeaderboardEntry,
  MatchParticipant,
  MatchRecord,
  PlacedTile,
  ResourceCard,
  RoomState,
  SeatAvatarMeta,
  SeatTakeoverInfo,
  Tile,
  TileCoordinate,
  TradeOfferTuple,
} from "./api.types";
import type { MapTemplate, MCTSProbabilities, PlayerAccount } from "./apiClient";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { tr } from "../i18n";
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
  difficultyFromPlayerKey,
  isOfficialBotName,
  isOpenSeatPlaceholderName,
  normalizeBotDifficulty,
  normalizeBotSpeed,
  OPEN_SEAT_LABEL,
  pickBotNameDeterministic,
  pickBotNames,
  playerKeyForDifficulty,
  prescanRequestedBotNames,
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

function randomIndex(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const gCrypto =
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;
  if (gCrypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let val = 0;
    do {
      gCrypto.getRandomValues(arr);
      val = arr[0];
    } while (val >= limit);
    return val % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const BALANCED_DICE_RESHUFFLE_THRESHOLD = 5;

export function buildBalancedDiceDeck(): Array<[number, number]> {
  const deck: Array<[number, number]> = [];
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      deck.push([d1, d2]);
    }
  }
  return shuffle(deck);
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

const TOURNAMENT_LAND_LAYOUT: Record<
  string,
  { resource: ResourceCard | null; number: number | null }
> = {
  "0,0,0": { resource: null, number: null },
  "1,-1,0": { resource: "ORE", number: 6 },
  "0,-1,1": { resource: "WOOD", number: 3 },
  "-1,0,1": { resource: "ORE", number: 11 },
  "-1,1,0": { resource: "BRICK", number: 9 },
  "0,1,-1": { resource: "ORE", number: 4 },
  "1,0,-1": { resource: "WHEAT", number: 5 },
  "2,-2,0": { resource: "WHEAT", number: 9 },
  "1,-2,1": { resource: "SHEEP", number: 12 },
  "0,-2,2": { resource: "BRICK", number: 11 },
  "-1,-1,2": { resource: "SHEEP", number: 4 },
  "-2,0,2": { resource: "BRICK", number: 8 },
  "-2,1,1": { resource: "WHEAT", number: 10 },
  "-2,2,0": { resource: "WOOD", number: 5 },
  "-1,2,-1": { resource: "WHEAT", number: 2 },
  "0,2,-2": { resource: "WOOD", number: 6 },
  "1,1,-2": { resource: "SHEEP", number: 3 },
  "2,0,-2": { resource: "SHEEP", number: 8 },
  "2,-1,-1": { resource: "WOOD", number: 10 },
};

const TOURNAMENT_PORT_LAYOUT: Record<string, ResourceCard | null> = {
  "3,-3,0": null,
  "1,-3,2": "BRICK",
  "-1,-2,3": "WOOD",
  "-3,0,3": null,
  "-3,2,1": "WHEAT",
  "-2,3,-1": "ORE",
  "0,3,-3": null,
  "2,1,-3": "SHEEP",
  "3,-1,-2": null,
};

function buildLocalMap(template: MapTemplate): BuiltMap {
  const isMini = template === "MINI";
  const isTournament = template === "TOURNAMENT";
  const topology = isMini ? MINI_TOPOLOGY : BASE_TOPOLOGY;

  const tileResources = isTournament
    ? []
    : isMini
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

  const portResources =
    isMini || isTournament
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
    const cKey = coordKey(coordinate);
    if (entry.kind === "LAND") {
      if (isTournament && cKey in TOURNAMENT_LAND_LAYOUT) {
        const fixed = TOURNAMENT_LAND_LAYOUT[cKey];
        if (fixed.resource === null || fixed.number === null) {
          robberCoordinate = coordinate;
          tileObj = { id: tileAutoinc++, type: "DESERT" };
        } else {
          tileObj = {
            id: tileAutoinc++,
            type: "RESOURCE_TILE",
            resource: fixed.resource,
            number: fixed.number,
          };
        }
      } else {
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
      }
    } else if (entry.kind === "PORT") {
      const portRes =
        isTournament && cKey in TOURNAMENT_PORT_LAYOUT
          ? TOURNAMENT_PORT_LAYOUT[cKey]
          : (portResources.pop() ?? null);
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
  original_player_key?: string;
  original_seat_kind?: "USER" | "GUEST" | "BOT";
  original_username?: string | null;
  original_display_name?: string;
  original_avatar_config?: Partial<AvatarConfig> | null;
  last_seen_at?: number;
  taken_over_by_bot?: boolean;
  takeover_reason?: string | null;
};

type StoredLocalGame = {
  state: GameState;
  mapTemplate?: MapTemplate;
  nodeNeighbors: Record<number, number[]>;
  portNodes: Record<string, number[]>;
  initialQueue: Array<{ color: Color; type: "SETTLEMENT" | "ROAD"; secondRound: boolean }>;
  lastInitialSettlementNode: number | null;
  history: GameState[];
  seatMeta?: Record<Color, LocalSeatMeta>;
  discardCounts?: number[];
  isRoadBuilding?: boolean;
  freeRoadsAvailable?: number;
  tradesThisTurn?: number;
  diceDeck?: Array<[number, number]>;
};

const GAMES_STORAGE_KEY = "catan_local_games_v1";
const ROOMS_STORAGE_KEY = "catan_local_rooms_v1";
const CLOSED_ROOMS_STORAGE_KEY = "catan_closed_rooms_v1";

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
  takenOverColors: Color[];
  seatTakeover: Partial<Record<Color, SeatTakeoverInfo>>;
} {
  const seatNames: Partial<Record<Color, string>> = {};
  const seatAvatars: Partial<Record<Color, SeatAvatarMeta>> = {};
  const takenOverColors: Color[] = [];
  const seatTakeover: Partial<Record<Color, SeatTakeoverInfo>> = {};
  if (!seatMeta) {
    return { seatNames, seatAvatars, takenOverColors, seatTakeover };
  }

  const dir = getLocalUserDirectory();
  const usedBotNames = new Set<string>();
  for (const [colorKey, meta] of Object.entries(seatMeta)) {
    const color = colorKey as Color;
    if (!meta) continue;
    const isTakenOver = Boolean(meta.taken_over_by_bot);
    const origPlayerKey = meta.original_player_key || meta.player_key || "HUMAN";

    if (isTakenOver) {
      takenOverColors.push(color);
      const rawOrig =
        meta.original_display_name ||
        meta.display_name ||
        PLAYER_COLOR_META[color].label;
      const origName = rawOrig.endsWith(" (Bot)")
        ? rawOrig.slice(0, -6)
        : rawOrig;
      seatNames[color] = meta.display_name?.endsWith(" (Bot)")
        ? meta.display_name
        : `${origName} (Bot)`;

      const origKind =
        meta.original_seat_kind || (meta.original_username ? "USER" : "GUEST");
      const origUname =
        origKind === "USER" ? meta.original_username ?? null : null;
      const liveOrigUser = origUname ? dir[origUname] : undefined;
      const origAvatar =
        origKind === "USER" && origUname
          ? liveOrigUser?.avatar_config ||
            sanitizeAvatarConfig(meta.original_avatar_config ?? meta.avatar_config)
          : filterUnlockedAvatarConfig(
              meta.original_avatar_config ?? meta.avatar_config,
              0
            );
      seatAvatars[color] = {
        seat_kind: "BOT",
        username: null,
        avatar_config: origAvatar,
      };
      seatTakeover[color] = {
        taken_over: true,
        reason: meta.takeover_reason ?? null,
        original_username: origUname,
        original_display_name: origName,
      };
      continue;
    }

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
    const resolvedName = liveUser?.display_name || meta.display_name;
    seatNames[color] = resolvedName;
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
    if (origPlayerKey === "HUMAN") {
      seatTakeover[color] = {
        taken_over: false,
        reason: meta.takeover_reason ?? null,
        original_username: meta.original_username ?? uname ?? null,
        original_display_name: meta.original_display_name ?? resolvedName ?? null,
      };
    }
  }
  return { seatNames, seatAvatars, takenOverColors, seatTakeover };
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

  // Longest road & largest army: track current holder's live total so a challenger only steals the star when strictly surpassing
  const roadLengths = {} as Record<Color, number>;
  for (const c of state.colors) {
    const k = pKey(state, c);
    const roadLen = computeLongestRoadForColor(state.edges, state.nodes, c);
    roadLengths[c] = roadLen;
    ps[`${k}_LONGEST_ROAD_LENGTH`] = roadLen;
    state.longest_roads_by_player[c] = roadLen;
  }

  let currentArmyOwner: Color | null = null;
  let maxArmy = 2;
  let currentRoadOwner: Color | null = null;
  let maxRoad = 4;

  for (const c of state.colors) {
    const k = pKey(state, c);
    if (ps[`${k}_HAS_ARMY`]) {
      const knights = ps[`${k}_PLAYED_KNIGHT`] ?? 0;
      if (knights >= 3) {
        currentArmyOwner = c;
        maxArmy = knights;
      }
    }
    if (ps[`${k}_HAS_ROAD`]) {
      const len = roadLengths[c] ?? 0;
      if (len >= 5) {
        currentRoadOwner = c;
        maxRoad = len;
      }
    }
  }

  for (const c of state.colors) {
    const k = pKey(state, c);
    const roadLen = roadLengths[c] ?? 0;
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
  state.is_road_building = Boolean(
    game.isRoadBuilding && (game.freeRoadsAvailable ?? 0) > 0
  );

  if (state.current_prompt === "DISCARD") {
    const curColor = state.current_color;
    const ck = pKey(state, curColor);
    const curIdx = state.colors.indexOf(curColor);
    const remaining =
      game.discardCounts && curIdx >= 0
        ? (game.discardCounts[curIdx] ?? 0)
        : (state.current_discard_count ?? 0);
    if (remaining > 0) {
      state.current_discard_count = remaining;
      const discardActions: GameAction[] = RESOURCES.filter(
        (r) => (ps[`${ck}_${r}_IN_HAND`] ?? 0) > 0
      ).map((r) => [curColor, "DISCARD_RESOURCE", r] as GameAction);
      if (discardActions.length > 0) {
        state.current_playable_actions = discardActions;
        return;
      }
    }
    state.current_player_index = state.current_turn_index;
    state.current_color = state.colors[state.current_turn_index];
    state.current_prompt = "MOVE_ROBBER";
    state.current_discard_count = 0;
    game.discardCounts = state.colors.map(() => 0);
  }

  const color = state.current_color;
  const k = pKey(state, color);

  if (state.current_prompt === "MOVE_ROBBER") {
    const allActions: GameAction[] = [];
    const friendlyActions: GameAction[] = [];
    for (const pt of state.tiles) {
      if (pt.tile.type !== "RESOURCE_TILE" && pt.tile.type !== "DESERT") {
        continue;
      }
      if (coordKey(pt.coordinate) === coordKey(state.robber_coordinate)) {
        continue;
      }
      // Find opponent colors with buildings on this hex
      const victims = new Set<Color>();
      let blocksLowVpEnemy = false;
      for (const n of Object.values(state.nodes)) {
        if (n.color && n.color !== color) {
          const adj = state.adjacent_tiles[String(n.id)] || [];
          if (adj.some((t) => "id" in t && "id" in pt.tile && t.id === pt.tile.id)) {
            const vk = pKey(state, n.color);
            const victimVp = ps[`${vk}_ACTUAL_VICTORY_POINTS`] ?? 0;
            if (victimVp < 3) {
              blocksLowVpEnemy = true;
            }
            if ((ps[`${vk}_NUM_RESOURCES_IN_HAND`] ?? 0) > 0) {
              victims.add(n.color);
            }
          }
        }
      }
      const tileActions: GameAction[] = [];
      if (victims.size === 0) {
        tileActions.push([color, "MOVE_ROBBER", [pt.coordinate]]);
      } else {
        for (const v of victims) {
          tileActions.push([color, "MOVE_ROBBER", [pt.coordinate, v]]);
        }
      }
      allActions.push(...tileActions);
      if (!blocksLowVpEnemy) {
        friendlyActions.push(...tileActions);
      }
    }
    state.current_playable_actions =
      state.game?.friendly_robber && friendlyActions.length > 0
        ? friendlyActions
        : allActions;
    return;
  }

  if (state.current_prompt === "DECIDE_TRADE") {
    const trade = (
      state.current_trade && state.current_trade.length >= 10
        ? state.current_trade
        : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, state.current_turn_index]
    ) as ActiveTradeTuple;
    const asked = trade.slice(5, 10);
    const actions: GameAction[] = [[color, "REJECT_TRADE", trade]];
    const canAfford = RESOURCES.every(
      (res, idx) => (ps[`${k}_${res}_IN_HAND`] ?? 0) >= (asked[idx] ?? 0)
    );
    if (canAfford) {
      actions.push([color, "ACCEPT_TRADE", trade]);
    }
    state.current_playable_actions = actions;
    return;
  }

  if (state.current_prompt === "DECIDE_ACCEPTEES") {
    const baseTrade = (
      state.current_trade && state.current_trade.length >= 10
        ? state.current_trade.slice(0, 10)
        : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ) as TradeOfferTuple;
    const asked = baseTrade.slice(5, 10);
    const actions: GameAction[] = [[color, "CANCEL_TRADE", null]];
    const acceptees = state.acceptees || [];
    state.colors.forEach((otherColor, idx) => {
      if (acceptees[idx] && otherColor !== color) {
        const ok = pKey(state, otherColor);
        const partnerStillCanAfford = RESOURCES.every(
          (res, rIdx) => (ps[`${ok}_${res}_IN_HAND`] ?? 0) >= (asked[rIdx] ?? 0)
        );
        if (partnerStillCanAfford) {
          actions.push([color, "CONFIRM_TRADE", [...baseTrade, otherColor]]);
        }
      }
    });
    state.current_playable_actions = actions;
    return;
  }

  // Normal PLAY_TURN
  state.current_prompt = "PLAY_TURN";
  state.current_discard_count = 0;

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

  const openRoadEdges =
    (ps[`${k}_ROADS_AVAILABLE`] ?? 0) > 0
      ? state.edges.filter(
          (e) =>
            e.color === null &&
            (connectedNodes.has(e.id[0]) || connectedNodes.has(e.id[1]))
        )
      : [];

  if (game.isRoadBuilding && (game.freeRoadsAvailable ?? 0) > 0) {
    if (openRoadEdges.length > 0) {
      state.is_road_building = true;
      state.current_playable_actions = openRoadEdges.map(
        (e) => [color, "BUILD_ROAD", e.id] as GameAction
      );
      return;
    }
    game.isRoadBuilding = false;
    game.freeRoadsAvailable = 0;
    state.is_road_building = false;
  }

  const canPlayDevCard = (card: DevelopmentCard) => {
    if (ps[`${k}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`]) return false;
    const held = ps[`${k}_${card}_IN_HAND`] ?? 0;
    const boughtThisTurn = ps[`${k}_${card}_BOUGHT_THIS_TURN`] ?? 0;
    return held - boughtThisTurn > 0;
  };

  const devActions: GameAction[] = [];
  if (canPlayDevCard("KNIGHT")) {
    devActions.push([color, "PLAY_KNIGHT_CARD", null]);
  }
  if (canPlayDevCard("ROAD_BUILDING") && openRoadEdges.length > 0) {
    devActions.push([color, "PLAY_ROAD_BUILDING", null]);
  }
  if (canPlayDevCard("MONOPOLY")) {
    for (const r of RESOURCES) {
      devActions.push([color, "PLAY_MONOPOLY", r]);
    }
  }
  if (canPlayDevCard("YEAR_OF_PLENTY")) {
    const bank = state.resource_freqdeck || [19, 19, 19, 19, 19];
    const yopSeen = new Set<string>();
    for (let i = 0; i < RESOURCES.length; i++) {
      for (let j = i; j < RESOURCES.length; j++) {
        const r1 = RESOURCES[i];
        const r2 = RESOURCES[j];
        const b1 = bank[i] ?? 0;
        const b2 = bank[j] ?? 0;
        if ((i === j && b1 >= 2) || (i !== j && b1 >= 1 && b2 >= 1)) {
          const key = `${r1},${r2}`;
          if (!yopSeen.has(key)) {
            yopSeen.add(key);
            devActions.push([color, "PLAY_YEAR_OF_PLENTY", [r1, r2]]);
          }
        } else {
          if (b1 >= 1 && !yopSeen.has(r1)) {
            yopSeen.add(r1);
            devActions.push([color, "PLAY_YEAR_OF_PLENTY", [r1]]);
          }
          if (b2 >= 1 && !yopSeen.has(r2)) {
            yopSeen.add(r2);
            devActions.push([color, "PLAY_YEAR_OF_PLENTY", [r2]]);
          }
        }
      }
    }
  }

  if (!ps[`${k}_HAS_ROLLED`]) {
    state.current_playable_actions = [[color, "ROLL", null], ...devActions];
    return;
  }

  const actions: GameAction[] = [[color, "END_TURN", null], ...devActions];
  const wood = ps[`${k}_WOOD_IN_HAND`] ?? 0;
  const brick = ps[`${k}_BRICK_IN_HAND`] ?? 0;
  const sheep = ps[`${k}_SHEEP_IN_HAND`] ?? 0;
  const wheat = ps[`${k}_WHEAT_IN_HAND`] ?? 0;
  const ore = ps[`${k}_ORE_IN_HAND`] ?? 0;

  // BUILD_ROAD
  if (wood >= 1 && brick >= 1 && openRoadEdges.length > 0) {
    for (const e of openRoadEdges) {
      actions.push([color, "BUILD_ROAD", e.id]);
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
  const devCardsRemaining = Object.values(state.development_listdeck || {}).reduce(
    (sum, count) => sum + Math.max(0, Number(count) || 0),
    0
  );
  if (sheep >= 1 && wheat >= 1 && ore >= 1 && devCardsRemaining > 0) {
    actions.push([color, "BUY_DEVELOPMENT_CARD", null]);
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
  const bank = state.resource_freqdeck || [19, 19, 19, 19, 19];

  for (const giveRes of RESOURCES) {
    const has2to1 = (portNodes[giveRes] || []).some((nid) =>
      ownedNodeIds.has(nid)
    );
    const rate = has2to1 ? 2 : has3to1Port ? 3 : 4;
    const count = ps[`${k}_${giveRes}_IN_HAND`] ?? 0;
    if (count >= rate) {
      for (let recvIdx = 0; recvIdx < RESOURCES.length; recvIdx++) {
        const recvRes = RESOURCES[recvIdx];
        if (recvRes === giveRes) continue;
        if ((bank[recvIdx] ?? 1) <= 0) continue;
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

function resetLocalTradingState(state: GameState) {
  state.is_resolving_trade = false;
  state.current_trade = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  state.acceptees = state.colors.map(() => false);
}

function isValidLocalTradeOffer(
  state: GameState,
  color: Color,
  value: unknown
): value is TradeOfferTuple {
  if (
    state.is_initial_build_phase ||
    state.is_resolving_trade ||
    state.colors.length < 2
  ) {
    return false;
  }
  if (state.current_color !== color || state.current_prompt !== "PLAY_TURN") {
    return false;
  }
  const k = pKey(state, color);
  if (!state.player_state[`${k}_HAS_ROLLED`]) {
    return false;
  }
  if (!Array.isArray(value) || value.length !== 10) {
    return false;
  }
  for (const amt of value) {
    if (typeof amt !== "number" || !Number.isInteger(amt) || amt < 0) {
      return false;
    }
  }
  const offering = value.slice(0, 5);
  const asking = value.slice(5, 10);
  const giveSum = offering.reduce((a, b) => a + b, 0);
  const askSum = asking.reduce((a, b) => a + b, 0);
  if (giveSum === 0 || askSum === 0) {
    return false;
  }
  for (let i = 0; i < 5; i++) {
    if (offering[i] > 0 && asking[i] > 0) {
      return false;
    }
    if ((state.player_state[`${k}_${RESOURCES[i]}_IN_HAND`] ?? 0) < offering[i]) {
      return false;
    }
  }
  return true;
}

function getLocalFreqdeck(state: GameState, color: Color): number[] {
  const k = pKey(state, color);
  return RESOURCES.map((r) => state.player_state[`${k}_${r}_IN_HAND`] ?? 0);
}

function scoreLocalHandUtility(
  state: GameState,
  color: Color,
  hand: number[]
): number {
  const k = pKey(state, color);
  const citiesAvail = state.player_state[`${k}_CITIES_AVAILABLE`] ?? 4;
  const settlementsAvail = state.player_state[`${k}_SETTLEMENTS_AVAILABLE`] ?? 5;
  const roadsAvail = state.player_state[`${k}_ROADS_AVAILABLE`] ?? 15;
  const ownedSettlements = Object.values(state.nodes).filter(
    (n) => n.color === color && n.building === "SETTLEMENT"
  ).length;
  const canUpgradeCity = citiesAvail > 0 && ownedSettlements > 0;
  const canExpandSettlement = settlementsAvail > 0;
  const canExpandRoad = roadsAvail > 0;
  const hasDevDeck = Object.values(state.development_listdeck || {}).some(
    (c) => Number(c) > 0
  );

  const distCity = (Math.max(2 - hand[3], 0) + Math.max(3 - hand[4], 0)) / 5.0;
  const distSettlement =
    (Math.max(1 - hand[0], 0) +
      Math.max(1 - hand[1], 0) +
      Math.max(1 - hand[2], 0) +
      Math.max(1 - hand[3], 0)) /
    4.0;
  const distDev =
    (Math.max(1 - hand[2], 0) +
      Math.max(1 - hand[3], 0) +
      Math.max(1 - hand[4], 0)) /
    3.0;
  const distRoad = (Math.max(1 - hand[0], 0) + Math.max(1 - hand[1], 0)) / 2.0;

  const cityWeight = canUpgradeCity ? 8.0 : 1.5;
  const settlementWeight = canExpandSettlement ? 7.5 : 1.5;
  const devWeight = hasDevDeck ? 3.5 : 0.5;
  const roadWeight = canExpandRoad ? 2.5 : 0.5;

  let unlockBonus = 0;
  if (canUpgradeCity && hand[3] >= 2 && hand[4] >= 3) unlockBonus += 12.0;
  if (
    canExpandSettlement &&
    hand[0] >= 1 &&
    hand[1] >= 1 &&
    hand[2] >= 1 &&
    hand[3] >= 1
  ) {
    unlockBonus += 10.0;
  }
  if (hasDevDeck && hand[2] >= 1 && hand[3] >= 1 && hand[4] >= 1) {
    unlockBonus += 4.0;
  }
  if (canExpandRoad && hand[0] >= 1 && hand[1] >= 1) {
    unlockBonus += 2.5;
  }

  const totalCards = hand.reduce((a, b) => a + b, 0);
  const discardLimit = state.game?.discard_limit ?? 7;
  const excess = Math.max(0, totalCards - discardLimit);
  const discardPenalty = excess > 0 ? 4.5 + excess * 2.5 : 0;
  const surplusPenalty = hand.reduce(
    (acc, count) => acc + Math.max(count - 2, 0) * 0.45,
    0
  );

  return (
    unlockBonus +
    totalCards * 1.4 -
    distCity * cityWeight -
    distSettlement * settlementWeight -
    distDev * devWeight -
    distRoad * roadWeight -
    discardPenalty -
    surplusPenalty
  );
}

function adjustLocalBankResource(
  state: GameState,
  resource: ResourceCard,
  delta: number
) {
  if (!Array.isArray(state.resource_freqdeck)) {
    state.resource_freqdeck = [19, 19, 19, 19, 19];
  }
  const idx = RESOURCES.indexOf(resource);
  if (idx < 0) return;
  state.resource_freqdeck[idx] = Math.max(
    0,
    (state.resource_freqdeck[idx] ?? 0) + delta
  );
}

function drawFromDevDeck(
  deck: Record<string, number>
): DevelopmentCard | "VICTORY_POINT" | null {
  const entries = Object.entries(deck || {}).filter(
    ([, cnt]) => Number(cnt) > 0
  );
  const total = entries.reduce((s, [, cnt]) => s + Number(cnt), 0);
  if (total <= 0) return null;
  let pick = Math.floor(Math.random() * total);
  for (const [card, rawCnt] of entries) {
    const cnt = Number(rawCnt);
    if (pick < cnt) {
      deck[card] = cnt - 1;
      return card as DevelopmentCard | "VICTORY_POINT";
    }
    pick -= cnt;
  }
  const last = entries[entries.length - 1][0];
  deck[last] = Math.max(0, Number(deck[last]) - 1);
  return last as DevelopmentCard | "VICTORY_POINT";
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
            adjustLocalBankResource(state, t.resource, -1);
          }
        }
      }
    } else {
      ps[`${k}_WOOD_IN_HAND`]--;
      ps[`${k}_BRICK_IN_HAND`]--;
      ps[`${k}_SHEEP_IN_HAND`]--;
      ps[`${k}_WHEAT_IN_HAND`]--;
      adjustLocalBankResource(state, "WOOD", 1);
      adjustLocalBankResource(state, "BRICK", 1);
      adjustLocalBankResource(state, "SHEEP", 1);
      adjustLocalBankResource(state, "WHEAT", 1);
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
    } else if (game.isRoadBuilding && (game.freeRoadsAvailable ?? 0) > 0) {
      game.freeRoadsAvailable = (game.freeRoadsAvailable ?? 0) - 1;
      if (game.freeRoadsAvailable <= 0) {
        game.isRoadBuilding = false;
        game.freeRoadsAvailable = 0;
        state.is_road_building = false;
      }
    } else {
      ps[`${k}_WOOD_IN_HAND`] = Math.max(0, (ps[`${k}_WOOD_IN_HAND`] ?? 0) - 1);
      ps[`${k}_BRICK_IN_HAND`] = Math.max(0, (ps[`${k}_BRICK_IN_HAND`] ?? 0) - 1);
      adjustLocalBankResource(state, "WOOD", 1);
      adjustLocalBankResource(state, "BRICK", 1);
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
    adjustLocalBankResource(state, "WHEAT", 2);
    adjustLocalBankResource(state, "ORE", 3);
    state.action_records.push([action, null]);
  } else if (actionType === "ROLL") {
    let d1: number;
    let d2: number;
    if (state.game?.dice_mode === "balanced") {
      if (
        !game.diceDeck ||
        game.diceDeck.length <= BALANCED_DICE_RESHUFFLE_THRESHOLD
      ) {
        game.diceDeck = buildBalancedDiceDeck();
      }
      const drawn = game.diceDeck.pop()!;
      d1 = drawn[0];
      d2 = drawn[1];
      state.dice_deck_remaining = game.diceDeck.length;
    } else {
      d1 = Math.floor(Math.random() * 6) + 1;
      d2 = Math.floor(Math.random() * 6) + 1;
    }
    const sum = d1 + d2;
    ps[`${k}_HAS_ROLLED`] = true;
    state.action_records.push([action, [d1, d2]]);

    if (sum === 7) {
      const discardLimit = state.game?.discard_limit ?? 7;
      const discardCounts = state.colors.map((c) => {
        const ck = pKey(state, c);
        const numCards = RESOURCES.reduce(
          (acc, r) => acc + (ps[`${ck}_${r}_IN_HAND`] ?? 0),
          0
        );
        return numCards > discardLimit ? Math.floor(numCards / 2) : 0;
      });
      const firstDiscarderIdx = discardCounts.findIndex((cnt) => cnt > 0);
      if (firstDiscarderIdx !== -1) {
        game.discardCounts = discardCounts;
        state.current_player_index = firstDiscarderIdx;
        state.current_color = state.colors[firstDiscarderIdx];
        state.current_prompt = "DISCARD";
        state.current_discard_count = discardCounts[firstDiscarderIdx];
      } else {
        game.discardCounts = state.colors.map(() => 0);
        state.current_discard_count = 0;
        state.current_prompt = "MOVE_ROBBER";
      }
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
              const rIdx = RESOURCES.indexOf(pt.tile.resource);
              const avail = rIdx >= 0 ? (state.resource_freqdeck?.[rIdx] ?? 19) : 19;
              const paid = Math.min(qty, Math.max(0, avail));
              if (paid > 0) {
                ps[`${nk}_${pt.tile.resource}_IN_HAND`] =
                  (ps[`${nk}_${pt.tile.resource}_IN_HAND`] ?? 0) + paid;
                adjustLocalBankResource(state, pt.tile.resource, -paid);
              }
            }
          }
        }
      }
    }
  } else if (actionType === "DISCARD_RESOURCE") {
    const discarded = action[2] as ResourceCard;
    const pIdx = state.colors.indexOf(color);
    const held = ps[`${k}_${discarded}_IN_HAND`] ?? 0;
    const counts = game.discardCounts || state.colors.map((c) =>
      c === color ? Math.max(1, state.current_discard_count ?? 1) : 0
    );
    const remaining = pIdx >= 0 ? (counts[pIdx] ?? 0) : 0;
    if (remaining <= 0 || held <= 0) {
      throw new Error(tr("Descarte inválido para o estado atual.", "Invalid discard for the current game state."));
    }
    ps[`${k}_${discarded}_IN_HAND`] = held - 1;
    adjustLocalBankResource(state, discarded, 1);
    counts[pIdx] = remaining - 1;
    game.discardCounts = counts;
    state.action_records.push([action, discarded]);

    if (counts[pIdx] > 0) {
      state.current_discard_count = counts[pIdx];
      state.current_prompt = "DISCARD";
    } else {
      const nextIdx = counts.findIndex((cnt, i) => i > pIdx && cnt > 0);
      if (nextIdx !== -1) {
        state.current_player_index = nextIdx;
        state.current_color = state.colors[nextIdx];
        state.current_discard_count = counts[nextIdx];
        state.current_prompt = "DISCARD";
      } else {
        state.current_player_index = state.current_turn_index;
        state.current_color = state.colors[state.current_turn_index];
        state.current_discard_count = 0;
        game.discardCounts = state.colors.map(() => 0);
        state.current_prompt = "MOVE_ROBBER";
      }
    }
  } else if (actionType === "MOVE_ROBBER") {
    const [coord, victimColor] = action[2];
    state.robber_coordinate = coord;
    let stolen: ResourceCard | null = null;
    if (victimColor) {
      const vk = pKey(state, victimColor as Color);
      const weightedRes: ResourceCard[] = [];
      for (const r of RESOURCES) {
        const cnt = ps[`${vk}_${r}_IN_HAND`] ?? 0;
        for (let i = 0; i < cnt; i++) weightedRes.push(r);
      }
      if (weightedRes.length > 0) {
        stolen = weightedRes[Math.floor(Math.random() * weightedRes.length)];
        ps[`${vk}_${stolen}_IN_HAND`]--;
        ps[`${k}_${stolen}_IN_HAND`] = (ps[`${k}_${stolen}_IN_HAND`] ?? 0) + 1;
      }
    }
    state.current_prompt = "PLAY_TURN";
    state.action_records.push([action, stolen]);
  } else if (actionType === "BUY_DEVELOPMENT_CARD") {
    if (!state.development_listdeck) {
      state.development_listdeck = {};
    }
    const drawn = drawFromDevDeck(state.development_listdeck);
    if (!drawn) {
      throw new Error(tr("Não há mais cartas de desenvolvimento no baralho.", "No more development cards left in the deck."));
    }
    ps[`${k}_SHEEP_IN_HAND`]--;
    ps[`${k}_WHEAT_IN_HAND`]--;
    ps[`${k}_ORE_IN_HAND`]--;
    adjustLocalBankResource(state, "SHEEP", 1);
    adjustLocalBankResource(state, "WHEAT", 1);
    adjustLocalBankResource(state, "ORE", 1);
    ps[`${k}_${drawn}_IN_HAND`] = (ps[`${k}_${drawn}_IN_HAND`] ?? 0) + 1;
    if (drawn !== "VICTORY_POINT") {
      ps[`${k}_${drawn}_BOUGHT_THIS_TURN`] =
        (ps[`${k}_${drawn}_BOUGHT_THIS_TURN`] ?? 0) + 1;
    }
    state.action_records.push([action, drawn as DevelopmentCard]);
  } else if (actionType === "PLAY_KNIGHT_CARD") {
    ps[`${k}_KNIGHT_IN_HAND`] = Math.max(0, (ps[`${k}_KNIGHT_IN_HAND`] ?? 0) - 1);
    ps[`${k}_PLAYED_KNIGHT`] = (ps[`${k}_PLAYED_KNIGHT`] ?? 0) + 1;
    ps[`${k}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`] = true;
    state.current_prompt = "MOVE_ROBBER";
    state.action_records.push([action, null]);
  } else if (actionType === "PLAY_ROAD_BUILDING") {
    ps[`${k}_ROAD_BUILDING_IN_HAND`] = Math.max(
      0,
      (ps[`${k}_ROAD_BUILDING_IN_HAND`] ?? 0) - 1
    );
    ps[`${k}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`] = true;
    game.isRoadBuilding = true;
    game.freeRoadsAvailable = 2;
    state.is_road_building = true;
    state.current_prompt = "PLAY_TURN";
    state.action_records.push([action, null]);
  } else if (actionType === "PLAY_MONOPOLY") {
    const targetRes = action[2];
    ps[`${k}_MONOPOLY_IN_HAND`] = Math.max(
      0,
      (ps[`${k}_MONOPOLY_IN_HAND`] ?? 0) - 1
    );
    ps[`${k}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`] = true;
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
    ps[`${k}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`] = true;
    for (const r of action[2]) {
      ps[`${k}_${r}_IN_HAND`] = (ps[`${k}_${r}_IN_HAND`] ?? 0) + 1;
      adjustLocalBankResource(state, r, -1);
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
      adjustLocalBankResource(state, giveRes, giveList.length);
      adjustLocalBankResource(state, recv, -1);
    }
    game.tradesThisTurn = (game.tradesThisTurn ?? 0) + 1;
    state.action_records.push([action, null]);
  } else if (actionType === "OFFER_TRADE") {
    const value = action[2];
    if (!isValidLocalTradeOffer(state, color, value)) {
      throw new Error(tr("Proposta de troca inválida para o estado atual.", "Invalid trade offer for the current game state."));
    }
    state.is_resolving_trade = true;
    state.current_trade = [...value, state.current_turn_index];
    state.acceptees = state.colors.map(() => false);
    const nextIdx = state.colors.findIndex(
      (_, idx) => idx !== state.current_turn_index
    );
    state.current_player_index = nextIdx;
    state.current_color = state.colors[nextIdx];
    state.current_prompt = "DECIDE_TRADE";
    state.action_records.push([action, null]);
  } else if (actionType === "ACCEPT_TRADE") {
    const acceptees = [...(state.acceptees || state.colors.map(() => false))];
    const myIdx = state.colors.indexOf(color);
    if (myIdx >= 0) {
      acceptees[myIdx] = true;
    }
    state.acceptees = acceptees;
    const nextIdx = state.colors.findIndex(
      (_, idx) =>
        idx !== state.current_turn_index && idx > state.current_player_index
    );
    if (nextIdx !== -1) {
      state.current_player_index = nextIdx;
      state.current_color = state.colors[nextIdx];
      state.current_prompt = "DECIDE_TRADE";
    } else {
      state.current_player_index = state.current_turn_index;
      state.current_color = state.colors[state.current_turn_index];
      state.current_prompt = "DECIDE_ACCEPTEES";
    }
    state.action_records.push([action, null]);
  } else if (actionType === "REJECT_TRADE") {
    const nextIdx = state.colors.findIndex(
      (_, idx) =>
        idx !== state.current_turn_index && idx > state.current_player_index
    );
    if (nextIdx !== -1) {
      state.current_player_index = nextIdx;
      state.current_color = state.colors[nextIdx];
      state.current_prompt = "DECIDE_TRADE";
    } else if ((state.acceptees || []).some(Boolean)) {
      state.current_player_index = state.current_turn_index;
      state.current_color = state.colors[state.current_turn_index];
      state.current_prompt = "DECIDE_ACCEPTEES";
    } else {
      resetLocalTradingState(state);
      state.current_player_index = state.current_turn_index;
      state.current_color = state.colors[state.current_turn_index];
      state.current_prompt = "PLAY_TURN";
    }
    state.action_records.push([action, null]);
  } else if (actionType === "CONFIRM_TRADE") {
    const val = action[2];
    const offering = val.slice(0, 5) as number[];
    const asking = val.slice(5, 10) as number[];
    const partnerColor = val[10] as Color;
    const partnerKey = pKey(state, partnerColor);
    const proposerCanPay = RESOURCES.every(
      (res, idx) => (ps[`${k}_${res}_IN_HAND`] ?? 0) >= (offering[idx] ?? 0)
    );
    const partnerCanPay = RESOURCES.every(
      (res, idx) => (ps[`${partnerKey}_${res}_IN_HAND`] ?? 0) >= (asking[idx] ?? 0)
    );
    if (!proposerCanPay || !partnerCanPay) {
      throw new Error("Recursos insuficientes para confirmar a troca.");
    }
    RESOURCES.forEach((res, idx) => {
      ps[`${k}_${res}_IN_HAND`] =
        (ps[`${k}_${res}_IN_HAND`] ?? 0) - (offering[idx] ?? 0) + (asking[idx] ?? 0);
      ps[`${partnerKey}_${res}_IN_HAND`] =
        (ps[`${partnerKey}_${res}_IN_HAND`] ?? 0) - (asking[idx] ?? 0) + (offering[idx] ?? 0);
    });
    resetLocalTradingState(state);
    state.current_player_index = state.current_turn_index;
    state.current_color = state.colors[state.current_turn_index];
    state.current_prompt = "PLAY_TURN";
    state.action_records.push([action, null]);
  } else if (actionType === "CANCEL_TRADE") {
    resetLocalTradingState(state);
    state.current_player_index = state.current_turn_index;
    state.current_color = state.colors[state.current_turn_index];
    state.current_prompt = "PLAY_TURN";
    state.action_records.push([action, null]);
  } else if (actionType === "END_TURN") {
    ps[`${k}_HAS_ROLLED`] = false;
    ps[`${k}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`] = false;
    ps[`${k}_KNIGHT_BOUGHT_THIS_TURN`] = 0;
    ps[`${k}_MONOPOLY_BOUGHT_THIS_TURN`] = 0;
    ps[`${k}_YEAR_OF_PLENTY_BOUGHT_THIS_TURN`] = 0;
    ps[`${k}_ROAD_BUILDING_BOUGHT_THIS_TURN`] = 0;
    game.tradesThisTurn = 0;
    game.isRoadBuilding = false;
    game.freeRoadsAvailable = 0;
    state.is_road_building = false;
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
      const isTakenOver = Boolean(m?.taken_over_by_bot);
      if (isTakenOver) {
        return {
          color: c,
          seat_kind: "BOT",
          username: null,
          player_key: "CATANATRON",
          display_name: m?.display_name ?? state.seat_names?.[c] ?? c,
          victory_points: vps,
          is_winner: isWinner,
        };
      }
      const resolvedKind =
        m?.seat_kind ?? (state.bot_colors.includes(c) ? "BOT" : "GUEST");
      return {
        color: c,
        seat_kind: resolvedKind,
        username: resolvedKind === "USER" ? m?.username ?? null : null,
        player_key:
          m?.player_key ??
          (state.bot_colors.includes(c) ? "CATANATRON" : "HUMAN"),
        display_name: m?.display_name ?? state.seat_names?.[c] ?? c,
        victory_points: vps,
        is_winner: isWinner,
      };
    });
    const winnerPart = participants.find((p) => p.color === winnerColor);
    const winnerIsBot = winnerPart?.seat_kind === "BOT";
    const origHumanCount = Object.values(meta).filter(
      (m) => (m?.original_player_key || m?.player_key) === "HUMAN"
    ).length;
    localRecordCompletedMatch({
      game_id: state.game.id,
      room_code: state.room_code || null,
      mode: state.room_code || origHumanCount >= 2 ? "MULTIPLAYER" : "SOLO",
      map_template: game.mapTemplate || "BASE",
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

function tilePips(t: Tile): number {
  if (t.type !== "RESOURCE_TILE") return 0;
  return Math.max(0, 6 - Math.abs(7 - t.number));
}

function scoreNodeForBot(
  state: GameState,
  portNodes: Record<string, number[]>,
  color: Color,
  nodeId: number
): number {
  const adj = state.adjacent_tiles[String(nodeId)] || [];
  let pips = 0;
  const newResources = new Set<ResourceCard>();
  const existingResources = new Set<ResourceCard>();
  for (const n of Object.values(state.nodes)) {
    if (n.color === color) {
      for (const t of state.adjacent_tiles[String(n.id)] || []) {
        if (t.type === "RESOURCE_TILE") existingResources.add(t.resource);
      }
    }
  }
  const tileResSeen = new Set<ResourceCard>();
  for (const t of adj) {
    if (t.type !== "RESOURCE_TILE") continue;
    pips += tilePips(t);
    tileResSeen.add(t.resource);
    if (!existingResources.has(t.resource)) {
      newResources.add(t.resource);
    }
  }
  let portBonus = 0;
  if ((portNodes.ANY || []).includes(nodeId)) {
    portBonus += 1.5;
  }
  for (const r of RESOURCES) {
    if ((portNodes[r] || []).includes(nodeId)) {
      portBonus += existingResources.has(r) || tileResSeen.has(r) ? 3.0 : 1.0;
    }
  }
  return pips * 2.0 + newResources.size * 2.5 + tileResSeen.size * 1.0 + portBonus;
}

function scoreRoadEdgeForBot(
  game: StoredLocalGame,
  color: Color,
  edgeId: [number, number]
): number {
  const { state, nodeNeighbors, portNodes } = game;
  let score = 0;
  const openEndpoints: number[] = [];
  for (const nid of edgeId) {
    const node = state.nodes[String(nid)];
    if (!node) continue;
    if (node.color === null) {
      const neighborOccupied = (nodeNeighbors[nid] || []).some(
        (nbId) => state.nodes[String(nbId)]?.building !== null
      );
      if (!neighborOccupied) {
        score += 4.0 + scoreNodeForBot(state, portNodes, color, nid) * 0.5;
      } else {
        openEndpoints.push(nid);
      }
    }
  }
  for (const ep of openEndpoints) {
    for (const hop of nodeNeighbors[ep] || []) {
      const hopNode = state.nodes[String(hop)];
      if (!hopNode || hopNode.color !== null) continue;
      const nbOcc = (nodeNeighbors[hop] || []).some(
        (nb) => state.nodes[String(nb)]?.building !== null
      );
      if (!nbOcc) {
        score = Math.max(
          score,
          2.0 + scoreNodeForBot(state, portNodes, color, hop) * 0.35
        );
      }
    }
  }
  const prevLen = computeLongestRoadForColor(state.edges, state.nodes, color);
  const simulatedEdges = state.edges.map((e) =>
    sameEdge(e.id, edgeId) ? { ...e, color } : e
  );
  const nextLen = computeLongestRoadForColor(simulatedEdges, state.nodes, color);
  if (nextLen > prevLen) {
    score += nextLen >= 5 ? 6.0 : 2.5;
  }
  return score;
}

function scoreRobberActionForBot(
  state: GameState,
  botColor: Color,
  action: GameAction,
  difficulty: BotDifficulty = "medium"
): number {
  const [coord, victimColor] = action[2] as [TileCoordinate, Color | undefined];
  const tileEntry = state.tiles.find(
    (pt) => coordKey(pt.coordinate) === coordKey(coord)
  );
  const pips = tileEntry ? tilePips(tileEntry.tile) : 0;
  const vpsToWin = state.game?.vps_to_win ?? 10;
  const selfPenalty = difficulty === "hard" ? 120 : 80;
  let score = 0;

  for (const n of Object.values(state.nodes)) {
    if (!n.color || !n.building) continue;
    const adj = state.adjacent_tiles[String(n.id)] || [];
    const touches =
      tileEntry &&
      "id" in tileEntry.tile &&
      adj.some(
        (t) =>
          "id" in t && "id" in tileEntry.tile && t.id === tileEntry.tile.id
      );
    if (!touches) continue;
    const weight = n.building === "CITY" ? 2 : 1;
    if (n.color === botColor) {
      score -= selfPenalty * weight * Math.max(1, pips);
    } else {
      const ok = pKey(state, n.color);
      const vp = state.player_state[`${ok}_VICTORY_POINTS`] ?? 0;
      const threat =
        difficulty === "hard"
          ? vp >= vpsToWin - 1
            ? 4.0
            : vp >= vpsToWin - 3
              ? 2.2
              : 1.0 + vp * 0.35
          : difficulty === "easy"
            ? 1.0
            : vp >= vpsToWin - 2
              ? 2.5
              : 1.0 + vp * 0.25;
      score += (pips * 3.0 + 1.0) * weight * threat;
    }
  }

  if (victimColor) {
    const vk = pKey(state, victimColor as Color);
    const victimVp = state.player_state[`${vk}_VICTORY_POINTS`] ?? 0;
    const victimCards = state.player_state[`${vk}_NUM_RESOURCES_IN_HAND`] ?? 0;
    const discardLimit = state.game?.discard_limit ?? 7;
    if (victimCards > 0) {
      const vpFactor = difficulty === "hard" ? 2.4 : difficulty === "easy" ? 0.4 : 1.5;
      score += 8.0 + Math.min(victimCards, 12) * 1.4 + victimVp * vpFactor;
      if (victimCards > discardLimit) {
        score += 8.0;
      }
    }
  }
  return score;
}

function getMaritimeTradeDeltaInfo(offer: (ResourceCard | null)[]): {
  giveIdx: number;
  rate: number;
  recvIdx: number;
} | null {
  const giveList = offer.slice(0, 4).filter((r): r is ResourceCard => r !== null);
  const recv = offer[4];
  if (giveList.length === 0 || !recv) return null;
  return {
    giveIdx: RESOURCES.indexOf(giveList[0]),
    rate: giveList.length,
    recvIdx: RESOURCES.indexOf(recv),
  };
}

function pickFromTopScored<T>(
  items: T[],
  scorer: (item: T) => number,
  topWindow = 1
): T {
  const scored = items
    .map((item) => ({ item, score: scorer(item) }))
    .sort((a, b) => b.score - a.score);
  const windowSize = Math.max(1, Math.min(topWindow, scored.length));
  return scored[Math.floor(Math.random() * windowSize)].item;
}

function chooseBotAction(game: StoredLocalGame): GameAction | null {
  const { state, portNodes } = game;
  const playable = state.current_playable_actions;
  if (playable.length === 0) return null;

  const botDifficulty = difficultyFromPlayerKey(
    game.seatMeta?.[state.current_color]?.player_key
  );

  if (state.current_prompt === "DECIDE_TRADE") {
    const acceptAction = playable.find((a) => a[1] === "ACCEPT_TRADE");
    const rejectAction = playable.find((a) => a[1] === "REJECT_TRADE");
    if (!acceptAction) return rejectAction || playable[0];
    if (!rejectAction) return acceptAction;

    const botColor = state.current_color;
    const trade = (acceptAction[2] || state.current_trade || []) as number[];
    const offering = trade.slice(0, 5);
    const asking = trade.slice(5, 10);
    const proposerIdx =
      trade.length > 10 ? Number(trade[10]) : state.current_turn_index;
    const proposerColor = state.colors[proposerIdx] || state.colors[0];

    const myHand = getLocalFreqdeck(state, botColor);
    const afterHand = myHand.map(
      (held, idx) => held + (offering[idx] ?? 0) - (asking[idx] ?? 0)
    );
    if (afterHand.some((c) => c < 0)) return rejectAction;

    const beforeScore = scoreLocalHandUtility(state, botColor, myHand);
    const afterScore = scoreLocalHandUtility(state, botColor, afterHand);
    const gain = afterScore - beforeScore;

    const pk = pKey(state, proposerColor);
    const proposerVp = state.player_state[`${pk}_VICTORY_POINTS`] ?? 0;
    const vpsToWin = state.game?.vps_to_win ?? 10;

    if (botDifficulty === "easy") {
      return gain >= -0.6 ? acceptAction : rejectAction;
    }

    if (botDifficulty === "hard") {
      if (proposerVp >= vpsToWin - 1 && gain < 4.5) return rejectAction;
      if (proposerVp >= vpsToWin - 2 && gain < 2.2) return rejectAction;
      const leaderPenalty =
        proposerVp >= vpsToWin - 2 ? 3.5 : proposerVp >= vpsToWin - 3 ? 1.5 : 0.0;
      return gain - leaderPenalty >= 0.8 ? acceptAction : rejectAction;
    }

    const leaderPenalty =
      proposerVp >= vpsToWin - 1 ? 5.5 : proposerVp >= vpsToWin - 2 ? 2.0 : 0.0;

    return gain - leaderPenalty >= 0.4
      ? acceptAction
      : rejectAction;
  }

  if (state.current_prompt === "DECIDE_ACCEPTEES") {
    const cancelAction = playable.find((a) => a[1] === "CANCEL_TRADE");
    const confirmActions = playable.filter(
      (a): a is ConfirmTradeAction => a[1] === "CONFIRM_TRADE"
    );
    if (confirmActions.length === 0) return cancelAction || playable[0];

    const botColor = state.current_color;
    const myHand = getLocalFreqdeck(state, botColor);
    const beforeScore = scoreLocalHandUtility(state, botColor, myHand);
    const vpsToWin = state.game?.vps_to_win ?? 10;

    let bestAction: ConfirmTradeAction | null = null;
    let bestCombined = -Infinity;
    let bestHandDelta = -Infinity;

    for (const act of confirmActions) {
      const offering = act[2].slice(0, 5) as number[];
      const asking = act[2].slice(5, 10) as number[];
      const partnerColor = act[2][10] as Color;
      const afterHand = myHand.map(
        (held, idx) => held - (offering[idx] ?? 0) + (asking[idx] ?? 0)
      );
      if (afterHand.some((c) => c < 0)) continue;

      const handDelta =
        scoreLocalHandUtility(state, botColor, afterHand) - beforeScore;
      const partnerKey = pKey(state, partnerColor);
      const partnerVp = state.player_state[`${partnerKey}_VICTORY_POINTS`] ?? 0;
      const partnerWeight = botDifficulty === "hard" ? 1.15 : 0.75;
      const partnerPenalty =
        partnerWeight * partnerVp + (partnerVp >= vpsToWin - 1 ? 4.0 : 0);
      const combined = handDelta - partnerPenalty;

      if (combined > bestCombined) {
        bestCombined = combined;
        bestHandDelta = handDelta;
        bestAction = act;
      }
    }

    if (!bestAction || (cancelAction && bestHandDelta < -2.0)) {
      return cancelAction || playable[0];
    }
    return bestAction;
  }

  const botColor = state.current_color;
  const k = pKey(state, botColor);
  const ps = state.player_state;

  // Smart DISCARD_RESOURCE keeping highest remaining hand utility
  if (state.current_prompt === "DISCARD") {
    const myHand = getLocalFreqdeck(state, botColor);
    let bestDiscard = playable[0];
    let bestUtility = -Infinity;
    for (const act of playable) {
      if (act[1] !== "DISCARD_RESOURCE") continue;
      const rIdx = RESOURCES.indexOf(act[2]);
      if (rIdx < 0 || myHand[rIdx] <= 0) continue;
      const nextHand = [...myHand];
      nextHand[rIdx] -= 1;
      const u = scoreLocalHandUtility(state, botColor, nextHand);
      if (u > bestUtility) {
        bestUtility = u;
        bestDiscard = act;
      }
    }
    return bestDiscard;
  }

  // Initial placement
  if (state.is_initial_build_phase) {
    const settlements = playable.filter((a) => a[1] === "BUILD_SETTLEMENT");
    if (settlements.length > 0) {
      return pickFromTopScored(
        settlements,
        (act) => scoreNodeForBot(state, portNodes, botColor, act[2] as number),
        botDifficulty === "easy" ? 4 : 1
      );
    }
    const roads = playable.filter((a) => a[1] === "BUILD_ROAD");
    if (roads.length > 0) {
      return pickFromTopScored(
        roads,
        (act) => scoreRoadEdgeForBot(game, botColor, act[2] as [number, number]),
        botDifficulty === "easy" ? 3 : 1
      );
    }
    return playable[0];
  }

  // MOVE_ROBBER (from rolling 7 or playing Knight)
  const moveRobber = playable.filter((a) => a[1] === "MOVE_ROBBER");
  if (moveRobber.length > 0) {
    return pickFromTopScored(
      moveRobber,
      (act) => scoreRobberActionForBot(state, botColor, act, botDifficulty),
      botDifficulty === "easy" ? 4 : 1
    );
  }

  // Pre-roll: unblock our own producing tile via Knight if robbed, otherwise ROLL
  const roll = playable.find((a) => a[1] === "ROLL");
  if (roll) {
    const knight = playable.find((a) => a[1] === "PLAY_KNIGHT_CARD");
    if (knight && (botDifficulty !== "easy" || Math.random() < 0.5)) {
      const robberKey = coordKey(state.robber_coordinate);
      const robbedTile = state.tiles.find(
        (pt) => coordKey(pt.coordinate) === robberKey
      );
      const robberBlocksMe = Object.values(state.nodes).some(
        (n) =>
          n.color === botColor &&
          robbedTile &&
          "id" in robbedTile.tile &&
          (state.adjacent_tiles[String(n.id)] || []).some(
            (t) =>
              "id" in t &&
              "id" in robbedTile.tile &&
              t.id === robbedTile.tile.id
          )
      );
      if (robberBlocksMe) return knight;
    }
    return roll;
  }

  // Road Building free roads in progress
  if (game.isRoadBuilding && (game.freeRoadsAvailable ?? 0) > 0) {
    const roads = playable.filter((a) => a[1] === "BUILD_ROAD");
    if (roads.length > 0) {
      return pickFromTopScored(
        roads,
        (act) => scoreRoadEdgeForBot(game, botColor, act[2] as [number, number]),
        botDifficulty === "easy" ? 3 : 1
      );
    }
  }

  // Post-roll PLAY_TURN
  // 1. Direct Cities (+1 VP + double yield)
  const cities = playable.filter((a) => a[1] === "BUILD_CITY");
  if (cities.length > 0) {
    return pickFromTopScored(
      cities,
      (act) => scoreNodeForBot(state, portNodes, botColor, act[2] as number),
      botDifficulty === "easy" ? 2 : 1
    );
  }

  // 2. Direct Settlements (+1 VP + new yield)
  const settlements = playable.filter((a) => a[1] === "BUILD_SETTLEMENT");
  if (settlements.length > 0) {
    return pickFromTopScored(
      settlements,
      (act) => scoreNodeForBot(state, portNodes, botColor, act[2] as number),
      botDifficulty === "easy" ? 3 : 1
    );
  }

  const myHand = getLocalFreqdeck(state, botColor);
  const totalCards = myHand.reduce((a, b) => a + b, 0);
  const discardLimit = state.game?.discard_limit ?? 7;
  const tradesThisTurn = game.tradesThisTurn ?? 0;
  const maxTradesPerTurn = 6;

  const citiesAvail = ps[`${k}_CITIES_AVAILABLE`] ?? 4;
  const settlementsAvail = ps[`${k}_SETTLEMENTS_AVAILABLE`] ?? 5;
  const roadsAvail = ps[`${k}_ROADS_AVAILABLE`] ?? 15;
  const ownedSettlements = Object.values(state.nodes).filter(
    (n) => n.color === botColor && n.building === "SETTLEMENT"
  ).length;
  const connectedNodes = new Set<number>();
  for (const e of state.edges) {
    if (e.color === botColor) {
      connectedNodes.add(e.id[0]);
      connectedNodes.add(e.id[1]);
    }
  }
  const hasBuildableSettlementSpot =
    settlementsAvail > 0 &&
    Object.values(state.nodes).some(
      (n) =>
        n.building === null &&
        connectedNodes.has(n.id) &&
        !(game.nodeNeighbors[n.id] || []).some(
          (nb) => state.nodes[String(nb)]?.building !== null
        )
    );
  const canUpgradeCity = citiesAvail > 0 && ownedSettlements > 0;
  const devDeckCount = Object.values(state.development_listdeck || {}).reduce(
    (s, c) => s + Math.max(0, Number(c) || 0),
    0
  );

  const maritimeTrades =
    tradesThisTurn < maxTradesPerTurn
      ? playable.filter((a) => a[1] === "MARITIME_TRADE")
      : [];

  // 3. Can a 1-step Maritime Trade immediately unlock City or Settlement THIS turn?
  if (maritimeTrades.length > 0 && (botDifficulty !== "easy" || totalCards > discardLimit)) {
    let bestUnlockTrade: GameAction | null = null;
    let bestUnlockScore = -Infinity;
    for (const act of maritimeTrades) {
      const info = getMaritimeTradeDeltaInfo(act[2] as (ResourceCard | null)[]);
      if (!info) continue;
      const afterHand = [...myHand];
      afterHand[info.giveIdx] -= info.rate;
      afterHand[info.recvIdx] += 1;
      const unlocksCity =
        canUpgradeCity && afterHand[3] >= 2 && afterHand[4] >= 3;
      const unlocksSettlement =
        hasBuildableSettlementSpot &&
        afterHand[0] >= 1 &&
        afterHand[1] >= 1 &&
        afterHand[2] >= 1 &&
        afterHand[3] >= 1;
      if (unlocksCity || unlocksSettlement) {
        const score =
          (unlocksCity ? 100 : 80) +
          scoreLocalHandUtility(state, botColor, afterHand);
        if (score > bestUnlockScore) {
          bestUnlockScore = score;
          bestUnlockTrade = act;
        }
      }
    }
    if (bestUnlockTrade) return bestUnlockTrade;
  }

  // 4. Playable Dev Cards strategically
  const yopActions = playable.filter((a) => a[1] === "PLAY_YEAR_OF_PLENTY");
  if (yopActions.length > 0) {
    const beforeUtility = scoreLocalHandUtility(state, botColor, myHand);
    let bestYop = yopActions[0];
    let bestYopScore = -Infinity;
    let bestYopShouldPlay = false;
    for (const act of yopActions) {
      const afterHand = [...myHand];
      for (const r of act[2] as ResourceCard[]) {
        afterHand[RESOURCES.indexOf(r)] += 1;
      }
      const unlocksCity =
        canUpgradeCity && afterHand[3] >= 2 && afterHand[4] >= 3;
      const unlocksSettlement =
        hasBuildableSettlementSpot &&
        afterHand[0] >= 1 &&
        afterHand[1] >= 1 &&
        afterHand[2] >= 1 &&
        afterHand[3] >= 1;
      const unlocksDev =
        devDeckCount > 0 &&
        afterHand[2] >= 1 &&
        afterHand[3] >= 1 &&
        afterHand[4] >= 1;
      const unlocksRoad =
        roadsAvail > 0 && afterHand[0] >= 1 && afterHand[1] >= 1;
      const afterCount = afterHand.reduce((a, b) => a + b, 0);
      const utilityDelta =
        scoreLocalHandUtility(state, botColor, afterHand) - beforeUtility;
      const score =
        (unlocksCity ? 60 : unlocksSettlement ? 50 : unlocksDev ? 14 : unlocksRoad ? 8 : 0) +
        utilityDelta;
      const shouldPlay =
        unlocksCity ||
        unlocksSettlement ||
        (unlocksDev && afterCount - 3 <= discardLimit) ||
        (afterCount <= discardLimit && utilityDelta > 0);
      if (score > bestYopScore) {
        bestYopScore = score;
        bestYop = act;
        bestYopShouldPlay = shouldPlay;
      }
    }
    if (bestYopShouldPlay) {
      return bestYop;
    }
  }

  const roadBuildingAct = playable.find((a) => a[1] === "PLAY_ROAD_BUILDING");
  if (roadBuildingAct && roadsAvail > 0) {
    const roadOptions = state.edges.filter(
      (e) =>
        e.color === null &&
        (connectedNodes.has(e.id[0]) || connectedNodes.has(e.id[1]))
    );
    const maxRoadVal = roadOptions.reduce(
      (best, e) => Math.max(best, scoreRoadEdgeForBot(game, botColor, e.id)),
      0
    );
    if (maxRoadVal >= 3 || (ps[`${k}_LONGEST_ROAD_LENGTH`] ?? 0) >= 3) {
      return roadBuildingAct;
    }
  }

  const monopolyActions = playable.filter((a) => a[1] === "PLAY_MONOPOLY");
  if (monopolyActions.length > 0) {
    const enemyCardsTotal = state.colors
      .filter((c) => c !== botColor)
      .reduce(
        (acc, c) =>
          acc + (ps[`${pKey(state, c)}_NUM_RESOURCES_IN_HAND`] ?? 0),
        0
      );
    if (enemyCardsTotal >= (botDifficulty === "hard" ? 2 : 3)) {
      let bestMono = monopolyActions[0];
      let bestMonoScore = -Infinity;
      let bestMonoGain = 0;
      for (const act of monopolyActions) {
        const res = act[2] as ResourceCard;
        let expectedGain = 0;
        for (const c of state.colors) {
          if (c === botColor) continue;
          const ck = pKey(state, c);
          expectedGain += ps[`${ck}_${res}_IN_HAND`] ?? 0;
        }
        const afterHand = [...myHand];
        afterHand[RESOURCES.indexOf(res)] += expectedGain;
        const score =
          expectedGain * 5.0 +
          scoreLocalHandUtility(state, botColor, afterHand);
        if (score > bestMonoScore) {
          bestMonoScore = score;
          bestMono = act;
          bestMonoGain = expectedGain;
        }
      }
      if (bestMonoGain >= 2) {
        return bestMono;
      }
    }
  }

  const knightAct = playable.find((a) => a[1] === "PLAY_KNIGHT_CARD");
  if (knightAct) {
    const myKnights = ps[`${k}_PLAYED_KNIGHT`] ?? 0;
    const maxEnemyKnights = state.colors
      .filter((c) => c !== botColor)
      .reduce((m, c) => Math.max(m, ps[`${pKey(state, c)}_PLAYED_KNIGHT`] ?? 0), 0);
    const robberKey = coordKey(state.robber_coordinate);
    const robbedTile = state.tiles.find(
      (pt) => coordKey(pt.coordinate) === robberKey
    );
    const robberBlocksMe = Object.values(state.nodes).some(
      (n) =>
        n.color === botColor &&
        robbedTile &&
        "id" in robbedTile.tile &&
        (state.adjacent_tiles[String(n.id)] || []).some(
          (t) =>
            "id" in t && "id" in robbedTile.tile && t.id === robbedTile.tile.id
        )
    );
    const maxEnemyVp = state.colors
      .filter((c) => c !== botColor)
      .reduce(
        (m, c) => Math.max(m, ps[`${pKey(state, c)}_VICTORY_POINTS`] ?? 0),
        0
      );
    if (
      robberBlocksMe ||
      (!ps[`${k}_HAS_ARMY`] && myKnights + 1 >= Math.max(3, maxEnemyKnights + 1)) ||
      (botDifficulty !== "easy" && maxEnemyVp >= (state.game?.vps_to_win ?? 10) - 3)
    ) {
      return knightAct;
    }
  }

  // 5. BUY_DEVELOPMENT_CARD (no random skip; save only when 1 card from City/Settlement safely under limit)
  const buyDev = playable.find((a) => a[1] === "BUY_DEVELOPMENT_CARD");
  if (buyDev) {
    const closeToCity =
      canUpgradeCity &&
      myHand[3] >= 2 &&
      myHand[4] >= 2 &&
      totalCards < discardLimit;
    const closeToSettlement =
      hasBuildableSettlementSpot &&
      (myHand[0] >= 1 ? 1 : 0) +
        (myHand[1] >= 1 ? 1 : 0) +
        (myHand[2] >= 1 ? 1 : 0) +
        (myHand[3] >= 1 ? 1 : 0) >=
        3 &&
      totalCards < discardLimit;
    if (totalCards >= discardLimit || (!closeToCity && !closeToSettlement)) {
      return buyDev;
    }
  }

  // 6. Anti-hoarding MARITIME_TRADE & strategic BUILD_ROAD
  const roadActions = playable.filter((a) => a[1] === "BUILD_ROAD");
  let bestRoad: GameAction | null = null;
  let bestRoadScore = -Infinity;
  for (const act of roadActions) {
    const s = scoreRoadEdgeForBot(game, botColor, act[2] as [number, number]);
    if (s > bestRoadScore) {
      bestRoadScore = s;
      bestRoad = act;
    }
  }

  if (bestRoad && (totalCards > discardLimit || bestRoadScore >= 2.0)) {
    return bestRoad;
  }

  if (maritimeTrades.length > 0) {
    const beforeUtil = scoreLocalHandUtility(state, botColor, myHand);
    let bestTrade: GameAction | null = null;
    let bestTradeScore = -Infinity;
    let bestTradeDelta = -Infinity;
    const maxEnemyRoad = state.colors
      .filter((c) => c !== botColor)
      .reduce((m, c) => Math.max(m, ps[`${pKey(state, c)}_LONGEST_ROAD_LENGTH`] ?? 0), 0);
    const myRoadLen = ps[`${k}_LONGEST_ROAD_LENGTH`] ?? 0;

    for (const act of maritimeTrades) {
      const info = getMaritimeTradeDeltaInfo(act[2] as (ResourceCard | null)[]);
      if (!info) continue;
      const afterHand = [...myHand];
      afterHand[info.giveIdx] -= info.rate;
      afterHand[info.recvIdx] += 1;

      const afterUtil = scoreLocalHandUtility(state, botColor, afterHand);
      const delta = afterUtil - beforeUtil;
      const unlocksDev =
        devDeckCount > 0 &&
        afterHand[2] >= 1 &&
        afterHand[3] >= 1 &&
        afterHand[4] >= 1;
      const unlocksRoad =
        roadsAvail > 0 && afterHand[0] >= 1 && afterHand[1] >= 1;
      const racesLongestRoad =
        botDifficulty === "hard" &&
        unlocksRoad &&
        !ps[`${k}_HAS_ROAD`] &&
        myRoadLen + 1 >= Math.max(5, maxEnemyRoad + 1);
      const tradePriority =
        delta +
        (unlocksDev ? 4.0 : 0) +
        (racesLongestRoad ? 8.0 : unlocksRoad && totalCards > discardLimit ? 1.5 : 0) +
        (myHand[info.giveIdx] >= info.rate ? myHand[info.giveIdx] * 0.25 : 0);

      if (tradePriority > bestTradeScore) {
        bestTradeScore = tradePriority;
        bestTradeDelta = delta + (racesLongestRoad ? 3.0 : 0);
        bestTrade = act;
      }
    }

    // Above discard limit: always trade down so bots never pass turns hoarding 8-19 cards.
    // Below discard limit: trade when strictly improving utility meaningfully (2:1/3:1 port or heavy surplus).
    const utilityThreshold = botDifficulty === "easy" ? 2.5 : 1.5;
    if (
      bestTrade &&
      (totalCards > discardLimit || bestTradeDelta >= utilityThreshold)
    ) {
      return bestTrade;
    }
  }

  if (bestRoad) {
    return bestRoad;
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
  diceMode?: DiceMode;
  seatNames?: Partial<Record<Color, string>>;
  seatNamesList?: Array<string | null>;
  hostName?: string;
  hostSeatIndex?: number;
  roomCode?: string;
  botSpeed?: BotSpeed;
  seatMeta?: Record<Color, LocalSeatMeta>;
  hostAvatarConfig?: Partial<AvatarConfig>;
}): string {
  const built = buildLocalMap(options.mapTemplate);
  const count = Math.max(2, Math.min(4, options.players.length));
  const rawPairs = SEAT_COLORS.slice(0, count).map((color, idx) => ({
    color,
    playerKey:
      options.seatMeta?.[color]?.player_key || options.players[idx] || "HUMAN",
  }));
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

  const nowSec = Math.floor(Date.now() / 1000);

  if (!options.seatMeta) {
    const guestProfile = !defaultUser ? getGuestProfile() : null;
    const resolvedGuestAvatar = !defaultUser
      ? filterUnlockedAvatarConfig(
          options.hostAvatarConfig ??
            (guestProfile?.customized ? guestProfile.avatar_config : undefined),
          0
        )
      : {};

    const requestedNameAt = (idx: number, c: Color): string | undefined => {
      const fromMap = options.seatNames?.[c];
      if (typeof fromMap === "string" && fromMap.trim()) return fromMap.trim();
      const fromList = options.seatNamesList?.[idx];
      if (typeof fromList === "string" && fromList.trim()) return fromList.trim();
      return undefined;
    };

    const { explicitByIndex, usedNames: usedBotNames } = prescanRequestedBotNames(
      rawPairs.map((pair, idx) => ({
        isBot: pair.playerKey !== "HUMAN",
        requestedName: requestedNameAt(idx, pair.color),
      }))
    );

    let resolvedHostIdx: number | null =
      typeof options.hostSeatIndex === "number" &&
      options.hostSeatIndex >= 0 &&
      options.hostSeatIndex < rawPairs.length &&
      rawPairs[options.hostSeatIndex].playerKey === "HUMAN"
        ? options.hostSeatIndex
        : null;
    if (resolvedHostIdx === null) {
      const firstHumanIdx = rawPairs.findIndex((p) => p.playerKey === "HUMAN");
      resolvedHostIdx = firstHumanIdx >= 0 ? firstHumanIdx : null;
    }

    let guestExtraIndex = 1;
    rawPairs.forEach(({ color: c, playerKey }, idx) => {
      if (playerKey === "HUMAN") {
        const reqHuman = requestedNameAt(idx, c);
        const cleanReqHuman =
          reqHuman && !isOpenSeatPlaceholderName(reqHuman) ? reqHuman : undefined;
        if (idx === resolvedHostIdx && defaultUser) {
          resolvedSeatMeta[c] = {
            color: c,
            seat_kind: "USER",
            username: defaultUser.username,
            player_key: "HUMAN",
            display_name: cleanReqHuman || defaultUser.display_name,
            avatar_config: defaultUser.avatar_config,
          };
        } else if (idx === resolvedHostIdx) {
          const guestFallbackName =
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
              cleanReqHuman ||
              options.hostName?.trim() ||
              guestFallbackName ||
              PLAYER_COLOR_META[c].label,
            avatar_config: resolvedGuestAvatar,
          };
        } else {
          guestExtraIndex += 1;
          resolvedSeatMeta[c] = {
            color: c,
            seat_kind: "GUEST",
            username: null,
            player_key: "HUMAN",
            display_name: cleanReqHuman || `Convidado ${guestExtraIndex}`,
            avatar_config: {},
          };
        }
      } else {
        const botName =
          explicitByIndex.get(idx) ?? pickBotNames(1, usedBotNames)[0];
        usedBotNames.add(botName);
        resolvedSeatMeta[c] = {
          color: c,
          seat_kind: "BOT",
          username: null,
          player_key: playerKey,
          display_name: botName,
          avatar_config: BOT_AVATAR_PROFILES[botName],
        };
      }
    });
  }

  for (const { color: c } of rawPairs) {
    const meta = resolvedSeatMeta[c];
    if (!meta) continue;
    resolvedSeatMeta[c] = {
      ...meta,
      original_player_key: meta.original_player_key ?? meta.player_key,
      original_seat_kind: meta.original_seat_kind ?? meta.seat_kind,
      original_username:
        meta.original_username !== undefined
          ? meta.original_username
          : meta.username,
      original_display_name: meta.original_display_name ?? meta.display_name,
      original_avatar_config:
        meta.original_avatar_config ??
        (meta.avatar_config ? { ...meta.avatar_config } : {}),
      last_seen_at: meta.last_seen_at ?? nowSec,
      taken_over_by_bot: meta.taken_over_by_bot ?? false,
      takeover_reason: meta.takeover_reason ?? null,
    };
  }

  const seatPairs = shuffle(rawPairs);
  const colors = seatPairs.map((p) => p.color);
  const botColors = seatPairs
    .filter((p) => p.playerKey !== "HUMAN")
    .map((p) => p.color);

  const {
    seatNames: metaNames,
    seatAvatars,
    takenOverColors,
    seatTakeover,
  } = buildSeatViewsFromMeta(resolvedSeatMeta);

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
    playerState[`${k}_HAS_PLAYED_DEVELOPMENT_CARD_IN_TURN`] = false;
    playerState[`${k}_KNIGHT_BOUGHT_THIS_TURN`] = 0;
    playerState[`${k}_MONOPOLY_BOUGHT_THIS_TURN`] = 0;
    playerState[`${k}_YEAR_OF_PLENTY_BOUGHT_THIS_TURN`] = 0;
    playerState[`${k}_ROAD_BUILDING_BOUGHT_THIS_TURN`] = 0;
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

  const resolvedDiceMode: DiceMode =
    options.diceMode === "balanced" ? "balanced" : "random";
  const diceDeck =
    resolvedDiceMode === "balanced" ? buildBalancedDiceDeck() : undefined;

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
    is_resolving_trade: false,
    current_trade: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    acceptees: colors.map(() => false),
    longest_roads_by_player: {},
    state_index: 0,
    seat_names: { ...metaNames, ...(options.seatNames || {}) },
    seat_avatars: seatAvatars,
    room_code: options.roomCode,
    ...(options.roomCode || options.botSpeed
      ? { bot_speed: normalizeBotSpeed(options.botSpeed) ?? "normal" }
      : {}),
    taken_over_colors: takenOverColors,
    seat_takeover: seatTakeover,
    schema_version: 2,
    game: {
      id: gameId,
      vps_to_win: options.vpsToWin,
      discard_limit: options.discardLimit,
      friendly_robber: options.friendlyRobber,
      dice_mode: resolvedDiceMode,
    },
    ...(diceDeck ? { dice_deck_remaining: diceDeck.length } : {}),
    num_turns: 0,
    current_player_index: 0,
    current_turn_index: 0,
    resource_freqdeck: [19, 19, 19, 19, 19],
    development_listdeck: {
      KNIGHT: 14,
      YEAR_OF_PLENTY: 2,
      ROAD_BUILDING: 2,
      MONOPOLY: 2,
      VICTORY_POINT: 5,
    },
  };

  const stored: StoredLocalGame = {
    state,
    mapTemplate: options.mapTemplate,
    nodeNeighbors: built.nodeNeighbors,
    portNodes: built.portNodes,
    initialQueue,
    lastInitialSettlementNode: null,
    history: [JSON.parse(JSON.stringify(state))],
    seatMeta: resolvedSeatMeta,
    discardCounts: colors.map(() => 0),
    isRoadBuilding: false,
    freeRoadsAvailable: 0,
    tradesThisTurn: 0,
    ...(diceDeck ? { diceDeck } : {}),
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
    const {
      seatNames,
      seatAvatars,
      takenOverColors,
      seatTakeover,
    } = buildSeatViewsFromMeta(game.seatMeta);
    cloned.seat_names = { ...(cloned.seat_names || {}), ...seatNames };
    cloned.seat_avatars = seatAvatars;
    cloned.taken_over_colors = takenOverColors;
    cloned.seat_takeover = seatTakeover;
  }
  return cloned;
}

export function localPostAction(
  gameId: string,
  action?: GameAction,
  options?: { botOnly?: boolean }
): GameState {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game) {
    return localGetState(gameId, "latest");
  }
  const buildView = () => {
    const cloned = JSON.parse(JSON.stringify(game.state)) as GameState;
    if (game.seatMeta) {
      const {
        seatNames,
        seatAvatars,
        takenOverColors,
        seatTakeover,
      } = buildSeatViewsFromMeta(game.seatMeta);
      cloned.seat_names = { ...(cloned.seat_names || {}), ...seatNames };
      cloned.seat_avatars = seatAvatars;
      cloned.taken_over_colors = takenOverColors;
      cloned.seat_takeover = seatTakeover;
    }
    return cloned;
  };
  if (
    options?.botOnly &&
    !action &&
    !game.state.bot_colors.includes(game.state.current_color)
  ) {
    return buildView();
  }
  const chosen = action ?? chooseBotAction(game);
  if (chosen) {
    applyActionToGame(game, chosen);
    saveGamesMap(map);
  }
  return buildView();
}

export function localGameHeartbeat(
  gameId: string,
  color?: Color | null
): {
  ok: boolean;
  bot_colors: Color[];
  taken_over_colors: Color[];
  my_seat_taken_over: boolean;
} {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game) {
    return {
      ok: true,
      bot_colors: [],
      taken_over_colors: [],
      my_seat_taken_over: false,
    };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    color &&
    game.seatMeta?.[color] &&
    !game.seatMeta[color].taken_over_by_bot
  ) {
    game.seatMeta[color].last_seen_at = nowSec;
    saveGamesMap(map);
  }
  const takenOver = Object.entries(game.seatMeta || {})
    .filter(([, m]) => Boolean(m?.taken_over_by_bot))
    .map(([c]) => c as Color);
  return {
    ok: true,
    bot_colors: [...game.state.bot_colors],
    taken_over_colors: takenOver,
    my_seat_taken_over: Boolean(
      color && game.seatMeta?.[color]?.taken_over_by_bot
    ),
  };
}

export function localAbandonGame(
  gameId: string,
  color?: Color | null
): GameState {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game) return localGetState(gameId, "latest");

  const targetColor =
    color ||
    game.state.colors.find((c) => !game.state.bot_colors.includes(c)) ||
    game.state.colors[0];

  if (!game.seatMeta) game.seatMeta = {} as Record<Color, LocalSeatMeta>;
  const existing = game.seatMeta[targetColor] || {
    color: targetColor,
    seat_kind: "GUEST",
    username: null,
    player_key: "HUMAN",
    display_name:
      game.state.seat_names?.[targetColor] || PLAYER_COLOR_META[targetColor].label,
    avatar_config: {},
  };
  const rawOrig =
    existing.original_display_name ||
    existing.display_name ||
    PLAYER_COLOR_META[targetColor].label;
  const origName = rawOrig.endsWith(" (Bot)") ? rawOrig.slice(0, -6) : rawOrig;
  game.seatMeta[targetColor] = {
    ...existing,
    original_player_key: existing.original_player_key || existing.player_key || "HUMAN",
    original_seat_kind: existing.original_seat_kind || existing.seat_kind || "GUEST",
    original_username:
      existing.original_username !== undefined
        ? existing.original_username
        : existing.username,
    original_display_name: origName,
    original_avatar_config:
      existing.original_avatar_config || existing.avatar_config || {},
    taken_over_by_bot: true,
    takeover_reason: "ABANDONED",
    player_key: "CATANATRON",
    seat_kind: "BOT",
    username: null,
    display_name: `${origName} (Bot)`,
  };
  if (game.state.seat_names) {
    game.state.seat_names[targetColor] = `${origName} (Bot)`;
  }
  if (!game.state.bot_colors.includes(targetColor)) {
    game.state.bot_colors = [...game.state.bot_colors, targetColor];
  }
  recomputeScoresAndPlayableActions(game);
  saveGamesMap(map);
  return localGetState(gameId, "latest");
}

export function localReclaimGame(
  gameId: string,
  color?: Color | null
): GameState {
  const map = loadGamesMap();
  const game = map[gameId];
  if (!game || !game.seatMeta) return localGetState(gameId, "latest");

  const targetColor =
    color ||
    (Object.keys(game.seatMeta).find(
      (c) => game.seatMeta?.[c as Color]?.taken_over_by_bot
    ) as Color | undefined);
  if (!targetColor || !game.seatMeta[targetColor]) {
    return localGetState(gameId, "latest");
  }

  const meta = game.seatMeta[targetColor];
  const origKey = meta.original_player_key || "HUMAN";
  const origKind = meta.original_seat_kind || "GUEST";
  const restoredName =
    meta.original_display_name || PLAYER_COLOR_META[targetColor].label;
  game.seatMeta[targetColor] = {
    ...meta,
    taken_over_by_bot: false,
    takeover_reason: null,
    player_key: origKey,
    seat_kind: origKind,
    username: origKind === "USER" ? meta.original_username ?? null : null,
    display_name: restoredName,
    avatar_config: meta.original_avatar_config || meta.avatar_config || {},
    last_seen_at: Math.floor(Date.now() / 1000),
  };
  if (game.state.seat_names) {
    game.state.seat_names[targetColor] = restoredName;
  }
  game.state.bot_colors = game.state.bot_colors.filter((c) => c !== targetColor);
  recomputeScoresAndPlayableActions(game);
  saveGamesMap(map);
  return localGetState(gameId, "latest");
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
    throw new Error(tr("Usuário deve ter pelo menos 2 caracteres.", "Username must be at least 2 characters long."));
  }
  const users = loadLocalUsers();
  if (users[cleanUser]) {
    throw new Error(tr("Este usuário já está cadastrado localmente.", "This username is already registered locally."));
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
    throw new Error(tr("Usuário ou senha incorretos.", "Invalid username or password."));
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
    throw new Error(tr("Usuário inválido.", "Invalid username."));
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
      const msg = tr(
        `Este item requer ${reqWins} vitória(s) no Ranking para ser desbloqueado (você tem ${wins}).`,
        `This item requires ${reqWins} Leaderboard win(s) to unlock (you have ${wins}).`
      );
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

type StoredLocalRoom = RoomState & {
  host_token: string;
  host_username?: string | null;
  seat_tokens: Record<string, string | null>;
};

function makeRoomHttpError(status: number, description: string): Error & {
  response: { status: number; data: { code: number; description: string } };
} {
  const err = new Error(description) as Error & {
    response: { status: number; data: { code: number; description: string } };
  };
  err.response = {
    status,
    data: { code: status, description },
  };
  return err;
}

function loadClosedRoomCodes(): string[] {
  try {
    const raw = localStorage.getItem(CLOSED_ROOMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string")
      : [];
  } catch {
    return [];
  }
}

export function isRoomClosedLocally(roomCode: string): boolean {
  const clean = roomCode.trim().toUpperCase();
  return clean ? loadClosedRoomCodes().includes(clean) : false;
}

function markRoomClosedLocally(roomCode: string) {
  const clean = roomCode.trim().toUpperCase();
  if (!clean) return;
  try {
    const prev = loadClosedRoomCodes().filter((c) => c !== clean);
    localStorage.setItem(
      CLOSED_ROOMS_STORAGE_KEY,
      JSON.stringify([clean, ...prev].slice(0, 100))
    );
  } catch {
    // ignore
  }
}

function unmarkRoomClosedLocally(roomCode: string) {
  const clean = roomCode.trim().toUpperCase();
  if (!clean) return;
  try {
    const next = loadClosedRoomCodes().filter((c) => c !== clean);
    localStorage.setItem(CLOSED_ROOMS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function getStoredRoomTokenLocal(roomCode: string): string | null {
  try {
    return localStorage.getItem(`catan_room_token_${roomCode.trim().toUpperCase()}`);
  } catch {
    return null;
  }
}

function clearStoredRoomTokenLocal(roomCode: string) {
  try {
    localStorage.removeItem(`catan_room_token_${roomCode.trim().toUpperCase()}`);
  } catch {
    // ignore
  }
}

function resolveCandidateRoomTokens(
  roomCode: string,
  explicitToken?: string | null,
  acct?: PlayerAccount | null
): string[] {
  const savedRoomTok = getStoredRoomTokenLocal(roomCode);
  const cleanExplicit = explicitToken?.trim() || "";
  const resolvedAcct = acct !== undefined ? acct : getSavedPlayerAccount();
  const acctTok = resolvedAcct?.auth_token?.trim() || "";

  let rawList: Array<string | null | undefined>;
  if (!cleanExplicit) {
    rawList = [savedRoomTok, acctTok];
  } else if (cleanExplicit === savedRoomTok || cleanExplicit === acctTok) {
    rawList = [cleanExplicit, savedRoomTok, acctTok];
  } else {
    rawList = [cleanExplicit];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of rawList) {
    const clean = t?.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

function isLocalRoomHost(
  stored: StoredLocalRoom,
  candidateTokens: string[],
  acct: PlayerAccount | null,
  usedBrowserIdentity: boolean
): boolean {
  if (candidateTokens.includes(stored.host_token)) {
    return true;
  }
  if (!usedBrowserIdentity || !acct?.username) {
    return false;
  }
  if (stored.host_username && stored.host_username === acct.username) {
    return true;
  }
  const hostSeat = stored.seats.find(
    (s) => stored.seat_tokens?.[s.color] === stored.host_token
  );
  return Boolean(
    hostSeat && hostSeat.seat_kind === "USER" && hostSeat.username === acct.username
  );
}

function loadRoomsMap(): Record<string, StoredLocalRoom> {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRoomsMap(map: Record<string, StoredLocalRoom>) {
  try {
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function localRemoveRoomCache(
  roomCode: string,
  options?: { markClosed?: boolean }
) {
  const code = roomCode.trim().toUpperCase();
  if (!code) return;
  const rooms = loadRoomsMap();
  if (rooms[code]) {
    const gid = rooms[code].game_id;
    delete rooms[code];
    saveRoomsMap(rooms);
    if (gid) {
      try {
        localStorage.removeItem(`catan_game_room_${gid}`);
      } catch {
        // ignore
      }
    }
  }
  clearStoredRoomTokenLocal(code);
  if (options?.markClosed) {
    markRoomClosedLocally(code);
  }
}

export function localCreateRoom(options: {
  hostName: string;
  players?: string[];
  seats?: Array<{
    player_key: string;
    player_name?: string | null;
    is_host?: boolean;
  }>;
  seatNames?: Partial<Record<Color, string>> | Array<string | null>;
  botDifficulty?: BotDifficulty;
  botSpeed?: BotSpeed;
  mapTemplate: MapTemplate;
  vpsToWin: number;
  discardLimit: number;
  friendlyRobber: boolean;
  diceMode?: DiceMode;
  token?: string | null;
  hostAvatarConfig?: Partial<AvatarConfig>;
}): { room_code: string; seat_token: string; room: RoomState } {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rooms = loadRoomsMap();
  const closed = new Set(loadClosedRoomCodes());
  let code = "";
  for (let attempt = 0; attempt < 20; attempt++) {
    let candidate = "";
    for (let i = 0; i < 6; i++) {
      candidate += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!rooms[candidate] && !closed.has(candidate)) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
    unmarkRoomClosedLocally(code);
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

  const normalizedDiff = normalizeBotDifficulty(options.botDifficulty);
  const defaultBotKey = playerKeyForDifficulty(normalizedDiff ?? "medium");

  const initialSpecs: Array<{
    player_key: string;
    player_name: string | null;
    is_host: boolean;
  }> = [];

  if (options.seats && options.seats.length >= 2 && options.seats.length <= 4) {
    for (const item of options.seats) {
      initialSpecs.push({
        player_key: item.player_key || "HUMAN",
        player_name: item.player_name ?? null,
        is_host: Boolean(item.is_host),
      });
    }
  } else {
    const rawKeys =
      options.players && options.players.length >= 2 && options.players.length <= 4
        ? options.players.slice(0, 4)
        : ["HUMAN", "HUMAN", defaultBotKey, defaultBotKey];
    rawKeys.forEach((pk, idx) => {
      const color = SEAT_COLORS[idx];
      let reqName: string | null = null;
      if (Array.isArray(options.seatNames)) {
        reqName = options.seatNames[idx] ?? null;
      } else if (options.seatNames && typeof options.seatNames === "object") {
        reqName = options.seatNames[color] ?? null;
      }
      initialSpecs.push({
        player_key: pk || "HUMAN",
        player_name: reqName,
        is_host: false,
      });
    });
  }

  let hostIdx = initialSpecs.findIndex(
    (sp) => sp.player_key === "HUMAN" && sp.is_host
  );
  if (hostIdx < 0) {
    hostIdx = initialSpecs.findIndex((sp) => sp.player_key === "HUMAN");
  }
  if (hostIdx < 0) {
    hostIdx = 0;
    initialSpecs[0].player_key = "HUMAN";
  }

  const { explicitByIndex, usedNames: usedBotNames } = prescanRequestedBotNames(
    initialSpecs.map((sp) => ({
      isBot: sp.player_key !== "HUMAN",
      requestedName: sp.player_name,
    }))
  );

  const seatTokens: Record<string, string | null> = {};
  let firstBotKey: string | null = null;
  const seats = initialSpecs.map((sp, idx) => {
    const color = SEAT_COLORS[idx];
    if (sp.player_key === "HUMAN" && idx === hostIdx) {
      seatTokens[color] = hostToken;
      return {
        color,
        player_key: "HUMAN",
        player_name: options.hostName.trim() || "Anfitrião",
        is_bot: false,
        claimed: true,
        is_me: true,
        seat_kind: savedAcct?.username ? ("USER" as const) : ("GUEST" as const),
        username: savedAcct?.username ?? null,
        avatar_config: savedAcct?.username
          ? sanitizeAvatarConfig(savedAcct.avatar_config)
          : guestHostAvatar,
      };
    } else if (sp.player_key === "HUMAN") {
      seatTokens[color] = null;
      return {
        color,
        player_key: "HUMAN",
        player_name: OPEN_SEAT_LABEL,
        is_bot: false,
        claimed: false,
        is_me: false,
        seat_kind: "GUEST" as const,
        username: null,
        avatar_config: {},
      };
    } else {
      if (!firstBotKey) firstBotKey = sp.player_key;
      seatTokens[color] = null;
      const botName =
        explicitByIndex.get(idx) ?? pickBotNames(1, usedBotNames)[0];
      usedBotNames.add(botName);
      return {
        color,
        player_key: sp.player_key,
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

  const resolvedDifficulty: BotDifficulty =
    normalizedDiff ??
    (firstBotKey ? difficultyFromPlayerKey(firstBotKey) : "medium");
  const resolvedDiceMode: DiceMode =
    options.diceMode === "balanced" ? "balanced" : "random";

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
      bot_difficulty: resolvedDifficulty,
      bot_speed: normalizeBotSpeed(options.botSpeed) ?? "normal",
      dice_mode: resolvedDiceMode,
      created_at: Math.floor(Date.now() / 1000),
    },
    seats,
  };

  rooms[code] = {
    ...room,
    host_token: hostToken,
    host_username: savedAcct?.username ?? null,
    seat_tokens: seatTokens,
  };
  saveRoomsMap(rooms);

  return { room_code: code, seat_token: hostToken, room };
}

export function localGetRoom(
  roomCode: string,
  token?: string | null
): RoomState {
  const code = roomCode.trim().toUpperCase();
  const rooms = loadRoomsMap();
  let stored = rooms[code];
  if (!stored) {
    if (isRoomClosedLocally(code)) {
      throw makeRoomHttpError(404, "Esta sala foi encerrada ou não existe mais.");
    }
    // Auto-create room if friend opened invite link directly on a new browser without shared DB
    const created = localCreateRoom({
      hostName: "Anfitrião",
      players: ["HUMAN", "HUMAN", "F", "F"],
      botDifficulty: "medium",
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

  const savedAcct = getSavedPlayerAccount();
  const savedRoomTok = getStoredRoomTokenLocal(code);
  const cleanExplicit = token?.trim() || "";
  const usedBrowserIdentity =
    !cleanExplicit ||
    cleanExplicit === savedRoomTok ||
    cleanExplicit === savedAcct?.auth_token?.trim();
  const candidateTokens = resolveCandidateRoomTokens(code, token, savedAcct);

  let myColor: Color | null = null;
  let tokenMatchedColor: Color | null = null;
  const dir = getLocalUserDirectory();
  const usedBotNames = new Set<string>();
  const seats = stored.seats.map((s, idx) => {
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
    const seatTok = stored.seat_tokens?.[s.color] || null;
    const matchedByToken = Boolean(seatTok && candidateTokens.includes(seatTok));
    const matchedByUser = Boolean(
      usedBrowserIdentity &&
        savedAcct?.username &&
        resolvedKind === "USER" &&
        uname === savedAcct.username
    );
    const isMe = matchedByToken || matchedByUser;
    if (matchedByToken) {
      tokenMatchedColor = s.color;
      myColor = s.color;
    } else if (matchedByUser && tokenMatchedColor === null && myColor === null) {
      myColor = s.color;
    }

    const guestAvatar = filterUnlockedAvatarConfig(s.avatar_config, 0);
    const cleanHumanName =
      !seatTok && isOpenSeatPlaceholderName(s.player_name)
        ? OPEN_SEAT_LABEL
        : (s.player_name || OPEN_SEAT_LABEL);
    return {
      ...s,
      player_name: cleanHumanName,
      seat_kind: resolvedKind,
      username: uname,
      avatar_config: uname
        ? dir[uname]?.avatar_config || sanitizeAvatarConfig(s.avatar_config)
        : guestAvatar,
      claimed: Boolean(seatTok),
      is_me: isMe,
    };
  });

  const firstBot = stored.seats.find((s) => s.player_key !== "HUMAN");
  const normalizedDifficulty =
    normalizeBotDifficulty(stored.config.bot_difficulty) ??
    (firstBot ? difficultyFromPlayerKey(firstBot.player_key) : "medium");

  return {
    room_code: stored.room_code,
    status: stored.status,
    game_id: stored.game_id,
    is_host: isLocalRoomHost(stored, candidateTokens, savedAcct, usedBrowserIdentity),
    my_color: myColor,
    config: {
      ...stored.config,
      bot_difficulty: normalizedDifficulty,
      bot_speed: normalizeBotSpeed(stored.config.bot_speed) ?? "normal",
      dice_mode: stored.config.dice_mode === "balanced" ? "balanced" : "random",
    },
    seats,
  };
}

export function localCloseRoom(
  roomCode: string,
  token?: string | null
): { closed: true; room_code: string; game_id: string | null } {
  const code = roomCode.trim().toUpperCase();
  const rooms = loadRoomsMap();
  const stored = rooms[code];
  if (!stored) {
    markRoomClosedLocally(code);
    clearStoredRoomTokenLocal(code);
    throw makeRoomHttpError(404, tr("Sala não encontrada.", "Room not found."));
  }

  const savedAcct = getSavedPlayerAccount();
  const savedRoomTok = getStoredRoomTokenLocal(code);
  const cleanExplicit = token?.trim() || "";
  const usedBrowserIdentity =
    !cleanExplicit ||
    cleanExplicit === savedRoomTok ||
    cleanExplicit === savedAcct?.auth_token?.trim();
  const candidateTokens = resolveCandidateRoomTokens(code, token, savedAcct);

  if (!isLocalRoomHost(stored, candidateTokens, savedAcct, usedBrowserIdentity)) {
    throw makeRoomHttpError(403, tr("Apenas o anfitrião pode encerrar esta sala.", "Only the host can close this room."));
  }

  const closedGameId = stored.game_id ?? null;
  delete rooms[code];
  saveRoomsMap(rooms);
  markRoomClosedLocally(code);
  clearStoredRoomTokenLocal(code);
  if (closedGameId) {
    try {
      localStorage.removeItem(`catan_game_room_${closedGameId}`);
    } catch {
      // ignore
    }
  }
  return { closed: true, room_code: code, game_id: closedGameId };
}

export function localLeaveRoom(
  roomCode: string,
  token?: string | null
): { left: true; room: RoomState } {
  const code = roomCode.trim().toUpperCase();
  const rooms = loadRoomsMap();
  const stored = rooms[code];
  if (!stored) {
    throw makeRoomHttpError(404, tr("Sala não encontrada.", "Room not found."));
  }
  if (stored.status !== "WAITING") {
    throw makeRoomHttpError(
      400,
      tr(
        "A partida já foi iniciada. Peça ao anfitrião para encerrar a sala ou use Sair (Bot Assume) na mesa.",
        "The match has already started. Ask the host to close the room or use Leave (AI Takes Over) at the table."
      )
    );
  }

  const savedAcct = getSavedPlayerAccount();
  const savedRoomTok = getStoredRoomTokenLocal(code);
  const cleanExplicit = token?.trim() || "";
  const usedBrowserIdentity =
    !cleanExplicit ||
    cleanExplicit === savedRoomTok ||
    cleanExplicit === savedAcct?.auth_token?.trim();
  const candidateTokens = resolveCandidateRoomTokens(code, token, savedAcct);

  if (isLocalRoomHost(stored, candidateTokens, savedAcct, usedBrowserIdentity)) {
    throw makeRoomHttpError(
      400,
      tr(
        "Você é o anfitrião desta sala. Use Encerrar Sala para fechá-la.",
        "You are the host of this room. Use Close Room to close it."
      )
    );
  }

  let released = false;
  for (const s of stored.seats) {
    if (s.is_bot || s.player_key !== "HUMAN") continue;
    const seatTok = stored.seat_tokens?.[s.color] || null;
    const tokMatch = Boolean(seatTok && candidateTokens.includes(seatTok));
    const userMatch = Boolean(
      usedBrowserIdentity &&
        savedAcct?.username &&
        s.seat_kind === "USER" &&
        s.username === savedAcct.username
    );
    if (tokMatch || userMatch) {
      stored.seat_tokens[s.color] = null;
      s.player_name = OPEN_SEAT_LABEL;
      s.claimed = false;
      s.is_me = false;
      s.seat_kind = "GUEST";
      s.username = null;
      s.avatar_config = {};
      released = true;
    }
  }

  if (!released) {
    throw makeRoomHttpError(403, tr("Você não ocupa nenhum assento nesta sala.", "You do not occupy any seat in this room."));
  }

  saveRoomsMap(rooms);
  clearStoredRoomTokenLocal(code);
  return { left: true, room: localGetRoom(code, null) };
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
  const code = roomCode.trim().toUpperCase();
  localGetRoom(code, options.token); // ensure exists and not closed
  const rooms = loadRoomsMap();
  const stored = rooms[code];
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

  const savedRoomTok = getStoredRoomTokenLocal(code);
  const cleanExplicit = options.token?.trim() || "";
  const usedBrowserIdentity =
    !cleanExplicit ||
    cleanExplicit === savedRoomTok ||
    cleanExplicit === savedAcct?.auth_token?.trim();
  const candidateTokens = resolveCandidateRoomTokens(code, options.token, savedAcct);

  let currentSeat = stored.seats.find((s) => {
    const seatTok = stored.seat_tokens?.[s.color] || null;
    if (!seatTok) return false;
    return (
      (cleanExplicit && seatTok === cleanExplicit) ||
      candidateTokens.includes(seatTok)
    );
  });
  if (!currentSeat && usedBrowserIdentity && savedAcct?.username) {
    currentSeat = stored.seats.find(
      (s) =>
        s.player_key === "HUMAN" &&
        s.seat_kind === "USER" &&
        s.username === savedAcct.username
    );
  }

  const effectiveToken =
    cleanExplicit ||
    (currentSeat ? stored.seat_tokens?.[currentSeat.color] : null) ||
    "tok_" + Math.random().toString(36).slice(2, 10);

  let targetSeat = currentSeat;
  if (options.preferredColor) {
    const requested = stored.seats.find((s) => s.color === options.preferredColor);
    if (!requested) {
      throw makeRoomHttpError(400, tr("Cor inválida", "Invalid color"));
    }
    if (requested === currentSeat) {
      targetSeat = requested;
    } else if (
      !requested.is_bot &&
      requested.player_key === "HUMAN" &&
      !stored.seat_tokens?.[requested.color]
    ) {
      targetSeat = requested;
    } else {
      throw makeRoomHttpError(400, tr("Este assento não está livre.", "This seat is already taken."));
    }
  } else if (!targetSeat) {
    targetSeat = stored.seats.find(
      (s) =>
        !s.is_bot &&
        s.player_key === "HUMAN" &&
        !stored.seat_tokens?.[s.color]
    );
    if (!targetSeat) {
      throw makeRoomHttpError(400, tr("Não há assentos livres nesta sala", "No open seats available in this room"));
    }
  }

  if (currentSeat && currentSeat !== targetSeat) {
    stored.seat_tokens[currentSeat.color] = null;
    currentSeat.player_name = OPEN_SEAT_LABEL;
    currentSeat.claimed = false;
    currentSeat.is_me = false;
    currentSeat.seat_kind = "GUEST";
    currentSeat.username = null;
    currentSeat.avatar_config = {};
  }

  targetSeat.player_key = "HUMAN";
  targetSeat.is_bot = false;
  targetSeat.player_name = options.playerName.trim() || "Jogador";
  targetSeat.claimed = true;
  targetSeat.seat_kind = seatKind;
  targetSeat.username = seatUsername;
  targetSeat.avatar_config = seatAvatar;
  stored.seat_tokens[targetSeat.color] = effectiveToken;
  saveRoomsMap(rooms);

  return {
    seat_token: effectiveToken,
    seat_color: targetSeat.color,
    room: localGetRoom(code, effectiveToken),
  };
}

export function localUpdateRoom(
  roomCode: string,
  payload: {
    token?: string | null;
    config?: Partial<RoomState["config"]>;
    seats?: Array<{
      color: Color;
      source_color?: Color;
      player_key: string;
      player_name?: string;
      release_claim?: boolean;
    }>;
  }
): RoomState {
  const code = roomCode.trim().toUpperCase();
  localGetRoom(code, payload.token);
  const rooms = loadRoomsMap();
  const stored = rooms[code];
  if (stored.status !== "WAITING") {
    throw makeRoomHttpError(400, tr("A partida já foi iniciada.", "The match has already started."));
  }

  if (payload.config) {
    const nextConfig = { ...stored.config, ...payload.config };
    if ("dice_mode" in payload.config) {
      if (
        payload.config.dice_mode !== "random" &&
        payload.config.dice_mode !== "balanced"
      ) {
        throw makeRoomHttpError(
          400,
          "'dice_mode' deve ser random ou balanced"
        );
      }
      nextConfig.dice_mode = payload.config.dice_mode;
    }
    if ("bot_difficulty" in payload.config) {
      const normDiff = normalizeBotDifficulty(payload.config.bot_difficulty);
      if (!normDiff) {
        throw makeRoomHttpError(
          400,
          "'bot_difficulty' deve ser easy, medium ou hard"
        );
      }
      nextConfig.bot_difficulty = normDiff;
      if (!payload.seats) {
        const targetKey = playerKeyForDifficulty(normDiff);
        stored.seats = stored.seats.map((s) =>
          s.player_key !== "HUMAN" ? { ...s, player_key: targetKey } : s
        );
      }
    }
    if ("bot_speed" in payload.config) {
      const normSpeed = normalizeBotSpeed(payload.config.bot_speed);
      if (!normSpeed) {
        throw makeRoomHttpError(
          400,
          "'bot_speed' deve ser normal, fast ou turbo"
        );
      }
      nextConfig.bot_speed = normSpeed;
    }
    stored.config = nextConfig;
  }

  if (payload.seats) {
    if (payload.seats.length < 2 || payload.seats.length > 4) {
      throw makeRoomHttpError(400, "A sala deve ter entre 2 e 4 assentos");
    }
    const oldByColor = Object.fromEntries(
      stored.seats.map((s) => [s.color, s])
    );
    const oldTokens = { ...(stored.seat_tokens || {}) };
    const nextSeatTokens: Record<string, string | null> = {};

    const { explicitByIndex, usedNames: usedBotNames } = prescanRequestedBotNames(
      payload.seats.map((item, idx) => {
        const src = item.source_color || item.color || SEAT_COLORS[idx];
        const prev = oldByColor[src];
        const reqName =
          item.player_name?.trim() ||
          (prev && prev.player_key !== "HUMAN" ? prev.player_name : undefined);
        return {
          isBot: item.player_key !== "HUMAN",
          requestedName: reqName,
        };
      })
    );

    stored.seats = payload.seats.map((item, idx) => {
      const color = SEAT_COLORS[idx];
      const sourceColor = item.source_color || item.color || color;
      const prev = oldByColor[sourceColor];
      const prevTok = prev ? (oldTokens[prev.color] ?? null) : null;
      const isBot = item.player_key !== "HUMAN";
      if (isBot) {
        nextSeatTokens[color] = null;
        const botName =
          explicitByIndex.get(idx) ?? pickBotNames(1, usedBotNames)[0];
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

      const wasHuman = !prev || prev.player_key === "HUMAN";
      const seatTok = item.release_claim ? null : wasHuman ? prevTok : null;
      nextSeatTokens[color] = seatTok;
      if (seatTok && prev) {
        const reqName = (item.player_name ?? "").trim();
        const prevName = (prev.player_name ?? "").trim();
        const resolvedName =
          reqName && !isOpenSeatPlaceholderName(reqName)
            ? reqName
            : prevName || "Jogador";
        return {
          color,
          player_key: "HUMAN",
          player_name: resolvedName,
          is_bot: false,
          claimed: true,
          is_me: Boolean(payload.token && seatTok === payload.token),
          seat_kind: prev.seat_kind || "GUEST",
          username: prev.username ?? null,
          avatar_config: prev.avatar_config ?? {},
        };
      }

      return {
        color,
        player_key: "HUMAN",
        player_name: OPEN_SEAT_LABEL,
        is_bot: false,
        claimed: false,
        is_me: false,
        seat_kind: "GUEST" as const,
        username: null,
        avatar_config: {},
      };
    });
    stored.seat_tokens = nextSeatTokens;
  }

  saveRoomsMap(rooms);
  return localGetRoom(code, payload.token);
}

export function localStartRoomGame(
  roomCode: string,
  token?: string | null
): { game_id: string; room: RoomState } {
  const code = roomCode.trim().toUpperCase();
  const resolvedRoom = localGetRoom(code, token);
  const rooms = loadRoomsMap();
  const stored = rooms[code];

  if (!stored.game_id) {
    const seatNames: Partial<Record<Color, string>> = {};
    const seatMeta = {} as Record<Color, LocalSeatMeta>;
    for (const s of resolvedRoom.seats) {
      const cleanLabel = isOpenSeatPlaceholderName(s.player_name)
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
      diceMode: stored.config.dice_mode,
      seatNames,
      seatMeta,
      roomCode: code,
      botSpeed: normalizeBotSpeed(stored.config.bot_speed) ?? "normal",
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
  const games = loadGamesMap();
  const finishedIds = new Set(localGetMatchHistory().map((m) => m.game_id));
  const list: RoomState[] = [];

  for (const code of Object.keys(rooms)) {
    const stored = rooms[code];
    if (!stored || isRoomClosedLocally(code)) continue;
    if (
      stored.game_id &&
      (finishedIds.has(stored.game_id) ||
        Boolean(games[stored.game_id]?.state?.winning_color))
    ) {
      continue;
    }
    list.push(localGetRoom(code, token));
  }

  list.sort((a, b) => {
    const mineA = a.is_host || Boolean(a.my_color) ? 1 : 0;
    const mineB = b.is_host || Boolean(b.my_color) ? 1 : 0;
    if (mineB !== mineA) return mineB - mineA;
    const waitA = a.status === "WAITING" ? 1 : 0;
    const waitB = b.status === "WAITING" ? 1 : 0;
    if (waitB !== waitA) return waitB - waitA;
    return (b.config.created_at ?? 0) - (a.config.created_at ?? 0);
  });
  return list;
}

export const LOCAL_MESSAGES_STORAGE_KEY = "catan_game_messages_v1";
export const LOCAL_MESSAGES_CHANNEL_NAME = "catan_game_messages_v1";

function loadLocalMessagesMap(): Record<string, GameMessage[]> {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalMessagesMap(map: Record<string, GameMessage[]>): void {
  try {
    localStorage.setItem(LOCAL_MESSAGES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function localGetGameMessages(
  gameId: string,
  afterId = 0
): GameMessage[] {
  const map = loadLocalMessagesMap();
  const rows = Array.isArray(map[gameId]) ? map[gameId] : [];
  return rows.filter((m) => m.id > afterId).slice(-100);
}

export function localPostGameMessage(
  gameId: string,
  options: {
    color?: Color | null;
    senderName?: string | null;
    body: string;
    kind?: GameMessageKind;
  }
): GameMessage {
  const trimmed = String(options.body || "").trim();
  if (!trimmed) {
    throw new Error(tr("A mensagem não pode ficar vazia.", "Message cannot be empty."));
  }
  if (trimmed.length > 240) {
    throw new Error(tr("Mensagem muito longa (máx. 240 caracteres).", "Message too long (max 240 characters)."));
  }

  const games = loadGamesMap();
  const game = games[gameId];
  const color: Color =
    options.color && SEAT_COLORS.includes(options.color)
      ? options.color
      : game?.state?.colors?.[0] || "RED";
  const resolvedSender =
    options.senderName?.trim() ||
    game?.state?.seat_names?.[color] ||
    PLAYER_COLOR_META[color]?.label ||
    "Jogador";
  const kind: GameMessageKind = options.kind === "TAUNT" ? "TAUNT" : "CHAT";

  const map = loadLocalMessagesMap();
  const existing = Array.isArray(map[gameId]) ? [...map[gameId]] : [];
  const nextId =
    existing.length > 0 ? existing[existing.length - 1].id + 1 : 1;

  const entry: GameMessage = {
    id: nextId,
    game_id: gameId,
    color,
    sender_name: resolvedSender.slice(0, 64),
    kind,
    body: trimmed,
    created_at: Math.floor(Date.now() / 1000),
  };
  existing.push(entry);
  map[gameId] = existing.slice(-150);
  saveLocalMessagesMap(map);

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(LOCAL_MESSAGES_CHANNEL_NAME);
      ch.postMessage({ gameId, message: entry });
      ch.close();
    }
  } catch {
    // ignore BroadcastChannel failures in unsupported test envs
  }

  return entry;
}
