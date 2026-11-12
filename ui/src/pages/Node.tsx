import React from "react";
import cn from "classnames";

import {
  tilePixelVector,
  getNodeDelta,
  SQRT3,
  type CubeCoordinate,
} from "../utils/coordinates";
import type {
  Building as BuildingType,
  Color,
  Direction,
} from "../utils/api.types";
import {
  CitySvgPiece,
  SettlementSvgPiece,
} from "../components/icons/GameIcons";
import { PLAYER_COLOR_META } from "../config/assetRegistry";

type BuildingProps<T = Color | null> = {
  color: T;
  building: T extends Color ? BuildingType : null;
  size: number;
};

function Building({ building, color, size }: BuildingProps) {
  if (!color) return null;
  const type = building === "CITY" ? "city" : "settlement";
  const label = PLAYER_COLOR_META[color]?.label || color;
  const pieceName = building === "CITY" ? "Cidade (2 PV)" : "Aldeia (1 PV)";
  const svgSize =
    building === "CITY"
      ? Math.max(38, Math.min(54, Math.round(size * 0.72)))
      : Math.max(34, Math.min(48, Math.round(size * 0.64)));

  return (
    <div
      className={cn("building-piece", color, type)}
      title={`${pieceName} — ${label}`}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="-24 -30 48 52"
        className="building-piece__svg"
      >
        {building === "CITY" ? (
          <CitySvgPiece color={color} scale={1.06} />
        ) : (
          <SettlementSvgPiece color={color} scale={1.08} />
        )}
      </svg>
    </div>
  );
}

type NodeProps = {
  center: [number, number];
  size: number;
  coordinate: CubeCoordinate;
  direction: Direction;
  building: BuildingType | null;
  color: Color | null;
  flashing: boolean;
  isRecent?: boolean;
  isPending?: boolean;
  onClick: React.MouseEventHandler<HTMLDivElement>;
};

export default function Node({
  center,
  size,
  coordinate,
  direction,
  building,
  color,
  flashing,
  isRecent,
  isPending,
  onClick,
}: NodeProps) {
  const [centerX, centerY] = center;
  const w = SQRT3 * size;
  const h = 2 * size;
  const [tileX, tileY] = tilePixelVector(coordinate, size, centerX, centerY);
  const [deltaX, deltaY] = getNodeDelta(direction, w, h);
  const x = tileX + deltaX;
  const y = tileY + deltaY;
  const nodeDiameter = Math.max(30, Math.min(46, Math.round(size * 0.52)));

  return (
    <div
      className={cn("node", {
        "node--occupied": !!color,
        "node--buildable": flashing,
        "node--recent": !!isRecent,
        "node--pending": !!isPending,
      })}
      style={{
        width: nodeDiameter,
        height: nodeDiameter,
        left: x,
        top: y,
        transform: "translateY(-50%) translateX(-50%)",
      }}
      onClick={(e) => {
        if (flashing) {
          e.stopPropagation();
        }
        onClick(e);
      }}
    >
      {color && <Building building={building} color={color} size={size} />}
      {flashing && (
        <div
          className="pulse"
          title={
            color ? "Melhorar para Cidade aqui" : "Construir Aldeia aqui"
          }
        />
      )}
    </div>
  );
}
