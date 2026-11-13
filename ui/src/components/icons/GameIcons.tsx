import React, { useId, useState } from "react";
import type {
  Color,
  DevelopmentCard,
  ResourceCard,
  VictoryPointCard,
} from "../../utils/api.types";

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
          {/* Soft teal caustic highlight + dusk gold surface glints */}
          <ellipse
            cx="102"
            cy="96"
            rx="68"
            ry="34"
            fill="rgba(56, 189, 248, 0.08)"
          />
          <path
            d="M32 62 Q68 54 100 63 T168 60"
            stroke="rgba(224, 242, 254, 0.24)"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M24 108 Q64 98 102 108 T178 106"
            stroke="rgba(254, 240, 138, 0.16)"
            strokeWidth="2.1"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M42 148 Q84 139 124 148 T166 146"
            stroke="rgba(125, 211, 252, 0.22)"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M58 182 Q96 175 138 184"
            stroke="rgba(165, 243, 252, 0.16)"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};

/**
 * Illustrated coastal timber wharf & moored merchant vessel for sea ports
 * (inspired by the red-and-gold striped caravels of Rule the Isle's home art).
 */
export const HarborPortSvg: React.FC<{
  resource: ResourceCard | null;
  width?: number;
  height?: number;
}> = ({ resource, width = 62, height = 50 }) => {
  const uid = useId().replace(/:/g, "");
  const waterGlowId = `harbor-glow-${uid}`;
  const sailColor =
    resource === "WOOD"
      ? "#15803d"
      : resource === "BRICK"
        ? "#c2410c"
        : resource === "SHEEP"
          ? "#4d7c0f"
          : resource === "WHEAT"
            ? "#d97706"
            : resource === "ORE"
              ? "#475569"
              : "#b91c1c";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 80"
      aria-hidden="true"
      className="port-scene__artwork-svg"
    >
      <defs>
        <radialGradient id={waterGlowId} cx="50%" cy="68%" r="48%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.48" />
          <stop offset="70%" stopColor="#0e7490" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#082f49" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Harbor turquoise bay reflection & water wake */}
      <ellipse cx="50" cy="56" rx="44" ry="20" fill={`url(#${waterGlowId})`} />
      <path
        d="M16 62 Q34 58 52 63 T84 61"
        stroke="rgba(224, 242, 254, 0.55)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M24 69 Q48 65 76 69"
        stroke="rgba(254, 240, 138, 0.45)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Timber dock wharf pilings & deck */}
      <g>
        <rect x="64" y="42" width="3.8" height="20" rx="1.2" fill="#451a03" />
        <rect x="82" y="40" width="3.8" height="22" rx="1.2" fill="#451a03" />
        <polygon
          points="56,42 90,37 94,45 60,51"
          fill="#92400e"
          stroke="#271206"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line
          x1="62"
          y1="44.5"
          x2="88"
          y2="40.5"
          stroke="#d97706"
          strokeWidth="1.1"
          opacity="0.7"
        />
        <circle cx="65.9" cy="41.5" r="2.2" fill="#fde68a" />
        <circle cx="83.9" cy="39.5" r="2.2" fill="#fde68a" />

        {/* Harbor cargo crates/barrels matching the port specialty */}
        {resource === "WOOD" && (
          <g transform="translate(75, 36)">
            <rect x="-6" y="0" width="12" height="4" rx="1.8" fill="#78350f" stroke="#271206" strokeWidth="1" />
            <rect x="-5" y="-3.5" width="11" height="4" rx="1.8" fill="#92400e" stroke="#271206" strokeWidth="1" />
          </g>
        )}
        {resource === "BRICK" && (
          <g transform="translate(76, 36)">
            <rect x="-5" y="-2" width="10" height="5" rx="1" fill="#dc2626" stroke="#450a0a" strokeWidth="1" />
            <rect x="-3" y="-6" width="7" height="4.5" rx="1" fill="#ef4444" stroke="#450a0a" strokeWidth="1" />
          </g>
        )}
        {resource === "SHEEP" && (
          <g transform="translate(76, 36)">
            <circle cx="-3" cy="-1" r="4" fill="#f8fafc" stroke="#475569" strokeWidth="0.9" />
            <circle cx="3" cy="-2" r="4.2" fill="#ffffff" stroke="#475569" strokeWidth="0.9" />
          </g>
        )}
        {resource === "WHEAT" && (
          <g transform="translate(76, 36)">
            <ellipse cx="-3" cy="-1" rx="3.8" ry="5" fill="#facc15" stroke="#713f12" strokeWidth="1" />
            <ellipse cx="3" cy="-2" rx="3.8" ry="5" fill="#eab308" stroke="#713f12" strokeWidth="1" />
          </g>
        )}
        {resource === "ORE" && (
          <g transform="translate(76, 36)">
            <polygon points="-5,2 -2,-5 3,-2 5,3 -3,4" fill="#64748b" stroke="#0f172a" strokeWidth="1" />
            <polygon points="-1,0 2,-6 5,-1 2,2" fill="#38bdf8" opacity="0.85" />
          </g>
        )}
        {!resource && (
          <g transform="translate(76, 36)">
            <rect x="-5" y="-2" width="9" height="6" rx="1" fill="#b45309" stroke="#271206" strokeWidth="1" />
            <circle cx="0" cy="-5" r="2.2" fill="#fef08a" />
          </g>
        )}
      </g>

      {/* Moored Merchant Caravel / Viking Longship rocking beside pier */}
      <g className="port-scene__ship">
        {/* Hull shadow in harbor water */}
        <ellipse cx="37" cy="57" rx="22" ry="5" fill="rgba(2, 12, 27, 0.52)" />
        {/* Wooden mast & yardarm */}
        <line x1="36" y1="12" x2="36" y2="50" stroke="#451a03" strokeWidth="2.8" strokeLinecap="round" />
        <line x1="18" y1="17" x2="54" y2="17" stroke="#78350f" strokeWidth="2.3" strokeLinecap="round" />

        {/* Striped billowing merchant sail (Rule the Isle motif) */}
        <path
          d="M19 18 Q26 28 21 40 L51 40 Q55 28 52 18 Z"
          fill="#fef3c7"
          stroke="#451a03"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M26 18 Q30 29 27 40 L33 40 Q36 29 33 18 Z" fill={sailColor} />
        <path d="M39 18 Q43 29 40 40 L46 40 Q49 29 46 18 Z" fill={sailColor} />

        {/* Brass/gold top pennant */}
        <path d="M36 9 L47 12.5 L36 15.5 Z" fill="#facc15" stroke="#78350f" strokeWidth="1" />

        {/* Carved Oak Hull with bow figurehead */}
        <path
          d="M12 45 C14 55, 22 59, 37 59 C52 59, 58 55, 62 44 L54 45 L37 46 L19 45 Z"
          fill="#78350f"
          stroke="#271206"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M16 47 C24 51, 48 51, 58 46"
          stroke="#d97706"
          strokeWidth="1.4"
          fill="none"
        />
        {/* Decorative wooden shields along ship rail */}
        <circle cx="27" cy="48" r="2.2" fill="#facc15" stroke="#451a03" strokeWidth="0.8" />
        <circle cx="37" cy="48.5" r="2.2" fill={sailColor} stroke="#451a03" strokeWidth="0.8" />
        <circle cx="47" cy="48" r="2.2" fill="#facc15" stroke="#451a03" strokeWidth="0.8" />
        {/* Mooring rope tied to wharf piling */}
        <path d="M58 46 Q62 50 65 44" stroke="#fde68a" strokeWidth="1.2" fill="none" strokeDasharray="2 1" />
      </g>
    </svg>
  );
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

type PiecePalette = {
  light: string;
  main: string;
  shade: string;
  deep: string;
  outline: string;
  trim: string;
};

function getPiecePalette(color: Color): PiecePalette {
  switch (color) {
    case "RED":
      return {
        light: "#FFAAA8",
        main: "#EF4444",
        shade: "#DC2626",
        deep: "#991B1B",
        outline: "#450A0A",
        trim: "#FEF08A",
      };
    case "BLUE":
      return {
        light: "#BAE6FD",
        main: "#2563EB",
        shade: "#1D4ED8",
        deep: "#1E3A8A",
        outline: "#082F49",
        trim: "#FEF08A",
      };
    case "ORANGE":
      return {
        light: "#FEF08A",
        main: "#F59E0B",
        shade: "#D97706",
        deep: "#78350F",
        outline: "#451A03",
        trim: "#FFFFFF",
      };
    case "WHITE":
    default:
      return {
        light: "#FFFFFF",
        main: "#F8FAFC",
        shade: "#CBD5E1",
        deep: "#64748B",
        outline: "#0F172A",
        trim: "#F59E0B",
      };
  }
}

/**
 * Artisanal Wooden & Half-Timbered Island Homestead SVG for Settlement (Aldeia)
 */
export const SettlementSvgPiece: React.FC<{
  color: Color;
  scale?: number;
}> = ({ color, scale = 1 }) => {
  const palette = getPiecePalette(color);
  const uid = useId().replace(/:/g, "");
  const wallGradId = `set-wall-${color}-${uid}`;
  const roofGradId = `set-roof-${color}-${uid}`;

  return (
    <g transform={`scale(${scale})`}>
      <defs>
        <linearGradient id={wallGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="45%" stopColor={palette.main} />
          <stop offset="100%" stopColor={palette.shade} />
        </linearGradient>
        <linearGradient id={roofGradId} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="50%" stopColor={palette.main} />
          <stop offset="100%" stopColor={palette.shade} />
        </linearGradient>
      </defs>

      {/* Ground contact shadow */}
      <ellipse cx="0" cy="13" rx="17" ry="5.5" fill="rgba(0, 0, 0, 0.72)" />

      {/* Solid player-colored plinth base */}
      <path
        d="M-14 9.5 L-11 13 L11 13 L15 9.5 L15 7.5 L-14 7.5 Z"
        fill={palette.deep}
        stroke={palette.outline}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line
        x1="-12"
        y1="8.2"
        x2="13"
        y2="8.2"
        stroke="#FFFFFF"
        strokeWidth="1.0"
        opacity="0.65"
      />

      {/* Chimney in faction contrast tone */}
      <rect
        x="-10"
        y="-14"
        width="4.8"
        height="8.5"
        rx="0.8"
        fill={palette.shade}
        stroke={palette.outline}
        strokeWidth="1.6"
      />
      <rect
        x="-11"
        y="-15.4"
        width="6.8"
        height="2.4"
        rx="0.6"
        fill={palette.light}
        stroke={palette.outline}
        strokeWidth="1.3"
      />

      {/* Front gable wall with vibrant player color */}
      <path
        d="M-11.5 9.5 L-11.5 0 L-1 -11 L9 0 L9 9.5 Z"
        fill={`url(#${wallGradId})`}
        stroke={palette.outline}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Right 3D perspective flank wall */}
      <path
        d="M9 0 L14.5 -2.5 L14.5 7.5 L9 9.5 Z"
        fill={palette.shade}
        stroke={palette.outline}
        strokeWidth="2.0"
        strokeLinejoin="round"
      />

      {/* Sloped right roof wing */}
      <path
        d="M-1 -12.5 L8 -14.5 L16.2 -2.2 L9.5 0.5 Z"
        fill={palette.deep}
        stroke={palette.outline}
        strokeWidth="2.0"
        strokeLinejoin="round"
      />

      {/* Main pitched shingle gable roof with vibrant sunlit gradient */}
      <path
        d="M-14.2 1.2 L-1 -13 L10.8 1.2 L8.2 2.2 L-1 -8.8 L-11.2 2.2 Z"
        fill={`url(#${roofGradId})`}
        stroke={palette.outline}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Crisp roof ridge specular highlight */}
      <line
        x1="-13"
        y1="0.5"
        x2="-1"
        y2="-12.2"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Contrasting arched door with glowing handle */}
      <path
        d="M-4.2 9.5 L-4.2 3.8 C-4.2 1.8, 1.8 1.8, 1.8 3.8 L1.8 9.5 Z"
        fill={palette.outline}
        stroke={palette.outline}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="0.4" cy="6.2" r="0.9" fill={palette.trim} />

      {/* Warm glowing attic window */}
      <circle
        cx="-1.2"
        cy="-3.6"
        r="2.2"
        fill={palette.trim}
        stroke={palette.outline}
        strokeWidth="1.3"
      />
    </g>
  );
};

/**
 * Fortified Manor Keep & Citadel SVG for City (Cidade / Vila Fortificada)
 */
export const CitySvgPiece: React.FC<{
  color: Color;
  scale?: number;
}> = ({ color, scale = 1 }) => {
  const palette = getPiecePalette(color);
  const uid = useId().replace(/:/g, "");
  const keepGradId = `city-keep-${color}-${uid}`;
  const hallGradId = `city-hall-${color}-${uid}`;

  return (
    <g transform={`scale(${scale})`}>
      <defs>
        <linearGradient id={keepGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="50%" stopColor={palette.main} />
          <stop offset="100%" stopColor={palette.shade} />
        </linearGradient>
        <linearGradient id={hallGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="60%" stopColor={palette.shade} />
        </linearGradient>
      </defs>

      {/* Wide ambient ground shadow */}
      <ellipse cx="0" cy="14" rx="20" ry="6.2" fill="rgba(0, 0, 0, 0.78)" />

      {/* Courtyard fortress base in deep faction tone */}
      <path
        d="M-18 10.5 L-15 14 L15 14 L18.5 10.5 L18.5 8.5 L-18 8.5 Z"
        fill={palette.deep}
        stroke={palette.outline}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <line
        x1="-16"
        y1="9.2"
        x2="16.5"
        y2="9.2"
        stroke="#FFFFFF"
        strokeWidth="1.0"
        opacity="0.65"
      />

      {/* Towering Watchtower Keep (left) */}
      <rect
        x="-14.5"
        y="-11"
        width="12.5"
        height="21.5"
        rx="1.2"
        fill={`url(#${keepGradId})`}
        stroke={palette.outline}
        strokeWidth="2.2"
      />
      {/* Keep crenellated battlements */}
      <path
        d="M-16 -10.5 L-1 -10.5 L-1 -13 L-4.5 -13 L-4.5 -11.5 L-7 -11.5 L-7 -13 L-10 -13 L-10 -11.5 L-12.5 -11.5 L-12.5 -13 L-16 -13 Z"
        fill={palette.light}
        stroke={palette.outline}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Citadel conical spire */}
      <polygon
        points="-16.5,-13 -8.2,-23.5 -0.2,-13"
        fill={`url(#${hallGradId})`}
        stroke={palette.outline}
        strokeWidth="2.0"
        strokeLinejoin="round"
      />
      <line
        x1="-14.5"
        y1="-14"
        x2="-8.2"
        y2="-22.3"
        stroke="#FFFFFF"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.8"
      />

      {/* Spire finial & faction pennant */}
      <line
        x1="-8.2"
        y1="-23.5"
        x2="-8.2"
        y2="-28"
        stroke={palette.trim}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M-8.2 -27.5 L1.0 -25.2 L-8.2 -22.8 Z"
        fill={palette.light}
        stroke={palette.outline}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />

      {/* Great Hall body (right) */}
      <path
        d="M-3 10.5 L-3 -2.5 L6 -10 L14.5 -2.5 L14.5 10.5 Z"
        fill={`url(#${keepGradId})`}
        stroke={palette.outline}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 -2.5 L18 -4.5 L18 8.5 L14.5 10.5 Z"
        fill={palette.deep}
        stroke={palette.outline}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Great Hall pitched roof */}
      <path
        d="M-4.5 -1.5 L6 -11.2 L16.2 -1.5 L13.8 -0.6 L6 -7.8 L-2.2 -0.6 Z"
        fill={`url(#${hallGradId})`}
        stroke={palette.outline}
        strokeWidth="2.0"
        strokeLinejoin="round"
      />
      <path
        d="M6 -11.2 L12.5 -12.6 L18.5 -4.2 L14.5 -2.5 Z"
        fill={palette.deep}
        stroke={palette.outline}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      {/* Arched windows with glowing warm gold */}
      <rect
        x="-10.2"
        y="-7.5"
        width="3.8"
        height="5.6"
        rx="1.8"
        fill={palette.trim}
        stroke={palette.outline}
        strokeWidth="1.2"
      />
      <rect
        x="-10.2"
        y="0.5"
        width="3.8"
        height="5"
        rx="1.2"
        fill={palette.trim}
        stroke={palette.outline}
        strokeWidth="1.2"
      />

      {/* Castle grand portal arch */}
      <path
        d="M2.5 10.5 L2.5 3.6 C2.5 1.2, 9.2 1.2, 9.2 3.6 L9.2 10.5 Z"
        fill={palette.outline}
        stroke={palette.outline}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="5.85"
        cy="-3.8"
        r="2.2"
        fill={palette.trim}
        stroke={palette.outline}
        strokeWidth="1.2"
      />
    </g>
  );
};

/**
 * Carved Timber & Cobblestone Causeway SVG for Road (Estrada)
 */
export const RoadSvgPiece: React.FC<{
  color: Color;
  className?: string;
}> = ({ color, className }) => {
  const palette = getPiecePalette(color);
  const uid = useId().replace(/:/g, "");
  const topGradId = `road-top-${color}-${uid}`;

  return (
    <svg
      viewBox="0 0 100 24"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={topGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="42%" stopColor={palette.main} />
          <stop offset="100%" stopColor={palette.shade} />
        </linearGradient>
      </defs>

      {/* Ground contact shadow */}
      <rect x="2" y="7" width="96" height="15" rx="5" fill="rgba(0, 0, 0, 0.75)" />

      {/* Beveled timber/stone beam base */}
      <path
        d="M4 6 L10 2.5 L90 2.5 L96 6 L98 15 L91 19.5 L9 19.5 L2 15 Z"
        fill={palette.deep}
        stroke={palette.outline}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Top causeway deck with saturated player color */}
      <path
        d="M6 6.5 L12 3.8 L88 3.8 L94 6.5 L94 13.5 L88 15.5 L12 15.5 L6 13.5 Z"
        fill={`url(#${topGradId})`}
        stroke={palette.outline}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* High-contrast divider notches */}
      <path
        d="M26 4.8 L26 14.5 M50 4.8 L50 14.5 M74 4.8 L74 14.5"
        stroke={palette.outline}
        strokeWidth="1.6"
        opacity="0.5"
      />

      {/* Top carved specular highlight */}
      <line
        x1="14"
        y1="5.5"
        x2="86"
        y2="5.5"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
};

/**
 * Faceted Heraldic Gold Star Badge for Longest Road / Largest Army awards
 */
export const AwardStarSvg: React.FC<{
  size?: number;
  className?: string;
  label?: string;
  awardType?: "army" | "road";
}> = ({ size = 15, className, label, awardType }) => {
  const uid = useId().replace(/:/g, "");
  const starGradId = `award-star-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid={awardType ? `award-star-${awardType}` : undefined}
    >
      <defs>
        <linearGradient id={starGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="45%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
      </defs>
      <polygon
        points="12,1.6 15.1,8.1 22.3,9.1 17.1,14.1 18.4,21.2 12,17.8 5.6,21.2 6.9,14.1 1.7,9.1 8.9,8.1"
        fill={`url(#${starGradId})`}
        stroke="#78350F"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <polygon
        points="12,3.4 13.9,8.3 12,11.8 10.1,8.3"
        fill="#FFFFFF"
        opacity="0.48"
      />
    </svg>
  );
};

/**
 * Carved Ivory & Bronze 2D6 Dice Face SVG
 */
export const DiceFaceSvg: React.FC<{
  value: number;
  size?: number;
  isHot?: boolean;
}> = ({ value, size = 34, isHot = false }) => {
  const uid = useId().replace(/:/g, "");
  const ivoryGradId = `die-ivory-${uid}`;
  const pipPositions: Record<number, Array<[number, number]>> = {
    1: [[16, 16]],
    2: [
      [9, 9],
      [23, 23],
    ],
    3: [
      [8.5, 8.5],
      [16, 16],
      [23.5, 23.5],
    ],
    4: [
      [9, 9],
      [23, 9],
      [9, 23],
      [23, 23],
    ],
    5: [
      [8.5, 8.5],
      [23.5, 8.5],
      [16, 16],
      [8.5, 23.5],
      [23.5, 23.5],
    ],
    6: [
      [9, 7.5],
      [23, 7.5],
      [9, 16],
      [23, 16],
      [9, 24.5],
      [23, 24.5],
    ],
  };
  const pips = pipPositions[value] || pipPositions[1];
  const pipFill = isHot ? "#B91C1C" : value === 1 ? "#991B1B" : "#1C1917";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-label={`Dado ${value}`}
    >
      <defs>
        <linearGradient id={ivoryGradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isHot ? "#FFF5F5" : "#FFFEF8"} />
          <stop offset="60%" stopColor={isHot ? "#FEE2E2" : "#F5E7C8"} />
          <stop offset="100%" stopColor={isHot ? "#FECACA" : "#DEC293"} />
        </linearGradient>
      </defs>
      {/* Carved rounded die body */}
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="6.8"
        fill={`url(#${ivoryGradId})`}
        stroke={isHot ? "#B91C1C" : "#78350F"}
        strokeWidth="2.1"
      />
      {/* Chamfer inner facet highlight */}
      <rect
        x="3.6"
        y="3.6"
        width="24.8"
        height="24.8"
        rx="4.8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1"
        opacity="0.7"
      />
      {pips.map(([cx, cy], idx) => (
        <g key={idx}>
          <circle cx={cx} cy={cy + 0.5} r="2.7" fill="rgba(255,255,255,0.45)" />
          <circle cx={cx} cy={cy} r="2.65" fill={pipFill} />
        </g>
      ))}
    </svg>
  );
};
