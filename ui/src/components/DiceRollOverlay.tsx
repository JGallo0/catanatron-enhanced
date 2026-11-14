import cn from "classnames";
import type { Color } from "../utils/api.types";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import Dice3D from "./Dice3D";
import "./DiceRollOverlay.scss";

export type DiceRollOverlayProps = {
  open: boolean;
  rolling: boolean;
  dice: [number, number] | null;
  rollerName: string;
  rollerColor: Color;
  center?: [number, number];
  size?: number;
};

export default function DiceRollOverlay({
  open,
  rolling,
  dice,
  rollerName,
  rollerColor,
  center,
  size,
}: DiceRollOverlayProps) {
  const { language, t } = useLanguage();
  if (!open || !dice) return null;

  const sum = dice[0] + dice[1];
  const isHot = !rolling && (sum === 6 || sum === 8);
  const isSeven = !rolling && sum === 7;
  const palette = getPlayerColorMeta(language)[rollerColor];

  // Anchor directly inside the enlarged right black box half on the 1.5x table (1560, 616 in 2000x1200 SVG)
  const boardAnchoredStyle: React.CSSProperties =
    center && size
      ? {
          "--roller-color": palette.primary,
          position: "absolute",
          left: center[0] + size * 10.5,
          top: center[1] + size * 0.3,
          right: "auto",
          transform: `translate(-50%, -50%) scale(${Math.max(0.48, size / 70)})`,
        } as React.CSSProperties
      : ({ "--roller-color": palette.primary } as React.CSSProperties);

  return (
    <div
      className={cn("tabletop-dice-stage", {
        "tabletop-dice-stage--board-anchored": Boolean(center && size),
        "is-rolling": rolling,
        "is-settled": !rolling,
        "is-hot": isHot,
        "is-seven": isSeven,
      })}
      style={boardAnchoredStyle}
      role="status"
      aria-live="polite"
    >
      <span
        className="tabletop-dice-stage__rivet tabletop-dice-stage__rivet--tl"
        aria-hidden="true"
      />
      <span
        className="tabletop-dice-stage__rivet tabletop-dice-stage__rivet--tr"
        aria-hidden="true"
      />
      <span
        className="tabletop-dice-stage__rivet tabletop-dice-stage__rivet--bl"
        aria-hidden="true"
      />
      <span
        className="tabletop-dice-stage__rivet tabletop-dice-stage__rivet--br"
        aria-hidden="true"
      />

      <div className="tabletop-dice-stage__header">
        <span
          className="tabletop-dice-stage__dot"
          style={{ background: palette.primary }}
        />
        <span className="tabletop-dice-stage__roller">{rollerName}</span>
      </div>

      <div className="tabletop-dice-stage__tray">
        <div className="tabletop-dice-stage__felt-ring" aria-hidden="true" />
        <div className="tabletop-dice-stage__faces">
          <div className="tabletop-dice-stage__die-slot">
            <span className="tabletop-dice-stage__die tabletop-dice-stage__die--first">
              <Dice3D
                value={dice[0]}
                rolling={rolling}
                isHot={isHot || isSeven}
                size={52}
                dieIndex={0}
                variant="stage"
              />
            </span>
            <span className="tabletop-dice-stage__shadow" aria-hidden="true" />
          </div>
          <div className="tabletop-dice-stage__die-slot">
            <span className="tabletop-dice-stage__die tabletop-dice-stage__die--second">
              <Dice3D
                value={dice[1]}
                rolling={rolling}
                isHot={isHot || isSeven}
                size={52}
                dieIndex={1}
                variant="stage"
              />
            </span>
            <span
              className="tabletop-dice-stage__shadow tabletop-dice-stage__shadow--second"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="tabletop-dice-stage__footer">
        {rolling ? (
          <span className="tabletop-dice-stage__status-rolling">
            {t("🎲 Rolando...", "🎲 Rolling...")}
          </span>
        ) : isSeven ? (
          <strong>{t("⚔️ Total 7 — Ladrão!", "⚔️ Total 7 — Robber!")}</strong>
        ) : (
          <strong>✦ Total {sum} ✦</strong>
        )}
      </div>
    </div>
  );
}
