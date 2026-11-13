import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import {
  SettlementSvgPiece,
  CitySvgPiece,
  RoadSvgPiece,
} from "./GameIcons";
import { savePieceSkin } from "../../utils/pieceSkin";

describe("GameIcons Piece SVG components", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders SettlementSvgPiece with default contrast skin", () => {
    const { container } = render(
      <svg>
        <SettlementSvgPiece color="RED" />
      </svg>
    );
    // Should contain the high-contrast dual-border path and solid core
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
    // Outer border path
    const outerBorder = Array.from(paths).find(
      (p) => p.getAttribute("stroke-width") === "2.6"
    );
    expect(outerBorder).toBeDefined();
    expect(outerBorder?.getAttribute("fill")).toBe("#000000");
  });

  it("renders SettlementSvgPiece with cottage variant skin", () => {
    const { container } = render(
      <svg>
        <SettlementSvgPiece color="RED" skin="cottage" />
      </svg>
    );
    // Cottage has chimneys (rect)
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
  });

  it("renders CitySvgPiece with default contrast skin (stepped tower + hall)", () => {
    const { container } = render(
      <svg>
        <CitySvgPiece color="BLUE" />
      </svg>
    );
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
    // Stepped dual-border stroke
    const steppedBorder = Array.from(paths).find(
      (p) => p.getAttribute("stroke-width") === "2.8"
    );
    expect(steppedBorder).toBeDefined();
    expect(steppedBorder?.getAttribute("fill")).toBe("#000000");
  });

  it("renders CitySvgPiece with cottage variant skin", () => {
    const { container } = render(
      <svg>
        <CitySvgPiece color="BLUE" skin="cottage" />
      </svg>
    );
    // Spire polygon or keep rect
    const polygons = container.querySelectorAll("polygon");
    expect(polygons.length).toBeGreaterThan(0);
  });

  it("renders RoadSvgPiece with default contrast skin (straight rectangular bar)", () => {
    const { container } = render(<RoadSvgPiece color="ORANGE" />);
    // Outer rect with stroke-width 2.6
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThanOrEqual(3);
    const outerRect = Array.from(rects).find(
      (r) => r.getAttribute("stroke-width") === "2.6"
    );
    expect(outerRect).toBeDefined();
    expect(outerRect?.getAttribute("fill")).toBe("#000000");
  });

  it("renders RoadSvgPiece with cottage variant skin (beveled causeway)", () => {
    const { container } = render(<RoadSvgPiece color="ORANGE" skin="cottage" />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("respects global saved skin when skin prop is omitted", () => {
    savePieceSkin("cottage");
    const { container } = render(
      <svg>
        <SettlementSvgPiece color="WHITE" />
      </svg>
    );
    // Should render cottage variant with rect chimney
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
  });
});
