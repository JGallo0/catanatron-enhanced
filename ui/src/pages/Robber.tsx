import {
  SQRT3,
  tilePixelVector,
  type CubeCoordinate,
} from "../utils/coordinates";

type RobberProps = {
  center: [number, number];
  size: number;
  coordinate: CubeCoordinate;
};

export default function Robber({ center, size, coordinate }: RobberProps) {
  const [centerX, centerY] = center;
  const w = SQRT3 * size;
  const [tileX, tileY] = tilePixelVector(coordinate, size, centerX, centerY);
  const [deltaX, deltaY] = [-w * 0.28, -size * 0.08];
  const x = tileX + deltaX;
  const y = tileY + deltaY;
  const pieceSize = Math.max(30, Math.min(48, Math.round(size * 0.56)));

  return (
    <div
      className="robber number-token"
      title="O Ladrão (Bloqueia a produção deste hexágono)"
      style={{
        left: x,
        top: y,
        width: pieceSize,
        height: pieceSize,
      }}
    >
      <svg
        viewBox="0 0 40 44"
        width={pieceSize * 0.85}
        height={pieceSize * 0.92}
        className="robber__svg"
        aria-hidden="true"
      >
        <ellipse cx="20" cy="39" rx="14" ry="4" fill="rgba(0,0,0,0.55)" />
        {/* Hooded Bandit Pawn Silhouette */}
        <path
          d="M10 37 C10 26, 13 21, 16 18 C13 15, 13 8, 20 5 C27 8, 27 15, 24 18 C27 21, 30 26, 30 37 Z"
          fill="#1E293B"
          stroke="#94A3B8"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Glowing Bandit Eyes */}
        <circle cx="17.5" cy="12.5" r="1.5" fill="#F43F5E" />
        <circle cx="22.5" cy="12.5" r="1.5" fill="#F43F5E" />
        {/* Base rim */}
        <rect
          x="8"
          y="35"
          width="24"
          height="4"
          rx="2"
          fill="#0F172A"
          stroke="#64748B"
          strokeWidth="1.5"
        />
      </svg>
      <span className="sr-only">R</span>
    </div>
  );
}
