import type { MapTemplate } from "../../utils/apiClient";
import "./MapTemplatePreview.scss";

interface MapTemplatePreviewProps {
  template: MapTemplate;
  compact?: boolean;
}

type HexSpec = {
  q: number;
  r: number;
  fill: string;
  stroke?: string;
  desert?: boolean;
};

const SQRT3 = Math.sqrt(3);

function hexToPoints(cx: number, cy: number, radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    pts.push(
      `${(cx + radius * Math.cos(angle)).toFixed(1)},${(
        cy +
        radius * Math.sin(angle)
      ).toFixed(1)}`
    );
  }
  return pts.join(" ");
}

function axialToPixel(q: number, r: number, size: number): [number, number] {
  const x = size * SQRT3 * (q + r / 2);
  const y = size * 1.5 * r;
  return [x, y];
}

const MINI_HEXES: HexSpec[] = [
  { q: 0, r: 0, fill: "#2e7d32" },
  { q: 1, r: 0, fill: "#e6b800" },
  { q: 0, r: 1, fill: "#b7410e" },
  { q: -1, r: 1, fill: "#7cb342" },
  { q: -1, r: 0, fill: "#5c6bc0" },
  { q: 0, r: -1, fill: "#e6b800" },
  { q: 1, r: -1, fill: "#2e7d32" },
];

const RING2_PALETTE: Array<{ q: number; r: number }> = [
  { q: 0, r: -2 },
  { q: 1, r: -2 },
  { q: 2, r: -2 },
  { q: 2, r: -1 },
  { q: 2, r: 0 },
  { q: 1, r: 1 },
  { q: 0, r: 2 },
  { q: -1, r: 2 },
  { q: -2, r: 2 },
  { q: -2, r: 1 },
  { q: -2, r: 0 },
  { q: -1, r: -1 },
];

const BASE_COLORS = [
  "#2e7d32",
  "#7cb342",
  "#e6b800",
  "#b7410e",
  "#5c6bc0",
  "#7cb342",
  "#2e7d32",
  "#e6b800",
  "#5c6bc0",
  "#b7410e",
  "#7cb342",
  "#2e7d32",
];

const BASE_HEXES: HexSpec[] = [
  { q: 0, r: 0, fill: "#2e7d32" },
  { q: 1, r: 0, fill: "#e6b800" },
  { q: 0, r: 1, fill: "#c2a878", desert: true },
  { q: -1, r: 1, fill: "#b7410e" },
  { q: -1, r: 0, fill: "#5c6bc0" },
  { q: 0, r: -1, fill: "#7cb342" },
  { q: 1, r: -1, fill: "#e6b800" },
  ...RING2_PALETTE.map((pos, idx) => ({
    ...pos,
    fill: BASE_COLORS[idx % BASE_COLORS.length],
  })),
];

const TOURNAMENT_COLORS = [
  "#5c6bc0",
  "#e6b800",
  "#7cb342",
  "#b7410e",
  "#2e7d32",
  "#e6b800",
  "#7cb342",
  "#b7410e",
  "#5c6bc0",
  "#2e7d32",
  "#e6b800",
  "#7cb342",
];

const TOURNAMENT_HEXES: HexSpec[] = [
  { q: 0, r: 0, fill: "#c2a878", desert: true, stroke: "#facc15" },
  { q: 1, r: 0, fill: "#5c6bc0" },
  { q: 0, r: 1, fill: "#2e7d32" },
  { q: -1, r: 1, fill: "#b7410e" },
  { q: -1, r: 0, fill: "#5c6bc0" },
  { q: 0, r: -1, fill: "#7cb342" },
  { q: 1, r: -1, fill: "#e6b800" },
  ...RING2_PALETTE.map((pos, idx) => ({
    ...pos,
    fill: TOURNAMENT_COLORS[idx % TOURNAMENT_COLORS.length],
  })),
];

const PORT_COORDS: Array<[number, number]> = [
  [0, -2.85],
  [2.05, -2.55],
  [2.75, -0.75],
  [2.1, 1.4],
  [0, 2.85],
  [-2.05, 2.55],
  [-2.75, 0.75],
  [-2.1, -1.4],
  [1.05, -2.95],
];

const TEMPLATE_META: Record<
  MapTemplate,
  {
    title: string;
    subtitle: string;
    chips: string[];
    hexSize: number;
    hexes: HexSpec[];
    showPorts: boolean;
  }
> = {
  BASE: {
    title: "Ilha Clássica Sorteada",
    subtitle: "Terrenos e números embaralhados a cada partida.",
    chips: ["19 hexágonos", "9 portos", "Deserto aleatório"],
    hexSize: 8.6,
    hexes: BASE_HEXES,
    showPorts: true,
  },
  MINI: {
    title: "Arquipélago Compacto",
    subtitle: "Disputa direta para sessões rápidas com menos turnos.",
    chips: ["7 hexágonos", "Sem deserto", "Ritmo ágil"],
    hexSize: 12.2,
    hexes: MINI_HEXES,
    showPorts: false,
  },
  TOURNAMENT: {
    title: "Tabuleiro Fixo de Torneio",
    subtitle: "Layout oficial idêntico e balanceado com deserto central.",
    chips: ["19 hexágonos fixos", "Deserto no centro", "9 portos simétricos"],
    hexSize: 8.6,
    hexes: TOURNAMENT_HEXES,
    showPorts: true,
  },
};

export default function MapTemplatePreview({
  template,
  compact = false,
}: MapTemplatePreviewProps) {
  const meta = TEMPLATE_META[template] ?? TEMPLATE_META.BASE;

  return (
    <div
      className={`map-template-preview ${compact ? "is-compact" : ""}`}
      data-testid={`map-preview-${template.toLowerCase()}`}
    >
      <svg
        className="map-template-preview__svg"
        viewBox="0 0 110 96"
        role="img"
        aria-label={`Prévia do mapa ${meta.title}`}
      >
        <defs>
          <radialGradient id={`sea-${template}`} cx="50%" cy="48%" r="55%">
            <stop offset="0%" stopColor="#0e4a73" />
            <stop offset="100%" stopColor="#071e34" />
          </radialGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="106"
          height="92"
          rx="14"
          fill={`url(#sea-${template})`}
          stroke="rgba(56, 189, 248, 0.28)"
          strokeWidth="1.2"
        />
        <ellipse
          cx="55"
          cy="48"
          rx="42"
          ry="34"
          fill="none"
          stroke="rgba(125, 211, 252, 0.14)"
          strokeDasharray="3 3"
        />

        {meta.showPorts &&
          PORT_COORDS.map(([pq, pr], idx) => {
            const [px, py] = axialToPixel(pq, pr, meta.hexSize);
            return (
              <circle
                key={idx}
                cx={55 + px}
                cy={48 + py}
                r="2.2"
                fill="#fde047"
                opacity="0.88"
              />
            );
          })}

        {meta.hexes.map((hex, idx) => {
          const [px, py] = axialToPixel(hex.q, hex.r, meta.hexSize);
          const cx = 55 + px;
          const cy = 48 + py;
          return (
            <g key={idx}>
              <polygon
                points={hexToPoints(cx, cy, meta.hexSize - 0.7)}
                fill={hex.fill}
                stroke={hex.stroke ?? "rgba(15, 23, 42, 0.85)"}
                strokeWidth={hex.stroke ? "1.2" : "0.9"}
                opacity="0.92"
              />
              {hex.desert && (
                <circle
                  cx={cx}
                  cy={cy}
                  r="2.1"
                  fill="#1e293b"
                  stroke="#fde047"
                  strokeWidth="0.7"
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="map-template-preview__meta">
        <strong>{meta.title}</strong>
        <p>{meta.subtitle}</p>
        <div className="map-template-preview__chips">
          {meta.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
