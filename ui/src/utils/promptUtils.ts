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
  Color,
  GameState,
} from "./api.types";
import { getPlayerColorMeta, getResourceMeta } from "../config/assetRegistry";
import { resolvePlayerDisplayName } from "../config/botCatalog";
import { getCurrentLanguage, type AppLanguage } from "../i18n";

const TRADE_RESOURCE_ORDER: ResourceCard[] = [
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
];

function resLabel(
  resource?: ResourceCard | null,
  lang: AppLanguage = getCurrentLanguage()
): string {
  if (!resource) return "";
  return getResourceMeta(lang)[resource]?.label || resource;
}

export function formatTradeBundlePt(
  bundle: number[] = [],
  lang: AppLanguage = getCurrentLanguage()
): string {
  const parts: string[] = [];
  TRADE_RESOURCE_ORDER.forEach((res, idx) => {
    const qty = Number(bundle[idx] || 0);
    if (qty > 0) {
      parts.push(`${qty}× ${resLabel(res, lang)}`);
    }
  });
  return parts.join(" + ") || (lang === "en" ? "nothing" : "nada");
}

export function humanizeTradeActionPt(
  action: MaritimeTradeAction,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const out = action[2]
    .slice(0, 4)
    .filter((resource: unknown): resource is ResourceCard => resource !== null);
  const giveRes = out[0] ? resLabel(out[0], lang) : "";
  const recvRes = action[2][4] ? resLabel(action[2][4], lang) : "";
  return `${out.length}× ${giveRes} → 1× ${recvRes}`;
}

export function humanizeActionRecordPt(
  gameState: GameState,
  actionRecord: GameActionRecord,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const colorMeta = getPlayerColorMeta(lang);
  const action = actionRecord[0];
  const color = action[0];
  const colorLabel = colorMeta[color]?.label || color;
  const player = resolvePlayerDisplayName(gameState, color, colorLabel);
  const en = lang === "en";

  switch (action[1]) {
    case "ROLL": {
      const dice = actionRecord[1] as [number, number];
      return en
        ? `${player} rolled ${dice[0] + dice[1]} (${dice[0]}+${dice[1]})`
        : `${player} rolou ${dice[0] + dice[1]} (${dice[0]}+${dice[1]})`;
    }
    case "DISCARD_RESOURCE":
      return en
        ? `${player} discarded ${resLabel(actionRecord[1] as ResourceCard, lang)}`
        : `${player} descartou ${resLabel(actionRecord[1] as ResourceCard, lang)}`;
    case "BUY_DEVELOPMENT_CARD":
      return en
        ? `${player} bought a Development Card`
        : `${player} comprou Carta de Desenvolvimento`;
    case "BUILD_SETTLEMENT":
    case "BUILD_CITY": {
      const buildAction = action as BuildCityAction;
      const isCity = buildAction[1] === "BUILD_CITY";
      const label = isCity
        ? en
          ? "City"
          : "Cidade"
        : en
          ? "Settlement"
          : "Aldeia";
      const nodeId = buildAction[2];
      const tiles = gameState.adjacent_tiles?.[nodeId] || [];
      const tileString = tiles.map(getShortTileString).join("-");
      return en
        ? `${player} built ${label} at ${tileString}`
        : `${player} construiu ${label} em ${tileString}`;
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
      return en
        ? `${player} built a Road on ${edgeString}`
        : `${player} construiu Estrada em ${edgeString}`;
    }
    case "PLAY_KNIGHT_CARD":
      return en
        ? `${player} played Knight card`
        : `${player} usou carta Cavaleiro`;
    case "PLAY_ROAD_BUILDING":
      return en
        ? `${player} played Road Building`
        : `${player} usou Construção de Estradas`;
    case "PLAY_MONOPOLY":
      return en
        ? `${player} monopolized ${resLabel(action[2] as ResourceCard, lang)}`
        : `${player} monopolizou ${resLabel(action[2] as ResourceCard, lang)}`;
    case "PLAY_YEAR_OF_PLENTY": {
      const yopAction = action as PlayYearOfPlentyAction;
      const firstResource = resLabel(yopAction[2][0], lang);
      const secondResource = yopAction[2][1]
        ? resLabel(yopAction[2][1], lang)
        : "";
      if (en) {
        return secondResource
          ? `${player} played Year of Plenty (${firstResource} & ${secondResource})`
          : `${player} played Year of Plenty (${firstResource})`;
      }
      return secondResource
        ? `${player} usou Ano da Fartura (${firstResource} e ${secondResource})`
        : `${player} usou Ano da Fartura (${firstResource})`;
    }
    case "MOVE_ROBBER": {
      const robAction = action as MoveRobberAction;
      const tile = findTileByCoordinate(gameState, robAction[2][0]);
      const tileInfo = tile.tile;
      const tileStr =
        tileInfo.type === "RESOURCE_TILE"
          ? `${tileInfo.number} (${resLabel(tileInfo.resource, lang)})`
          : en
            ? "the Desert"
            : "o Deserto";
      const robbedResource = actionRecord[1] as ResourceCard | null;
      const stolenStr = robbedResource
        ? en
          ? ` and stole ${resLabel(robbedResource, lang)}`
          : ` e roubou ${resLabel(robbedResource, lang)}`
        : "";
      return en
        ? `${player} moved the Robber to ${tileStr}${stolenStr}`
        : `${player} moveu o Ladrão para ${tileStr}${stolenStr}`;
    }
    case "MARITIME_TRADE": {
      const label = humanizeTradeActionPt(action as MaritimeTradeAction, lang);
      return en ? `${player} traded ${label}` : `${player} trocou ${label}`;
    }
    case "OFFER_TRADE": {
      const val = (action[2] as number[]) || [];
      const giveStr = formatTradeBundlePt(val.slice(0, 5), lang);
      const askStr = formatTradeBundlePt(val.slice(5, 10), lang);
      return en
        ? `${player} offered trade: ${giveStr} for ${askStr}`
        : `${player} propôs troca: ${giveStr} por ${askStr}`;
    }
    case "ACCEPT_TRADE":
      return en
        ? `${player} accepted the trade offer`
        : `${player} aceitou a proposta de troca`;
    case "REJECT_TRADE":
      return en
        ? `${player} declined the trade offer`
        : `${player} recusou a proposta de troca`;
    case "CONFIRM_TRADE": {
      const val = (action[2] as [...number[], Color]) || [];
      const giveStr = formatTradeBundlePt(val.slice(0, 5) as number[], lang);
      const askStr = formatTradeBundlePt(val.slice(5, 10) as number[], lang);
      const partnerColor = val[10] as Color;
      const partnerName = resolvePlayerDisplayName(
        gameState,
        partnerColor,
        colorMeta[partnerColor]?.label || String(partnerColor)
      );
      return en
        ? `${player} traded with ${partnerName} (${giveStr} ↔ ${askStr})`
        : `${player} fechou troca com ${partnerName} (${giveStr} ↔ ${askStr})`;
    }
    case "CANCEL_TRADE":
      return en
        ? `${player} canceled the trade offer`
        : `${player} cancelou a proposta de troca`;
    case "END_TURN":
      return en ? `${player} ended their turn` : `${player} passou a vez`;
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
    case "OFFER_TRADE":
      return `${player} OFFERED TRADE`;
    case "ACCEPT_TRADE":
      return `${player} ACCEPTED TRADE`;
    case "REJECT_TRADE":
      return `${player} REJECTED TRADE`;
    case "CONFIRM_TRADE":
      return `${player} CONFIRMED TRADE`;
    case "CANCEL_TRADE":
      return `${player} CANCELED TRADE`;
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
