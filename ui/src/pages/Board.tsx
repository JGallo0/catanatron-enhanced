import React, { useMemo } from "react";
import classnames from "classnames";

import { SQRT3 } from "../utils/coordinates";
import type {
  GameAction,
  GameState,
  TileCoordinate,
} from "../utils/api.types";
import Tile from "./Tile";
import Node from "./Node";
import Edge, { toEdgeId, type EdgeId } from "./Edge";
import Robber from "./Robber";

import "./Board.scss";

/**
 * Computes optimal hex size based on available canvas dimensions.
 */
function computeDefaultSize(divWidth: number, divHeight: number): number {
  const numLevels = 7.0; // 3 land rings + outer illustrated harbor ring + ocean clearance
  const maxSizeThatRespectsHeight = (4 * divHeight) / (3 * numLevels + 1) / 2;
  const correspondingWidth = SQRT3 * maxSizeThatRespectsHeight;
  if (numLevels * correspondingWidth < divWidth) {
    return maxSizeThatRespectsHeight;
  }
  return divWidth / numLevels / SQRT3;
}

function getLastRolledSum(gameState: GameState): number | null {
  const records = gameState.action_records || [];
  for (let i = records.length - 1; i >= 0; i--) {
    const [action, result] = records[i];
    if (action[1] === "ROLL" && Array.isArray(result) && result.length === 2) {
      return Number(result[0]) + Number(result[1]);
    }
    if (action[1] === "END_TURN") {
      break;
    }
  }
  return null;
}

type BoardProps = {
  width: number;
  height: number;
  containerWidth?: number;
  containerHeight?: number;
  buildOnNodeClick: (
    id: number,
    action?: GameAction
  ) => React.MouseEventHandler<HTMLDivElement>;
  buildOnEdgeClick: (
    id: [number, number],
    action?: GameAction
  ) => React.MouseEventHandler<HTMLDivElement>;
  handleTileClick: (coordinate: TileCoordinate) => void;
  nodeActions?: Record<number, GameAction>;
  edgeActions?: Record<EdgeId, GameAction>;
  replayMode: boolean;
  gameState: GameState;
  isMobile: boolean;
  show: boolean;
  isMovingRobber: boolean;
  robberCoordinates?: Set<string>;
  recentNodeId?: number | null;
  recentEdgeId?: string | null;
  pendingNodeId?: number | null;
  pendingEdgeId?: string | null;
};

export default function Board({
  width,
  height,
  containerWidth,
  containerHeight,
  buildOnNodeClick,
  buildOnEdgeClick,
  handleTileClick,
  nodeActions,
  edgeActions,
  replayMode,
  gameState,
  isMobile,
  show,
  isMovingRobber,
  robberCoordinates,
  recentNodeId = null,
  recentEdgeId = null,
  pendingNodeId = null,
  pendingEdgeId = null,
}: BoardProps) {
  // Exact available viewport: prefer ResizeObserver container bounds when mounted in ZoomableBoard
  const leftSidebarWidth = 0;
  const isCompactHeight = height <= 520;
  const hasMeasuredContainer =
    typeof containerWidth === "number" &&
    containerWidth > 0 &&
    typeof containerHeight === "number" &&
    containerHeight > 0;
  const fallbackCanvasWidth = Math.max(280, width - leftSidebarWidth);
  const reservedHeight = isCompactHeight
    ? 184
    : isMobile || width <= 980
      ? 344
      : 268;
  const fallbackCanvasHeight = Math.max(
    isCompactHeight ? 200 : 280,
    height - reservedHeight
  );
  const canvasWidth = hasMeasuredContainer ? containerWidth : fallbackCanvasWidth;
  const canvasHeight = hasMeasuredContainer
    ? Math.max(180, containerHeight)
    : fallbackCanvasHeight;
  const margin = isMobile ? 16 : 24;

  const size = computeDefaultSize(canvasWidth - margin, canvasHeight - margin);
  // Nudge center up slightly so bottom harbor ships + hanging 2:1/3:1 placards share balanced sea margin
  const center: [number, number] = [
    canvasWidth / 2,
    canvasHeight / 2 - (size ? size * 0.1 : 0),
  ];

  const lastRolledSum = useMemo(() => getLastRolledSum(gameState), [gameState]);
  const robberCoordKey = `${gameState.robber_coordinate}`;

  if (!size) {
    return null;
  }

  const tiles = gameState.tiles.map(({ coordinate, tile }) => {
    const coordKey = `${coordinate}`;
    const hasRobber = coordKey === robberCoordKey;
    const isProducing =
      tile.type === "RESOURCE_TILE" &&
      lastRolledSum !== null &&
      tile.number === lastRolledSum;

    return (
      <Tile
        key={coordKey}
        center={center}
        coordinate={coordinate}
        tile={tile}
        size={size}
        flashing={!!robberCoordinates?.has(coordKey)}
        isProducing={isProducing}
        hasRobber={hasRobber}
        onClick={
          !isMovingRobber || robberCoordinates?.has(coordKey)
            ? () => handleTileClick(coordinate)
            : undefined
        }
      />
    );
  });

  const nodes = Object.values(gameState.nodes).map(
    ({ color, building, direction, tile_coordinate, id }) => (
      <Node
        key={id}
        center={center}
        size={size}
        coordinate={tile_coordinate}
        direction={direction}
        building={building}
        color={color}
        flashing={!replayMode && !!nodeActions && id in nodeActions}
        isRecent={recentNodeId === id}
        isPending={pendingNodeId === id}
        onClick={buildOnNodeClick(
          id,
          nodeActions ? nodeActions[id] : undefined
        )}
      />
    )
  );

  const edges = Object.values(gameState.edges).map(
    ({ color, direction, tile_coordinate, id }) => {
      const action =
        edgeActions?.[toEdgeId(id)] ??
        edgeActions?.[`${id[1]},${id[0]}` as EdgeId];
      const normalizedEdgeId = `${Math.min(id[0], id[1])},${Math.max(
        id[0],
        id[1]
      )}`;
      return (
        <Edge
          id={`${id[0]},${id[1]}`}
          key={`${id}`}
          center={center}
          size={size}
          coordinate={tile_coordinate}
          direction={direction}
          color={color}
          flashing={!!action}
          isRecent={recentEdgeId === normalizedEdgeId}
          isPending={pendingEdgeId === normalizedEdgeId}
          onClick={buildOnEdgeClick(id, action)}
        />
      );
    }
  );

  return (
    <div
      className={classnames("board", { show })}
      style={{
        width: canvasWidth,
        height: canvasHeight,
      }}
    >
      {/* Realistic Sunset Ocean Lagoons, Turquoise Coastal Shoals & Nautical Chart */}
      <div
        className="board__seascape-underlay"
        style={{
          left: center[0],
          top: center[1],
          width: size * 10.6,
          height: size * 10.6,
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 600 600" width="100%" height="100%">
          <defs>
            <radialGradient id="catanReefShallow" cx="50%" cy="50%" r="48%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.46" />
              <stop offset="46%" stopColor="#2dd4bf" stopOpacity="0.42" />
              <stop offset="68%" stopColor="#0284c7" stopOpacity="0.28" />
              <stop offset="86%" stopColor="#075985" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#04182b" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="catanSunCaustic" cx="62%" cy="32%" r="36%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.26" />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="300" cy="300" r="292" fill="url(#catanReefShallow)" />
          <circle cx="300" cy="300" r="285" fill="url(#catanSunCaustic)" />

          {/* Gentle coastal surf ripples embracing Catan Island */}
          <circle
            className="board__surf-ring board__surf-ring--inner"
            cx="300"
            cy="300"
            r="204"
            fill="none"
            stroke="rgba(224, 242, 254, 0.34)"
            strokeWidth="2.4"
            strokeDasharray="18 14 8 16"
          />
          <circle
            className="board__surf-ring board__surf-ring--outer"
            cx="300"
            cy="300"
            r="238"
            fill="none"
            stroke="rgba(125, 211, 252, 0.24)"
            strokeWidth="2"
            strokeDasharray="28 22 10 24"
          />

          {/* Faint nautical atlas rhumb ring & miniature compass rose */}
          <circle
            cx="300"
            cy="300"
            r="268"
            fill="none"
            stroke="rgba(250, 204, 21, 0.14)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          <g transform="translate(506, 492)" opacity="0.34">
            <circle cx="0" cy="0" r="22" fill="none" stroke="#fde68a" strokeWidth="1" />
            <polygon points="0,-24 4,-4 0,-8 -4,-4" fill="#facc15" />
            <polygon points="0,24 4,4 0,8 -4,4" fill="#bae6fd" />
            <polygon points="24,0 4,4 8,0 4,-4" fill="#bae6fd" />
            <polygon points="-24,0 -4,4 -8,0 -4,-4" fill="#bae6fd" />
          </g>
        </svg>
      </div>
      {tiles}
      {edges}
      {nodes}
      <Robber
        center={center}
        size={size}
        coordinate={gameState.robber_coordinate}
      />
    </div>
  );
}
