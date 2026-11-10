import React from "react";
import cn from "classnames";

import {
  tilePixelVector,
  getNodeDelta,
  SQRT3,
  type CubeCoordinate,
} from "../utils/coordinates";
import type { Building as BuildingType, Color, Direction } from "../utils/api.types";
import {
  CitySvgPiece,
  SettlementSvgPiece,
} from "../components/icons/GameIcons";

type BuildingProps<T = Color | null> = {
  color: T;
  building: T extends Color ? BuildingType : null;
};

function Building({ building, color }: BuildingProps) {
  if (!color) return null;
  const type = building === "CITY" ? "city" : "settlement";
  return (
    <div className={cn("building-piece", color, type)} title={`${color} ${building}`}>
      <svg
        width="38"
        height="38"
        viewBox="-20 -24 40 40"
        className="building-piece__svg"
      >
        {building === "CITY" ? (
          <CitySvgPiece color={color} scale={1.05} />
        ) : (
          <SettlementSvgPiece color={color} scale={1.05} />
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
  const nodeDiameter = Math.max(26, Math.min(46, Math.round(size * 0.52)));

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
      onClick={onClick}
    >
      {color && <Building building={building} color={color} />}
      {flashing && <div className="pulse" title="Construir aqui" />}
    </div>
  );
}
