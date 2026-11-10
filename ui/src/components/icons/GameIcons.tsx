import React, { useState } from "react";
import type { Color, ResourceCard } from "../../utils/api.types";
import {
  DEV_CARD_META,
  type DevCardType,
  PLAYER_COLOR_META,
  RESOURCE_META,
} from "../../config/assetRegistry";

/**
 * Renders a Nano Banana Pro custom illustration if present in /public/assets/illustrations/,
 * automatically falling back to built-in vector art until the file is added.
 */
export function HybridIllustration({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <>{fallback}</>;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

export function ResourceIcon({
  resource,
  size = 20,
  className = "",
}: {
  resource: ResourceCard;
  size?: number;
  className?: string;
}) {
  switch (resource) {
    case "WOOD":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Pine trees & timber log */}
          <path
            d="M11 4L4 15H8L3 23H19L14 15H18L11 4Z"
            fill="#22C55E"
            stroke="#052E16"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M21 7L15 17H18.5L14.5 24H28.5L24.5 17H28L21 7Z"
            fill="#15803D"
            stroke="#052E16"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect
            x="6"
            y="24"
            width="20"
            height="5"
            rx="2.5"
            fill="#92400E"
            stroke="#451A03"
            strokeWidth="1.5"
          />
          <circle cx="8.5" cy="26.5" r="1.5" fill="#FDE68A" />
        </svg>
      );
    case "BRICK":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Stacked clay bricks */}
          <rect
            x="3"
            y="18"
            width="12"
            height="7"
            rx="1.5"
            fill="#EA580C"
            stroke="#431407"
            strokeWidth="1.5"
          />
          <rect
            x="17"
            y="18"
            width="12"
            height="7"
            rx="1.5"
            fill="#C2410C"
            stroke="#431407"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="9"
            width="14"
            height="7"
            rx="1.5"
            fill="#FB923C"
            stroke="#431407"
            strokeWidth="1.5"
          />
          <path
            d="M11 11.5H20"
            stroke="#FFEDD5"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "SHEEP":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Fluffy wool cloud & head */}
          <path
            d="M9 22C6.2 22 4 19.8 4 17C4 14.8 5.4 13 7.4 12.3C8 9.3 10.7 7 14 7C16.8 7 19.2 8.7 20.2 11.1C20.8 10.9 21.4 10.8 22 10.8C25.3 10.8 28 13.5 28 16.8C28 19.9 25.6 22.4 22.6 22.7L9 22Z"
            fill="#F8FAFC"
            stroke="#1E293B"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <ellipse
            cx="23"
            cy="16.5"
            rx="3.5"
            ry="4"
            fill="#334155"
            stroke="#0F172A"
            strokeWidth="1.4"
          />
          <circle cx="24.2" cy="15.5" r="0.9" fill="#F8FAFC" />
          <path
            d="M10 22V26M14 22V26M19 22V26M22 22V26"
            stroke="#334155"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "WHEAT":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Golden grain sheaf */}
          <path
            d="M16 28V6"
            stroke="#CA8A04"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <ellipse
            cx="12.5"
            cy="10"
            rx="2.5"
            ry="4"
            transform="rotate(-25 12.5 10)"
            fill="#FACC15"
            stroke="#713F12"
            strokeWidth="1.3"
          />
          <ellipse
            cx="19.5"
            cy="10"
            rx="2.5"
            ry="4"
            transform="rotate(25 19.5 10)"
            fill="#FACC15"
            stroke="#713F12"
            strokeWidth="1.3"
          />
          <ellipse
            cx="12"
            cy="16"
            rx="2.5"
            ry="4"
            transform="rotate(-28 12 16)"
            fill="#EAB308"
            stroke="#713F12"
            strokeWidth="1.3"
          />
          <ellipse
            cx="20"
            cy="16"
            rx="2.5"
            ry="4"
            transform="rotate(28 20 16)"
            fill="#EAB308"
            stroke="#713F12"
            strokeWidth="1.3"
          />
          <ellipse
            cx="16"
            cy="6.5"
            rx="2.2"
            ry="3.5"
            fill="#FEF08A"
            stroke="#713F12"
            strokeWidth="1.3"
          />
        </svg>
      );
    case "ORE":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Faceted mountain crystal / iron ore rock */}
          <polygon
            points="16,4 27,11 24,25 8,25 5,11"
            fill="#64748B"
            stroke="#0F172A"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <polygon points="16,4 27,11 18,16 11,12" fill="#CBD5E1" />
          <polygon points="5,11 11,12 18,16 8,25" fill="#475569" />
          <polygon points="18,16 27,11 24,25 8,25" fill="#334155" />
          <path
            d="M16 4L11 12L18 16L24 25"
            stroke="#E2E8F0"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function DevCardIcon({
  card,
  size = 20,
  className = "",
}: {
  card: DevCardType;
  size?: number;
  className?: string;
}) {
  const meta = DEV_CARD_META[card];
  switch (card) {
    case "KNIGHT":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <path
            d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2Z"
            fill={meta.accentColor}
            fillOpacity="0.25"
            stroke={meta.accentColor}
            strokeWidth="1.8"
          />
          <path
            d="M14.5 7.5L9 13L7.5 11.5L6 13L9 16L16 9L14.5 7.5Z"
            fill="#FCA5A5"
          />
        </svg>
      );
    case "VICTORY_POINT":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <polygon
            points="12,2 15.1,8.3 22,9.3 17,14.1 18.2,21 12,17.8 5.8,21 7,14.1 2,9.3 8.9,8.3"
            fill="#FACC15"
            stroke="#CA8A04"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "ROAD_BUILDING":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <path
            d="M4 19L9 5M15 5L20 19M12 6V9M12 12V15M12 18V20"
            stroke={meta.accentColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "YEAR_OF_PLENTY":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <circle
            cx="9"
            cy="12"
            r="5"
            fill="#3B82F6"
            fillOpacity="0.3"
            stroke="#60A5FA"
            strokeWidth="1.8"
          />
          <circle
            cx="15"
            cy="12"
            r="5"
            fill="#FACC15"
            fillOpacity="0.3"
            stroke="#FDE047"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "MONOPOLY":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <path
            d="M3 17H21L19 8L15 12L12 5L9 12L5 8L3 17Z"
            fill="#A855F7"
            fillOpacity="0.35"
            stroke="#C084FC"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/**
 * 3D-styled Tabletop Settlement SVG piece rendered at (0,0) in board SVG space.
 */
export function SettlementSvgPiece({
  color,
  scale = 1,
}: {
  color: Color;
  scale?: number;
}) {
  const palette = PLAYER_COLOR_META[color];
  return (
    <g transform={`scale(${scale})`}>
      {/* Drop shadow */}
      <ellipse cx="0" cy="10" rx="13" ry="5" fill="rgba(0,0,0,0.45)" />
      {/* Base house body */}
      <path
        d="M-10 0 L0 -12 L10 0 L10 9 L-10 9 Z"
        fill={palette.primary}
        stroke={palette.dark}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Roof highlight */}
      <path
        d="M-12 1 L0 -13 L12 1"
        fill="none"
        stroke={palette.secondary}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Doorway */}
      <rect
        x="-2.5"
        y="2"
        width="5"
        height="7"
        rx="1.5"
        fill={palette.dark}
      />
    </g>
  );
}

/**
 * 3D-styled Tabletop City (Citadel with Tower) SVG piece rendered at (0,0).
 */
export function CitySvgPiece({
  color,
  scale = 1,
}: {
  color: Color;
  scale?: number;
}) {
  const palette = PLAYER_COLOR_META[color];
  return (
    <g transform={`scale(${scale})`}>
      {/* Drop shadow */}
      <ellipse cx="0" cy="12" rx="17" ry="6" fill="rgba(0,0,0,0.55)" />
      {/* Main Citadel + High Tower */}
      <path
        d="M-14 10 L-14 -2 L-8 -9 L-2 -2 L-2 -11 L5 -18 L12 -11 L12 0 L15 0 L15 10 Z"
        fill={palette.primary}
        stroke={palette.dark}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Golden roof trim / 2 VP star */}
      <path
        d="M-15 -1 L-8 -9 L-1 -1 M-3 -10 L5 -19 L13 -10"
        fill="none"
        stroke="#FACC15"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Windows */}
      <rect x="3" y="-8" width="4" height="5" rx="1" fill="#FEF08A" />
      <rect x="-10" y="1" width="4" height="5" rx="1" fill="#FEF08A" />
      <rect x="4" y="2" width="5" height="8" rx="1" fill={palette.dark} />
    </g>
  );
}

export function DiceFaceSvg({
  value,
  size = 38,
  isHot = false,
}: {
  value: number;
  size?: number;
  isHot?: boolean;
}) {
  const pipCoords: Record<number, [number, number][]> = {
    1: [[16, 16]],
    2: [
      [9, 9],
      [23, 23],
    ],
    3: [
      [8, 8],
      [16, 16],
      [24, 24],
    ],
    4: [
      [9, 9],
      [23, 9],
      [9, 23],
      [23, 23],
    ],
    5: [
      [9, 9],
      [23, 9],
      [16, 16],
      [9, 23],
      [23, 23],
    ],
    6: [
      [9, 8],
      [23, 8],
      [9, 16],
      [23, 16],
      [9, 24],
      [23, 24],
    ],
  };
  const pips = pipCoords[value] || pipCoords[1];

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label={`Dado ${value}`}>
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="6"
        fill={isHot ? "#FEF2F2" : "#FAF3E0"}
        stroke={isHot ? "#E11D48" : "#D97706"}
        strokeWidth="2"
      />
      <rect
        x="4"
        y="4"
        width="24"
        height="24"
        rx="4"
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1"
      />
      {pips.map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r="2.6"
          fill={value === 6 || isHot ? "#E11D48" : "#1E293B"}
        />
      ))}
    </svg>
  );
}

export function ResourceBadgePill({
  resource,
  count,
  size = "sm",
}: {
  resource: ResourceCard;
  count?: number;
  size?: "xs" | "sm" | "md";
}) {
  const meta = RESOURCE_META[resource];
  return (
    <span
      className={`inline-resource-pill inline-resource-pill--${size}`}
      style={{
        background: `${meta.primaryColor}CC`,
        borderColor: meta.borderColor,
        color: meta.textColor,
      }}
      title={meta.label}
    >
      <ResourceIcon resource={resource} size={size === "xs" ? 13 : 16} />
      {count !== undefined && <strong>{count}</strong>}
      <span>{meta.label}</span>
    </span>
  );
}
