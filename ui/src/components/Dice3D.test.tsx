import { render, screen } from "@testing-library/react";
import { Matrix4, Vector3 } from "three";
import { describe, expect, test } from "vitest";
import Dice3D from "./Dice3D";

function rotationMatrix(transform: string) {
  const result = new Matrix4();
  for (const [, axis, degrees] of transform.matchAll(/rotate([XYZ])\((-?[\d.]+)deg\)/g)) {
    const radians = Number(degrees) * Math.PI / 180;
    const rotation = new Matrix4();
    if (axis === "X") rotation.makeRotationX(radians);
    if (axis === "Y") rotation.makeRotationY(radians);
    if (axis === "Z") rotation.makeRotationZ(radians);
    result.multiply(rotation);
  }
  return result;
}

describe("Dice3D", () => {
  test.each([0, 1] as const)("shows the rolled pips on the face turned toward the camera (die %i)", (dieIndex) => {
    for (let value = 1; value <= 6; value++) {
      const { container, unmount } = render(<Dice3D value={value} dieIndex={dieIndex} />);
      expect(screen.getByRole("img", { name: `Dado ${value}` })).toBeInTheDocument();
      const tilt = container.querySelector<HTMLElement>(".dice3d-tilt")!.style.getPropertyValue("--dice-camera-tilt");
      const cube = container.querySelector<HTMLElement>(".dice3d-cube")!;
      const result = rotationMatrix(cube.style.transform);
      const view = rotationMatrix(tilt).multiply(result);
      const faces = Array.from(cube.querySelectorAll<HTMLElement>(".dice3d-face"), (face) => {
        const normal = new Vector3(0, 0, 1).applyMatrix4(rotationMatrix(face.style.transform));
        return {
          pips: face.querySelectorAll(".dice3d-pip").length,
          up: -normal.clone().applyMatrix4(result).y,
          facingCamera: normal.applyMatrix4(view).z,
        };
      });
      expect(faces).toHaveLength(6);
      expect(faces.find((face) => face.up > 0.99)?.pips).toBe(value);
      expect(faces.sort((a, b) => b.facingCamera - a.facingCamera)[0].pips).toBe(value);
      unmount();
    }
  });
});
