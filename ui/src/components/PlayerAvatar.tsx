import { useId } from "react";
import cn from "classnames";
import type {
  AvatarBackground,
  AvatarBrowStyle,
  AvatarConfig,
  AvatarEyeStyle,
  AvatarHeadShape,
  AvatarMouthStyle,
  AvatarNoseStyle,
} from "../utils/api.types";
import {
  findAvatarCatalogItem,
  getFrameLabel,
  isValidPortraitSnapshot,
  resolveAvatarConfig,
} from "../config/avatarCatalog";
import { useLanguage } from "../i18n";
import "./PlayerAvatar.scss";

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [128, 128, 128];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Adjusts a #RRGGBB color toward black (amount < 0) or white (amount > 0).
 */
function shadeHexColor(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  if (amount < 0) {
    const f = 1 + amount;
    return toHex(r * f, g * f, b * f);
  }
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function mixHexColors(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = parseHex(hexA);
  const [r2, g2, b2] = parseHex(hexB);
  const k = Math.max(0, Math.min(1, t));
  return toHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

const BG_PALETTE: Record<AvatarBackground, { top: string; bottom: string }> = {
  ocean: { top: "#156599", bottom: "#072643" },
  sunset: { top: "#f97316", bottom: "#581c87" },
  forest: { top: "#16a34a", bottom: "#052e16" },
  mountain: { top: "#475569", bottom: "#0f172a" },
  gold: { top: "#eab308", bottom: "#713f12" },
  crimson: { top: "#b91c1c", bottom: "#450a0a" },
};

function getHeadPath(shape: AvatarHeadShape): string {
  switch (shape) {
    case "square":
      return "M36 39 C36 28 46 25 60 25 C74 25 84 28 84 39 L84 62 C84 73 75 81 66 83 L54 83 C45 81 36 73 36 62 Z";
    case "heart":
      return "M36 41 C36 28 46 25 60 25 C74 25 84 28 84 41 L82 60 C80 71 69 81 60 84 C51 81 40 71 38 60 Z";
    case "chiseled":
      return "M36 40 C36 28 46 25 60 25 C74 25 84 28 84 40 L83 59 L75 74 L64 83.5 L56 83.5 L45 74 L37 59 Z";
    case "oval":
    default:
      return "M36 42 C36 28 47 25 60 25 C73 25 84 28 84 42 C84 60 77 77 65 83 C62 84.5 58 84.5 55 83 C43 77 36 60 36 42 Z";
  }
}

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
  const { language, t } = useLanguage();
  const uid = useId().replace(/:/g, "");
  const rawResolved = resolveAvatarConfig(config, username);

  const resolvedFrame = findAvatarCatalogItem("frame", rawResolved.frame)
    ? rawResolved.frame
    : "wood";
  const resolvedBackground: AvatarBackground =
    rawResolved.background && BG_PALETTE[rawResolved.background]
      ? rawResolved.background
      : "ocean";

  const frameLabel = getFrameLabel(resolvedFrame, language);
  const ariaLabel = username
    ? t(`Avatar de ${username}`, `${username}'s avatar`)
    : t("Avatar do jogador", "Player avatar");

  const hasValidSnapshot = isValidPortraitSnapshot(rawResolved.portraitSnapshot);

  // Derive V2-color-aware palettes
  const skinBase = rawResolved.colors.skin;
  const skinShade = shadeHexColor(skinBase, -0.22);
  const skinDeepShade = shadeHexColor(skinBase, -0.36);
  const skinHighlight = shadeHexColor(skinBase, 0.14);
  const skinBlush = mixHexColors(skinBase, "#d9534f", 0.24);

  const hairMain = rawResolved.colors.hair;
  const hairShade = shadeHexColor(hairMain, -0.28);
  const hairHighlight = shadeHexColor(hairMain, 0.16);

  const eyeIris = rawResolved.colors.eyes;
  const eyeIrisDark = shadeHexColor(eyeIris, -0.32);

  const outfitPrimary = rawResolved.colors.outfitPrimary;
  const outfitDark =
    rawResolved.colors.outfitSecondary || shadeHexColor(outfitPrimary, -0.32);
  const outfitDeepDark = shadeHexColor(outfitDark, -0.28);
  const outfitTrim = rawResolved.colors.outfitTrim;

  const bg = BG_PALETTE[resolvedBackground];

  const eyeStyle: AvatarEyeStyle = rawResolved.eyeStyle ?? rawResolved.eyes ?? "calm";
  const browStyle: AvatarBrowStyle = rawResolved.browStyle ?? "calm";
  const noseStyle: AvatarNoseStyle = rawResolved.noseStyle ?? "straight";
  const mouthStyle: AvatarMouthStyle = rawResolved.mouthStyle ?? "confident";
  const headShape: AvatarHeadShape = rawResolved.headShape ?? "oval";
  const resolvedHair = rawResolved.hair ?? "short";
  const resolvedBeard = rawResolved.beard ?? "none";
  const resolvedOutfit = rawResolved.outfit ?? "settler";
  const resolvedHat = rawResolved.hat ?? "none";
  const resolvedCape = rawResolved.cape ?? "none";

  const clipId = `pa-clip-${uid}`;
  const bgGradId = `pa-bg-${uid}`;
  const skinShadeGradId = `pa-skin-${uid}`;
  const outfitGradId = `pa-outfit-${uid}`;
  const hideFrontHair = resolvedHat === "helm";
  const isFierceEyes = eyeStyle === "fierce" || eyeStyle === "sharp";
  const isNobleEyes = eyeStyle === "noble";
  const isWiseEyes = eyeStyle === "wise";

  return (
    <div
      className={cn(
        "player-avatar",
        `player-avatar--frame-${resolvedFrame}`,
        className
      )}
      data-testid="player-avatar"
      data-frame={resolvedFrame}
    >
      <div
        className="player-avatar__frame"
        style={{ width: size, height: size }}
      >
        {hasValidSnapshot ? (
          <img
            className="player-avatar__snapshot"
            src={rawResolved.portraitSnapshot}
            alt={ariaLabel}
            width={size}
            height={size}
          />
        ) : (
          <svg
            viewBox="0 0 120 120"
            width={size}
            height={size}
            className="player-avatar__svg"
            role="img"
            aria-label={ariaLabel}
          >
            <defs>
              <clipPath id={clipId}>
                <circle cx="60" cy="60" r="58" />
              </clipPath>
              <linearGradient id={bgGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={bg.top} />
                <stop offset="100%" stopColor={bg.bottom} />
              </linearGradient>
              <linearGradient id={skinShadeGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={skinHighlight} stopOpacity="0.22" />
                <stop offset="65%" stopColor={skinBase} stopOpacity="0" />
                <stop offset="100%" stopColor={skinShade} stopOpacity="0.34" />
              </linearGradient>
              <linearGradient id={outfitGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={outfitPrimary} stopOpacity="0" />
                <stop offset="100%" stopColor={outfitDeepDark} stopOpacity="0.45" />
              </linearGradient>
            </defs>

            <g clipPath={`url(#${clipId})`}>
              {/* 1. Background */}
              <rect width="120" height="120" fill={`url(#${bgGradId})`} />
              {resolvedBackground === "ocean" && (
                <path
                  d="M0 90 Q30 82 60 90 T120 90 V120 H0 Z"
                  fill="rgba(255,255,255,0.12)"
                />
              )}
              {resolvedBackground === "sunset" && (
                <circle cx="60" cy="68" r="28" fill="rgba(254, 240, 138, 0.28)" />
              )}
              {resolvedBackground === "forest" && (
                <path
                  d="M8 106 L22 76 L36 106 Z M84 106 L98 72 L112 106 Z"
                  fill="rgba(0,0,0,0.22)"
                />
              )}
              {resolvedBackground === "mountain" && (
                <path
                  d="M-5 110 L32 64 L64 96 L94 60 L126 110 Z"
                  fill="rgba(15,23,42,0.45)"
                />
              )}
              {resolvedBackground === "gold" && (
                <circle cx="60" cy="54" r="40" fill="rgba(254, 249, 195, 0.22)" />
              )}
              {resolvedBackground === "crimson" && (
                <path
                  d="M12 115 V82 H24 V88 H34 V82 H86 V88 H96 V82 H108 V115 Z"
                  fill="rgba(0,0,0,0.22)"
                />
              )}

              {/* 2. Back Hair */}
              {resolvedHair === "long" && (
                <path
                  d="M29 46 C23 70 24 98 33 116 H87 C96 98 97 70 91 46 Z"
                  fill={hairShade}
                />
              )}
              {resolvedHair === "wavy" && (
                <path
                  d="M30 45 C22 64 25 90 34 102 H86 C95 90 98 64 90 45 Z"
                  fill={hairShade}
                />
              )}
              {resolvedHair === "braids" && (
                <g fill={hairShade}>
                  <rect x="27" y="53" width="11" height="50" rx="5.5" />
                  <rect x="82" y="53" width="11" height="50" rx="5.5" />
                  <rect x="28" y="92" width="9" height="4" rx="2" fill={outfitTrim} />
                  <rect x="83" y="92" width="9" height="4" rx="2" fill={outfitTrim} />
                </g>
              )}
              {resolvedHair === "curly" && (
                <g fill={hairShade}>
                  <circle cx="31" cy="48" r="11" />
                  <circle cx="89" cy="48" r="11" />
                  <circle cx="29" cy="64" r="10" />
                  <circle cx="91" cy="64" r="10" />
                </g>
              )}
              {resolvedHair === "bun" && (
                <circle cx="60" cy="20" r="12.5" fill={hairShade} />
              )}
              {resolvedHair === "royal_bun" && (
                <g>
                  <circle cx="60" cy="18" r="13.5" fill={hairShade} />
                  <path
                    d="M47 22 Q60 15 73 22"
                    fill="none"
                    stroke={outfitTrim}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <circle cx="60" cy="16" r="2.2" fill={outfitTrim} />
                </g>
              )}
              {resolvedHair === "navigator" && (
                <path
                  d="M31 44 C26 56 26 70 32 78 L42 66 Z M89 44 C94 56 94 70 88 78 L78 66 Z"
                  fill={hairShade}
                />
              )}

              {/* 2b. Optional Cape Drape */}
              {resolvedCape !== "none" && (
                <path
                  d="M18 122 C20 96 32 84 44 82 H76 C88 84 100 96 102 122 Z"
                  fill={resolvedCape === "royal_mantle" ? outfitDark : outfitDeepDark}
                  stroke={resolvedCape === "royal_mantle" || resolvedCape === "navy_commander" ? outfitTrim : "none"}
                  strokeWidth={resolvedCape === "royal_mantle" ? 2.4 : 1.4}
                />
              )}

              {/* 3. Outfit & Shoulders */}
              <g>
                <path
                  d="M14 122 C16 93 34 83 60 83 C86 83 104 93 106 122 Z"
                  fill={outfitPrimary}
                />
                <path
                  d="M14 122 C16 93 34 83 60 83 C86 83 104 93 106 122 Z"
                  fill={`url(#${outfitGradId})`}
                />
                {resolvedOutfit === "settler" && (
                  <>
                    <path d="M36 85 L60 112 L84 85 L74 83 L60 99 L46 83 Z" fill={outfitDark} />
                    <path d="M36 87 L80 120" stroke={outfitDeepDark} strokeWidth="5.5" />
                    <path d="M46 84 L60 99 L74 84" fill="none" stroke={outfitTrim} strokeWidth="1.5" opacity="0.85" />
                  </>
                )}
                {resolvedOutfit === "captain" && (
                  <>
                    <path d="M40 84 L54 114 L46 120 L30 95 Z" fill={outfitDark} />
                    <path d="M80 84 L66 114 L74 120 L90 95 Z" fill={outfitDark} />
                    <path d="M40 84 L54 114" stroke={outfitTrim} strokeWidth="1.6" />
                    <path d="M80 84 L66 114" stroke={outfitTrim} strokeWidth="1.6" />
                    <circle cx="48" cy="100" r="2.2" fill={outfitTrim} />
                    <circle cx="72" cy="100" r="2.2" fill={outfitTrim} />
                  </>
                )}
                {resolvedOutfit === "armor" && (
                  <>
                    <path
                      d="M22 104 C28 87 42 83 60 83 C78 83 92 87 98 104 L92 122 H28 Z"
                      fill="#94a3b8"
                    />
                    <path
                      d="M36 86 L60 105 L84 86"
                      fill="none"
                      stroke="#475569"
                      strokeWidth="3.5"
                    />
                    <path d="M18 106 C22 91 34 85 44 87 L40 104 Z" fill={outfitPrimary} stroke={outfitTrim} strokeWidth="1.3" />
                    <path d="M102 106 C98 91 86 85 76 87 L80 104 Z" fill={outfitPrimary} stroke={outfitTrim} strokeWidth="1.3" />
                  </>
                )}
                {resolvedOutfit === "merchant" && (
                  <>
                    <path d="M34 85 Q60 112 86 85 L92 122 H28 Z" fill={outfitDark} />
                    <path d="M44 86 Q60 102 76 86" fill="none" stroke={outfitTrim} strokeWidth="3" />
                    <circle cx="60" cy="99" r="4.5" fill={outfitTrim} />
                  </>
                )}
                {resolvedOutfit === "imperial_lord" && (
                  <>
                    <path d="M36 84 L60 116 L84 84 L74 82 L60 103 L46 82 Z" fill={outfitDark} />
                    <path d="M22 96 C26 86 35 83 43 85 L39 95 Z" fill={outfitTrim} />
                    <path d="M98 96 C94 86 85 83 77 85 L81 95 Z" fill={outfitTrim} />
                    <path d="M39 87 L81 120" stroke={outfitTrim} strokeWidth="4.5" opacity="0.92" />
                    <polygon points="60,96 64,102 60,108 56,102" fill={outfitTrim} />
                    <circle cx="60" cy="102" r="2" fill="#dc2626" />
                  </>
                )}
              </g>

              {/* 4. Neck & Chiseled Head */}
              <rect x="51" y="72" width="18" height="20" rx="7" fill={skinShade} />
              <path d="M49 78 Q60 88 71 78 L69 86 Q60 91 51 86 Z" fill={skinDeepShade} opacity="0.45" />

              {/* Ears */}
              <ellipse cx="35.5" cy="55" rx="4.5" ry="6.8" fill={skinShade} />
              <ellipse cx="84.5" cy="55" rx="4.5" ry="6.8" fill={skinShade} />

              {/* Base Head Fill (uses rawResolved.colors.skin directly) */}
              <path d={getHeadPath(headShape)} fill={skinBase} />
              <path d={getHeadPath(headShape)} fill={`url(#${skinShadeGradId})`} />

              {/* Sculpted Cheekbone & Jaw Shading */}
              <path
                d="M39 58 Q43 68 50 75 Q41 69 38 60 Z"
                fill={skinShade}
                opacity="0.38"
              />
              <path
                d="M81 58 Q77 68 70 75 Q79 69 82 60 Z"
                fill={skinShade}
                opacity="0.38"
              />
              <ellipse cx="44" cy="60" rx="4.5" ry="2.2" fill={skinBlush} opacity="0.28" />
              <ellipse cx="76" cy="60" rx="4.5" ry="2.2" fill={skinBlush} opacity="0.28" />

              {/* 5. Detailed Eyes (white sclera, colored iris, pupil, catchlight, upper lid) */}
              <g>
                {/* Left Eye */}
                <path
                  d={
                    isFierceEyes
                      ? "M41.5 52 Q47.5 48.5 53.5 51.8 Q47.5 55.2 41.5 52 Z"
                      : isNobleEyes
                      ? "M41.5 51.5 Q47.5 47.6 53.5 51.5 Q47.5 55.2 41.5 51.5 Z"
                      : "M42 51.8 Q47.8 47.8 53.5 51.8 Q47.8 55.6 42 51.8 Z"
                  }
                  fill="#f8fafc"
                />
                <circle cx="47.8" cy="51.8" r="2.75" fill={eyeIris} />
                <circle cx="47.8" cy="51.8" r="1.4" fill="#0f172a" />
                <circle cx="48.8" cy="50.8" r="0.85" fill="#ffffff" />
                <path
                  d={
                    isFierceEyes
                      ? "M41 51.3 Q47.5 48 54 51.6"
                      : "M41.5 51.5 Q47.8 47.4 53.8 51.5"
                  }
                  fill="none"
                  stroke={eyeIrisDark}
                  strokeWidth="1.45"
                  strokeLinecap="round"
                />

                {/* Right Eye */}
                <path
                  d={
                    isFierceEyes
                      ? "M66.5 51.8 Q72.5 48.5 78.5 52 Q72.5 55.2 66.5 51.8 Z"
                      : isNobleEyes
                      ? "M66.5 51.5 Q72.5 47.6 78.5 51.5 Q72.5 55.2 66.5 51.5 Z"
                      : "M66.5 51.8 Q72.2 47.8 78 51.8 Q72.2 55.6 66.5 51.8 Z"
                  }
                  fill="#f8fafc"
                />
                <circle cx="72.2" cy="51.8" r="2.75" fill={eyeIris} />
                <circle cx="72.2" cy="51.8" r="1.4" fill="#0f172a" />
                <circle cx="73.2" cy="50.8" r="0.85" fill="#ffffff" />
                <path
                  d={
                    isFierceEyes
                      ? "M66 51.6 Q72.5 48 79 51.3"
                      : "M66.2 51.5 Q72.2 47.4 78.5 51.5"
                  }
                  fill="none"
                  stroke={eyeIrisDark}
                  strokeWidth="1.45"
                  strokeLinecap="round"
                />

                {/* Wise Spectacles */}
                {isWiseEyes && (
                  <g fill="none" stroke={outfitTrim} strokeWidth="1.5">
                    <circle cx="47.8" cy="51.8" r="6.8" />
                    <circle cx="72.2" cy="51.8" r="6.8" />
                    <line x1="54.6" y1="51.8" x2="65.4" y2="51.8" />
                  </g>
                )}
              </g>

              {/* 5b. Expressive Brows */}
              <g fill="none" stroke={hairShade} strokeLinecap="round">
                {browStyle === "arched" && (
                  <>
                    <path d="M40.5 45.5 Q46.5 41.5 54 44.5" strokeWidth="2.1" />
                    <path d="M66 44.5 Q73.5 41.5 79.5 45.5" strokeWidth="2.1" />
                  </>
                )}
                {browStyle === "thick" && (
                  <>
                    <path d="M40.5 45 Q47.5 43 54.5 45.5" strokeWidth="3.1" />
                    <path d="M65.5 45.5 Q72.5 43 79.5 45" strokeWidth="3.1" />
                  </>
                )}
                {browStyle === "scarred" && (
                  <>
                    <path d="M40.5 45.5 L54.5 47" strokeWidth="2.5" />
                    <path d="M65.5 47 L79.5 45.5" strokeWidth="2.5" />
                    <path d="M71 41.5 L75 56" stroke={skinDeepShade} strokeWidth="1.5" opacity="0.8" />
                  </>
                )}
                {browStyle === "calm" && (
                  <>
                    <path d="M41 45.2 Q47.5 43 54 45" strokeWidth="2.2" />
                    <path d="M66 45 Q72.5 43 79 45.2" strokeWidth="2.2" />
                  </>
                )}
              </g>

              {/* 5c. Shaded Nose Bridge & Nostrils */}
              <g>
                {noseStyle === "aquiline" && (
                  <>
                    <path d="M60 49 L58.5 60 L62 61.5" fill="none" stroke={skinShade} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M56.8 61.2 Q60 63 63.2 61.2" fill="none" stroke={skinDeepShade} strokeWidth="1.3" strokeLinecap="round" />
                  </>
                )}
                {noseStyle === "broad" && (
                  <>
                    <path d="M59.2 50 L58 60.5" fill="none" stroke={skinShade} strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M55.5 61 Q60 63.5 64.5 61" fill="none" stroke={skinDeepShade} strokeWidth="1.5" strokeLinecap="round" />
                  </>
                )}
                {noseStyle === "button" && (
                  <>
                    <path d="M60 52 L60 59.5" fill="none" stroke={skinShade} strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M57.6 60.6 Q60 62.2 62.4 60.6" fill="none" stroke={skinDeepShade} strokeWidth="1.3" strokeLinecap="round" />
                  </>
                )}
                {noseStyle === "straight" && (
                  <>
                    <path d="M60 49.5 L59.4 60.5" fill="none" stroke={skinShade} strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M57 61.2 Q60 62.8 63 61.2" fill="none" stroke={skinDeepShade} strokeWidth="1.35" strokeLinecap="round" />
                  </>
                )}
              </g>

              {/* 5d. Expressive Mouth */}
              <g>
                {mouthStyle === "smile" && (
                  <>
                    <path d="M52.5 68.5 Q60 74.5 67.5 68.5 Z" fill="#ffffff" />
                    <path d="M52.5 68.5 Q60 74.5 67.5 68.5" fill="none" stroke={skinDeepShade} strokeWidth="1.5" strokeLinecap="round" />
                  </>
                )}
                {mouthStyle === "serious" && (
                  <path d="M53.5 70 Q60 69.2 66.5 70" fill="none" stroke={skinDeepShade} strokeWidth="2" strokeLinecap="round" />
                )}
                {mouthStyle === "smirk" && (
                  <path d="M53.5 70.2 Q61 71.5 67.5 67.5" fill="none" stroke={skinDeepShade} strokeWidth="2" strokeLinecap="round" />
                )}
                {mouthStyle === "confident" && (
                  <>
                    <path d="M53 69 Q60 72.6 67 69" fill="none" stroke={skinDeepShade} strokeWidth="2" strokeLinecap="round" />
                    <path d="M57.5 72.5 Q60 73.4 62.5 72.5" fill="none" stroke={skinShade} strokeWidth="1.1" strokeLinecap="round" />
                  </>
                )}
              </g>

              {/* 6. Beard (V1 + V2 styles) */}
              {resolvedBeard === "goatee" && (
                <path
                  d="M50 72 C50 82 54 88 60 88 C66 88 70 82 70 72 C65 75 55 75 50 72 Z"
                  fill={hairMain}
                />
              )}
              {resolvedBeard === "full" && (
                <path
                  d="M36 58 C36 78 46 90 60 90 C74 90 84 78 84 58 L80 62 C78 72 70 75 60 75 C50 75 42 72 40 62 Z"
                  fill={hairMain}
                />
              )}
              {resolvedBeard === "mustache" && (
                <path
                  d="M44 66 Q52 61 60 65.5 Q68 61 76 66 Q69 69.5 60 67 Q51 69.5 44 66 Z"
                  fill={hairMain}
                />
              )}
              {resolvedBeard === "captain_trimmed" && (
                <g fill={hairMain}>
                  <path d="M38 60 C39 76 48 85 60 85 C72 85 81 76 82 60 L79 62 C78 73 70 79 60 79 C50 79 42 73 41 62 Z" />
                  <path d="M46 66 Q53 62 60 65.5 Q67 62 74 66 Q67 68.5 60 66.5 Q53 68.5 46 66 Z" fill={hairShade} />
                </g>
              )}
              {resolvedBeard === "full_viking" && (
                <g>
                  <path
                    d="M36 57 C35 76 42 88 53 93 L56 101 L60 95 L64 101 L67 93 C78 88 85 76 84 57 L80 61 C78 71 70 73 60 73 C50 73 42 71 40 61 Z"
                    fill={hairMain}
                  />
                  <path
                    d="M45 66 Q53 61 60 65 Q67 61 75 66 Q68 70 60 67.5 Q52 70 45 66 Z"
                    fill={hairShade}
                  />
                  <rect x="52.5" y="91" width="5" height="3.2" rx="1" fill={outfitTrim} />
                  <rect x="62.5" y="91" width="5" height="3.2" rx="1" fill={outfitTrim} />
                </g>
              )}

              {/* 7. Front Hair (V1 + V2 styles) */}
              {!hideFrontHair && resolvedHair !== "none" && (
                <g fill={hairMain}>
                  {resolvedHair === "short" && (
                    <path d="M35 45 C35 27 48 21 60 21 C72 21 85 27 85 45 C77 35 45 35 35 45 Z" />
                  )}
                  {resolvedHair === "wavy" && (
                    <path d="M34 48 C34 26 47 20 60 20 C73 20 86 26 86 48 C78 38 67 34 56 40 C47 44 39 42 34 48 Z" />
                  )}
                  {resolvedHair === "bun" && (
                    <path d="M35 44 C37 27 49 22 60 22 C71 22 83 27 85 44 C75 33 45 33 35 44 Z" />
                  )}
                  {resolvedHair === "royal_bun" && (
                    <>
                      <path d="M35 44 C37 27 49 22 60 22 C71 22 83 27 85 44 C75 33 45 33 35 44 Z" />
                      <path
                        d="M39 36 Q60 28 81 36"
                        fill="none"
                        stroke={outfitTrim}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                  {resolvedHair === "braids" && (
                    <path d="M35 46 C36 27 48 22 60 22 C72 22 84 27 85 46 C74 36 64 33 60 38 C56 33 46 36 35 46 Z" />
                  )}
                  {resolvedHair === "curly" && (
                    <>
                      <circle cx="43" cy="33" r="9" />
                      <circle cx="55" cy="28" r="10" />
                      <circle cx="68" cy="29" r="10" />
                      <circle cx="79" cy="35" r="8.5" />
                    </>
                  )}
                  {resolvedHair === "long" && (
                    <path d="M34 49 C34 26 46 20 60 20 C74 20 86 26 86 49 C77 35 65 33 60 33 C55 33 43 35 34 49 Z" />
                  )}
                  {resolvedHair === "navigator" && (
                    <>
                      <path d="M34 47 C33 26 46 19 61 19 C76 19 86 26 85 46 C77 35 67 32 58 36 C49 40 41 37 34 47 Z" />
                      <path
                        d="M44 26 Q60 22 76 28"
                        fill="none"
                        stroke={hairHighlight}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        opacity="0.6"
                      />
                    </>
                  )}
                </g>
              )}

              {/* 8. Hats, Helm & Sovereign / Admiral Headgear */}
              {resolvedHat === "captain" && (
                <g>
                  <path
                    d="M23 35 C32 15 46 13 60 14 C74 13 88 15 97 35 Q60 43 23 35 Z"
                    fill="#1e293b"
                  />
                  <path
                    d="M24 34 Q60 42 96 34"
                    fill="none"
                    stroke={outfitTrim}
                    strokeWidth="2.8"
                  />
                  <circle cx="60" cy="25" r="3.5" fill={outfitTrim} />
                </g>
              )}
              {resolvedHat === "admiral_bicorne" && (
                <g>
                  <path
                    d="M17 36 C25 14 45 10 60 13 C75 10 95 14 103 36 Q60 42 17 36 Z"
                    fill={outfitDeepDark}
                    stroke={outfitTrim}
                    strokeWidth="1.8"
                  />
                  <path
                    d="M20 34 Q60 40 100 34"
                    fill="none"
                    stroke={outfitTrim}
                    strokeWidth="3"
                  />
                  <polygon points="60,18 64,25 60,31 56,25" fill={outfitTrim} />
                  <circle cx="60" cy="25" r="2.1" fill="#dc2626" />
                </g>
              )}
              {resolvedHat === "explorer" && (
                <g>
                  <path d="M38 32 C40 15 80 15 82 32 Z" fill="#854d0e" />
                  <rect x="38" y="28" width="44" height="4.5" fill="#ca8a04" />
                  <ellipse cx="60" cy="33" rx="37" ry="5.5" fill="#713f12" />
                </g>
              )}
              {resolvedHat === "bandana" && (
                <g>
                  <path
                    d="M34 41 C35 22 85 22 86 41 Q60 35 34 41 Z"
                    fill={outfitPrimary}
                  />
                  <circle cx="84" cy="39" r="5" fill={outfitDark} />
                  <path d="M86 40 L97 48 L90 51 Z" fill={outfitPrimary} />
                </g>
              )}
              {resolvedHat === "helm" && (
                <g>
                  <path
                    d="M33 47 C33 20 46 14 60 14 C74 14 87 20 87 47 Z"
                    fill="#94a3b8"
                    stroke="#475569"
                    strokeWidth="2"
                  />
                  <rect x="57.5" y="27" width="5" height="27" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
                  <path d="M34 43 H86" stroke={outfitTrim} strokeWidth="2.5" />
                </g>
              )}
              {resolvedHat === "crown_gold" && (
                <g>
                  <path
                    d="M36 32 L40 13 L51 23 L60 9 L69 23 L80 13 L84 32 Z"
                    fill="#facc15"
                    stroke="#a16207"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <rect x="36" y="29" width="48" height="5" rx="2" fill="#eab308" stroke="#a16207" strokeWidth="1.2" />
                  <circle cx="60" cy="22" r="2.8" fill="#ef4444" />
                  <circle cx="48" cy="25" r="2.2" fill="#10b981" />
                  <circle cx="72" cy="25" r="2.2" fill="#10b981" />
                </g>
              )}
            </g>
          </svg>
        )}
      </div>
      {showFrameLabel && (
        <span className="player-avatar__frame-label">🏆 {frameLabel}</span>
      )}
    </div>
  );
}
