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
 * Cube rotations that bring face `1..6` cleanly to the TOP face of the cube (visão superior / vista de cima),
 * matching real physical tabletop dice where the upward-facing surface is the rolled result.
 * Face mapping: 1=front, 2=bottom, 3=right, 4=left, 5=top, 6=back.
 */
const TARGET_FACE_TRANSFORM: Record<number, string> = {
  1: "rotateX(90deg)",
  2: "rotateX(180deg)",
  3: "rotateZ(-90deg)",
  4: "rotateZ(90deg)",
  5: "rotateX(0deg)",
  6: "rotateX(-90deg)",
};

const FACES = [
  { faceValue: 1, modifier: "front", rotation: "rotateY(0deg)" },
  { faceValue: 6, modifier: "back", rotation: "rotateY(180deg)" },
  { faceValue: 3, modifier: "right", rotation: "rotateY(90deg)" },
  { faceValue: 4, modifier: "left", rotation: "rotateY(-90deg)" },
  { faceValue: 5, modifier: "top", rotation: "rotateX(90deg)" },
  { faceValue: 2, modifier: "bottom", rotation: "rotateX(-90deg)" },
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
  // A normal do topo aponta para -Y antes da inclinação em direção à câmera.
  const cameraTilt = dieIndex === 1 ? "rotateX(-68deg) rotateZ(10deg)" : "rotateX(-66deg) rotateZ(-6deg)";

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
      <span className="dice3d-tilt" style={{ "--dice-camera-tilt": cameraTilt } as React.CSSProperties} aria-hidden="true">
        <span
          className="dice3d-cube"
          style={rolling ? undefined : { transform: faceTransform }}
        >
          {/* Solid bronze/mahogany inner chamfer core so corners never leak */}
          <span className="dice3d-core dice3d-core--x" />
          <span className="dice3d-core dice3d-core--y" />
          <span className="dice3d-core dice3d-core--z" />

          {FACES.map(({ faceValue, modifier, rotation }) => {
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
                style={{ transform: `${rotation} translateZ(var(--die-half))` }}
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
