import React, { useState } from "react";
import type {
  Color,
  DevelopmentCard,
  ResourceCard,
  VictoryPointCard,
} from "../../utils/api.types";
import { PLAYER_COLOR_META } from "../../config/assetRegistry";

/**
 * Rich Catan Universe (Steam) style SVG terrain landscapes for hex tiles.
 * Replaces the old black circuit-board SVGs with painted-style vector dioramas.
 */
export const TerrainHexIllustration: React.FC<{
  terrain: ResourceCard | "DESERT" | "WATER";
}> = ({ terrain }) => {
  switch (terrain) {
    case "WOOD":
      return (
        <svg
          viewBox="0 0 200 230"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="woodSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e4d2b" />
              <stop offset="55%" stopColor="#15803d" />
              <stop offset="100%" stopColor="#0f3923" />
            </linearGradient>
            <radialGradient id="woodSun" cx="50%" cy="25%" r="55%">
              <stop offset="0%" stopColor="#86efac" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="230" fill="url(#woodSky)" />
          <rect width="200" height="230" fill="url(#woodSun)" />
          {/* Distant forest hills */}
          <path
            d="M0 135 Q50 105 105 130 T200 125 L200 230 L0 230 Z"
            fill="#14532d"
          />
          <path
            d="M0 165 Q65 140 135 162 T200 155 L200 230 L0 230 Z"
            fill="#064e3b"
          />
          {/* Pine trees cluster */}
          {[
            { x: 48, y: 78, s: 0.9 },
            { x: 148, y: 82, s: 0.9 },
            { x: 75, y: 60, s: 1.05 },
            { x: 122, y: 64, s: 1.0 },
            { x: 35, y: 128, s: 0.95 },
            { x: 162, y: 132, s: 0.95 },
            { x: 100, y: 148, s: 1.1 },
          ].map((t, idx) => (
            <g
              key={idx}
              transform={`translate(${t.x}, ${t.y}) scale(${t.s})`}
            >
              <rect x="-4" y="20" width="8" height="14" rx="2" fill="#78350f" />
              <polygon
                points="0,-24 -22,6 22,6"
                fill="#22c55e"
                stroke="#052e16"
                strokeWidth="1.5"
              />
              <polygon
                points="0,-12 -26,16 26,16"
                fill="#16a34a"
                stroke="#052e16"
                strokeWidth="1.5"
              />
              <polygon
                points="0,0 -30,24 30,24"
                fill="#15803d"
                stroke="#052e16"
                strokeWidth="1.5"
              />
              <polygon points="0,-24 -10,6 0,6" fill="#86efac" opacity="0.35" />
            </g>
          ))}
        </svg>
      );

    case "BRICK":
      return (
        <svg
          viewBox="0 0 200 230"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="brickBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9a3412" />
              <stop offset="55%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
          </defs>
          <rect width="200" height="230" fill="url(#brickBg)" />
          {/* Terracotta mesas and clay quarry layers */}
          <path
            d="M15 95 L55 52 L98 52 L130 92 L185 68 L200 95 L200 230 L0 230 Z"
            fill="#b45309"
            opacity="0.65"
          />
          <path
            d="M0 120 L42 82 L88 84 L125 118 L152 92 L200 122 L200 230 L0 230 Z"
            fill="#9a3412"
          />
          {/* Stratum lines */}
          <path
            d="M28 96 L84 96 M135 106 L185 106 M18 145 L182 145 M30 175 L170 175"
            stroke="#fed7aa"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.35"
          />
          {/* Clay bricks stack */}
          <g transform="translate(100, 172)">
            <rect
              x="-34"
              y="0"
              width="30"
              height="14"
              rx="3"
              fill="#ef4444"
              stroke="#450a0a"
              strokeWidth="1.8"
            />
            <rect
              x="4"
              y="0"
              width="30"
              height="14"
              rx="3"
              fill="#dc2626"
              stroke="#450a0a"
              strokeWidth="1.8"
            />
            <rect
              x="-16"
              y="-13"
              width="32"
              height="14"
              rx="3"
              fill="#f87171"
              stroke="#450a0a"
              strokeWidth="1.8"
            />
          </g>
        </svg>
      );

    case "SHEEP":
      return (
        <svg
          viewBox="0 0 200 230"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sheepBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#65a30d" />
              <stop offset="55%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#3f6212" />
            </linearGradient>
          </defs>
          <rect width="200" height="230" fill="url(#sheepBg)" />
          {/* Rolling sunlit meadow hills */}
          <path
            d="M0 100 Q60 65 130 98 T200 90 L200 230 L0 230 Z"
            fill="#65a30d"
          />
          <path
            d="M0 142 Q80 112 155 142 T200 135 L200 230 L0 230 Z"
            fill="#4d7c0f"
          />
          {/* Fluffy grazing sheep */}
          {[
            { x: 52, y: 74, s: 0.95 },
            { x: 145, y: 78, s: 0.9 },
            { x: 64, y: 166, s: 1.05 },
            { x: 136, y: 162, s: 1.0 },
          ].map((sh, i) => (
            <g
              key={i}
              transform={`translate(${sh.x}, ${sh.y}) scale(${sh.s})`}
            >
              <line
                x1="-8"
                y1="6"
                x2="-8"
                y2="14"
                stroke="#1e293b"
                strokeWidth="2.5"
              />
              <line
                x1="6"
                y1="6"
                x2="6"
                y2="14"
                stroke="#1e293b"
                strokeWidth="2.5"
              />
              <circle cx="-8" cy="0" r="9" fill="#f8fafc" />
              <circle cx="0" cy="-3" r="10" fill="#ffffff" />
              <circle cx="8" cy="0" r="8.5" fill="#f1f5f9" />
              <circle cx="14" cy="-2" r="5.5" fill="#334155" />
            </g>
          ))}
        </svg>
      );

    case "WHEAT":
      return (
        <svg
          viewBox="0 0 200 230"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="wheatBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>
          </defs>
          <rect width="200" height="230" fill="url(#wheatBg)" />
          {/* Golden fields with harvest rows */}
          <path
            d="M0 105 Q70 75 140 102 T200 95 L200 230 L0 230 Z"
            fill="#ca8a04"
          />
          <path
            d="M0 148 Q65 122 140 148 T200 140 L200 230 L0 230 Z"
            fill="#a16207"
          />
          {/* Furrow lines */}
          <path
            d="M20 160 Q100 135 180 160 M15 182 Q100 155 185 182"
            stroke="#fef08a"
            strokeWidth="2.5"
            fill="none"
            opacity="0.45"
          />
          {/* Wheat sheaves */}
          {[46, 100, 152].map((x, idx) => (
            <g key={idx} transform={`translate(${x}, ${idx === 1 ? 66 : 162})`}>
              <path
                d="M0 16 L0 -16 M-8 14 L-12 -10 M8 14 L12 -10"
                stroke="#fef08a"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <ellipse cx="0" cy="-14" rx="4" ry="7" fill="#fde047" />
              <ellipse
                cx="-11"
                cy="-9"
                rx="3.5"
                ry="6"
                transform="rotate(-18 -11 -9)"
                fill="#fde047"
              />
              <ellipse
                cx="11"
                cy="-9"
                rx="3.5"
                ry="6"
                transform="rotate(18 11 -9)"
                fill="#fde047"
              />
            </g>
          ))}
        </svg>
      );

    case "ORE":
      return (
        <svg
          viewBox="0 0 200 230"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="oreBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="55%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>
          <rect width="200" height="230" fill="url(#oreBg)" />
          {/* Jagged Alpine Peaks */}
          <polygon
            points="10,165 62,48 115,165"
            fill="#64748b"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <polygon points="62,48 86,102 62,92 42,102" fill="#e2e8f0" />
          <polygon
            points="82,170 142,54 192,170"
            fill="#475569"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <polygon points="142,54 164,104 142,94 122,104" fill="#cbd5e1" />
          <polygon
            points="45,195 102,82 160,195"
            fill="#334155"
            stroke="#0f172a"
            strokeWidth="2"
          />
          {/* Glowing crystal ore veins */}
          <polygon
            points="75,168 85,148 96,162 88,176"
            fill="#38bdf8"
            stroke="#e0f2fe"
            strokeWidth="1.2"
          />
          <polygon
            points="112,172 122,152 132,166 122,180"
            fill="#7dd3fc"
            stroke="#e0f2fe"
            strokeWidth="1.2"
          />
        </svg>
      );

    case "DESERT":
      return (
        <svg
          viewBox="0 0 200 230"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="desertBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="55%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>
          <rect width="200" height="230" fill="url(#desertBg)" />
          <circle cx="100" cy="52" r="24" fill="#fef08a" opacity="0.55" />
          <path
            d="M0 125 Q65 92 135 125 T200 118 L200 230 L0 230 Z"
            fill="#d97706"
          />
          <path
            d="M0 162 Q85 135 155 165 T200 155 L200 230 L0 230 Z"
            fill="#b45309"
          />
          {/* Oasis lagoon & palm tree */}
          <ellipse
            cx="132"
            cy="168"
            rx="26"
            ry="10"
            fill="#0284c7"
            stroke="#fde68a"
            strokeWidth="2"
          />
          <path
            d="M112 168 Q108 142 118 126"
            stroke="#78350f"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M118 126 Q102 120 98 130 M118 126 Q132 118 138 128 M118 126 Q118 112 128 114"
            stroke="#15803d"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );

    case "WATER":
    default:
      return (
        <svg
          viewBox="0 0 200 230"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path
            d="M35 80 Q65 68 95 80 T155 80 M45 150 Q75 138 105 150 T165 150"
            stroke="rgba(125, 211, 252, 0.22)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};

/**
 * Richly illustrated card artwork for Resource and Development cards in the player's hand.
 */
export const CardArtIllustration: React.FC<{
  resource?: ResourceCard;
  cardType?: ResourceCard | DevelopmentCard | VictoryPointCard;
  className?: string;
}> = ({ resource, cardType, className }) => {
  const resolvedType = resource ?? cardType ?? "WOOD";
  if (
    resolvedType === "WOOD" ||
    resolvedType === "BRICK" ||
    resolvedType === "SHEEP" ||
    resolvedType === "WHEAT" ||
    resolvedType === "ORE"
  ) {
    const customSrc = `/assets/illustrations/cards/${resolvedType.toLowerCase()}.webp`;
    return (
      <div className={className} aria-hidden="true">
        <HybridIllustration
          src={customSrc}
          alt={resolvedType}
          className="card-art-custom-img"
          fallback={<TerrainHexIllustration terrain={resolvedType} />}
        />
      </div>
    );
  }

  const devCustomSrc = `/assets/illustrations/dev/${resolvedType.toLowerCase()}.webp`;
  return (
    <div className={className} aria-hidden="true">
      <HybridIllustration
        src={devCustomSrc}
        alt={resolvedType}
        className="card-art-custom-img"
        fallback={
          <svg
            viewBox="0 0 120 160"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id={`devGrad-${resolvedType}`}
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stopColor="#312e81" />
                <stop offset="55%" stopColor="#1e1b4b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
            <rect width="120" height="160" fill={`url(#devGrad-${resolvedType})`} />
            <circle
              cx="60"
              cy="68"
              r="34"
              fill="rgba(250, 204, 21, 0.14)"
              stroke="rgba(250, 204, 21, 0.45)"
              strokeWidth="1.5"
            />
          </svg>
        }
      />
    </div>
  );
};

/**
 * Renders a custom Nano Banana Pro illustration if available on disk
 * (automatically trying .webp, .png, and .jpg extensions),
 * or smoothly falls back to the built-in vector component.
 */
export const HybridIllustration: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}> = ({ src, alt, className, fallback }) => {
  const [extIndex, setExtIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!src) {
    return <>{fallback}</>;
  }

  const baseWithoutExt = src.replace(/\.(webp|png|jpg|jpeg)$/i, "");
  const candidateUrls = [
    src,
    `${baseWithoutExt}.png`,
    `${baseWithoutExt}.webp`,
    `${baseWithoutExt}.jpg`,
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  if (extIndex >= candidateUrls.length) {
    return <>{fallback}</>;
  }

  const currentUrl = candidateUrls[extIndex];

  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      }}
    >
      {!imgLoaded && fallback}
      <img
        src={currentUrl}
        alt={alt}
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          setImgLoaded(false);
          setExtIndex((prev) => prev + 1);
        }}
        style={{
          display: imgLoaded ? "block" : "none",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "inherit",
        }}
      />
    </span>
  );
};

export const ResourceIcon: React.FC<{
  resource: ResourceCard;
  size?: number;
  className?: string;
}> = ({ resource, size = 22, className }) => {
  switch (resource) {
    case "WOOD":
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
            d="M12 2L5 11H9L4 18H10V22H14V18H20L15 11H19L12 2Z"
            fill="#4ADE80"
            stroke="#064E3B"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "BRICK":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <rect
            x="2"
            y="4"
            width="9"
            height="6"
            rx="1.2"
            fill="#F87171"
            stroke="#7F1D1D"
            strokeWidth="1.5"
          />
          <rect
            x="13"
            y="4"
            width="9"
            height="6"
            rx="1.2"
            fill="#EF4444"
            stroke="#7F1D1D"
            strokeWidth="1.5"
          />
          <rect
            x="6"
            y="12"
            width="12"
            height="6"
            rx="1.2"
            fill="#FB923C"
            stroke="#7F1D1D"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "SHEEP":
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
            cy="11"
            r="5"
            fill="#ECFCCB"
            stroke="#365314"
            strokeWidth="1.5"
          />
          <circle
            cx="14"
            cy="10"
            r="5.5"
            fill="#F7FEE7"
            stroke="#365314"
            strokeWidth="1.5"
          />
          <circle
            cx="12"
            cy="14"
            r="4.5"
            fill="#D9F99D"
            stroke="#365314"
            strokeWidth="1.5"
          />
          <circle cx="17.5" cy="11.5" r="2.8" fill="#3F3F46" />
        </svg>
      );
    case "WHEAT":
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
            d="M12 21V4M12 7C9.5 7 8 5.5 8 3.5C10.5 3.5 12 5 12 7ZM12 7C14.5 7 16 5.5 16 3.5C13.5 3.5 12 5 12 7ZM12 12C9.2 12 7.5 10.2 7.5 8C10.2 8 12 9.8 12 12ZM12 12C14.8 12 16.5 10.2 16.5 8C13.8 8 12 9.8 12 12ZM12 17C9.2 17 7.5 15.2 7.5 13C10.2 13 12 14.8 12 17ZM12 17C14.8 17 16.5 15.2 16.5 13C13.8 13 12 14.8 12 17Z"
            stroke="#FDE047"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="#FACC15"
          />
        </svg>
      );
    case "ORE":
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
            points="12,3 21,9 18,20 6,20 3,9"
            fill="#94A3B8"
            stroke="#1E293B"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <polygon points="12,3 17,9 12,13 7,9" fill="#E2E8F0" />
          <polygon points="12,13 18,20 6,20" fill="#64748B" />
        </svg>
      );
  }
};

export const DevCardIcon: React.FC<{
  card: DevelopmentCard | VictoryPointCard;
  size?: number;
}> = ({ card, size = 20 }) => {
  switch (card) {
    case "KNIGHT":
      return (
        <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden="true">
          ⚔️
        </span>
      );
    case "VICTORY_POINT":
      return (
        <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden="true">
          👑
        </span>
      );
    case "ROAD_BUILDING":
      return (
        <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden="true">
          🛤️
        </span>
      );
    case "YEAR_OF_PLENTY":
      return (
        <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden="true">
          🌾
        </span>
      );
    case "MONOPOLY":
      return (
        <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden="true">
          ⚖️
        </span>
      );
  }
};

/**
 * 3D-styled Board Game Piece SVG for Settlement (Aldeia) — Catan Universe style
 */
export const SettlementSvgPiece: React.FC<{
  color: Color;
  scale?: number;
}> = ({ color, scale = 1 }) => {
  const palette = PLAYER_COLOR_META[color];
  return (
    <g transform={`scale(${scale})`}>
      {/* Base shadow */}
      <ellipse cx="0" cy="12" rx="16" ry="6" fill="rgba(0,0,0,0.65)" />
      {/* Pedestal token */}
      <ellipse
        cx="0"
        cy="10"
        rx="14"
        ry="4.5"
        fill={palette.dark}
        stroke="#0f172a"
        strokeWidth="1.5"
      />
      {/* House front wall */}
      <path
        d="M-11 2 L0 -12 L11 2 L11 10 L-11 10 Z"
        fill={palette.primary}
        stroke="#090d16"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* 3D Side wall */}
      <path
        d="M0 -12 L13 -7 L13 7 L11 10 L11 2 Z"
        fill={palette.dark}
        stroke="#090d16"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Pitched Roof highlight */}
      <path
        d="M-13 2 L0 -14 L13 2 L8 2 L0 -8 L-8 2 Z"
        fill={palette.secondary}
        stroke="#090d16"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Warm lit window/door */}
      <rect
        x="-3"
        y="2"
        width="6"
        height="8"
        rx="1.5"
        fill="#fef08a"
        stroke="#090d16"
        strokeWidth="1.2"
      />
    </g>
  );
};

/**
 * 3D-styled Board Game Piece SVG for City (Cidade / Catedral) — Catan Universe style
 */
export const CitySvgPiece: React.FC<{
  color: Color;
  scale?: number;
}> = ({ color, scale = 1 }) => {
  const palette = PLAYER_COLOR_META[color];
  return (
    <g transform={`scale(${scale})`}>
      {/* Base shadow */}
      <ellipse cx="0" cy="13" rx="19" ry="7" fill="rgba(0,0,0,0.7)" />
      {/* Pedestal */}
      <ellipse
        cx="0"
        cy="11"
        rx="17"
        ry="5"
        fill={palette.dark}
        stroke="#090d16"
        strokeWidth="1.6"
      />
      {/* High Castle Keep Tower */}
      <path
        d="M-14 11 L-14 -8 L-8 -18 L-2 -8 L-2 11 Z"
        fill={palette.primary}
        stroke="#090d16"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Tower Roof */}
      <polygon
        points="-15,-8 -8,-20 -1,-8"
        fill={palette.secondary}
        stroke="#090d16"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Great Hall */}
      <path
        d="M-4 11 L-4 -3 L6 -10 L15 -3 L15 11 Z"
        fill={palette.dark}
        stroke="#090d16"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <polygon
        points="-5,-3 6,-12 16,-3"
        fill={palette.secondary}
        stroke="#090d16"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Golden windows */}
      <rect x="-10" y="-4" width="4" height="6" rx="1" fill="#fef08a" />
      <rect x="3" y="1" width="5" height="6" rx="1" fill="#fef08a" />
    </g>
  );
};

/**
 * Visual 2D6 Dice Face SVG
 */
export const DiceFaceSvg: React.FC<{
  value: number;
  size?: number;
  isHot?: boolean;
}> = ({ value, size = 34, isHot = false }) => {
  const pipPositions: Record<number, Array<[number, number]>> = {
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
      [8, 8],
      [24, 8],
      [16, 16],
      [8, 24],
      [24, 24],
    ],
    6: [
      [9, 7],
      [23, 7],
      [9, 16],
      [23, 16],
      [9, 25],
      [23, 25],
    ],
  };
  const pips = pipPositions[value] || pipPositions[1];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-label={`Dado ${value}`}
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="6.5"
        fill={isHot ? "#FEF2F2" : "#FFFBEB"}
        stroke={isHot ? "#EF4444" : "#D97706"}
        strokeWidth="2.2"
      />
      {pips.map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r="2.7"
          fill={isHot ? "#DC2626" : "#1E293B"}
        />
      ))}
    </svg>
  );
};
