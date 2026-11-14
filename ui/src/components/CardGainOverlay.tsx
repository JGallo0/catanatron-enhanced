import { useEffect, useRef, type CSSProperties } from "react";
import type { Card, ResourceCard } from "../utils/api.types";
import { getDevCardMeta, getResourceMeta, type DevCardType } from "../config/assetRegistry";
import { RESOURCE_TYPES } from "../utils/cardGains";
import { CardArtIllustration } from "./icons/GameIcons";
import "./CardGainOverlay.scss";

export const CARD_GAIN_DURATION_MS = 1800;

type CardGainOverlayProps = {
  cards?: Card[];
  card?: Card;
  onComplete: () => void;
};

export default function CardGainOverlay({
  cards,
  card,
  onComplete,
}: CardGainOverlayProps) {
  const done = useRef(onComplete);
  done.current = onComplete;

  const resolvedCards = cards && cards.length > 0 ? cards : card ? [card] : [];

  useEffect(() => {
    const timer = setTimeout(() => done.current(), CARD_GAIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (resolvedCards.length === 0) return null;

  const hasDevCard = resolvedCards.some(
    (c) => !(RESOURCE_TYPES as readonly string[]).includes(c)
  );
  const captionText =
    resolvedCards.length > 1
      ? `Recursos recebidos (${resolvedCards.length})`
      : hasDevCard
        ? "Carta de desenvolvimento recebida"
        : "Recurso recebido";

  return (
    <aside className="card-gain" role="status">
      <div className="card-gain__batch">
        <span className="card-gain__caption">{captionText}</span>
        <div className="card-gain__row">
          {resolvedCards.map((itemCard, idx) => {
            const isResource = (RESOURCE_TYPES as readonly string[]).includes(
              itemCard
            );
            const meta = isResource
              ? getResourceMeta("pt")[itemCard as ResourceCard]
              : getDevCardMeta("pt")[itemCard as DevCardType];
            const target =
              document.querySelector(`[data-card-destination="${itemCard}"]`) ??
              document.querySelector(".resource-cards");
            const bounds = target?.getBoundingClientRect();
            const cardStyle = {
              "--gain-x": `${bounds ? bounds.left + bounds.width / 2 - window.innerWidth / 2 : 0}px`,
              "--gain-y": `${bounds ? bounds.top + bounds.height / 2 - window.innerHeight / 2 : window.innerHeight * 0.42}px`,
            } as CSSProperties;

            return (
              <div
                key={`${itemCard}-${idx}`}
                className="card-gain__flight"
                aria-label={`Você recebeu: ${meta.label}`}
                style={cardStyle}
              >
                <div className="card-gain__card">
                  {isResource ? (
                    <CardArtIllustration
                      resource={itemCard as ResourceCard}
                      className="card-gain__art"
                    />
                  ) : (
                    <CardArtIllustration
                      cardType={itemCard as DevCardType}
                      className="card-gain__art"
                    />
                  )}
                  <div className="card-gain__name">
                    <span>+1</span>
                    <strong>{meta.label}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <span className="card-gain__caption">
          {resolvedCards.length > 1
            ? "Adicionadas à sua mão"
            : "Adicionada à sua mão"}
        </span>
      </div>
    </aside>
  );
}
