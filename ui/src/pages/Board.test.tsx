import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { makeGameState } from "../test/fixtures";
import Board from "./Board";

test("renders the nested tile, node, and edge shapes emitted by GameEncoder", () => {
  const gameState = makeGameState();

  const { container } = render(
    <Board
      width={1200}
      height={900}
      buildOnNodeClick={() => () => undefined}
      buildOnEdgeClick={() => () => undefined}
      handleTileClick={() => undefined}
      replayMode={false}
      gameState={gameState}
      isMobile={false}
      show
      isMovingRobber={false}
    />
  );

  expect(container.querySelectorAll(".tile")).toHaveLength(3);
  expect(container.querySelector(".board__seascape-underlay")).toBeInTheDocument();
  expect(container.querySelector(".port-scene")).toBeInTheDocument();
  expect(container.querySelectorAll(".node")).toHaveLength(1);
  expect(container.querySelectorAll(".edge")).toHaveLength(1);
  expect(container.querySelectorAll(".robber")).toHaveLength(1);
  expect(screen.getByText("11")).toBeInTheDocument();
  expect(screen.getByText("3:1")).toBeInTheDocument();
});

test("fits narrow portrait and landscape mobile viewports without overflowing horizontally", () => {
  const gameState = makeGameState();

  const portrait = render(
    <Board
      width={375}
      height={667}
      buildOnNodeClick={() => () => undefined}
      buildOnEdgeClick={() => () => undefined}
      handleTileClick={() => undefined}
      replayMode={false}
      gameState={gameState}
      isMobile={true}
      show
      isMovingRobber={false}
    />
  );

  const portraitBoard = portrait.container.querySelector(".board") as HTMLElement;
  expect(portraitBoard).toBeTruthy();
  expect(parseInt(portraitBoard.style.width, 10)).toBeLessThanOrEqual(375);
  expect(parseInt(portraitBoard.style.height, 10)).toBeGreaterThanOrEqual(280);
  portrait.unmount();

  const landscape = render(
    <Board
      width={667}
      height={375}
      buildOnNodeClick={() => () => undefined}
      buildOnEdgeClick={() => () => undefined}
      handleTileClick={() => undefined}
      replayMode={false}
      gameState={gameState}
      isMobile={true}
      show
      isMovingRobber={false}
    />
  );

  const landscapeBoard = landscape.container.querySelector(".board") as HTMLElement;
  expect(landscapeBoard).toBeTruthy();
  expect(parseInt(landscapeBoard.style.width, 10)).toBeLessThanOrEqual(667);
  expect(parseInt(landscapeBoard.style.height, 10)).toBeLessThanOrEqual(240);
});

test("uses explicit measured ResizeObserver containerWidth and containerHeight when provided", () => {
  const gameState = makeGameState();

  const { container } = render(
    <Board
      width={769}
      height={769}
      containerWidth={769}
      containerHeight={428}
      buildOnNodeClick={() => () => undefined}
      buildOnEdgeClick={() => () => undefined}
      handleTileClick={() => undefined}
      replayMode={false}
      gameState={gameState}
      isMobile={false}
      show
      isMovingRobber={false}
    />
  );

  const board = container.querySelector(".board") as HTMLElement;
  expect(board).toBeTruthy();
  expect(parseInt(board.style.width, 10)).toBe(769);
  expect(parseInt(board.style.height, 10)).toBe(428);
});

test("highlights recently placed node and normalized edge with .node--recent and .edge--recent", () => {
  const gameState = makeGameState({
    edges: [
      {
        id: [1, 0],
        color: "RED",
        direction: "WEST",
        tile_coordinate: [0, 0, 0],
      },
    ],
  });

  const { container } = render(
    <Board
      width={1200}
      height={900}
      buildOnNodeClick={() => () => undefined}
      buildOnEdgeClick={() => () => undefined}
      handleTileClick={() => undefined}
      replayMode={false}
      gameState={gameState}
      isMobile={false}
      show
      isMovingRobber={false}
      recentNodeId={0}
      recentEdgeId="0,1"
    />
  );

  expect(container.querySelectorAll(".node--recent")).toHaveLength(1);
  expect(container.querySelectorAll(".edge--recent")).toHaveLength(1);
});
