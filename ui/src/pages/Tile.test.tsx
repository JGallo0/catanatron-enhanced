import { afterEach, describe, it, expect } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import Tile from "./Tile";
import type { Tile as TileData } from "../utils/api.types";
import { saveBoardSkin } from "../utils/boardSkin";

afterEach(() => localStorage.clear());

describe("Tile", () => {
  it("restores diorama artwork by default and switches to classic and vector styles", () => {
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

    const artwork = container.querySelector(".tile__artwork");
    expect(artwork).toBeInTheDocument();
    const diorama = artwork!.querySelector("img")!;
    expect(diorama).toHaveAttribute("src", "/assets/illustrations/tiles/themes/diorama/wood.webp");
    fireEvent.load(diorama);
    expect(diorama).toBeVisible();
    expect(artwork?.querySelector("svg")).toBeNull();

    act(() => saveBoardSkin("classic"));
    expect(artwork?.querySelector("img")).toHaveAttribute("src", "/assets/illustrations/tiles/themes/classic/wood.webp");
    expect(container.querySelector(".tile__hex-surface--classic")).toBeInTheDocument();

    act(() => saveBoardSkin("vector"));
    const svg = artwork?.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 200 230");
    expect(container.querySelector(".tile__frame-svg")).toBeInTheDocument();
    expect(container.querySelector(".number-token")).toBeInTheDocument();
    expect(artwork?.querySelector("img")).toBeNull();
  });

  it("uses the vector desert when the selected illustrations are unavailable", () => {
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
    for (const extension of ["webp", "png", "jpg"]) {
      const image = artwork!.querySelector("img")!;
      expect(image).toHaveAttribute("src", `/assets/illustrations/tiles/themes/diorama/desert.${extension}`);
      fireEvent.error(image);
    }
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
