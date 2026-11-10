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
};

function Building({ building, color }: BuildingProps) {
  if (!color) return null;
  const type = building === "CITY" ? "city" : "settlement";
  const label = PLAYER_COLOR_META[color]?.label || color;
  const pieceName = building === "CITY" ? "Cidade (2 PV)" : "Aldeia (1 PV)";

  return (
    <div
      className={cn("building-piece", color, type)}
      title={`${pieceName} — ${label}`}
    >
      <svg
        width="44"
        height="44"
        viewBox="-22 -24 44 42"
        className="building-piece__svg"
      >
        {building === "CITY" ? (
          <CitySvgPiece color={color} scale={1.12} />
        ) : (
          <SettlementSvgPiece color={color} scale={1.12} />
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
      {color && <Building building={building} color={color} />}
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
