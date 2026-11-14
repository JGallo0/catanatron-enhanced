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
      const victimColor = (robAction[2]?.[1] as Color | null | undefined) ?? null;
      const victimName = victimColor
        ? resolvePlayerDisplayName(
            gameState,
            victimColor,
            colorMeta[victimColor]?.label || String(victimColor)
          )
        : null;
      const stolenStr = victimName
        ? en
          ? ` and stole 1 resource from ${victimName}`
          : ` e roubou 1 recurso de ${victimName}`
        : en
          ? " (nobody was robbed)"
          : " (ninguém foi roubado)";
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

export type DetailedActionLogEntry = {
  record: GameActionRecord;
  color: Color;
  text: string;
  details: string[];
};

function formatResourceGainMap(
  gains: Partial<Record<ResourceCard, number>>,
  lang: AppLanguage
): string {
  const parts: string[] = [];
  for (const res of TRADE_RESOURCE_ORDER) {
    const qty = gains[res] ?? 0;
    if (qty > 0) {
      parts.push(`+${qty}× ${resLabel(res, lang)}`);
    }
  }
  return parts.join(", ");
}

/**
 * Reconstructs the chronological action history with player resource gains
 * (from dice rolls, second initial settlements, and Year of Plenty) and
 * theft victims (from rolling 7, playing a Knight card, or playing Monopoly,
 * always showing who was robbed without revealing the stolen resource).
 */
export function buildDetailedActionLogEntries(
  gameState: GameState,
  lang: AppLanguage = getCurrentLanguage()
): DetailedActionLogEntry[] {
  const records = gameState.action_records || [];
  if (records.length === 0) return [];

  const en = lang === "en";
  const colorMeta = getPlayerColorMeta(lang);
  const buildingsByNode = new Map<
    number,
    { color: Color; type: "SETTLEMENT" | "CITY" }
  >();
  const settlementCountByColor = new Map<Color, number>();
  let hasRolledYet = false;

  let robberTileId: number | null = null;
  for (const pt of gameState.tiles || []) {
    if (pt.tile.type === "DESERT" && typeof pt.tile.id === "number") {
      robberTileId = pt.tile.id;
      break;
    }
  }

  const hands = new Map<Color, Record<ResourceCard, number>>();
  for (const c of gameState.colors || []) {
    hands.set(c, { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 });
  }
  const addRes = (c: Color, r: ResourceCard, delta: number) => {
    const h = hands.get(c);
    if (!h) return;
    h[r] = Math.max(0, (h[r] ?? 0) + delta);
  };

  let lastRobberTrigger: "SEVEN" | "KNIGHT" | null = null;
  const entries: DetailedActionLogEntry[] = [];

  for (const record of records) {
    if (!record || !record[0]) continue;
    const [action, result] = record;
    const color = action[0];
    const actionType = action[1];
    const player = resolvePlayerDisplayName(
      gameState,
      color,
      colorMeta[color]?.label || color
    );
    let text = humanizeActionRecordPt(gameState, record, lang);
    const details: string[] = [];

    if (actionType === "BUILD_SETTLEMENT") {
      const nodeId = Number(action[2]);
      buildingsByNode.set(nodeId, { color, type: "SETTLEMENT" });
      const count = (settlementCountByColor.get(color) ?? 0) + 1;
      settlementCountByColor.set(color, count);

      if (!hasRolledYet && count === 2) {
        const adjTiles = gameState.adjacent_tiles?.[nodeId] || [];
        const initGains: Partial<Record<ResourceCard, number>> = {};
        for (const t of adjTiles) {
          if (t.type === "RESOURCE_TILE") {
            initGains[t.resource] = (initGains[t.resource] ?? 0) + 1;
            addRes(color, t.resource, 1);
          }
        }
        const gainStr = formatResourceGainMap(initGains, lang);
        if (gainStr) {
          details.push(
            en
              ? `🎁 ${player} gained starting resources: ${gainStr}`
              : `🎁 ${player} ganhou recursos iniciais: ${gainStr}`
          );
        }
      } else if (hasRolledYet) {
        addRes(color, "WOOD", -1);
        addRes(color, "BRICK", -1);
        addRes(color, "SHEEP", -1);
        addRes(color, "WHEAT", -1);
      }
    } else if (actionType === "BUILD_CITY") {
      const nodeId = Number(action[2]);
      buildingsByNode.set(nodeId, { color, type: "CITY" });
      addRes(color, "WHEAT", -2);
      addRes(color, "ORE", -3);
    } else if (actionType === "BUILD_ROAD") {
      if (hasRolledYet) {
        addRes(color, "WOOD", -1);
        addRes(color, "BRICK", -1);
      }
    } else if (actionType === "BUY_DEVELOPMENT_CARD") {
      addRes(color, "SHEEP", -1);
      addRes(color, "WHEAT", -1);
      addRes(color, "ORE", -1);
    } else if (actionType === "DISCARD_RESOURCE") {
      const discarded = (result || action[2]) as ResourceCard | undefined;
      if (discarded) addRes(color, discarded, -1);
    } else if (
      actionType === "ROLL" &&
      Array.isArray(result) &&
      result.length === 2
    ) {
      hasRolledYet = true;
      const sum = Number(result[0]) + Number(result[1]);
      if (sum === 7) {
        lastRobberTrigger = "SEVEN";
      } else {
        const gainsByPlayer = new Map<
          Color,
          Partial<Record<ResourceCard, number>>
        >();

        if (buildingsByNode.size > 0) {
          for (const [nodeId, b] of buildingsByNode.entries()) {
            const mult = b.type === "CITY" ? 2 : 1;
            const adjTiles = gameState.adjacent_tiles?.[nodeId] || [];
            for (const tile of adjTiles) {
              if (
                tile.type === "RESOURCE_TILE" &&
                tile.number === sum &&
                tile.id !== robberTileId
              ) {
                const map = gainsByPlayer.get(b.color) ?? {};
                map[tile.resource] = (map[tile.resource] ?? 0) + mult;
                gainsByPlayer.set(b.color, map);
                addRes(b.color, tile.resource, mult);
              }
            }
          }
        } else {
          // Fallback if action_records started mid-game without initial BUILD_SETTLEMENT records
          for (const node of Object.values(gameState.nodes || {})) {
            if (!node.color || !node.building) continue;
            const mult = node.building === "CITY" ? 2 : 1;
            const adjTiles = gameState.adjacent_tiles?.[node.id] || [];
            for (const tile of adjTiles) {
              if (
                tile.type === "RESOURCE_TILE" &&
                tile.number === sum &&
                tile.id !== robberTileId
              ) {
                const map = gainsByPlayer.get(node.color) ?? {};
                map[tile.resource] = (map[tile.resource] ?? 0) + mult;
                gainsByPlayer.set(node.color, map);
                addRes(node.color, tile.resource, mult);
              }
            }
          }
        }

        const orderedColors = gameState.colors || Array.from(gainsByPlayer.keys());
        for (const pColor of orderedColors) {
          const map = gainsByPlayer.get(pColor);
          if (!map) continue;
          const gainStr = formatResourceGainMap(map, lang);
          if (!gainStr) continue;
          const pName = resolvePlayerDisplayName(
            gameState,
            pColor,
            colorMeta[pColor]?.label || pColor
          );
          details.push(
            en ? `🎁 ${pName} gained ${gainStr}` : `🎁 ${pName} ganhou ${gainStr}`
          );
        }
        if (details.length === 0) {
          details.push(
            en
              ? "🎁 No player gained resources"
              : "🎁 Nenhum jogador ganhou recursos"
          );
        }
      }
    } else if (actionType === "PLAY_KNIGHT_CARD") {
      lastRobberTrigger = "KNIGHT";
    } else if (actionType === "MOVE_ROBBER") {
      const robAction = action as MoveRobberAction;
      try {
        const movedTile = findTileByCoordinate(gameState, robAction[2][0]);
        if ("id" in movedTile.tile && typeof movedTile.tile.id === "number") {
          robberTileId = movedTile.tile.id;
        }
      } catch {
        // ignore coordinate lookup error in minimal mocks
      }

      const victimColor = (robAction[2]?.[1] as Color | null | undefined) ?? null;
      const victimName = victimColor
        ? resolvePlayerDisplayName(
            gameState,
            victimColor,
            colorMeta[victimColor]?.label || String(victimColor)
          )
        : null;
      const causeTag =
        lastRobberTrigger === "KNIGHT"
          ? en
            ? "Knight Card"
            : "Carta Cavaleiro"
          : lastRobberTrigger === "SEVEN"
            ? en
              ? "Rolled 7"
              : "7 nos dados"
            : null;

      if (victimName) {
        details.push(
          en
            ? `🥷 ${victimName} had 1 resource stolen by ${player}${causeTag ? ` (${causeTag})` : ""}`
            : `🥷 ${victimName} teve 1 recurso roubado por ${player}${causeTag ? ` (${causeTag})` : ""}`
        );
      }
      lastRobberTrigger = null;
    } else if (actionType === "PLAY_YEAR_OF_PLENTY") {
      const yopAction = action as PlayYearOfPlentyAction;
      const yopGains: Partial<Record<ResourceCard, number>> = {};
      for (const r of yopAction[2] || []) {
        if (r) {
          yopGains[r] = (yopGains[r] ?? 0) + 1;
          addRes(color, r, 1);
        }
      }
      const gainStr = formatResourceGainMap(yopGains, lang);
      if (gainStr) {
        details.push(
          en ? `🎁 ${player} gained ${gainStr}` : `🎁 ${player} ganhou ${gainStr}`
        );
      }
    } else if (actionType === "PLAY_MONOPOLY") {
      const monoRes = action[2] as ResourceCard;
      const victimNames: string[] = [];
      for (const otherColor of gameState.colors || []) {
        if (otherColor === color) continue;
        const held = hands.get(otherColor)?.[monoRes] ?? 0;
        if (held > 0) {
          addRes(otherColor, monoRes, -held);
          addRes(color, monoRes, held);
          victimNames.push(
            resolvePlayerDisplayName(
              gameState,
              otherColor,
              colorMeta[otherColor]?.label || otherColor
            )
          );
        }
      }
      text = en
        ? `${player} played Monopoly card`
        : `${player} usou carta Monopólio`;
      if (victimNames.length > 0) {
        details.push(
          en
            ? `🥷 Stolen from: ${victimNames.join(", ")} (Monopoly Card)`
            : `🥷 Roubou recursos de: ${victimNames.join(", ")} (Carta Monopólio)`
        );
      } else {
        details.push(
          en
            ? `🥷 Monopoly card played by ${player} (no player had resources stolen)`
            : `🥷 Carta Monopólio usada por ${player} (ninguém teve recursos roubados)`
        );
      }
    } else if (actionType === "MARITIME_TRADE") {
      const mt = (action[2] || []) as (ResourceCard | null)[];
      const out = mt.slice(0, 4).filter((r): r is ResourceCard => r !== null);
      const recv = mt[4];
      for (const r of out) addRes(color, r, -1);
      if (recv) addRes(color, recv, 1);
    } else if (actionType === "CONFIRM_TRADE") {
      const val = (action[2] as [...number[], Color]) || [];
      const partnerColor = val[10] as Color;
      TRADE_RESOURCE_ORDER.forEach((res, idx) => {
        const giveQty = Number(val[idx] || 0);
        const askQty = Number(val[idx + 5] || 0);
        if (giveQty > 0) {
          addRes(color, res, -giveQty);
          addRes(partnerColor, res, giveQty);
        }
        if (askQty > 0) {
          addRes(color, res, askQty);
          addRes(partnerColor, res, -askQty);
        }
      });
    }

    entries.push({
      record,
      color,
      text,
      details,
    });
  }

  return entries;
}
