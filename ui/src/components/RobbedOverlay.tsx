import { useEffect, useRef } from "react";
import { getResourceMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import type { ResourceCard } from "../utils/api.types";
import { CardArtIllustration } from "./icons/GameIcons";
import "./RobbedOverlay.scss";

export const ROBBED_OVERLAY_DURATION_MS = 3200;

type RobbedOverlayProps = {
  resource: ResourceCard;
  attackerName: string;
  source: "SEVEN" | "KNIGHT";
  onComplete: () => void;
};

export default function RobbedOverlay({
  resource,
  attackerName,
  source,
  onComplete,
}: RobbedOverlayProps) {
  const { language, t } = useLanguage();
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  useEffect(() => {
    const timer = setTimeout(() => {
      doneRef.current();
    }, ROBBED_OVERLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [resource, attackerName, source]);

  const meta = getResourceMeta(language)[resource];
  const headline = t("Você foi roubado", "You were robbed");
  const detailText =
    source === "KNIGHT"
      ? t(
          `${attackerName} usou Cavaleiro e levou 1× ${meta.label}`,
          `${attackerName} played a Knight and stole 1× ${meta.label}`
        )
      : t(
          `${attackerName} moveu o Ladrão e levou 1× ${meta.label}`,
          `${attackerName} moved the Robber and stole 1× ${meta.label}`
        );

  return (
    <aside
      className="robbed-overlay"
      data-testid="robbed-overlay"
      role="status"
      aria-live="assertive"
      aria-label={`${headline}: ${meta.label}`}
    >
      <div className="robbed-overlay__stage">
        <div className="robbed-overlay__swords" aria-hidden="true">
          <svg
            className="robbed-overlay__swords-svg"
            viewBox="0 0 180 140"
            width="180"
            height="140"
          >
            <defs>
              <linearGradient id="robbedBladeGradA" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="48%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <linearGradient id="robbedBladeGradB" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="48%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              <linearGradient id="robbedHiltGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="55%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
            </defs>

            {/* Left Sword (swings from bottom-left toward top-right) */}
            <g className="robbed-overlay__sword robbed-overlay__sword--left">
              <path
                d="M126 18 L119 36 L60 95 L53 88 L112 29 Z"
                fill="url(#robbedBladeGradA)"
                stroke="#0f172a"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <line
                x1="118"
                y1="26"
                x2="60"
                y2="84"
                stroke="#ffffff"
                strokeWidth="1.4"
                strokeOpacity="0.65"
              />
              <path
                d="M44 77 L68 101 L63 106 L39 82 Z"
                fill="url(#robbedHiltGold)"
                stroke="#451a03"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M52 94 L35 111 L40 116 L57 99 Z"
                fill="#7f1d1d"
                stroke="#1c1917"
                strokeWidth="1.8"
              />
              <circle
                cx="35"
                cy="115"
                r="5.5"
                fill="url(#robbedHiltGold)"
                stroke="#451a03"
                strokeWidth="1.8"
              />
            </g>

            {/* Right Sword (swings from bottom-right toward top-left) */}
            <g className="robbed-overlay__sword robbed-overlay__sword--right">
              <path
                d="M54 18 L61 36 L120 95 L127 88 L68 29 Z"
                fill="url(#robbedBladeGradB)"
                stroke="#0f172a"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <line
                x1="62"
                y1="26"
                x2="120"
                y2="84"
                stroke="#ffffff"
                strokeWidth="1.4"
                strokeOpacity="0.65"
              />
              <path
                d="M136 77 L112 101 L117 106 L141 82 Z"
                fill="url(#robbedHiltGold)"
                stroke="#451a03"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M128 94 L145 111 L140 116 L123 99 Z"
                fill="#7f1d1d"
                stroke="#1c1917"
                strokeWidth="1.8"
              />
              <circle
                cx="145"
                cy="115"
                r="5.5"
                fill="url(#robbedHiltGold)"
                stroke="#451a03"
                strokeWidth="1.8"
              />
            </g>

            {/* Clash Spark Burst at Sword Crossing */}
            <g className="robbed-overlay__spark">
              <circle cx="90" cy="62" r="18" fill="rgba(250, 204, 21, 0.35)" />
              <path
                d="M90 36 L94 55 L112 52 L98 63 L114 76 L93 70 L90 88 L86 70 L66 76 L82 63 L68 52 L86 55 Z"
                fill="#fef08a"
                stroke="#ef4444"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        <div className="robbed-overlay__card-wrap">
          <div className="robbed-overlay__card">
            <CardArtIllustration
              resource={resource}
              className="robbed-overlay__art"
            />
            <div className="robbed-overlay__card-footer">
              <span>−1</span>
              <strong>{meta.label}</strong>
            </div>
          </div>
        </div>

        <div className="robbed-overlay__caption">
          <strong className="robbed-overlay__title">{headline}</strong>
          <span className="robbed-overlay__subtitle">{detailText}</span>
        </div>
      </div>
    </aside>
  );
}
