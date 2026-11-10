import React, { useState } from "react";
import cn from "classnames";

import "./Tile.scss";
import { SQRT3, tilePixelVector } from "../utils/coordinates";
import {
  type Direction,
  type ResourceCard,
  type Tile as TileData,
} from "../utils/api.types";
import {
  DESERT_META,
  RESOURCE_META,
} from "../config/assetRegistry";
import { ResourceIcon } from "../components/icons/GameIcons";

type NumberTokenProps = {
  number: number;
  className?: string;
  style?: Partial<React.CSSProperties>;
  flashing?: boolean;
  isProducing?: boolean;
  hasRobber?: boolean;
  size?: number;
};

export const numberToPips = (number: number) => {
  switch (number) {
    case 2:
    case 12:
      return "•";
    case 3:
    case 11:
      return "••";
    case 4:
    case 10:
      return "•••";
    case 5:
    case 9:
      return "••••";
    case 6:
    case 8:
      return "•••••";
    default:
      return "";
  }
};

export function NumberToken({
  number,
  className,
  style,
  flashing,
  isProducing,
  hasRobber,
  size = 72,
}: NumberTokenProps) {
  const isHot = number === 6 || number === 8;
  const tokenDiameter = Math.max(32, Math.min(54, Math.round(size * 0.66)));

  return (
    <div
      className={cn("number-token", className, {
        flashing: flashing,
        "number-token-red": isHot,
        "number-token--producing": isProducing && !hasRobber,
        "number-token--robbed": hasRobber,
      })}
      style={{
        width: tokenDiameter,
        height: tokenDiameter,
        ...style,
      }}
    >
      <div className="number-token__value">{number}</div>
      <div className="pips">{numberToPips(number)}</div>
    </div>
  );
}

const calculatePortOffset = (
  direction: Direction,
  size: number
): { x: number; y: number; angle: number } => {
  const dist = size * 0.34;
  switch (direction) {
    case "NORTH":
      return { x: 0, y: -dist, angle: 0 };
    case "SOUTH":
      return { x: 0, y: dist, angle: 180 };
    case "NORTHEAST":
      return { x: dist * 0.86, y: -dist * 0.5, angle: 60 };
    case "SOUTHEAST":
      return { x: dist * 0.86, y: dist * 0.5, angle: 120 };
    case "SOUTHWEST":
      return { x: -dist * 0.86, y: dist * 0.5, angle: 240 };
    case "NORTHWEST":
      return { x: -dist * 0.86, y: -dist * 0.5, angle: 300 };
    case "EAST":
      return { x: dist, y: 0, angle: 90 };
    case "WEST":
      return { x: -dist, y: 0, angle: 270 };
    default:
      return { x: 0, y: 0, angle: 0 };
  }
};

const Port = ({
  resource,
  direction,
  size,
}: {
  resource: ResourceCard | null;
  direction: Direction;
  size: number;
}) => {
  const ratio = resource ? "2:1" : "3:1";
  const offset = calculatePortOffset(direction, size);
  const meta = resource ? RESOURCE_META[resource] : null;
  const badgeSize = Math.max(38, Math.min(58, Math.round(size * 0.72)));

  return (
    <div
      className={cn("port", {
        "port--specialized": !!resource,
        "port--generic": !resource,
      })}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        width: badgeSize,
        height: badgeSize,
        borderColor: meta ? meta.borderColor : "#FCD34D",
      }}
      title={
        meta
          ? `Porto Especializado ${ratio} (${meta.label})`
          : "Porto Marítimo Geral 3:1 (Qualquer Recurso)"
      }
    >
      {/* Pier direction indicator */}
      <div
        className="port__pier-indicator"
        style={{
          transform: `rotate(${offset.angle}deg)`,
        }}
      />
      <div className="port__icon">
        {resource ? (
          <ResourceIcon resource={resource} size={Math.round(badgeSize * 0.42)} />
        ) : (
          <span className="port__anchor" aria-hidden="true">
            ⚓
          </span>
        )}
      </div>
      <div className="port__ratio">{ratio}</div>
    </div>
  );
};

type TileProps = {
  center: [number, number];
  coordinate: [number, number, number];
  tile: TileData;
  size: number;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  flashing: boolean;
  isProducing?: boolean;
  hasRobber?: boolean;
};

export default function Tile({
  center,
  coordinate,
  tile,
  size,
  onClick,
  flashing,
  isProducing = false,
  hasRobber = false,
}: TileProps) {
  const [customImgLoaded, setCustomImgLoaded] = useState(false);
  const [customImgError, setCustomImgError] = useState(false);

  const w = SQRT3 * size;
  const h = 2 * size;
  const [centerX, centerY] = center;
  const [x, y] = tilePixelVector(coordinate, size, centerX, centerY);

  const isLand = tile.type === "RESOURCE_TILE" || tile.type === "DESERT";
  const resourceMeta =
    tile.type === "RESOURCE_TILE" ? RESOURCE_META[tile.resource] : null;

  const legacySvgUrl =
    tile.type === "RESOURCE_TILE"
      ? resourceMeta?.legacyTileSvg
      : tile.type === "DESERT"
        ? DESERT_META.legacyTileSvg
        : undefined;

  const customIllustrationUrl =
    tile.type === "RESOURCE_TILE"
      ? resourceMeta?.customTileIllustration
      : tile.type === "DESERT"
        ? DESERT_META.customTileIllustration
        : undefined;

  return (
    <div
      className={cn("tile", `tile--${tile.type.toLowerCase()}`, {
        [`tile--resource-${tile.type === "RESOURCE_TILE" ? tile.resource.toLowerCase() : ""}`]:
          tile.type === "RESOURCE_TILE",
        "tile--flashing": flashing,
        "tile--producing": isProducing && !hasRobber,
        "tile--clickable": !!onClick && flashing,
      })}
      style={{
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
      }}
      onClick={onClick}
    >
      {isLand && (
        <div className="tile__hex-surface">
          {/* Base SVG terrain artwork */}
          <div
            className="tile__artwork"
            style={{
              backgroundImage: legacySvgUrl ? `url("${legacySvgUrl}")` : undefined,
            }}
          />

          {/* Optional Nano Banana Pro high-res illustration overlay */}
          {customIllustrationUrl && !customImgError && (
            <img
              src={customIllustrationUrl}
              alt=""
              className={cn("tile__custom-illustration", {
                "tile__custom-illustration--loaded": customImgLoaded,
              })}
              onLoad={() => setCustomImgLoaded(true)}
              onError={() => setCustomImgError(true)}
              draggable={false}
            />
          )}

          {/* SVG Bevel & Coastal Frame Overlay */}
          <svg
            className="tile__frame-svg"
            viewBox="0 0 100 115.47"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              className="tile__bevel-outer"
              points="50,1.5 98.5,29.5 98.5,85.97 50,113.97 1.5,85.97 1.5,29.5"
            />
            <polygon
              className="tile__bevel-inner"
              points="50,5 95,31 95,84.47 50,110.47 5,84.47 5,31"
            />
          </svg>

          {/* Resource subtle badge in top corner of hex */}
          {tile.type === "RESOURCE_TILE" && (
            <div
              className="tile__terrain-watermark"
              title={`${resourceMeta?.terrainName} (${resourceMeta?.label})`}
            >
              <ResourceIcon
                resource={tile.resource}
                size={Math.max(14, Math.round(size * 0.22))}
              />
            </div>
          )}
        </div>
      )}

      {tile.type === "RESOURCE_TILE" && (
        <NumberToken
          number={tile.number}
          flashing={flashing}
          isProducing={isProducing}
          hasRobber={hasRobber}
          size={size}
        />
      )}

      {tile.type === "PORT" && (
        <Port
          resource={tile.resource}
          direction={tile.direction}
          size={size}
        />
      )}

      {flashing && (
        <div className="tile__robber-target-ring" title="Mover Ladrão para cá" />
      )}
    </div>
  );
}
