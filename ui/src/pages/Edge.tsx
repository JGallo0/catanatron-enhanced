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
import { usePieceSkin } from "../utils/pieceSkin";

function Road({ color, isGhost = false }: { color: Color; isGhost?: boolean }) {
  const { skin } = usePieceSkin();
  const palette = PLAYER_COLOR_META[color];
  return (
    <div
      className={cn("road road-piece", color, {
        "road-piece--ghost": isGhost,
      })}
      title={isGhost ? `Confirmar Estrada — ${palette.label}` : `Estrada — ${palette.label}`}
      style={{
        filter: isGhost
          ? `drop-shadow(0 0 10px #facc15) drop-shadow(0 0 16px ${palette.glow})`
          : `drop-shadow(0 4px 6px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 8px ${palette.glow})`,
      }}
    >
      <RoadSvgPiece color={color} className="road-piece__svg" skin={skin} />
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
  pendingColor?: Color | null;
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
  pendingColor = null,
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
      {(color || (isPending && pendingColor)) && (
        <Road
          color={color || (pendingColor as Color)}
          isGhost={!color && !!isPending}
        />
      )}
      {flashing && !isPending && <div className="pulse" title="Construir Estrada aqui" />}
    </div>
  );
}
