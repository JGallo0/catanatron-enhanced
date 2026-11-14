import React, { useId } from "react";
import "./OceanBackdrop.scss";

export type OceanBackdropProps = {
  center?: [number, number];
  size?: number;
};

/**
 * Edição República "A Praça é Nossa" (Viçosa-MG):
 * Full wooden tabletop scene rendered inside the zoomable Board container so
 * Zoom In / Zoom Out scales the entire table and Catan board together:
 * - Honey-amber varnished wooden table with bevelled outer edges ("borda da mesa")
 * - Human bite mark ("marca de mordida humana") chewed into the right edge of the table
 * - Bottle of Toni Lourenço & bottle of Fofinha on the table border
 * - Two matte-black board game box halves (one on each side of the board) with
 *   realistic 3D sloped inner walls, darker recessed floor, scuffed white corners, and no text
 * - Giant Bamboo Ashtray ("cinzeiro de bambu gigante") with bottom node ring,
 *   carved sun emblem, dark ash cavity, and lit Coyote straw cigarette with rising smoke
 * - Red COYOTE pack, loose palheiros with red rubber band, white Bic lighter, and beer glasses
 */
export default function OceanBackdrop({ center, size }: OceanBackdropProps) {
  const uid = useId().replace(/:/g, "");

  const woodBaseId = `rep-wood-base-${uid}`;
  const boxFloorLeftId = `rep-box-floor-l-${uid}`;
  const boxFloorRightId = `rep-box-floor-r-${uid}`;
  const bambooBodyId = `rep-bamboo-body-${uid}`;
  const bambooCavityId = `rep-bamboo-cavity-${uid}`;
  const beerLiquidId = `rep-beer-liquid-${uid}`;
  const emberGlowId = `rep-ember-glow-${uid}`;
  const toniGlassId = `rep-toni-glass-${uid}`;
  const fofinhaGlassId = `rep-fofinha-glass-${uid}`;

  const positionedStyle: React.CSSProperties | undefined =
    center && size
      ? {
          left: center[0],
          top: center[1],
          width: size * 25,
          height: size * 15,
          transform: "translate(-50%, -50%)",
        }
      : undefined;

  return (
    <div
      className="ocean-panorama-backdrop ocean-panorama-backdrop--republica-table"
      style={positionedStyle}
      aria-hidden="true"
    >
      <svg
        className="ocean-panorama-backdrop__svg"
        viewBox="0 0 2000 1200"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Honey-amber varnished wooden table surface */}
          <linearGradient id={woodBaseId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8a4813" />
            <stop offset="18%" stopColor="#a85c1b" />
            <stop offset="42%" stopColor="#bd6e24" />
            <stop offset="58%" stopColor="#c47529" />
            <stop offset="80%" stopColor="#a65a1a" />
            <stop offset="100%" stopColor="#824310" />
          </linearGradient>

          {/* Deep dark recessed floor for the left & right box halves (darker than inner walls) */}
          <radialGradient id={boxFloorLeftId} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#101115" />
            <stop offset="65%" stopColor="#0a0b0e" />
            <stop offset="100%" stopColor="#050507" />
          </radialGradient>

          <radialGradient id={boxFloorRightId} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#101115" />
            <stop offset="65%" stopColor="#0a0b0e" />
            <stop offset="100%" stopColor="#050507" />
          </radialGradient>

          {/* Giant dried bamboo cylinder gradient */}
          <linearGradient id={bambooBodyId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6b5b35" />
            <stop offset="22%" stopColor="#9d8b58" />
            <stop offset="48%" stopColor="#baa874" />
            <stop offset="76%" stopColor="#8d7b49" />
            <stop offset="100%" stopColor="#594a28" />
          </linearGradient>

          {/* Bamboo ashtray dark interior cavity */}
          <radialGradient id={bambooCavityId} cx="50%" cy="46%" r="52%">
            <stop offset="0%" stopColor="#3b352e" />
            <stop offset="58%" stopColor="#221e1a" />
            <stop offset="100%" stopColor="#120f0d" />
          </radialGradient>

          {/* Golden pilsner beer gradient */}
          <linearGradient id={beerLiquidId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          {/* Lit Coyote ember glow */}
          <radialGradient id={emberGlowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="1" />
            <stop offset="35%" stopColor="#f97316" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#dc2626" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </radialGradient>

          {/* Toni Lourenço amber glass bottle gradient */}
          <linearGradient id={toniGlassId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2e1305" />
            <stop offset="28%" stopColor="#6b2f0b" />
            <stop offset="55%" stopColor="#8f4212" />
            <stop offset="82%" stopColor="#4c1f06" />
            <stop offset="100%" stopColor="#240d02" />
          </linearGradient>

          {/* Fofinha golden cachaça glass bottle gradient */}
          <linearGradient id={fofinhaGlassId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#713f12" />
            <stop offset="25%" stopColor="#ca8a04" />
            <stop offset="52%" stopColor="#facc15" />
            <stop offset="80%" stopColor="#a16207" />
            <stop offset="100%" stopColor="#522c06" />
          </linearGradient>
        </defs>

        {/* ================================================================ */}
        {/* 0. DARK FLOOR AROUND THE TABLE (visible when zooming out)        */}
        {/* ================================================================ */}
        <rect width="2000" height="1200" fill="#120803" />

        {/* Table drop shadow on the room floor */}
        <rect
          x="74"
          y="64"
          width="1868"
          height="1092"
          rx="22"
          fill="rgba(0, 0, 0, 0.72)"
        />

        {/* ================================================================ */}
        {/* 1. WOODEN TABLE WITH 3D BEVELLED BORDER ("BORDA DA MESA")        */}
        {/* ================================================================ */}
        {/* Outer 3D wooden skirt/apron thickness */}
        <rect
          x="64"
          y="48"
          width="1872"
          height="1104"
          rx="18"
          fill="#3d1c03"
          stroke="#240f01"
          strokeWidth="4"
        />
        {/* Bevelled solid wood border frame */}
        <rect
          x="72"
          y="56"
          width="1856"
          height="1084"
          rx="14"
          fill="#633008"
          stroke="#8c4812"
          strokeWidth="3"
        />

        {/* Main honey-amber varnished plank surface */}
        <rect
          x="90"
          y="74"
          width="1820"
          height="1048"
          rx="8"
          fill={`url(#${woodBaseId})`}
        />

        {/* Alternating warm wood plank tonal bands */}
        <rect x="90" y="74" width="1820" height="174" fill="#6b3409" opacity="0.18" />
        <rect x="90" y="248" width="1820" height="176" fill="#e08b32" opacity="0.08" />
        <rect x="90" y="424" width="1820" height="176" fill="#7c3c0b" opacity="0.11" />
        <rect x="90" y="600" width="1820" height="176" fill="#e5933a" opacity="0.08" />
        <rect x="90" y="776" width="1820" height="174" fill="#703509" opacity="0.14" />
        <rect x="90" y="950" width="1820" height="172" fill="#592806" opacity="0.2" />

        {/* Horizontal plank grooves (table seams) */}
        {[248, 424, 600, 776, 950].map((y) => (
          <g key={y}>
            <line
              x1="90"
              y1={y}
              x2="1910"
              y2={y}
              stroke="#3b1a04"
              strokeWidth="2.8"
              opacity="0.72"
            />
            <line
              x1="90"
              y1={y + 2}
              x2="1910"
              y2={y + 2}
              stroke="#fbbf24"
              strokeWidth="1"
              opacity="0.16"
            />
          </g>
        ))}

        {/* Vertical board-end join lines on planks */}
        <line x1="510" y1="74" x2="504" y2="248" stroke="#3b1a04" strokeWidth="2.2" opacity="0.5" />
        <line x1="1460" y1="248" x2="1468" y2="424" stroke="#3b1a04" strokeWidth="2.2" opacity="0.48" />
        <line x1="420" y1="600" x2="414" y2="776" stroke="#3b1a04" strokeWidth="2.2" opacity="0.48" />
        <line x1="1540" y1="776" x2="1546" y2="950" stroke="#3b1a04" strokeWidth="2.2" opacity="0.5" />

        {/* Organic wood grain curves & knots */}
        <g stroke="#4a2206" fill="none" opacity="0.26">
          <path d="M90 138 Q520 112 1020 144 T1910 132" strokeWidth="2" />
          <path d="M90 198 Q610 222 1140 188 T1910 204" strokeWidth="1.5" />
          <path d="M90 312 Q440 284 860 318 T1560 298 T1910 318" strokeWidth="2" />
          <path d="M90 378 Q640 404 1220 368 T1910 386" strokeWidth="1.6" />
          <path d="M90 488 Q490 462 960 496 T1910 480" strokeWidth="2.1" />
          <path d="M90 554 Q660 578 1280 544 T1910 562" strokeWidth="1.6" />
          <path d="M90 664 Q530 638 1040 672 T1910 658" strokeWidth="2" />
          <path d="M90 732 Q700 754 1340 720 T1910 738" strokeWidth="1.5" />
          <path d="M90 842 Q480 818 980 850 T1910 834" strokeWidth="2" />
          <path d="M90 908 Q620 932 1240 900 T1910 914" strokeWidth="1.6" />
          <path d="M90 1028 Q580 1004 1160 1036 T1910 1020" strokeWidth="2.1" />

          {/* Wood knots */}
          <ellipse cx="348" cy="336" rx="30" ry="10" strokeWidth="2.2" />
          <ellipse cx="348" cy="336" rx="15" ry="4.8" strokeWidth="1.6" fill="#4a2206" opacity="0.45" />
          <ellipse cx="1610" cy="792" rx="34" ry="11" strokeWidth="2.2" />
          <ellipse cx="1610" cy="792" rx="16" ry="5" strokeWidth="1.6" fill="#4a2206" opacity="0.45" />
          <ellipse cx="640" cy="988" rx="26" ry="8.5" strokeWidth="1.8" />
        </g>

        {/* Subtle cup water stain rings & small palheiro ember burn dots */}
        <g opacity="0.24" fill="none">
          <circle cx="496" cy="442" r="38" stroke="#fde68a" strokeWidth="2.2" strokeDasharray="48 14 82 18" />
          <circle cx="1510" cy="368" r="36" stroke="#fde68a" strokeWidth="1.8" strokeDasharray="60 18 44 12" />
          <ellipse cx="458" cy="642" rx="4.8" ry="3" fill="#1c0d04" opacity="0.85" transform="rotate(-18 458 642)" />
          <ellipse cx="472" cy="658" rx="3.4" ry="2.2" fill="#1c0d04" opacity="0.75" transform="rotate(12 472 658)" />
          <ellipse cx="1488" cy="748" rx="4.2" ry="2.5" fill="#1c0d04" opacity="0.8" transform="rotate(-28 1488 748)" />
        </g>

        {/* ================================================================ */}
        {/* 2. HUMAN BITE MARK ON THE RIGHT EDGE OF THE TABLE                */}
        {/*    ("Marca de mordida humana na borda direita da mesa")          */}
        {/* ================================================================ */}
        <g transform="translate(1936, 468)">
          {/* Outer splintered raw wood halo where teeth tore the varnish */}
          <path
            d="M 0 -64
               C -36 -58, -68 -36, -72 0
               C -68 36, -36 58, 0 64 Z"
            fill="#d99b52"
            stroke="#5c2c06"
            strokeWidth="2.5"
          />
          {/* Inner lighter raw sapwood layer */}
          <path
            d="M 0 -55
               C -28 -50, -56 -30, -60 0
               C -56 30, -28 50, 0 55 Z"
            fill="#eec082"
          />
          {/* Scalloped dental arch tooth impressions (incisors, canines, premolars) */}
          <path
            d="M -4 -52
               Q -24 -48, -28 -36
               Q -42 -32, -46 -20
               Q -56 -14, -56 -2
               Q -58 0, -56 2
               Q -56 14, -46 20
               Q -42 32, -28 36
               Q -24 48, -4 52"
            fill="none"
            stroke="#6e3509"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Individual tooth gouge craters along the dental arch */}
          {[
            [-18, -43, 6.5, 4.2, -28],
            [-35, -31, 7, 4.5, -18],
            [-47, -17, 6.2, 4, -8],
            [-51, -5, 6, 3.8, -2],
            [-51, 6, 6, 3.8, 2],
            [-47, 18, 6.2, 4, 8],
            [-35, 31, 7, 4.5, 18],
            [-18, 43, 6.5, 4.2, 28],
          ].map(([tx, ty, rx, ry, rot], idx) => (
            <ellipse
              key={idx}
              cx={tx}
              cy={ty}
              rx={rx}
              ry={ry}
              transform={`rotate(${rot} ${tx} ${ty})`}
              fill="#b4712c"
              stroke="#5c2c06"
              strokeWidth="1.4"
            />
          ))}
          {/* Tooth scrape grooves radiating toward the edge */}
          <g stroke="#8a4b14" strokeWidth="1.4" strokeLinecap="round" opacity="0.75">
            <line x1="-45" y1="-14" x2="-22" y2="-11" />
            <line x1="-48" y1="-3" x2="-20" y2="-2" />
            <line x1="-48" y1="5" x2="-20" y2="4" />
            <line x1="-44" y1="16" x2="-22" y2="13" />
            <line x1="-33" y1="-28" x2="-14" y2="-22" />
            <line x1="-33" y1="28" x2="-14" y2="22" />
          </g>
          {/* Dark 3D wood thickness bevel inside the bitten cutout */}
          <path
            d="M 2 -46
               C -18 -42, -38 -24, -41 0
               C -38 24, -18 42, 2 46 Z"
            fill="#3d1c03"
          />
          {/* Room floor void where the chunk of table edge was bitten off */}
          <path
            d="M 4 -38
               C -12 -34, -28 -20, -31 0
               C -28 20, -12 34, 4 38 Z"
            fill="#120803"
          />
        </g>

        {/* ================================================================ */}
        {/* 3. BOTTLES OF "TONI LOURENÇO" & "FOFINHA" ON THE TABLE BORDER    */}
        {/* ================================================================ */}
        {/* 3A. Garrafa de Toni Lourenço (top-right border of the table) */}
        <g transform="translate(1662, 232) rotate(-11)">
          {/* Bottle drop shadow on table border */}
          <rect
            x="-34"
            y="-78"
            width="72"
            height="176"
            rx="18"
            fill="rgba(12, 5, 1, 0.58)"
            transform="translate(8, 12)"
          />
          {/* Bottle neck */}
          <rect
            x="-11"
            y="-108"
            width="22"
            height="38"
            rx="4"
            fill={`url(#${toniGlassId})`}
            stroke="#1f0b02"
            strokeWidth="1.8"
          />
          {/* Metallic red/gold bottle cap */}
          <rect
            x="-13"
            y="-118"
            width="26"
            height="13"
            rx="3"
            fill="#b91c1c"
            stroke="#facc15"
            strokeWidth="1.4"
          />
          {/* Neck collar label */}
          <rect x="-11" y="-88" width="22" height="8" fill="#fef3c7" stroke="#92400e" strokeWidth="0.9" />
          {/* Bottle body & rounded shoulders */}
          <path
            d="M -11 -72
               C -26 -64, -34 -48, -34 -28
               L -34 78
               A 12 12 0 0 0 -22 90
               L 22 90
               A 12 12 0 0 0 34 78
               L 34 -28
               C 34 -48, 26 -64, 11 -72 Z"
            fill={`url(#${toniGlassId})`}
            stroke="#1f0b02"
            strokeWidth="2.2"
          />
          {/* Glass specular highlight along left side */}
          <path
            d="M -24 -38 L -24 74"
            stroke="rgba(254, 243, 199, 0.34)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Vintage Toni Lourenço paper label */}
          <rect
            x="-30"
            y="-22"
            width="60"
            height="76"
            rx="4"
            fill="#fffbeb"
            stroke="#b45309"
            strokeWidth="2"
          />
          <rect
            x="-26"
            y="-18"
            width="52"
            height="68"
            rx="2"
            fill="none"
            stroke="#dc2626"
            strokeWidth="1.2"
          />
          {/* Ornate red banner crest */}
          <rect x="-22" y="-11" width="44" height="14" rx="2" fill="#b91c1c" />
          <text
            x="0"
            y="-1"
            textAnchor="middle"
            fill="#fef08a"
            fontSize="9.5"
            fontWeight="900"
            letterSpacing="0.8"
            fontFamily="Cinzel, Georgia, serif"
          >
            TONI
          </text>
          <text
            x="0"
            y="16"
            textAnchor="middle"
            fill="#7f1d1d"
            fontSize="8.8"
            fontWeight="900"
            letterSpacing="0.3"
            fontFamily="Cinzel, Georgia, serif"
          >
            LOURENÇO
          </text>
          <line x1="-18" y1="23" x2="18" y2="23" stroke="#d97706" strokeWidth="1.2" />
          <text
            x="0"
            y="34"
            textAnchor="middle"
            fill="#451a03"
            fontSize="6.2"
            fontWeight="800"
            letterSpacing="0.6"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            CACHAÇA DE MINAS
          </text>
          <text
            x="0"
            y="44"
            textAnchor="middle"
            fill="#92400e"
            fontSize="5.6"
            fontWeight="700"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
             SAFRA ESPECIAL
          </text>
        </g>

        {/* 3B. Garrafa de Fofinha (next to Toni Lourenço on the right table border) */}
        <g transform="translate(1796, 258) rotate(12)">
          {/* Bottle drop shadow */}
          <rect
            x="-32"
            y="-74"
            width="68"
            height="168"
            rx="16"
            fill="rgba(12, 5, 1, 0.56)"
            transform="translate(8, 12)"
          />
          {/* Bottle neck */}
          <rect
            x="-10"
            y="-102"
            width="20"
            height="36"
            rx="4"
            fill="rgba(254, 249, 195, 0.42)"
            stroke="#713f12"
            strokeWidth="1.6"
          />
          {/* Classic yellow/red screw cap */}
          <rect
            x="-12"
            y="-112"
            width="24"
            height="12"
            rx="3"
            fill="#eab308"
            stroke="#991b1b"
            strokeWidth="1.4"
          />
          {/* Clear glass bottle filled with golden Fofinha cachaça */}
          <path
            d="M -10 -68
               C -24 -60, -32 -44, -32 -25
               L -32 74
               A 12 12 0 0 0 -20 86
               L 20 86
               A 12 12 0 0 0 32 74
               L 32 -25
               C 32 -44, 24 -60, 10 -68 Z"
            fill={`url(#${fofinhaGlassId})`}
            stroke="#451a03"
            strokeWidth="2"
          />
          {/* Glass highlight */}
          <path
            d="M -22 -34 L -22 68"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          {/* Iconic Fofinha label */}
          <rect
            x="-28"
            y="-18"
            width="56"
            height="68"
            rx="5"
            fill="#dc2626"
            stroke="#fef08a"
            strokeWidth="2"
          />
          <ellipse cx="0" cy="4" rx="23" ry="16" fill="#facc15" stroke="#7f1d1d" strokeWidth="1.2" />
          <text
            x="0"
            y="8"
            textAnchor="middle"
            fill="#991b1b"
            fontSize="9.8"
            fontWeight="900"
            letterSpacing="0.4"
            fontFamily="Cinzel, Georgia, serif"
          >
            FOFINHA
          </text>
          <text
            x="0"
            y="32"
            textAnchor="middle"
            fill="#fef9c3"
            fontSize="6.2"
            fontWeight="800"
            letterSpacing="0.5"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            A RAINHA DA PRAÇA
          </text>
          <text
            x="0"
            y="43"
            textAnchor="middle"
            fill="#fde047"
            fontSize="5.6"
            fontWeight="700"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            VIÇOSA • MG
          </text>
        </g>

        {/* Small cachaça shot glass ("copinho de dose") beside Toni Lourenço & Fofinha */}
        <g transform="translate(1726, 366)">
          <ellipse cx="4" cy="6" rx="22" ry="20" fill="rgba(12, 5, 1, 0.5)" />
          <circle
            cx="0"
            cy="0"
            r="20"
            fill="rgba(255, 255, 255, 0.24)"
            stroke="rgba(255, 255, 255, 0.65)"
            strokeWidth="2.2"
          />
          <circle cx="0" cy="0" r="14" fill="#eab308" opacity="0.88" />
          <path d="M-8 -6 A10 10 0 0 1 8 -6" stroke="#fef9c3" strokeWidth="2" fill="none" />
        </g>

        {/* ================================================================ */}
        {/* 4. LEFT BLACK GAME BOX HALF (3D Sloped Walls + Darker Floor)     */}
        {/*    No text inside, per user request                              */}
        {/* ================================================================ */}
        <g transform="translate(278, 468) rotate(-4)">
          {/* Heavy drop shadow on wood */}
          <rect
            x="-134"
            y="-182"
            width="268"
            height="364"
            rx="8"
            fill="rgba(8, 3, 0, 0.68)"
            transform="translate(12, 16)"
          />

          {/* Outer cardboard rim frame */}
          <rect
            x="-134"
            y="-182"
            width="268"
            height="364"
            rx="5"
            fill="#272830"
            stroke="#3a3b45"
            strokeWidth="2.5"
          />

          {/* 4 Sloped 3D Inner Side Walls (lighter than the bottom floor for realistic depth) */}
          {/* Top sloped inner wall */}
          <polygon
            points="-130,-178 130,-178 96,-142 -96,-142"
            fill="#23242b"
          />
          {/* Right sloped inner wall (illuminated by central table light) */}
          <polygon
            points="130,-178 130,178 96,142 96,-142"
            fill="#32343e"
          />
          {/* Bottom sloped inner wall */}
          <polygon
            points="-96,142 96,142 130,178 -130,178"
            fill="#1c1d23"
          />
          {/* Left sloped inner wall */}
          <polygon
            points="-130,-178 -96,-142 -96,142 -130,178"
            fill="#282932"
          />

          {/* Deep Recessed Bottom Floor (noticeably darker than the 4 inner walls) */}
          <rect
            x="-96"
            y="-142"
            width="192"
            height="284"
            rx="2"
            fill={`url(#${boxFloorLeftId})`}
          />
          {/* Ambient occlusion shadow where the 4 sloped walls meet the recessed floor */}
          <rect
            x="-96"
            y="-142"
            width="192"
            height="284"
            fill="none"
            stroke="rgba(0, 0, 0, 0.85)"
            strokeWidth="7"
          />
          <rect
            x="-96"
            y="-142"
            width="192"
            height="284"
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="1.2"
          />

          {/* 3D Corner Fold Crease Lines connecting outer rim to recessed floor */}
          <line x1="-130" y1="-178" x2="-96" y2="-142" stroke="#111115" strokeWidth="2.2" />
          <line x1="130" y1="-178" x2="96" y2="-142" stroke="#464854" strokeWidth="1.8" />
          <line x1="-130" y1="178" x2="-96" y2="142" stroke="#111115" strokeWidth="2.2" />
          <line x1="130" y1="178" x2="96" y2="142" stroke="#3d3f4a" strokeWidth="1.8" />

          {/* Worn/scuffed white cardboard corners & edges (exact detail from photos 5.jpeg & 11.jpeg) */}
          <path
            d="M-134 -150 L-134 -180 L-102 -182 M102 -182 L134 -180 L134 -148 M-134 150 L-134 182 L-100 182 M100 182 L134 182 L134 148"
            stroke="#d1d5db"
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.76"
          />
          <path
            d="M-68 -182 L-16 -182 M42 182 L90 182 M-134 -44 L-134 20 M134 -28 L134 36"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="12 6 4 8"
            fill="none"
            opacity="0.5"
          />
        </g>

        {/* ================================================================ */}
        {/* 5. RIGHT BLACK GAME BOX HALF (3D Sloped Walls + Darker Floor)    */}
        {/*    Positioned on the right side for rolling the dice inside      */}
        {/* ================================================================ */}
        <g transform="translate(1640, 616) rotate(3)">
          {/* Heavy drop shadow on wood */}
          <rect
            x="-138"
            y="-174"
            width="276"
            height="348"
            rx="8"
            fill="rgba(8, 3, 0, 0.68)"
            transform="translate(12, 16)"
          />

          {/* Outer cardboard rim frame */}
          <rect
            x="-138"
            y="-174"
            width="276"
            height="348"
            rx="5"
            fill="#272830"
            stroke="#3a3b45"
            strokeWidth="2.5"
          />

          {/* 4 Sloped 3D Inner Side Walls (lighter than the bottom floor) */}
          {/* Top sloped inner wall */}
          <polygon
            points="-134,-170 134,-170 100,-134 -100,-134"
            fill="#24252c"
          />
          {/* Left sloped inner wall (illuminated by central table light) */}
          <polygon
            points="-134,-170 -100,-134 -100,134 -134,170"
            fill="#333540"
          />
          {/* Right sloped inner wall */}
          <polygon
            points="134,-170 134,170 100,134 100,-134"
            fill="#26272f"
          />
          {/* Bottom sloped inner wall */}
          <polygon
            points="-100,134 100,134 134,170 -134,170"
            fill="#1c1d23"
          />

          {/* Deep Recessed Bottom Floor (darker than the inner walls) */}
          <rect
            x="-100"
            y="-134"
            width="200"
            height="268"
            rx="2"
            fill={`url(#${boxFloorRightId})`}
          />
          {/* Ambient occlusion shadow along floor perimeter */}
          <rect
            x="-100"
            y="-134"
            width="200"
            height="268"
            fill="none"
            stroke="rgba(0, 0, 0, 0.85)"
            strokeWidth="7"
          />
          <rect
            x="-100"
            y="-134"
            width="200"
            height="268"
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="1.2"
          />

          {/* 3D Corner Fold Crease Lines */}
          <line x1="-134" y1="-170" x2="-100" y2="-134" stroke="#464854" strokeWidth="1.8" />
          <line x1="134" y1="-170" x2="100" y2="-134" stroke="#111115" strokeWidth="2.2" />
          <line x1="-134" y1="170" x2="-100" y2="134" stroke="#3d3f4a" strokeWidth="1.8" />
          <line x1="134" y1="170" x2="100" y2="134" stroke="#111115" strokeWidth="2.2" />

          {/* Worn/scuffed white cardboard corners & edges */}
          <path
            d="M-138 -142 L-138 -172 L-106 -174 M106 -174 L138 -172 L138 -140 M-138 142 L-138 174 L-104 174 M104 174 L138 174 L138 140"
            stroke="#d1d5db"
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.76"
          />
          <path
            d="M-58 -174 L14 -174 M-84 174 L-22 174 M138 -46 L138 26"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="14 6 5 9"
            fill="none"
            opacity="0.48"
          />
        </g>

        {/* ================================================================ */}
        {/* 6. GIANT BAMBOO ASHTRAY ("CINZEIRO DE BAMBU GIGANTE")            */}
        {/* ================================================================ */}
        <g transform="translate(392, 868)">
          {/* Warm ambient shadow on the wood table */}
          <ellipse cx="8" cy="44" rx="94" ry="39" fill="rgba(12, 5, 1, 0.65)" />

          {/* Protruding bottom bamboo node ring */}
          <ellipse
            cx="0"
            cy="34"
            rx="82"
            ry="28"
            fill="#6b5a32"
            stroke="#42361b"
            strokeWidth="2.2"
          />
          <ellipse
            cx="0"
            cy="29"
            rx="79"
            ry="25"
            fill="#8c7847"
            stroke="#564726"
            strokeWidth="1.5"
          />

          {/* Cylindrical giant bamboo body wall */}
          <path
            d="M-74 -22 L-76 26 A76 24 0 0 0 76 26 L74 -22 Z"
            fill={`url(#${bambooBodyId})`}
            stroke="#4a3c1f"
            strokeWidth="2"
          />

          {/* Natural vertical bamboo fiber striations */}
          <g stroke="#574726" strokeWidth="1.1" opacity="0.48">
            <line x1="-54" y1="-16" x2="-55" y2="28" />
            <line x1="-36" y1="-14" x2="-36" y2="32" />
            <line x1="-18" y1="-12" x2="-18" y2="34" />
            <line x1="19" y1="-12" x2="19" y2="34" />
            <line x1="38" y1="-14" x2="39" y2="32" />
            <line x1="56" y1="-16" x2="57" y2="28" />
          </g>

          {/* Carved Sun Emblem on the front of the bamboo ashtray */}
          <g transform="translate(0, 12)" opacity="0.78">
            <circle
              cx="0"
              cy="0"
              r="10"
              fill="none"
              stroke="#4a3919"
              strokeWidth="2"
            />
            <circle cx="0" cy="0" r="4" fill="#4a3919" />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
              (deg) => (
                <line
                  key={deg}
                  x1="0"
                  y1="-11"
                  x2="0"
                  y2="-16"
                  stroke="#4a3919"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  transform={`rotate(${deg})`}
                />
              )
            )}
          </g>

          {/* Thick woody top rim of the giant bamboo */}
          <ellipse
            cx="0"
            cy="-22"
            rx="74"
            ry="24"
            fill="#c7b682"
            stroke="#4a3c1f"
            strokeWidth="2.2"
          />
          {/* Inner dark ash cavity */}
          <ellipse
            cx="0"
            cy="-22"
            rx="61"
            ry="18.5"
            fill={`url(#${bambooCavityId})`}
            stroke="#29231d"
            strokeWidth="2"
          />

          {/* Ash piles & extinguished palheiro butt inside the bamboo cavity */}
          <ellipse cx="-12" cy="-20" rx="26" ry="8" fill="#4b5563" opacity="0.55" />
          <ellipse cx="14" cy="-23" rx="18" ry="6" fill="#6b7280" opacity="0.48" />
          <circle cx="-18" cy="-22" r="2.2" fill="#9ca3af" opacity="0.7" />
          <circle cx="6" cy="-19" r="1.8" fill="#d1d5db" opacity="0.65" />
          <circle cx="22" cy="-24" r="2" fill="#9ca3af" opacity="0.6" />
          <g transform="translate(-18, -23) rotate(22)">
            <rect x="-14" y="-2.5" width="24" height="5" rx="2" fill="#d6c79c" />
            <line x1="-2" y1="-2.5" x2="-2" y2="2.5" stroke="#dc2626" strokeWidth="1.6" />
            <rect x="8" y="-2.5" width="5" height="5" rx="1" fill="#1f2937" />
          </g>

          {/* Lit Coyote Straw Cigarette (Palheiro) resting on the right rim */}
          <g transform="translate(46, -28) rotate(-16)">
            <rect x="-34" y="1" width="68" height="7" rx="3" fill="rgba(0,0,0,0.45)" />
            <rect
              x="-34"
              y="-3.5"
              width="64"
              height="7"
              rx="3"
              fill="#f3e5ab"
              stroke="#bca36b"
              strokeWidth="1"
            />
            <rect x="-2" y="-4" width="3.2" height="8" rx="1" fill="#dc2626" />
            <rect x="-38" y="-3.5" width="6" height="7" rx="1.5" fill="#9ca3af" />
            <circle
              cx="-38"
              cy="0"
              r="7"
              fill={`url(#${emberGlowId})`}
              className="ocean-panorama-backdrop__ember-pulse"
            />
            <circle cx="-37" cy="0" r="2.6" fill="#fef08a" />
          </g>

          {/* Animated curling smoke wisps rising from the lit Coyote palheiro */}
          <g className="ocean-panorama-backdrop__smoke-plume" transform="translate(10, -38)">
            <path
              className="ocean-panorama-backdrop__smoke-wisp ocean-panorama-backdrop__smoke-wisp--1"
              d="M0 0 C-14 -26, 16 -52, -6 -82 C-24 -108, 12 -136, -4 -168"
              stroke="rgba(226, 232, 240, 0.34)"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              className="ocean-panorama-backdrop__smoke-wisp ocean-panorama-backdrop__smoke-wisp--2"
              d="M6 -6 C22 -34, -12 -64, 10 -96 C26 -122, -8 -150, 8 -182"
              stroke="rgba(203, 213, 225, 0.24)"
              strokeWidth="6.5"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        </g>

        {/* ================================================================ */}
        {/* 7. RED "COYOTE" PACK + LOOSE PALHEIROS + WHITE BIC LIGHTER       */}
        {/* ================================================================ */}
        <g transform="translate(212, 902) rotate(14)">
          <rect
            x="-46"
            y="-68"
            width="92"
            height="136"
            rx="6"
            fill="rgba(12, 5, 1, 0.6)"
            transform="translate(6, 9)"
          />
          <rect
            x="-46"
            y="-68"
            width="92"
            height="136"
            rx="5"
            fill="#b91c1c"
            stroke="#7f1d1d"
            strokeWidth="2"
          />
          <rect x="-42" y="-64" width="84" height="92" rx="3" fill="#dc2626" />
          <path d="M-44 -34 L44 -34" stroke="#7f1d1d" strokeWidth="1.8" opacity="0.85" />

          <text
            x="0"
            y="-44"
            textAnchor="middle"
            fill="#facc15"
            stroke="#450a0a"
            strokeWidth="0.8"
            fontSize="16.5"
            fontWeight="900"
            letterSpacing="1.5"
            fontFamily="Cinzel, Georgia, serif"
          >
            COYOTE
          </text>

          <circle cx="0" cy="-8" r="19" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
          <polygon points="-16,10 -4,-1 10,10" fill="#1c1917" />
          <path
            d="M-6 2 L-3 -9 L1 -14 L5 -19 L7 -16 L4 -11 L6 -3 L2 4 L-6 4 Z"
            fill="#09090b"
          />

          <text
            x="0"
            y="21"
            textAnchor="middle"
            fill="#fef2f2"
            fontSize="6.5"
            fontWeight="700"
            letterSpacing="0.6"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            PRODUTO ARTESANAL
          </text>

          <rect
            x="-43"
            y="28"
            width="86"
            height="36"
            rx="2"
            fill="#facc15"
            stroke="#1c1917"
            strokeWidth="1.2"
          />
          <text
            x="0"
            y="41"
            textAnchor="middle"
            fill="#09090b"
            fontSize="6.8"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
          >
            ESTE PRODUTO
          </text>
          <text
            x="0"
            y="50"
            textAnchor="middle"
            fill="#09090b"
            fontSize="6.8"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
          >
            CAUSA CÂNCER
          </text>
          <text
            x="0"
            y="60"
            textAnchor="middle"
            fill="#1c1917"
            fontSize="5.8"
            fontWeight="800"
            fontFamily="Arial, sans-serif"
          >
            PARE DE FUMAR • 136
          </text>
        </g>

        {/* Two loose Coyote straw cigarettes (palheiros) with red rubber band */}
        <g transform="translate(296, 956) rotate(-28)">
          <rect x="-32" y="2" width="64" height="6.5" rx="3" fill="rgba(0,0,0,0.42)" />
          <rect
            x="-32"
            y="-3"
            width="64"
            height="6.5"
            rx="2.8"
            fill="#f5e6b3"
            stroke="#c4ab72"
            strokeWidth="0.9"
          />
          <rect x="-1.5" y="-3.4" width="3" height="7.3" rx="0.8" fill="#dc2626" />
        </g>
        <g transform="translate(312, 974) rotate(-8)">
          <rect x="-32" y="2" width="64" height="6.5" rx="3" fill="rgba(0,0,0,0.42)" />
          <rect
            x="-32"
            y="-3"
            width="64"
            height="6.5"
            rx="2.8"
            fill="#efe0ac"
            stroke="#bfa56a"
            strokeWidth="0.9"
          />
          <rect x="-1.5" y="-3.4" width="3" height="7.3" rx="0.8" fill="#dc2626" />
        </g>

        {/* White Bic Lighter with Red Button & Silver Hood */}
        <g transform="translate(286, 804) rotate(-36)">
          <rect x="-13" y="-34" width="28" height="70" rx="12" fill="rgba(0,0,0,0.48)" transform="translate(4, 6)" />
          <rect
            x="-13"
            y="-22"
            width="26"
            height="56"
            rx="11"
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          <rect
            x="-9"
            y="-35"
            width="12"
            height="15"
            rx="3"
            fill="#94a3b8"
            stroke="#475569"
            strokeWidth="1.2"
          />
          <rect
            x="2"
            y="-30"
            width="9"
            height="9"
            rx="2.5"
            fill="#dc2626"
            stroke="#991b1b"
            strokeWidth="1"
          />
        </g>

        {/* ================================================================ */}
        {/* 8. COLD BEER GLASSES ("COPO LAGOINHA / AMERICANO")               */}
        {/* ================================================================ */}
        <g transform="translate(456, 224)">
          <circle cx="0" cy="6" r="46" fill="none" stroke="rgba(254, 243, 199, 0.25)" strokeWidth="2.5" strokeDasharray="58 14 76 18" />
          <ellipse cx="6" cy="10" rx="42" ry="38" fill="rgba(12, 5, 1, 0.55)" />
          <circle cx="0" cy="0" r="39" fill="rgba(255, 255, 255, 0.18)" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="2.5" />
          <circle cx="0" cy="0" r="33" fill={`url(#${beerLiquidId})`} />
          <path
            d="M-24 -16 C-12 -28, 16 -28, 26 -12 C32 -2, 22 18, 6 22 C-14 26, -30 8, -24 -16 Z"
            fill="#fffbeb"
            opacity="0.92"
          />
          <circle cx="-8" cy="-6" r="4" fill="#fef3c7" />
          <circle cx="8" cy="-10" r="3" fill="#fef3c7" />
          <circle cx="4" cy="6" r="3.5" fill="#fef3c7" />
          <circle cx="-14" cy="8" r="2.2" fill="#ffffff" />
        </g>

        <g transform="translate(1548, 924)">
          <circle cx="0" cy="4" r="44" fill="none" stroke="rgba(254, 243, 199, 0.22)" strokeWidth="2.2" strokeDasharray="64 16 48 14" />
          <ellipse cx="6" cy="10" rx="40" ry="36" fill="rgba(12, 5, 1, 0.55)" />
          <circle cx="0" cy="0" r="37" fill="rgba(255, 255, 255, 0.18)" stroke="rgba(255, 255, 255, 0.52)" strokeWidth="2.4" />
          <circle cx="0" cy="0" r="31" fill={`url(#${beerLiquidId})`} />
          <path
            d="M-22 -14 C-10 -25, 14 -25, 24 -10 C28 0, 18 16, 4 20 C-12 24, -26 6, -22 -14 Z"
            fill="#fffbeb"
            opacity="0.9"
          />
          <circle cx="-6" cy="-4" r="3.5" fill="#fef3c7" />
          <circle cx="7" cy="-8" r="2.8" fill="#fef3c7" />
          <circle cx="2" cy="5" r="3" fill="#fef3c7" />
        </g>
      </svg>
    </div>
  );
}
