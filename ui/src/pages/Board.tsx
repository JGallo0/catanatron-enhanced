import React, { useMemo } from "react";
import classnames from "classnames";

import { SQRT3 } from "../utils/coordinates";
import type {
  Building as BuildingType,
  Color,
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
  const numLevels = 6.7; // 3 land rings + outer illustrated harbor ring (calibrated to Print 2 framing)
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
  isRollingDice?: boolean;
  width: number;
  height: number;
  containerWidth?: number;
  containerHeight?: number;
  hudClearance?: { top: number; bottom: number };
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
  pendingColor?: Color | null;
  pendingBuilding?: BuildingType | null;
};

export default function Board({
  isRollingDice = false,
  width,
  height,
  containerWidth,
  containerHeight,
  hudClearance,
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
  pendingColor = null,
  pendingBuilding = null,
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

  // Clearance for floating top bar (players + prompt banner) and bottom console (cards + actions)
  // Ensures all 19 hexes and 9 coastal harbor ships are 100% visible on load without cropping
  const topHudClearance = hudClearance?.top ?? (isCompactHeight ? 56 : isMobile ? 84 : 108);
  const bottomConsoleClearance = hudClearance?.bottom ?? (isCompactHeight ? 64 : isMobile ? 100 : 128);
  const verticalSafetyMargin = topHudClearance + bottomConsoleClearance;

  const canvasWidth = hasMeasuredContainer ? containerWidth : fallbackCanvasWidth;
  const canvasHeight = hasMeasuredContainer
    ? Math.max(200, containerHeight)
    : height;

  const availableCanvasWidth = Math.max(280, canvasWidth);
  const availableCanvasHeight = Math.max(
    isCompactHeight ? 220 : 300,
    canvasHeight - verticalSafetyMargin
  );
  const margin = isMobile ? 8 : 12;

  const size = computeDefaultSize(
    availableCanvasWidth - margin,
    availableCanvasHeight - margin
  );

  // Optical center calibrated to Print 2:
  // Nudged slightly down (+22px on desktop, +8px on mobile) so the top harbor ships
  // sit comfortably below the prompt banner while the bottom harbor ships clear the console dock
  const verticalOffset = hudClearance ? 0 : isCompactHeight ? 4 : isMobile ? 8 : 22;
  const center: [number, number] = [
    canvasWidth / 2,
    topHudClearance + availableCanvasHeight / 2 + verticalOffset,
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
      !isRollingDice && lastRolledSum !== null &&
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
        pendingColor={pendingColor}
        pendingBuilding={pendingBuilding}
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
          pendingColor={pendingColor}
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
              <stop offset="0%" stopColor="#1c0d04" stopOpacity="0.58" />
              <stop offset="62%" stopColor="#291305" stopOpacity="0.44" />
              <stop offset="82%" stopColor="#451a03" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="catanSunCaustic" cx="50%" cy="45%" r="42%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.14" />
              <stop offset="70%" stopColor="#b45309" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="300" cy="300" r="292" fill="url(#catanReefShallow)" />
          <circle cx="300" cy="300" r="285" fill="url(#catanSunCaustic)" />

          {/* Subtle tabletop board frame rim on the wooden table */}
          <circle
            className="board__surf-ring board__surf-ring--inner"
            cx="300"
            cy="300"
            r="224"
            fill="none"
            stroke="rgba(254, 243, 199, 0.18)"
            strokeWidth="1.8"
            strokeDasharray="24 14 10 14"
          />
          <circle
            cx="300"
            cy="300"
            r="258"
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
