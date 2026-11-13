import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Dice3D from "./Dice3D";

describe("Dice3D", () => {
  test("renders correct transforms and labels for all faces 1 to 6 without face inversion", () => {
    const expectedTransforms: Record<number, string> = {
      1: "rotateX(90deg)",
      2: "rotateX(180deg)",
      3: "rotateZ(-90deg)",
      4: "rotateZ(90deg)",
      5: "rotateX(0deg)",
      6: "rotateX(-90deg)",
    };

    for (let val = 1; val <= 6; val++) {
      const { container, unmount } = render(<Dice3D value={val} size={50} />);

      const dieScene = screen.getByLabelText(new RegExp(`Dado ${val}`, "i"));
      expect(dieScene).toBeInTheDocument();

      const cube = container.querySelector(".dice3d-cube") as HTMLElement;
      expect(cube).toBeTruthy();
      expect(cube.style.transform).toBe(expectedTransforms[val]);

      unmount();
    }
  });

  test("renders 12 face elements per 2-die roll with accurate pips", () => {
    const { container } = render(
      <div>
        <Dice3D value={6} size={50} dieIndex={0} />
        <Dice3D value={5} size={50} dieIndex={1} />
      </div>
    );

    const cubes = container.querySelectorAll(".dice3d-cube");
    expect(cubes).toHaveLength(2);
    // Die 1 (value 6) must have transform rotateX(-90deg) bringing 6 to the TOP face
    expect((cubes[0] as HTMLElement).style.transform).toBe("rotateX(-90deg)");
    // Die 2 (value 5) must have transform rotateX(0deg) bringing 5 to the TOP face
    expect((cubes[1] as HTMLElement).style.transform).toBe("rotateX(0deg)");
  });
});
