import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Tile from "./Tile";
import type { Tile as TileData } from "../utils/api.types";

describe("Tile component (Ultra-HD Vector standard)", () => {
  it("renders land resource tile with pure vector SVG and no blurry img overlays", () => {
    const tileData: TileData = {
      id: 1,
      type: "RESOURCE_TILE",
      resource: "WOOD",
      number: 8,
    };

    const { container } = render(
      <Tile
        center={[200, 200]}
        coordinate={[0, 0, 0]}
        tile={tileData}
        size={70}
        flashing={false}
      />
    );

    // Vector artwork container must be present
    const artwork = container.querySelector(".tile__artwork");
    expect(artwork).toBeInTheDocument();

    // Must render SVG inside artwork
    const svg = artwork?.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 200 230");

    // Must have bevel frame overlay and number token
    expect(container.querySelector(".tile__frame-svg")).toBeInTheDocument();
    expect(container.querySelector(".number-token")).toBeInTheDocument();

    // MUST NOT have any raster img overlay (Option 1 standardization)
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".tile__custom-illustration")).toBeNull();
  });

  it("renders desert tile with pure vector SVG and no number token", () => {
    const desertData: TileData = {
      id: 2,
      type: "DESERT",
    };

    const { container } = render(
      <Tile
        center={[200, 200]}
        coordinate={[0, 0, 0]}
        tile={desertData}
        size={70}
        flashing={false}
      />
    );

    const artwork = container.querySelector(".tile__artwork");
    expect(artwork).toBeInTheDocument();
    expect(artwork?.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector(".number-token")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders water tile cleanly", () => {
    const waterData: TileData = {
      type: "WATER",
    };

    const { container } = render(
      <Tile
        center={[200, 200]}
        coordinate={[0, 0, 0]}
        tile={waterData}
        size={70}
        flashing={false}
      />
    );

    expect(container.querySelector(".tile__sea-surface")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders port tile with harbor scene and placard", () => {
    const portData: TileData = {
      id: 3,
      type: "PORT",
      direction: "NORTH",
      resource: "BRICK",
    };

    const { container } = render(
      <Tile
        center={[200, 200]}
        coordinate={[0, 0, 0]}
        tile={portData}
        size={70}
        flashing={false}
      />
    );

    expect(container.querySelector(".port-scene")).toBeInTheDocument();
    expect(container.querySelector(".port-scene__placard")).toBeInTheDocument();
  });
});
