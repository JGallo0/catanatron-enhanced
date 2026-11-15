import type { CSSProperties } from "react";
import { getPlayerColorMeta } from "../config/assetRegistry";
import type { AwardConquestFX } from "../utils/tabletopPacing";
import "./AwardConquestOverlay.scss";

const CREST_META = {
  ROAD: {
    src: "/assets/illustrations/ui/longest-road-crest.png",
    alt: "Brasão de Maior Estrada",
    title: "Maior Estrada",
  },
  ARMY: {
    src: "/assets/illustrations/ui/largest-army-crest.png",
    alt: "Brasão de Maior Exército",
    title: "Maior Exército",
  },
} as const;

export default function AwardConquestOverlay({
  award,
}: {
  award: AwardConquestFX;
}) {
  const crest = CREST_META[award.type];
  const playerColor = getPlayerColorMeta()[award.color]?.primary || "#facc15";
  const initial = Array.from(award.playerName.trim())[0]?.toLocaleUpperCase("pt-BR") || "?";

  return (
    <div
      className={`award-conquest-overlay award-conquest-overlay--${award.type.toLowerCase()}`}
      data-testid="award-conquest-overlay"
      role="status"
      aria-live="assertive"
      aria-label={`${award.playerName} conquistou ${crest.title} e recebeu 2 pontos de vitória`}
      style={
        {
          "--award-player-color": playerColor,
          "--award-crest-mask": `url("${crest.src}")`,
        } as CSSProperties
      }
    >
      <div className="award-conquest-overlay__scrim" aria-hidden="true" />
      <div className="award-conquest-overlay__stage">
        <div className="award-conquest-overlay__halo" aria-hidden="true" />
        <img
          className="award-conquest-overlay__crest"
          src={crest.src}
          alt={crest.alt}
        />
        <div className="award-conquest-overlay__glint" aria-hidden="true" />
        <div className="award-conquest-overlay__particles" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="award-conquest-overlay__identity-plate">
          <span className="award-conquest-overlay__avatar" aria-hidden="true">
            {initial}
          </span>
          <span className="award-conquest-overlay__identity-copy">
            <small>Novo detentor</small>
            <strong
              className="award-conquest-overlay__player-name"
              title={award.playerName}
            >
              {award.playerName}
            </strong>
          </span>
          <strong className="award-conquest-overlay__points">+2 PV</strong>
        </div>
      </div>
    </div>
  );
}
