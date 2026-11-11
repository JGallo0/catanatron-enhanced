import { useId } from "react";
import cn from "classnames";
import type {
  AvatarBackground,
  AvatarConfig,
  AvatarHairColor,
  AvatarOutfitColor,
  AvatarSkin,
} from "../utils/api.types";
import {
  AVATAR_FRAME_OPTIONS,
  resolveAvatarConfig,
} from "../config/avatarCatalog";
import "./PlayerAvatar.scss";

const SKIN_PALETTE: Record<AvatarSkin, { base: string; shade: string; blush: string }> = {
  porcelain: { base: "#fbe2d1", shade: "#e6b89c", blush: "#f4a59a" },
  fair: { base: "#f3cfb3", shade: "#d6a07b", blush: "#e89282" },
  warm: { base: "#e4b287", shade: "#c08454", blush: "#d97d68" },
  tan: { base: "#c98b5b", shade: "#9e6238", blush: "#b85d47" },
  brown: { base: "#995c37", shade: "#713d1f", blush: "#8d4330" },
  deep: { base: "#633722", shade: "#422112", blush: "#5e2b1d" },
};

const HAIR_PALETTE: Record<AvatarHairColor, { main: string; shade: string }> = {
  brown: { main: "#5c3922", shade: "#3b2212" },
  black: { main: "#222732", shade: "#10141b" },
  blonde: { main: "#eab308", shade: "#a16207" },
  red: { main: "#c2410c", shade: "#7c2d12" },
  silver: { main: "#cbd5e1", shade: "#64748b" },
  navy: { main: "#2563eb", shade: "#1e3a8a" },
};

const OUTFIT_PALETTE: Record<
  AvatarOutfitColor,
  { primary: string; dark: string; trim: string }
> = {
  crimson: { primary: "#dc2626", dark: "#7f1d1d", trim: "#fde047" },
  royal: { primary: "#2563eb", dark: "#1e3a8a", trim: "#facc15" },
  emerald: { primary: "#059669", dark: "#064e3b", trim: "#fde68a" },
  amber: { primary: "#d97706", dark: "#78350f", trim: "#fef08a" },
  slate: { primary: "#475569", dark: "#1e293b", trim: "#e2e8f0" },
};

const BG_PALETTE: Record<AvatarBackground, { top: string; bottom: string }> = {
  ocean: { top: "#156599", bottom: "#072643" },
  sunset: { top: "#f97316", bottom: "#581c87" },
  forest: { top: "#16a34a", bottom: "#052e16" },
  mountain: { top: "#475569", bottom: "#0f172a" },
  gold: { top: "#eab308", bottom: "#713f12" },
  crimson: { top: "#b91c1c", bottom: "#450a0a" },
};

export default function PlayerAvatar({
  config,
  username,
  size = 48,
  className,
  showFrameLabel = false,
}: {
  config?: Partial<AvatarConfig> | Record<string, unknown> | null;
  username?: string | null;
  size?: number;
  className?: string;
  showFrameLabel?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const rawResolved = resolveAvatarConfig(config, username);
  const resolved: AvatarConfig = {
    skin: rawResolved.skin && SKIN_PALETTE[rawResolved.skin] ? rawResolved.skin : "warm",
    eyes: rawResolved.eyes ?? "calm",
    hair: rawResolved.hair ?? "short",
    hairColor:
      rawResolved.hairColor && HAIR_PALETTE[rawResolved.hairColor]
        ? rawResolved.hairColor
        : "brown",
    beard: rawResolved.beard ?? "none",
    hat: rawResolved.hat ?? "none",
    outfit: rawResolved.outfit ?? "settler",
    outfitColor:
      rawResolved.outfitColor && OUTFIT_PALETTE[rawResolved.outfitColor]
        ? rawResolved.outfitColor
        : "royal",
    background:
      rawResolved.background && BG_PALETTE[rawResolved.background]
        ? rawResolved.background
        : "ocean",
    frame:
      rawResolved.frame &&
      AVATAR_FRAME_OPTIONS.some((f) => f.value === rawResolved.frame)
        ? rawResolved.frame
        : "wood",
  };
  const skin = SKIN_PALETTE[resolved.skin];
  const hair = HAIR_PALETTE[resolved.hairColor];
  const outfit = OUTFIT_PALETTE[resolved.outfitColor];
  const bg = BG_PALETTE[resolved.background];
  const frameLabel =
    AVATAR_FRAME_OPTIONS.find((f) => f.value === resolved.frame)?.label ||
    "Madeira de Colono";

  const clipId = `pa-clip-${uid}`;
  const bgGradId = `pa-bg-${uid}`;
  const hideFrontHair = resolved.hat === "helm";

  return (
    <div
      className={cn(
        "player-avatar",
        `player-avatar--frame-${resolved.frame}`,
        className
      )}
      data-testid="player-avatar"
      data-frame={resolved.frame}
    >
      <div
        className="player-avatar__frame"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 120 120"
          width={size}
          height={size}
          className="player-avatar__svg"
          role="img"
          aria-label={username ? `Avatar de ${username}` : "Avatar do jogador"}
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="60" cy="60" r="58" />
            </clipPath>
            <linearGradient id={bgGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bg.top} />
              <stop offset="100%" stopColor={bg.bottom} />
            </linearGradient>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            {/* 1. Background */}
            <rect width="120" height="120" fill={`url(#${bgGradId})`} />
            {resolved.background === "ocean" && (
              <path
                d="M0 90 Q30 82 60 90 T120 90 V120 H0 Z"
                fill="rgba(255,255,255,0.12)"
              />
            )}
            {resolved.background === "sunset" && (
              <circle cx="60" cy="68" r="28" fill="rgba(254, 240, 138, 0.28)" />
            )}
            {resolved.background === "forest" && (
              <path
                d="M8 106 L22 76 L36 106 Z M84 106 L98 72 L112 106 Z"
                fill="rgba(0,0,0,0.22)"
              />
            )}
            {resolved.background === "mountain" && (
              <path
                d="M-5 110 L32 64 L64 96 L94 60 L126 110 Z"
                fill="rgba(15,23,42,0.45)"
              />
            )}
            {resolved.background === "gold" && (
              <circle cx="60" cy="54" r="40" fill="rgba(254, 249, 195, 0.22)" />
            )}

            {/* 2. Back Hair */}
            {resolved.hair === "long" && (
              <path
                d="M30 48 C25 70 25 96 34 114 H86 C95 96 95 70 90 48 Z"
                fill={hair.shade}
              />
            )}
            {resolved.hair === "wavy" && (
              <path
                d="M31 46 C23 64 26 88 35 100 H85 C94 88 97 64 89 46 Z"
                fill={hair.shade}
              />
            )}
            {resolved.hair === "braids" && (
              <g fill={hair.shade}>
                <rect x="28" y="54" width="11" height="48" rx="5.5" />
                <rect x="81" y="54" width="11" height="48" rx="5.5" />
                <rect x="29" y="92" width="9" height="4" rx="2" fill="#facc15" />
                <rect x="82" y="92" width="9" height="4" rx="2" fill="#facc15" />
              </g>
            )}
            {resolved.hair === "curly" && (
              <g fill={hair.shade}>
                <circle cx="32" cy="48" r="11" />
                <circle cx="88" cy="48" r="11" />
                <circle cx="30" cy="64" r="10" />
                <circle cx="90" cy="64" r="10" />
              </g>
            )}
            {resolved.hair === "bun" && (
              <circle cx="60" cy="22" r="13" fill={hair.shade} />
            )}

            {/* 3. Outfit & Shoulders */}
            <g>
              <path
                d="M14 122 C16 94 34 84 60 84 C86 84 104 94 106 122 Z"
                fill={outfit.primary}
              />
              {resolved.outfit === "settler" && (
                <>
                  <path d="M36 86 L60 112 L84 86 L74 84 L60 100 L46 84 Z" fill={outfit.dark} />
                  <path d="M36 88 L80 120" stroke="#78350f" strokeWidth="6" />
                </>
              )}
              {resolved.outfit === "captain" && (
                <>
                  <path d="M40 85 L54 114 L46 120 L30 96 Z" fill={outfit.dark} />
                  <path d="M80 85 L66 114 L74 120 L90 96 Z" fill={outfit.dark} />
                  <circle cx="48" cy="100" r="2.2" fill={outfit.trim} />
                  <circle cx="72" cy="100" r="2.2" fill={outfit.trim} />
                </>
              )}
              {resolved.outfit === "armor" && (
                <>
                  <path
                    d="M22 104 C28 88 42 84 60 84 C78 84 92 88 98 104 L92 122 H28 Z"
                    fill="#94a3b8"
                  />
                  <path
                    d="M36 87 L60 105 L84 87"
                    fill="none"
                    stroke="#475569"
                    strokeWidth="3.5"
                  />
                  <path d="M18 106 C22 92 34 86 44 88 L40 104 Z" fill={outfit.primary} />
                  <path d="M102 106 C98 92 86 86 76 88 L80 104 Z" fill={outfit.primary} />
                </>
              )}
              {resolved.outfit === "merchant" && (
                <>
                  <path
                    d="M34 86 Q60 112 86 86 L92 122 H28 Z"
                    fill={outfit.dark}
                  />
                  <path
                    d="M44 87 Q60 102 76 87"
                    fill="none"
                    stroke={outfit.trim}
                    strokeWidth="3"
                  />
                  <circle cx="60" cy="99" r="4.5" fill={outfit.trim} />
                </>
              )}
            </g>

            {/* 4. Neck & Head */}
            <rect x="51" y="72" width="18" height="20" rx="7" fill={skin.shade} />
            <circle cx="35" cy="58" r="6" fill={skin.shade} />
            <circle cx="85" cy="58" r="6" fill={skin.shade} />
            <rect x="36" y="30" width="48" height="53" rx="23" fill={skin.base} />
            <ellipse cx="44" cy="63" rx="5" ry="2.6" fill={skin.blush} opacity="0.45" />
            <ellipse cx="76" cy="63" rx="5" ry="2.6" fill={skin.blush} opacity="0.45" />
            <path
              d="M58 55 Q60 61 62 59"
              fill="none"
              stroke={skin.shade}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* 5. Eyes & Expression */}
            {resolved.eyes === "calm" && (
              <g>
                <circle cx="48" cy="53" r="3" fill="#1e293b" />
                <circle cx="72" cy="53" r="3" fill="#1e293b" />
                <circle cx="49" cy="52" r="1" fill="#ffffff" />
                <circle cx="73" cy="52" r="1" fill="#ffffff" />
                <path d="M42 46 Q48 44 54 46" stroke={hair.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M66 46 Q72 44 78 46" stroke={hair.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M53 69 Q60 73 67 69" stroke={skin.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              </g>
            )}
            {resolved.eyes === "cheerful" && (
              <g>
                <circle cx="48" cy="53" r="3.2" fill="#1e293b" />
                <circle cx="72" cy="53" r="3.2" fill="#1e293b" />
                <circle cx="49" cy="51.8" r="1.1" fill="#ffffff" />
                <circle cx="73" cy="51.8" r="1.1" fill="#ffffff" />
                <path d="M42 45 Q48 42 54 45" stroke={hair.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M66 45 Q72 42 78 45" stroke={hair.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M51 67 Q60 76 69 67 Z" fill="#ffffff" />
                <path d="M51 67 Q60 76 69 67" stroke={skin.shade} strokeWidth="1.5" fill="none" />
              </g>
            )}
            {resolved.eyes === "sharp" && (
              <g>
                <ellipse cx="48" cy="54" rx="3.4" ry="2.6" fill="#0f172a" />
                <ellipse cx="72" cy="54" rx="3.4" ry="2.6" fill="#0f172a" />
                <path d="M42 45 L55 49" stroke={hair.shade} strokeWidth="2.8" strokeLinecap="round" />
                <path d="M78 45 L65 49" stroke={hair.shade} strokeWidth="2.8" strokeLinecap="round" />
                <path d="M53 70 Q62 72 68 67" stroke={skin.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              </g>
            )}
            {resolved.eyes === "wise" && (
              <g>
                <circle cx="48" cy="53" r="2.8" fill="#1e293b" />
                <circle cx="72" cy="53" r="2.8" fill="#1e293b" />
                <circle cx="48" cy="53" r="6.8" fill="none" stroke="#facc15" strokeWidth="1.8" />
                <circle cx="72" cy="53" r="6.8" fill="none" stroke="#facc15" strokeWidth="1.8" />
                <line x1="54.8" y1="53" x2="65.2" y2="53" stroke="#facc15" strokeWidth="1.8" />
                <path d="M42 43 Q48 41 54 43" stroke={hair.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />
                <path d="M66 43 Q72 41 78 43" stroke={hair.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />
                <path d="M54 70 Q60 73 66 70" stroke={skin.shade} strokeWidth="2" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* 6. Beard */}
            {resolved.beard === "goatee" && (
              <path
                d="M50 72 C50 82 54 88 60 88 C66 88 70 82 70 72 C65 75 55 75 50 72 Z"
                fill={hair.main}
              />
            )}
            {resolved.beard === "full" && (
              <path
                d="M36 58 C36 78 46 90 60 90 C74 90 84 78 84 58 L80 62 C78 72 70 75 60 75 C50 75 42 72 40 62 Z"
                fill={hair.main}
              />
            )}
            {resolved.beard === "mustache" && (
              <path
                d="M44 66 Q52 60 60 65 Q68 60 76 66 Q69 70 60 67 Q51 70 44 66 Z"
                fill={hair.main}
              />
            )}

            {/* 7. Front Hair */}
            {!hideFrontHair && resolved.hair !== "none" && (
              <g fill={hair.main}>
                {resolved.hair === "short" && (
                  <path d="M35 46 C35 28 48 22 60 22 C72 22 85 28 85 46 C77 36 45 36 35 46 Z" />
                )}
                {resolved.hair === "wavy" && (
                  <path d="M34 49 C34 27 47 21 60 21 C73 21 86 27 86 49 C78 39 67 35 56 41 C47 45 39 43 34 49 Z" />
                )}
                {resolved.hair === "bun" && (
                  <path d="M35 45 C37 28 49 23 60 23 C71 23 83 28 85 45 C75 34 45 34 35 45 Z" />
                )}
                {resolved.hair === "braids" && (
                  <path d="M35 47 C36 28 48 23 60 23 C72 23 84 28 85 47 C74 37 64 34 60 39 C56 34 46 37 35 47 Z" />
                )}
                {resolved.hair === "curly" && (
                  <>
                    <circle cx="43" cy="34" r="9" />
                    <circle cx="55" cy="29" r="10" />
                    <circle cx="68" cy="30" r="10" />
                    <circle cx="79" cy="36" r="8.5" />
                  </>
                )}
                {resolved.hair === "long" && (
                  <path d="M34 50 C34 27 46 21 60 21 C74 21 86 27 86 50 C77 36 65 34 60 34 C55 34 43 36 34 50 Z" />
                )}
              </g>
            )}

            {/* 8. Hats & Sovereign Crown */}
            {resolved.hat === "captain" && (
              <g>
                <path
                  d="M23 36 C32 16 46 14 60 15 C74 14 88 16 97 36 Q60 44 23 36 Z"
                  fill="#1e293b"
                />
                <path
                  d="M24 35 Q60 43 96 35"
                  fill="none"
                  stroke="#facc15"
                  strokeWidth="2.8"
                />
                <circle cx="60" cy="26" r="3.5" fill="#facc15" />
              </g>
            )}
            {resolved.hat === "explorer" && (
              <g>
                <path d="M38 33 C40 16 80 16 82 33 Z" fill="#854d0e" />
                <rect x="38" y="29" width="44" height="4.5" fill="#ca8a04" />
                <ellipse cx="60" cy="34" rx="37" ry="5.5" fill="#713f12" />
              </g>
            )}
            {resolved.hat === "bandana" && (
              <g>
                <path
                  d="M34 42 C35 23 85 23 86 42 Q60 36 34 42 Z"
                  fill={outfit.primary}
                />
                <circle cx="84" cy="40" r="5" fill={outfit.dark} />
                <path d="M86 41 L97 49 L90 52 Z" fill={outfit.primary} />
              </g>
            )}
            {resolved.hat === "helm" && (
              <g>
                <path
                  d="M33 48 C33 21 46 15 60 15 C74 15 87 21 87 48 Z"
                  fill="#94a3b8"
                  stroke="#475569"
                  strokeWidth="2"
                />
                <rect x="57.5" y="28" width="5" height="27" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
                <path d="M34 44 H86" stroke="#facc15" strokeWidth="2.5" />
              </g>
            )}
            {resolved.hat === "crown_gold" && (
              <g>
                <path
                  d="M36 33 L40 14 L51 24 L60 10 L69 24 L80 14 L84 33 Z"
                  fill="#facc15"
                  stroke="#a16207"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <rect x="36" y="30" width="48" height="5" rx="2" fill="#eab308" stroke="#a16207" strokeWidth="1.2" />
                <circle cx="60" cy="23" r="2.8" fill="#ef4444" />
                <circle cx="48" cy="26" r="2.2" fill="#10b981" />
                <circle cx="72" cy="26" r="2.2" fill="#10b981" />
              </g>
            )}
          </g>
        </svg>
      </div>
      {showFrameLabel && (
        <span className="player-avatar__frame-label">🏆 {frameLabel}</span>
      )}
    </div>
  );
}
