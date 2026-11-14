import {
  SQRT3,
  tilePixelVector,
  type CubeCoordinate,
} from "../utils/coordinates";
import { useLanguage } from "../i18n";

type RobberProps = {
  center: [number, number];
  size: number;
  coordinate: CubeCoordinate;
};

export default function Robber({ center, size, coordinate }: RobberProps) {
  const { t } = useLanguage();
  const [centerX, centerY] = center;
  const w = SQRT3 * size;
  const [tileX, tileY] = tilePixelVector(coordinate, size, centerX, centerY);
  const [deltaX, deltaY] = [-w * 0.22, -size * 0.12];
  const x = tileX + deltaX;
  const y = tileY + deltaY;
  const pawnWidth = Math.max(30, Math.min(50, Math.round(size * 0.58)));
  const pawnHeight = Math.round(pawnWidth * 1.35);

  return (
    <div
      className="robber robber-pawn"
      title={t(
        "O Ladrão (Bloqueia a produção deste hexágono)",
        "The Robber (Blocks production on this hex)"
      )}
      aria-label={t("O Ladrão", "The Robber")}
      style={{
        left: x,
        top: y,
        width: pawnWidth,
        height: pawnHeight,
      }}
    >
      <svg
        viewBox="0 0 40 54"
        width={pawnWidth}
        height={pawnHeight}
        className="robber__svg-piece"
        aria-hidden="true"
      >
        <defs>
          {/* Soft ground contact shadow */}
          <radialGradient id="robberShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.75)" />
            <stop offset="60%" stopColor="rgba(0,0,0,0.35)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          {/* Black wooden lacquer body gradient */}
          <linearGradient id="robberBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e2530" />
            <stop offset="25%" stopColor="#3a4556" />
            <stop offset="60%" stopColor="#111620" />
            <stop offset="100%" stopColor="#080b10" />
          </linearGradient>
          {/* Spherical head highlight */}
          <radialGradient id="robberHeadGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#4b5563" />
            <stop offset="35%" stopColor="#1f2937" />
            <stop offset="85%" stopColor="#111827" />
            <stop offset="100%" stopColor="#030712" />
          </radialGradient>
          {/* Base bevel */}
          <linearGradient id="robberBaseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="30%" stopColor="#4b5563" />
            <stop offset="70%" stopColor="#111827" />
            <stop offset="100%" stopColor="#030712" />
          </linearGradient>
        </defs>

        {/* Ground shadow on hex */}
        <ellipse cx="20" cy="50" rx="16" ry="4" fill="url(#robberShadow)" />
        {/* Crimson-gold menace ring at base */}
        <ellipse
          cx="20"
          cy="47.5"
          rx="15.5"
          ry="4.2"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.5"
          opacity="0.82"
        />

        {/* Base Rim */}
        <ellipse
          cx="20"
          cy="46"
          rx="13"
          ry="3.5"
          fill="url(#robberBaseGrad)"
          stroke="#374151"
          strokeWidth="0.8"
        />

        {/* Conical Trunk / Body */}
        <path
          d="M9.5 45 C10 32, 14 26, 15 22 L25 22 C26 26, 30 32, 30.5 45 Z"
          fill="url(#robberBodyGrad)"
          stroke="#374151"
          strokeWidth="0.8"
        />

        {/* Collar / Neck Ring */}
        <ellipse
          cx="20"
          cy="22"
          rx="6"
          ry="1.6"
          fill="#4b5563"
          stroke="#1f2937"
          strokeWidth="0.8"
        />

        {/* Spherical Head */}
        <circle
          cx="20"
          cy="14"
          r="8.5"
          fill="url(#robberHeadGrad)"
          stroke="#374151"
          strokeWidth="0.8"
        />

        {/* Soft Specular Pin Highlight */}
        <ellipse
          cx="17.5"
          cy="11.5"
          rx="2.5"
          ry="1.8"
          fill="rgba(255,255,255,0.25)"
        />
      </svg>
      <span
        key={JSON.stringify(coordinate)}
        className="robber__arrival-shockwave"
        aria-hidden="true"
      />
      <span className="sr-only">R</span>
    </div>
  );
}
