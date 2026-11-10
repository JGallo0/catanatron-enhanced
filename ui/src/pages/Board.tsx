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
  const numLevels = 6.2; // 3 land rings + outer port ring + margin
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
  // Exact available viewport after accounting for LeftDrawer (300px on desktop) and top/bottom HUD bars
  const leftSidebarWidth = isMobile ? 0 : 300;
  const canvasWidth = Math.max(320, width - leftSidebarWidth);
  const canvasHeight = Math.max(320, height - (isMobile ? 185 : 175));

  const center: [number, number] = [canvasWidth / 2, canvasHeight / 2];
  const size = computeDefaultSize(canvasWidth - 24, canvasHeight - 24);

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
    ({ color, direction, tile_coordinate, id }) => {
      const action =
        edgeActions?.[toEdgeId(id)] ??
        edgeActions?.[`${id[1]},${id[0]}` as EdgeId];
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
      {/* Ambient Caribbean Ocean Reef Glow behind Catan island */}
      <div
        className="board__island-glow"
        style={{
          left: center[0],
          top: center[1],
          width: size * 8.4,
          height: size * 8.4,
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
