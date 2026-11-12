import React from "react";
import cn from "classnames";

import type { Color, Direction } from "../utils/api.types";
import {
  tilePixelVector,
  getEdgeTransform,
  type CubeCoordinate,
} from "../utils/coordinates";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { RoadSvgPiece } from "../components/icons/GameIcons";

function Road({ color }: { color: Color }) {
  const palette = PLAYER_COLOR_META[color];
  return (
    <div
      className={cn("road road-piece", color)}
      title={`Estrada — ${palette.label}`}
      style={{
        filter: `drop-shadow(0 3px 5px rgba(0, 0, 0, 0.72)) drop-shadow(0 0 6px ${palette.glow})`,
      }}
    >
      <RoadSvgPiece color={color} className="road-piece__svg" />
    </div>
  );
}

export type EdgeId = `${number},${number}`;

export const toEdgeId = (id: [number, number]): EdgeId => `${id[0]},${id[1]}`;

type EdgeProps = {
  id: `${number},${number}`;
  center: [number, number];
  coordinate: CubeCoordinate;
  size: number;
  direction: Direction;
  color: Color | null;
  flashing: boolean;
  isRecent?: boolean;
  isPending?: boolean;
  onClick: React.MouseEventHandler;
};

export default function Edge({
  id,
  center,
  size,
  coordinate,
  direction,
  color,
  flashing,
  isRecent,
  isPending,
  onClick,
}: EdgeProps) {
  const [centerX, centerY] = center;
  const [tileX, tileY] = tilePixelVector(coordinate, size, centerX, centerY);
  const transform = getEdgeTransform(direction, size);

  return (
    <div
      id={id}
      className={cn("edge", direction, {
        "edge--occupied": !!color,
        "edge--buildable": flashing,
        "edge--recent": !!isRecent,
        "edge--pending": !!isPending,
      })}
      style={{
        left: tileX,
        top: tileY,
        width: size * 0.84,
        transform: transform,
      }}
      onClick={(e) => {
        if (flashing) {
          e.stopPropagation();
        }
        onClick(e);
      }}
    >
      {color && <Road color={color} />}
      {flashing && <div className="pulse" title="Construir Estrada aqui" />}
    </div>
  );
}
