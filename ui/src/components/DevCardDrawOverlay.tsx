import { useEffect, useState } from "react";
import cn from "classnames";
import { getDevCardMeta, type DevCardType } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import { CardArtIllustration, DevCardIcon } from "./icons/GameIcons";
import "./DevCardDrawOverlay.scss";

export type DevCardDrawOverlayProps = {
  card: DevCardType | null;
  onComplete?: () => void;
};

export default function DevCardDrawOverlay({
  card,
  onComplete,
}: DevCardDrawOverlayProps) {
  const { language, t } = useLanguage();
  const devMeta = getDevCardMeta(language);
  const [phase, setPhase] = useState<"enter" | "glide" | null>(null);

  useEffect(() => {
    if (!card) {
      setPhase(null);
      return;
    }

    setPhase("enter");

    // After presenting in center, glide down towards player's hand dock
    const glideTimer = setTimeout(() => {
      setPhase("glide");
    }, 1150);

    // After glide animation completes, clear
    const finishTimer = setTimeout(() => {
      setPhase(null);
      onComplete?.();
    }, 1750);

    return () => {
      clearTimeout(glideTimer);
      clearTimeout(finishTimer);
    };
  }, [card, onComplete]);

  if (!card || !phase) return null;

  const meta = devMeta[card];

  return (
    <aside
      className={cn("dev-card-draw-overlay", `phase-${phase}`)}
      aria-live="polite"
      role="status"
      aria-label={t(
        `Carta comprada: ${meta.label}`,
        `Card drawn: ${meta.label}`
      )}
    >
      <div className="dev-card-draw-stage">
        {/* Shimmer backdrop flash */}
        <div className="dev-card-draw-stage__aura" aria-hidden="true" />

        {/* Floating title pill */}
        <div className="dev-card-draw-stage__header">
          <span className="dev-card-draw-stage__sparkle">✦</span>
          <span>{t("Nova Carta de Desenvolvimento!", "New Development Card!")}</span>
          <span className="dev-card-draw-stage__sparkle">✦</span>
        </div>

        {/* 3D Animated Card */}
        <div className="dev-card-draw-card">
          <div className="dev-card-draw-card__frame">
            {/* Card Artwork */}
            <CardArtIllustration
              cardType={card}
              className="dev-card-draw-card__art"
            />

            {/* Top Chrome */}
            <div className="dev-card-draw-card__top">
              <span className="dev-card-draw-card__crest">
                <DevCardIcon card={card} size={18} />
              </span>
              <span className="dev-card-draw-card__tag">
                {card === "VICTORY_POINT" ? "+1 PV" : t("DEV", "DEV")}
              </span>
            </div>

            {/* Bottom Info Banner */}
            <div className="dev-card-draw-card__bottom">
              <h3 className="dev-card-draw-card__name">{meta.label}</h3>
              <p className="dev-card-draw-card__desc">{meta.description}</p>
            </div>
          </div>
        </div>

        <div className="dev-card-draw-stage__sub">
          {t("Adicionada à sua mão", "Added to your hand")}
        </div>
      </div>
    </aside>
  );
}
