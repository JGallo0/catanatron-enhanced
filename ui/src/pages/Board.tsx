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
 * Computes optimal hex size based on viewport dimensions.
 * Uses the formulas: W = SQRT3 * size and H = 2 * size.
 */
function computeDefaultSize(divWidth: number, divHeight: number): number {
  const numLevels = 6; // 3 rings + outer water ring
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
    // Stop if we crossed back into a previous turn's END_TURN
    if (action[1] === "END_TURN") {
      break;
    }
  }
  return null;
}

type BoardProps = {
  width: number;
  height: number;
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
};

export default function Board({
  width,
  height,
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
}: BoardProps) {
  // Full-bleed Steam Catan style table with comfortable HUD margins
  const hudVerticalPadding = isMobile ? 165 : 145;
  const hudHorizontalPadding = isMobile ? 16 : 320;
  const containerHeight = Math.max(320, height - hudVerticalPadding);
  const containerWidth = Math.max(320, width - hudHorizontalPadding);
  const center: [number, number] = [width / 2, (height - 64) / 2];
  const size = computeDefaultSize(containerWidth, containerHeight);

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
        onClick={buildOnNodeClick(
          id,
          nodeActions ? nodeActions[id] : undefined
        )}
      />
    )
  );

  const edges = Object.values(gameState.edges).map(
    ({ color, direction, tile_coordinate, id }) => (
      <Edge
        id={`${id[0]},${id[1]}`}
        key={`${id}`}
        center={center}
        size={size}
        coordinate={tile_coordinate}
        direction={direction}
        color={color}
        flashing={!!edgeActions && toEdgeId(id) in edgeActions}
        onClick={buildOnEdgeClick(
          id,
          edgeActions ? edgeActions[toEdgeId(id)] : undefined
        )}
      />
    )
  );

  return (
    <div className={classnames("board", { show })}>
      {/* Ambient Ocean Glow behind island */}
      <div
        className="board__island-glow"
        style={{
          left: center[0],
          top: center[1],
          width: size * 9.5,
          height: size * 9.5,
        }}
      />
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
