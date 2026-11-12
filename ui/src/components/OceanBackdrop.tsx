import { useId, useState } from "react";
import "./OceanBackdrop.scss";

/**
 * Full-bleed atmospheric dusk-ocean & archipelago seascape rendered behind
 * the playable Catan island, pairing high-res painterly ocean artwork with
 * subtle live wave caustics and sunset shimmer layers.
 */
export default function OceanBackdrop() {
  const uid = useId().replace(/:/g, "");
  const [artFailed, setArtFailed] = useState(false);

  const skySeaId = `ocean-sky-${uid}`;
  const sunGlowId = `ocean-sun-${uid}`;
  const reflectionId = `ocean-reflect-${uid}`;
  const beamId = `ocean-beam-${uid}`;
  const deepVignetteId = `ocean-vig-${uid}`;

  return (
    <div className="ocean-panorama-backdrop" aria-hidden="true">
      {/* Vector atmospheric ocean fallback / sky-crown blend */}
      <svg
        className="ocean-panorama-backdrop__svg"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={skySeaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b1426" />
            <stop offset="12%" stopColor="#3c233f" />
            <stop offset="22%" stopColor="#854d0e" />
            <stop offset="30%" stopColor="#0e4f6e" />
            <stop offset="56%" stopColor="#08334e" />
            <stop offset="82%" stopColor="#042038" />
            <stop offset="100%" stopColor="#020e1c" />
          </linearGradient>

          <radialGradient id={sunGlowId} cx="54%" cy="22%" r="44%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.82" />
            <stop offset="22%" stopColor="#fbbf24" stopOpacity="0.48" />
            <stop offset="50%" stopColor="#ea580c" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#082f49" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={reflectionId} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.42" />
            <stop offset="34%" stopColor="#f59e0b" stopOpacity="0.18" />
            <stop offset="72%" stopColor="#38bdf8" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#04182b" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={beamId} x1="1" y1="0.4" x2="0" y2="0.6">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
          </linearGradient>

          <radialGradient id={deepVignetteId} cx="50%" cy="54%" r="65%">
            <stop offset="45%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#010811" stopOpacity="0.56" />
          </radialGradient>
        </defs>

        <rect width="1600" height="900" fill={`url(#${skySeaId})`} />
        <rect width="1600" height="900" fill={`url(#${sunGlowId})`} />
        <path
          d="M740 248 L960 248 L1140 860 L540 860 Z"
          fill={`url(#${reflectionId})`}
        />
        <rect width="1600" height="900" fill={`url(#${deepVignetteId})`} />
      </svg>

      {/* Painterly sunset ocean illustration (lobby_hero matching style) */}
      {!artFailed && (
        <img
          src="/assets/illustrations/ui/ocean_backdrop.webp"
          alt=""
          className="ocean-panorama-backdrop__art"
          onError={() => setArtFailed(true)}
        />
      )}

      {/* Subtle animated sunlight & wave shimmer layer over the painting */}
      <svg
        className="ocean-panorama-backdrop__fx"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <g className="ocean-panorama-backdrop__swells">
          <path
            d="M-60 360 Q180 344 410 362 T890 356 T1360 364 T1680 354"
            stroke="rgba(186, 230, 253, 0.14)"
            strokeWidth="2.2"
            fill="none"
          />
          <path
            d="M-40 460 Q210 445 470 462 T980 455 T1420 464 T1660 452"
            stroke="rgba(125, 211, 252, 0.15)"
            strokeWidth="2.4"
            fill="none"
          />
          <path
            d="M-80 578 Q190 562 450 580 T960 572 T1460 582 T1680 570"
            stroke="rgba(56, 189, 248, 0.13)"
            strokeWidth="2.8"
            fill="none"
          />
          <path
            d="M-50 698 Q240 680 520 700 T1060 690 T1520 702 T1680 690"
            stroke="rgba(125, 211, 252, 0.13)"
            strokeWidth="3"
            fill="none"
          />
        </g>

        <g className="ocean-panorama-backdrop__glints">
          {[
            [795, 268, 48],
            [808, 304, 62],
            [784, 344, 72],
            [816, 388, 66],
            [792, 434, 54],
            [812, 486, 68],
          ].map(([cx, cy, w], idx) => (
            <line
              key={idx}
              x1={cx - w / 2}
              y1={cy}
              x2={cx + w / 2}
              y2={cy}
              stroke="#fef08a"
              strokeWidth={idx < 3 ? 1.8 : 2.2}
              strokeLinecap="round"
              opacity={0.26 - idx * 0.03}
            />
          ))}
        </g>
      </svg>

      {/* Atmospheric vignette keeping tabletop contrast crisp */}
      <div className="ocean-panorama-backdrop__vignette" />
    </div>
  );
}
