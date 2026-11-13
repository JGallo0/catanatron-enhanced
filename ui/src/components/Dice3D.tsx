import cn from "classnames";
import { useLanguage } from "../i18n";
import "./Dice3D.scss";

export type Dice3DProps = {
  value: number;
  rolling?: boolean;
  isHot?: boolean;
  size?: number;
  dieIndex?: 0 | 1;
  variant?: "stage" | "mini";
};

const PIP_COORDS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [26, 26],
    [50, 50],
    [74, 74],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [26, 26],
    [74, 26],
    [50, 50],
    [26, 74],
    [74, 74],
  ],
  6: [
    [28, 23],
    [72, 23],
    [28, 50],
    [72, 50],
    [28, 77],
    [72, 77],
  ],
};

/**
 * Cube rotations that bring face `1..6` cleanly to the top-facing position inside `.dice3d-tilt`
 * for a top-down perspective (visão superior / vista de cima).
 * Face mapping: 1=front, 2=bottom, 3=right, 4=left, 5=top, 6=back.
 * Corrected orientations: opposite faces sum to 7.
 */
const TARGET_FACE_TRANSFORM: Record<number, string> = {
  1: "rotateX(90deg) rotateY(180deg)",
  2: "rotateX(0deg)",
  3: "rotateY(90deg) rotateZ(90deg)",
  4: "rotateY(-90deg) rotateZ(-90deg)",
  5: "rotateY(180deg) rotateZ(180deg)",
  6: "rotateX(90deg)",
};

const FACES: Array<{ faceValue: 1 | 2 | 3 | 4 | 5 | 6; modifier: string }> = [
  { faceValue: 1, modifier: "front" },
  { faceValue: 6, modifier: "back" },
  { faceValue: 3, modifier: "right" },
  { faceValue: 4, modifier: "left" },
  { faceValue: 5, modifier: "top" },
  { faceValue: 2, modifier: "bottom" },
];

export default function Dice3D({
  value,
  rolling = false,
  isHot = false,
  size = 50,
  dieIndex = 0,
  variant = "stage",
}: Dice3DProps) {
  const { t } = useLanguage();
  const safeValue = Math.min(6, Math.max(1, Math.round(value || 1)));
  const faceTransform = TARGET_FACE_TRANSFORM[safeValue] || TARGET_FACE_TRANSFORM[1];

  return (
    <span
      className={cn("dice3d-scene", `dice3d-scene--${variant}`, {
        "is-rolling": rolling,
        "is-settled": !rolling,
        "is-hot": isHot,
        "is-alt": dieIndex === 1,
      })}
      style={
        {
          "--die-size": `${size}px`,
          "--die-half": `${size / 2}px`,
        } as React.CSSProperties
      }
      role="img"
      aria-label={
        rolling
          ? t("Dado em rotação", "Rolling die")
          : t(`Dado ${safeValue}`, `Die ${safeValue}`)
      }
    >
      <span className="dice3d-tilt" aria-hidden="true">
        <span
          className="dice3d-cube"
          style={rolling ? undefined : { transform: faceTransform }}
        >
          {/* Solid bronze/mahogany inner chamfer core so corners never leak */}
          <span className="dice3d-core dice3d-core--x" />
          <span className="dice3d-core dice3d-core--y" />
          <span className="dice3d-core dice3d-core--z" />

          {FACES.map(({ faceValue, modifier }) => {
            const pips = PIP_COORDS[faceValue];
            const pipRed = isHot || faceValue === 1;
            return (
              <span
                key={faceValue}
                className={cn(
                  "dice3d-face",
                  `dice3d-face--${modifier}`,
                  { "is-red-pips": pipRed }
                )}
              >
                <span className="dice3d-face__bevel">
                  {pips.map(([x, y], idx) => (
                    <span
                      key={idx}
                      className="dice3d-pip"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    />
                  ))}
                </span>
              </span>
            );
          })}
        </span>
      </span>
    </span>
  );
}
