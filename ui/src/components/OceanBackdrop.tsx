import { useId } from "react";
import "./OceanBackdrop.scss";

/**
 * Edição República "A Praça é Nossa" (Viçosa-MG):
 * Full-bleed varnished honey-amber wooden tabletop scene inspired by the
 * real photos from the student house:
 * - Warm varnished wood planks with knots, cup condensation rings & ember burn marks
 * - Two matte-black board game box halves (Grow style with scuffed white cardboard corners),
 *   one on each side of the Catan island (used to roll the dice inside)
 * - The iconic Giant Bamboo Ashtray ("cinzeiro de bambu gigante") with bottom node ring,
 *   carved sun emblem on the front, dark ash cavity, and a lit Coyote straw cigarette with rising smoke
 * - Red COYOTE Artisanal Straw Cigarette pack (yellow moon + howling coyote + yellow warning bar),
 *   loose palheiros with the classic red rubber band ("liguinha vermelha"), and a white/red Bic lighter
 * - Cold beer glasses (copo lagoinha/americano) on the table
 */
export default function OceanBackdrop() {
  const uid = useId().replace(/:/g, "");

  const woodBaseId = `rep-wood-base-${uid}`;
  const woodLampGlowId = `rep-wood-glow-${uid}`;
  const woodVignetteId = `rep-wood-vig-${uid}`;
  const boxInnerId = `rep-box-inner-${uid}`;
  const bambooBodyId = `rep-bamboo-body-${uid}`;
  const bambooCavityId = `rep-bamboo-cavity-${uid}`;
  const beerLiquidId = `rep-beer-liquid-${uid}`;
  const emberGlowId = `rep-ember-glow-${uid}`;

  return (
    <div
      className="ocean-panorama-backdrop ocean-panorama-backdrop--republica-table"
      aria-hidden="true"
    >
      <svg
        className="ocean-panorama-backdrop__svg"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Honey-amber varnished wooden table base (matching photos 1.jpeg, 7.jpeg, 8.jpeg) */}
          <linearGradient id={woodBaseId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6e380b" />
            <stop offset="16%" stopColor="#8f4c14" />
            <stop offset="36%" stopColor="#b36822" />
            <stop offset="52%" stopColor="#c4762b" />
            <stop offset="68%" stopColor="#a95f1d" />
            <stop offset="86%" stopColor="#854510" />
            <stop offset="100%" stopColor="#5a2b07" />
          </linearGradient>

          {/* Overhead dining table warm bulb reflection */}
          <radialGradient id={woodLampGlowId} cx="50%" cy="48%" r="54%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.34" />
            <stop offset="38%" stopColor="#d97706" stopOpacity="0.16" />
            <stop offset="72%" stopColor="#78350f" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#1c0d04" stopOpacity="0" />
          </radialGradient>

          {/* Outer room night vignette */}
          <radialGradient id={woodVignetteId} cx="50%" cy="50%" r="68%">
            <stop offset="52%" stopColor="#000000" stopOpacity="0" />
            <stop offset="84%" stopColor="#1a0b03" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#0c0501" stopOpacity="0.78" />
          </radialGradient>

          {/* Matte black board game box interior */}
          <linearGradient id={boxInnerId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#141417" />
            <stop offset="50%" stopColor="#202127" />
            <stop offset="100%" stopColor="#101114" />
          </linearGradient>

          {/* Giant dried bamboo cylinder gradient (matching Cinzeiro de bambu.png) */}
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
        </defs>

        {/* ================================================================ */}
        {/* 1. HONEY-AMBER VARNISHED WOODEN TABLE PLANK SURFACE              */}
        {/* ================================================================ */}
        <rect width="1600" height="900" fill={`url(#${woodBaseId})`} />

        {/* Alternating warm wood plank tonal bands */}
        <rect x="0" y="0" width="1600" height="148" fill="#5e2e08" opacity="0.22" />
        <rect x="0" y="148" width="1600" height="156" fill="#d9822b" opacity="0.08" />
        <rect x="0" y="304" width="1600" height="162" fill="#78390b" opacity="0.12" />
        <rect x="0" y="466" width="1600" height="154" fill="#e08e36" opacity="0.09" />
        <rect x="0" y="620" width="1600" height="152" fill="#6b3309" opacity="0.16" />
        <rect x="0" y="772" width="1600" height="128" fill="#472004" opacity="0.28" />

        {/* Horizontal plank grooves (table seams) */}
        {[148, 304, 466, 620, 772].map((y) => (
          <g key={y}>
            <line
              x1="0"
              y1={y}
              x2="1600"
              y2={y}
              stroke="#361804"
              strokeWidth="2.6"
              opacity="0.72"
            />
            <line
              x1="0"
              y1={y + 2}
              x2="1600"
              y2={y + 2}
              stroke="#eab308"
              strokeWidth="1"
              opacity="0.16"
            />
          </g>
        ))}

        {/* Vertical board-end join lines on planks */}
        <line x1="420" y1="0" x2="412" y2="148" stroke="#3b1a04" strokeWidth="2" opacity="0.52" />
        <line x1="1190" y1="148" x2="1198" y2="304" stroke="#3b1a04" strokeWidth="2" opacity="0.5" />
        <line x1="310" y1="466" x2="304" y2="620" stroke="#3b1a04" strokeWidth="2" opacity="0.48" />
        <line x1="1270" y1="620" x2="1276" y2="772" stroke="#3b1a04" strokeWidth="2" opacity="0.52" />

        {/* Organic wood grain cathedral curves & knots */}
        <g stroke="#4a2206" fill="none" opacity="0.28">
          <path d="M-20 72 Q380 48 820 78 T1620 68" strokeWidth="1.8" />
          <path d="M-20 112 Q440 134 910 102 T1620 118" strokeWidth="1.4" />
          <path d="M-20 196 Q290 170 640 202 T1280 184 T1620 205" strokeWidth="1.9" />
          <path d="M-20 256 Q510 282 980 246 T1620 264" strokeWidth="1.5" />
          <path d="M-20 356 Q340 330 760 364 T1620 348" strokeWidth="2.1" />
          <path d="M-20 418 Q520 442 1040 408 T1620 426" strokeWidth="1.6" />
          <path d="M-20 518 Q410 492 840 526 T1620 512" strokeWidth="2.0" />
          <path d="M-20 578 Q580 598 1120 566 T1620 584" strokeWidth="1.5" />
          <path d="M-20 668 Q360 646 790 676 T1620 662" strokeWidth="1.9" />
          <path d="M-20 726 Q490 748 1020 718 T1620 732" strokeWidth="1.5" />
          <path d="M-20 828 Q460 806 940 834 T1620 820" strokeWidth="2.1" />

          {/* Wood knots */}
          <ellipse cx="248" cy="228" rx="28" ry="9" strokeWidth="2" />
          <ellipse cx="248" cy="228" rx="14" ry="4.5" strokeWidth="1.5" fill="#4a2206" opacity="0.45" />
          <ellipse cx="1352" cy="542" rx="32" ry="10" strokeWidth="2" />
          <ellipse cx="1352" cy="542" rx="15" ry="4.5" strokeWidth="1.5" fill="#4a2206" opacity="0.45" />
          <ellipse cx="520" cy="696" rx="24" ry="8" strokeWidth="1.8" />
        </g>

        {/* Varnish specular glow & cup water stain rings + cigarette ember scars (from real table photos) */}
        <rect width="1600" height="900" fill={`url(#${woodLampGlowId})`} />
        <g opacity="0.24" fill="none">
          {/* Old beer cup condensation rings */}
          <circle cx="388" cy="364" r="36" stroke="#fde68a" strokeWidth="2.2" strokeDasharray="48 14 82 18" />
          <circle cx="1186" cy="284" r="34" stroke="#fde68a" strokeWidth="1.8" strokeDasharray="60 18 44 12" />
          <circle cx="432" cy="688" r="38" stroke="#3b1a04" strokeWidth="2.5" strokeDasharray="72 16 54 20" />
          {/* Tiny black palheiro ember burn dots on the table varnish */}
          <ellipse cx="354" cy="498" rx="4.5" ry="2.8" fill="#1c0d04" opacity="0.85" transform="rotate(-18 354 498)" />
          <ellipse cx="366" cy="512" rx="3.2" ry="2.1" fill="#1c0d04" opacity="0.75" transform="rotate(12 366 512)" />
          <ellipse cx="1168" cy="628" rx="4" ry="2.4" fill="#1c0d04" opacity="0.8" transform="rotate(-28 1168 628)" />
        </g>

        {/* Central warm shadow where the Catan board rests on the wooden table */}
        <ellipse
          cx="800"
          cy="455"
          rx="315"
          ry="295"
          fill="#241003"
          opacity="0.42"
        />

        {/* ================================================================ */}
        {/* 2. LEFT BLACK GAME BOX HALF (Grow style with scuffed corners)    */}
        {/* ================================================================ */}
        <g transform="translate(172, 378) rotate(-5)">
          {/* Drop shadow on wood */}
          <rect
            x="-126"
            y="-172"
            width="256"
            height="348"
            rx="8"
            fill="rgba(12, 5, 1, 0.62)"
            transform="translate(10, 14)"
          />
          {/* Outer matte black cardboard wall */}
          <rect
            x="-126"
            y="-172"
            width="256"
            height="348"
            rx="6"
            fill="#17171b"
            stroke="#2f3037"
            strokeWidth="2.5"
          />
          {/* Worn/scuffed white cardboard corners & edges (exact detail from photos 5.jpeg & 11.jpeg) */}
          <path
            d="M-126 -144 L-126 -170 L-98 -172 M102 -172 L130 -170 L130 -142 M-126 146 L-126 176 L-96 176 M100 176 L130 176 L130 144"
            stroke="#d1d5db"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.72"
          />
          <path
            d="M-65 -172 L-18 -172 M42 176 L88 176 M-126 -40 L-126 18 M130 -25 L130 35"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="12 6 4 8"
            fill="none"
            opacity="0.48"
          />
          {/* Inner recessed black cardboard tray cavity */}
          <rect
            x="-112"
            y="-158"
            width="228"
            height="320"
            rx="4"
            fill={`url(#${boxInnerId})`}
            stroke="#09090b"
            strokeWidth="3"
          />
          {/* Inner cardboard wall bevel lines */}
          <line x1="-126" y1="-172" x2="-112" y2="-158" stroke="#9ca3af" strokeWidth="1.5" opacity="0.5" />
          <line x1="130" y1="-172" x2="116" y2="-158" stroke="#9ca3af" strokeWidth="1.5" opacity="0.5" />
          <line x1="-126" y1="176" x2="-112" y2="162" stroke="#9ca3af" strokeWidth="1.5" opacity="0.5" />
          <line x1="130" y1="176" x2="116" y2="162" stroke="#9ca3af" strokeWidth="1.5" opacity="0.5" />

          {/* Subtle Ziploc spare pieces bag & Catan manual corner resting inside left box */}
          <g transform="translate(-26, -68) rotate(8)" opacity="0.82">
            <rect
              x="-52"
              y="-36"
              width="104"
              height="72"
              rx="4"
              fill="rgba(255, 255, 255, 0.07)"
              stroke="rgba(226, 232, 240, 0.24)"
              strokeWidth="1.2"
            />
            <line x1="-48" y1="-26" x2="48" y2="-26" stroke="rgba(248, 113, 113, 0.45)" strokeWidth="1.5" />
            {/* Spare wooden settlements/roads inside plastic baggie */}
            <rect x="-24" y="-8" width="14" height="6" rx="1.5" fill="#dc2626" transform="rotate(18 -17 -5)" />
            <rect x="4" y="6" width="14" height="6" rx="1.5" fill="#2563eb" transform="rotate(-22 11 9)" />
            <rect x="-8" y="12" width="14" height="6" rx="1.5" fill="#ea580c" transform="rotate(9 -1 15)" />
            <polygon points="18,-12 25,-18 32,-12 32,-2 18,-2" fill="#f8fafc" opacity="0.85" />
          </g>

          {/* Subtle República stamp inside the box floor */}
          <text
            x="2"
            y="112"
            textAnchor="middle"
            fill="rgba(229, 231, 235, 0.22)"
            fontSize="10.5"
            fontWeight="800"
            letterSpacing="2.5"
            fontFamily="Cinzel, serif"
          >
            A PRAÇA É NOSSA
          </text>
          <text
            x="2"
            y="128"
            textAnchor="middle"
            fill="rgba(250, 204, 21, 0.18)"
            fontSize="8.5"
            fontWeight="700"
            letterSpacing="1.8"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            CAIXA DE DADOS • VIÇOSA-MG
          </text>
        </g>

        {/* ================================================================ */}
        {/* 3. RIGHT BLACK GAME BOX HALF (Dice Rolling Tray on Right Side)   */}
        {/* ================================================================ */}
        <g transform="translate(1418, 446) rotate(3)">
          {/* Drop shadow on wood */}
          <rect
            x="-134"
            y="-164"
            width="268"
            height="328"
            rx="8"
            fill="rgba(12, 5, 1, 0.64)"
            transform="translate(10, 14)"
          />
          {/* Outer matte black cardboard wall */}
          <rect
            x="-134"
            y="-164"
            width="268"
            height="328"
            rx="6"
            fill="#17171b"
            stroke="#2f3037"
            strokeWidth="2.5"
          />
          {/* Worn/scuffed white cardboard corners & edges */}
          <path
            d="M-134 -134 L-134 -162 L-104 -164 M104 -164 L134 -162 L134 -132 M-134 134 L-134 164 L-102 164 M102 164 L134 164 L134 134"
            stroke="#d1d5db"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.74"
          />
          <path
            d="M-54 -164 L12 -164 M-82 164 L-24 164 M134 -44 L134 24"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="14 6 5 9"
            fill="none"
            opacity="0.46"
          />
          {/* Inner recessed black cardboard tray cavity where dice roll */}
          <rect
            x="-118"
            y="-148"
            width="236"
            height="296"
            rx="4"
            fill={`url(#${boxInnerId})`}
            stroke="#09090b"
            strokeWidth="3"
          />
          {/* Corner crease lines */}
          <line x1="-134" y1="-164" x2="-118" y2="-148" stroke="#9ca3af" strokeWidth="1.5" opacity="0.5" />
          <line x1="134" y1="-164" x2="118" y2="-148" stroke="#9ca3af" strokeWidth="1.5" opacity="0.5" />
          <line x1="-134" y1="164" x2="-118" y2="148" stroke="#9ca3af" strokeWidth="1.5" opacity="0.5" />
          <line x1="134" y1="164" x2="118" y2="148" stroke="#9ca3af" strokeWidth="1.5" opacity="0.5" />

          {/* Subtle Grow-style triangular corner scuff & dice tray watermark */}
          <text
            x="0"
            y="124"
            textAnchor="middle"
            fill="rgba(229, 231, 235, 0.2)"
            fontSize="9.5"
            fontWeight="800"
            letterSpacing="2.2"
            fontFamily="Cinzel, serif"
          >
            TAMPA DOS DADOS
          </text>
        </g>

        {/* ================================================================ */}
        {/* 4. GIANT BAMBOO ASHTRAY ("CINZEIRO DE BAMBU GIGANTE")            */}
        {/*    Modeled after Cinzeiro de bambu.png & 1.jpeg / 3.jpeg         */}
        {/* ================================================================ */}
        <g transform="translate(318, 692)">
          {/* Warm ambient shadow on the wood table */}
          <ellipse cx="8" cy="44" rx="92" ry="38" fill="rgba(12, 5, 1, 0.65)" />

          {/* Protruding bottom bamboo node ring (the thick diaphragm rim at the base) */}
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

          {/* Natural vertical bamboo fiber striations & age cracks */}
          <g stroke="#574726" strokeWidth="1.1" opacity="0.48">
            <line x1="-54" y1="-16" x2="-55" y2="28" />
            <line x1="-36" y1="-14" x2="-36" y2="32" />
            <line x1="-18" y1="-12" x2="-18" y2="34" />
            <line x1="19" y1="-12" x2="19" y2="34" />
            <line x1="38" y1="-14" x2="39" y2="32" />
            <line x1="56" y1="-16" x2="57" y2="28" />
          </g>

          {/* Carved Sun Emblem on the front of the bamboo ashtray (exact detail from Cinzeiro de bambu.png!) */}
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

          {/* Ash piles & extinguished palheiro butts inside the bamboo cavity */}
          <ellipse cx="-12" cy="-20" rx="26" ry="8" fill="#4b5563" opacity="0.55" />
          <ellipse cx="14" cy="-23" rx="18" ry="6" fill="#6b7280" opacity="0.48" />
          <circle cx="-18" cy="-22" r="2.2" fill="#9ca3af" opacity="0.7" />
          <circle cx="6" cy="-19" r="1.8" fill="#d1d5db" opacity="0.65" />
          <circle cx="22" cy="-24" r="2" fill="#9ca3af" opacity="0.6" />
          {/* Extinguished straw cigarette butt inside ashtray */}
          <g transform="translate(-18, -23) rotate(22)">
            <rect x="-14" y="-2.5" width="24" height="5" rx="2" fill="#d6c79c" />
            <line x1="-2" y1="-2.5" x2="-2" y2="2.5" stroke="#dc2626" strokeWidth="1.6" />
            <rect x="8" y="-2.5" width="5" height="5" rx="1" fill="#1f2937" />
          </g>

          {/* Lit Coyote Straw Cigarette (Palheiro) resting on the right rim of the bamboo */}
          <g transform="translate(46, -28) rotate(-16)">
            {/* Shadow on rim */}
            <rect x="-34" y="1" width="68" height="7" rx="3" fill="rgba(0,0,0,0.45)" />
            {/* Corn-husk straw body (palha de milho) */}
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
            {/* Characteristic red rubber band ("liguinha vermelha" do Coyote) */}
            <rect x="-2" y="-4" width="3.2" height="8" rx="1" fill="#dc2626" />
            {/* Glowing ash tip & burning ember pointing into the bamboo cavity */}
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
        {/* 5. RED "COYOTE" PACK + LOOSE PALHEIROS + WHITE BIC LIGHTER       */}
        {/*    Modeled directly after Coyote.jpg & 1.jpeg                    */}
        {/* ================================================================ */}
        <g transform="translate(142, 716) rotate(14)">
          {/* Pack drop shadow */}
          <rect
            x="-46"
            y="-68"
            width="92"
            height="136"
            rx="6"
            fill="rgba(12, 5, 1, 0.6)"
            transform="translate(6, 9)"
          />
          {/* Crimson red Coyote box */}
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
          {/* Inner red gradient sheen */}
          <rect
            x="-42"
            y="-64"
            width="84"
            height="92"
            rx="3"
            fill="#dc2626"
          />
          {/* Flip-top lid seam */}
          <path d="M-44 -34 L44 -34" stroke="#7f1d1d" strokeWidth="1.8" opacity="0.85" />

          {/* Yellow "COYOTE" western title */}
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

          {/* Yellow full moon + howling black coyote silhouette on rock (from Coyote.jpg) */}
          <circle cx="0" cy="-8" r="19" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
          {/* Dark mountain crag */}
          <polygon points="-16,10 -4,-1 10,10" fill="#1c1917" />
          {/* Howling coyote silhouette */}
          <path
            d="M-6 2 L-3 -9 L1 -14 L5 -19 L7 -16 L4 -11 L6 -3 L2 4 L-6 4 Z"
            fill="#09090b"
          />

          {/* "PRODUTO ARTESANAL" & "20 Unidades" */}
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

          {/* Yellow health warning bar at bottom of pack (exact detail from Coyote.jpg) */}
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

        {/* Two loose Coyote straw cigarettes (palheiros) with red rubber band on the wood */}
        <g transform="translate(226, 774) rotate(-28)">
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
          {/* Red rubber band ("liguinha vermelha") */}
          <rect x="-1.5" y="-3.4" width="3" height="7.3" rx="0.8" fill="#dc2626" />
        </g>
        <g transform="translate(242, 792) rotate(-8)">
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
          {/* Red rubber band ("liguinha vermelha") */}
          <rect x="-1.5" y="-3.4" width="3" height="7.3" rx="0.8" fill="#dc2626" />
        </g>

        {/* White Bic Lighter with Red Button & Silver Hood (from photo 1.jpeg) */}
        <g transform="translate(218, 632) rotate(-36)">
          <rect x="-13" y="-34" width="28" height="70" rx="12" fill="rgba(0,0,0,0.48)" transform="translate(4, 6)" />
          {/* White oval Bic body */}
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
          {/* Silver metal wind hood */}
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
          {/* Red thumb Piezo/fork button */}
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
        {/* 6. COLD BEER GLASSES ("COPO LAGOINHA / AMERICANO")               */}
        {/* ================================================================ */}
        {/* Top-left beer glass near player bar */}
        <g transform="translate(362, 196)">
          {/* Wet condensation ring around base */}
          <circle cx="0" cy="6" r="46" fill="none" stroke="rgba(254, 243, 199, 0.25)" strokeWidth="2.5" strokeDasharray="58 14 76 18" />
          <ellipse cx="6" cy="10" rx="42" ry="38" fill="rgba(12, 5, 1, 0.55)" />
          {/* Faceted glass rim (Copo Americano top-down perspective) */}
          <circle cx="0" cy="0" r="39" fill="rgba(255, 255, 255, 0.18)" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="2.5" />
          {/* Golden beer body */}
          <circle cx="0" cy="0" r="33" fill={`url(#${beerLiquidId})`} />
          {/* Creamy white beer foam collar & bubbles */}
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

        {/* Bottom-right beer glass */}
        <g transform="translate(1248, 718)">
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

        {/* Ambient late-night smoky haze & warm table edge vignette */}
        <rect width="1600" height="900" fill={`url(#${woodVignetteId})`} />
      </svg>

      {/* Subtle ambient smoke drift overlay across the república table */}
      <div className="ocean-panorama-backdrop__smoke-haze" />
      <div className="ocean-panorama-backdrop__vignette" />
    </div>
  );
}
