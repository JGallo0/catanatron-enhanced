import { useEffect, useState } from "react";
import cn from "classnames";
import type { Color } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { DiceFaceSvg } from "./icons/GameIcons";
import "./DiceRollOverlay.scss";

export type DiceRollOverlayProps = {
  open: boolean;
  rolling: boolean;
  dice: [number, number] | null;
  rollerName: string;
  rollerColor: Color;
};

export default function DiceRollOverlay({
  open,
  rolling,
  dice,
  rollerName,
  rollerColor,
}: DiceRollOverlayProps) {
  const [spinFaces, setSpinFaces] = useState<[number, number]>([1, 6]);

  useEffect(() => {
    if (!open || !rolling) return;
    let step = 0;
    const iv = setInterval(() => {
      step += 1;
      setSpinFaces([((step * 2) % 6) + 1, ((step * 5 + 1) % 6) + 1]);
    }, 85);
    return () => clearInterval(iv);
  }, [open, rolling]);

  if (!open || !dice) return null;

  const shownDice = rolling ? spinFaces : dice;
  const sum = dice[0] + dice[1];
  const isHot = !rolling && (sum === 6 || sum === 8);
  const isSeven = !rolling && sum === 7;
  const palette = PLAYER_COLOR_META[rollerColor];

  return (
    <div
      className={cn("tabletop-dice-stage", {
        "is-rolling": rolling,
        "is-settled": !rolling,
        "is-hot": isHot,
        "is-seven": isSeven,
      })}
      style={{ borderColor: palette.primary }}
      role="status"
      aria-live="polite"
    >
      <div className="tabletop-dice-stage__header">
        <span
          className="tabletop-dice-stage__dot"
          style={{ background: palette.primary }}
        />
        <span className="tabletop-dice-stage__roller">{rollerName}</span>
      </div>
      <div className="tabletop-dice-stage__faces">
        <span className="tabletop-dice-stage__die">
          <DiceFaceSvg value={shownDice[0]} size={42} isHot={isHot || isSeven} />
        </span>
        <span className="tabletop-dice-stage__die tabletop-dice-stage__die--second">
          <DiceFaceSvg value={shownDice[1]} size={42} isHot={isHot || isSeven} />
        </span>
      </div>
      <div className="tabletop-dice-stage__footer">
        {rolling ? (
          <span>🎲 Rolando...</span>
        ) : isSeven ? (
          <strong>Total 7 — Ladrão!</strong>
        ) : (
          <strong>Total {sum}</strong>
        )}
      </div>
    </div>
  );
}
