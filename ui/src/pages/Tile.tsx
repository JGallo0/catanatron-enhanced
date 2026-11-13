import React, { useState, useEffect } from "react";
import cn from "classnames";

import "./Tile.scss";
import { SQRT3, tilePixelVector } from "../utils/coordinates";
import {
  type Direction,
  type ResourceCard,
  type Tile as TileData,
} from "../utils/api.types";
import { getDesertMeta, getResourceMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import { useBoardSkin, getTileIllustrationUrl } from "../utils/boardSkin";
import {
  HarborPortSvg,
  ResourceIcon,
  TerrainHexIllustration,
} from "../components/icons/GameIcons";

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
  const tokenDiameter = Math.max(30, Math.min(50, Math.round(size * 0.6)));

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
  const dist = size * 0.28;
  const angleByDir: Record<Direction, number> = {
    NORTH: 0,
    NORTHEAST: 30,
    EAST: 90,
    SOUTHEAST: 150,
    SOUTH: 180,
    SOUTHWEST: 210,
    WEST: 270,
    NORTHWEST: 330,
  };
  const angle = angleByDir[direction] ?? 0;
  const rad = (angle * Math.PI) / 180;
  return {
    x: dist * Math.sin(rad),
    y: -dist * Math.cos(rad),
    angle,
  };
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
  const { language, t } = useLanguage();
  const ratio = resource ? "2:1" : "3:1";
  const offset = calculatePortOffset(direction, size);
  const meta = resource ? getResourceMeta(language)[resource] : null;
  const harborWidth = Math.max(54, Math.min(82, Math.round(size * 0.96)));
  const harborHeight = Math.round(harborWidth * 0.78);
  const bridgeLen = Math.max(20, Math.round(size * 0.44));

  return (
    <div
      className={cn("port port-scene", {
        "port--specialized": !!resource,
        "port--generic": !resource,
      })}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
      title={
        meta
          ? t(`Porto ${ratio} (${meta.label})`, `${ratio} Port (${meta.label})`)
          : t("Porto 3:1 (Qualquer recurso)", "3:1 Port (Any resource)")
      }
    >
      {/* Twin timber piers pointing perpendicularly to the coastal land edge */}
      <div
        className="port-scene__gangway-wrap"
        style={{
          transform: `translate(-50%, -50%) rotate(${offset.angle}deg)`,
        }}
        aria-hidden="true"
      >
        <div
          className="port-scene__gangway"
          style={{ height: bridgeLen }}
        />
      </div>

      {/* Illustrated Harbor Wharf + Moored Merchant Ship */}
      <div
        className="port-scene__artwork"
        style={{ width: harborWidth, height: harborHeight }}
      >
        <HarborPortSvg
          resource={resource}
          width={harborWidth}
          height={harborHeight}
        />
      </div>

      {/* Hanging Weathered Parchment Harbor Trade Sign */}
      <div
        className="port-scene__placard"
        style={{
          borderColor: meta ? meta.borderColor : "#f59e0b",
        }}
      >
        <span className="port-scene__icon">
          {resource ? (
            <ResourceIcon
              resource={resource}
              size={Math.max(12, Math.round(size * 0.21))}
            />
          ) : (
            <span className="port-scene__anchor" aria-hidden="true">
              ⚓
            </span>
          )}
        </span>
        <span className="port-scene__ratio">{ratio}</span>
      </div>
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
  const { language, t } = useLanguage();
  const { skin } = useBoardSkin();
  const [customImgLoaded, setCustomImgLoaded] = useState(false);
  const [extIndex, setExtIndex] = useState(0);

  useEffect(() => {
    setExtIndex(0);
    setCustomImgLoaded(false);
  }, [skin]);

  const w = SQRT3 * size;
  const h = 2 * size;
  const [centerX, centerY] = center;
  const [x, y] = tilePixelVector(coordinate, size, centerX, centerY);

  const isLand = tile.type === "RESOURCE_TILE" || tile.type === "DESERT";
  const resourceMetaMap = getResourceMeta(language);
  const desertMeta = getDesertMeta(language);
  const resourceMeta =
    tile.type === "RESOURCE_TILE" ? resourceMetaMap[tile.resource] : null;

  const terrainKey =
    tile.type === "RESOURCE_TILE"
      ? tile.resource
      : tile.type === "DESERT"
        ? "DESERT"
        : null;

  const themedIllustrationUrl = terrainKey
    ? getTileIllustrationUrl(terrainKey, skin)
    : undefined;

  const defaultIllustrationUrl =
    tile.type === "RESOURCE_TILE"
      ? resourceMeta?.customTileIllustration
      : tile.type === "DESERT"
        ? desertMeta.customTileIllustration
        : undefined;

  const candidateUrls = themedIllustrationUrl
    ? [
        themedIllustrationUrl,
        defaultIllustrationUrl,
        themedIllustrationUrl.replace(/\.webp$/i, ".png"),
        themedIllustrationUrl.replace(/\.webp$/i, ".jpg"),
      ].filter((v, idx, arr): v is string => Boolean(v) && arr.indexOf(v) === idx)
    : [];
  const activeCustomUrl =
    extIndex < candidateUrls.length ? candidateUrls[extIndex] : undefined;

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
      {!isLand && (
        <div className="tile__sea-surface" aria-hidden="true">
          <div className="tile__sea-artwork">
            <TerrainHexIllustration terrain="WATER" />
          </div>
          <svg
            className="tile__frame-svg"
            viewBox="0 0 100 115.47"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              className="tile__sea-bevel"
              points="50,1.2 98.8,29.2 98.8,86.2 50,114.2 1.2,86.2 1.2,29.2"
            />
          </svg>
        </div>
      )}

      {isLand && (
        <div className="tile__hex-surface">
          {/* Rich Catan Universe style vector landscape */}
          <div className="tile__artwork">
            <TerrainHexIllustration
              terrain={tile.type === "RESOURCE_TILE" ? tile.resource : "DESERT"}
            />
          </div>

          {/* Optional Nano Banana Pro high-res illustration overlay */}
          {activeCustomUrl && (
            <img
              src={activeCustomUrl}
              alt=""
              className={cn("tile__custom-illustration", {
                "tile__custom-illustration--loaded": customImgLoaded,
              })}
              onLoad={() => setCustomImgLoaded(true)}
              onError={() => {
                setCustomImgLoaded(false);
                setExtIndex((prev) => prev + 1);
              }}
              draggable={false}
            />
          )}

          {/* Sandy Beach Shoreline & Inner Frame Overlay */}
          <svg
            className="tile__frame-svg"
            viewBox="0 0 100 115.47"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              className="tile__bevel-outer"
              points="50,1.2 98.8,29.2 98.8,86.2 50,114.2 1.2,86.2 1.2,29.2"
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
                size={Math.max(13, Math.round(size * 0.2))}
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
        <div
          className="tile__robber-target-ring"
          title={t("Mover Ladrão para cá", "Move Robber here")}
        />
      )}
    </div>
  );
}
