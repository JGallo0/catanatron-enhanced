import { useEffect, useRef, type CSSProperties } from "react";
import type { Card, ResourceCard } from "../utils/api.types";
import { getDevCardMeta, getResourceMeta, type DevCardType } from "../config/assetRegistry";
import { RESOURCE_TYPES } from "../utils/cardGains";
import { CardArtIllustration } from "./icons/GameIcons";
import "./CardGainOverlay.scss";

export const CARD_GAIN_DURATION_MS = 1800;
export default function CardGainOverlay({ card, onComplete }: { card: Card; onComplete: () => void }) {
  const done = useRef(onComplete);
  done.current = onComplete;
  const isResource = (RESOURCE_TYPES as readonly string[]).includes(card);
  const meta = isResource ? getResourceMeta("pt")[card as ResourceCard] : getDevCardMeta("pt")[card as DevCardType];
  const target = document.querySelector(`[data-card-destination="${card}"]`) ?? document.querySelector(".resource-cards");
  const bounds = target?.getBoundingClientRect();
  const style = {
    "--gain-x": `${bounds ? bounds.left + bounds.width / 2 - window.innerWidth / 2 : 0}px`,
    "--gain-y": `${bounds ? bounds.top + bounds.height / 2 - window.innerHeight / 2 : window.innerHeight * .42}px`,
  } as CSSProperties;
  useEffect(() => {
    const timer = setTimeout(() => done.current(), CARD_GAIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);
  return <aside className="card-gain" role="status" aria-label={`Você recebeu: ${meta.label}`} style={style}>
    <div className="card-gain__flight">
      <span className="card-gain__caption">{isResource ? "Recurso recebido" : "Carta de desenvolvimento recebida"}</span>
      <div className="card-gain__card">
        {isResource ? <CardArtIllustration resource={card as ResourceCard} className="card-gain__art" /> :
          <CardArtIllustration cardType={card as DevCardType} className="card-gain__art" />}
        <div className="card-gain__name"><span>+1</span><strong>{meta.label}</strong></div>
      </div>
      <span className="card-gain__caption">Adicionada à sua mão</span>
    </div>
  </aside>;
}
