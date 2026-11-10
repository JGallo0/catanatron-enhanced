import type {
  Tile,
  PlacedTile,
  GameActionRecord,
  MaritimeTradeAction,
  BuildCityAction,
  BuildRoadAction,
  PlayYearOfPlentyAction,
  MoveRobberAction,
  ResourceCard,
   GameState,
} from "./api.types";
import { PLAYER_COLOR_META, RESOURCE_META } from "../config/assetRegistry";

function resPt(resource?: ResourceCard | null): string {
  if (!resource) return "";
  return RESOURCE_META[resource]?.label || resource;
}

export function humanizeTradeActionPt(action: MaritimeTradeAction): string {
  const out = action[2]
    .slice(0, 4)
    .filter((resource: unknown): resource is ResourceCard => resource !== null);
  const giveRes = out[0] ? resPt(out[0]) : "";
  const recvRes = action[2][4] ? resPt(action[2][4]) : "";
  return `${out.length}× ${giveRes} → 1× ${recvRes}`;
}

export function humanizeActionRecordPt(
  gameState: GameState,
  actionRecord: GameActionRecord
): string {
  const botColors = gameState.bot_colors || [];
  const action = actionRecord[0];
  const color = action[0];
  const colorLabel = PLAYER_COLOR_META[color]?.label || color;
  const customName = gameState.seat_names?.[color];
  const player =
    customName || (botColors.includes(color) ? `IA (${colorLabel})` : colorLabel);

  switch (action[1]) {
    case "ROLL": {
      const dice = actionRecord[1] as [number, number];
      return `${player} rolou ${dice[0] + dice[1]} (${dice[0]}+${dice[1]})`;
    }
    case "DISCARD_RESOURCE":
      return `${player} descartou ${resPt(actionRecord[1] as ResourceCard)}`;
    case "BUY_DEVELOPMENT_CARD":
      return `${player} comprou Carta de Desenvolvimento`;
    case "BUILD_SETTLEMENT":
    case "BUILD_CITY": {
      const buildAction = action as BuildCityAction;
      const isCity = buildAction[1] === "BUILD_CITY";
      const label = isCity ? "Cidade" : "Aldeia";
      const nodeId = buildAction[2];
      const tiles = gameState.adjacent_tiles?.[nodeId] || [];
      const tileString = tiles.map(getShortTileString).join("-");
      return `${player} construiu ${label} em ${tileString}`;
    }
    case "BUILD_ROAD": {
      const roadAction = action as BuildRoadAction;
      const edge = roadAction[2];
      const a = (gameState.adjacent_tiles?.[edge[0]] || []).flatMap((tile) =>
        "id" in tile ? [tile.id] : []
      );
      const b = (gameState.adjacent_tiles?.[edge[1]] || []).flatMap((tile) =>
        "id" in tile ? [tile.id] : []
      );
      const intersection = a.filter((t) => b.includes(t));
      const tiles = intersection.map(
        (tileId) => findTileById(gameState, tileId).tile
      );
      const edgeString = tiles.map(getShortTileString).join("-");
      return `${player} construiu Estrada em ${edgeString}`;
    }
    case "PLAY_KNIGHT_CARD":
      return `${player} usou carta Cavaleiro`;
    case "PLAY_ROAD_BUILDING":
      return `${player} usou Construção de Estradas`;
    case "PLAY_MONOPOLY":
      return `${player} monopolizou ${resPt(action[2] as ResourceCard)}`;
    case "PLAY_YEAR_OF_PLENTY": {
      const yopAction = action as PlayYearOfPlentyAction;
      const firstResource = resPt(yopAction[2][0]);
      const secondResource = yopAction[2][1] ? resPt(yopAction[2][1]) : "";
      return secondResource
        ? `${player} usou Ano da Fartura (${firstResource} e ${secondResource})`
        : `${player} usou Ano da Fartura (${firstResource})`;
    }
    case "MOVE_ROBBER": {
      const robAction = action as MoveRobberAction;
      const tile = findTileByCoordinate(gameState, robAction[2][0]);
      const tileInfo = tile.tile;
      const tileStr =
        tileInfo.type === "DESERT"
          ? "o Deserto"
          : `${tileInfo.number} (${resPt(tileInfo.resource)})`;
      const robbedResource = actionRecord[1] as ResourceCard | null;
      const stolenStr = robbedResource ? ` e roubou ${resPt(robbedResource)}` : "";
      return `${player} moveu o Ladrão para ${tileStr}${stolenStr}`;
    }
    case "MARITIME_TRADE": {
      const label = humanizeTradeActionPt(action as MaritimeTradeAction);
      return `${player} trocou ${label}`;
    }
    case "END_TURN":
      return `${player} passou a vez`;
    default:
      return `${player}: ${action[1]}`;
  }
}

export function humanizeActionRecord(
  gameState: GameState,
  actionRecord: GameActionRecord
) {
  const botColors = gameState.bot_colors;
  const action = actionRecord[0];
  const player = botColors.includes(action[0]) ? "BOT" : "YOU";
  switch (actionRecord[0][1]) {
    case "ROLL": {
      const action = actionRecord[1] as [number, number];
      return `${player} ROLLED A ${action[0] + action[1]}`;
    }
    case "DISCARD_RESOURCE":
      return `${player} DISCARDED ${actionRecord[1] as ResourceCard}`;
    case "BUY_DEVELOPMENT_CARD":
      return `${player} BOUGHT DEVELOPMENT CARD`;
    case "BUILD_SETTLEMENT":
    case "BUILD_CITY": {
      const action = actionRecord[0] as BuildCityAction;
      const parts = action[1].split("_");
      const building = parts[parts.length - 1];
      const tileId = action[2];
      const tiles = gameState.adjacent_tiles[tileId];
      const tileString = tiles.map(getShortTileString).join("-");
      return `${player} BUILT ${building} ON ${tileString}`;
    }
    case "BUILD_ROAD": {
      const action = actionRecord[0] as BuildRoadAction;
      const edge = action[2];
      const a = gameState.adjacent_tiles[edge[0]].flatMap((tile) =>
        "id" in tile ? [tile.id] : []
      );
      const b = gameState.adjacent_tiles[edge[1]].flatMap((tile) =>
        "id" in tile ? [tile.id] : []
      );
      const intersection = a.filter((t) => b.includes(t));
      const tiles = intersection.map(
        (tileId) => findTileById(gameState, tileId).tile
      );
      const edgeString = tiles.map(getShortTileString).join("-");
      return `${player} BUILT ROAD ON ${edgeString}`;
    }
    case "PLAY_KNIGHT_CARD": {
      return `${player} PLAYED KNIGHT CARD`;
    }
    case "PLAY_ROAD_BUILDING": {
      return `${player} PLAYED ROAD BUILDING`;
    }
    case "PLAY_MONOPOLY": {
      return `${player} MONOPOLIZED ${action[2]}`;
    }
    case "PLAY_YEAR_OF_PLENTY": {
      const action = actionRecord[0] as PlayYearOfPlentyAction;
      const firstResource = action[2][0];
      const secondResource = action[2][1];
      if (secondResource) {
        return `${player} PLAYED YEAR OF PLENTY. CLAIMED ${firstResource} AND ${secondResource}`;
      } else {
        return `${player} PLAYED YEAR OF PLENTY. CLAIMED ${firstResource}`;
      }
    }
    case "MOVE_ROBBER": {
      const action = actionRecord[0] as MoveRobberAction;
      const tile = findTileByCoordinate(gameState, action[2][0]);
      const tileString = getTileString(tile);
      const robbedResource = actionRecord[1];
      const stolenResource = robbedResource ? ` (STOLE ${robbedResource})` : "";
      return `${player} ROBBED ${tileString}${stolenResource}`;
    }
    case "MARITIME_TRADE": {
      const label = humanizeTradeAction(action as MaritimeTradeAction);
      return `${player} TRADED ${label}`;
    }
    case "END_TURN":
      return `${player} ENDED TURN`;
    default:
      throw new Error(`Unknown action type: ${action[1]}`);
  }
}

export function humanizeTradeAction(action: MaritimeTradeAction): string {
  const out = action[2]
    .slice(0, 4)
    .filter((resource: unknown) => resource !== null);
  return `${out.length} ${out[0]} => ${action[2][4]}`;
}

export function findTileByCoordinate(gameState: GameState, coordinate: any) {
  for (const tile of Object.values(gameState.tiles)) {
    if (JSON.stringify(tile.coordinate) === JSON.stringify(coordinate)) {
      return tile;
    }
  }
  throw new Error(
    `Tile not found for coordinate: ${JSON.stringify(coordinate)}`
  );
}

export function getShortTileString(tile: Tile): string {
  return tile.type === "RESOURCE_TILE" ? tile.number.toString() : tile.type;
}

export function getTileString(tile: PlacedTile): string {
  const tileInfo = tile.tile;
  switch (tileInfo.type) {
    case "DESERT":
      return "THE DESERT";
    case "RESOURCE_TILE":
      return `${tileInfo.number} ${tileInfo.resource}`;
    default:
      throw new Error("getTileString() only works on Desert or Resource tiles");
  }
}

export function findTileById(gameState: GameState, tileId: number): PlacedTile {
  return gameState.tiles[tileId];
}
