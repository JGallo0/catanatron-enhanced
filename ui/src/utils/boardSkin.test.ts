import { describe, it, expect, beforeEach } from "vitest";
import {
  BOARD_SKIN_STORAGE_KEY,
  BOARD_SKINS,
  getSavedBoardSkin,
  saveBoardSkin,
  toggleBoardSkin,
  getTileIllustrationUrl,
} from "./boardSkin";

describe("boardSkin utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to diorama skin when nothing is stored", () => {
    expect(getSavedBoardSkin()).toBe("diorama");
    expect(BOARD_SKINS.diorama.isDefault).toBe(true);
    expect(BOARD_SKINS.classic.isDefault).toBe(false);
  });

  it("persists skin in localStorage and retrieves saved value", () => {
    saveBoardSkin("classic");
    expect(localStorage.getItem(BOARD_SKIN_STORAGE_KEY)).toBe("classic");
    expect(getSavedBoardSkin()).toBe("classic");

    saveBoardSkin("diorama");
    expect(localStorage.getItem(BOARD_SKIN_STORAGE_KEY)).toBe("diorama");
    expect(getSavedBoardSkin()).toBe("diorama");
  });

  it("cycles through all three board styles", () => {
    expect(getSavedBoardSkin()).toBe("diorama");
    const next = toggleBoardSkin();
    expect(next).toBe("classic");
    expect(getSavedBoardSkin()).toBe("classic");

    expect(toggleBoardSkin()).toBe("vector");
    expect(getSavedBoardSkin()).toBe("vector");

    const back = toggleBoardSkin();
    expect(back).toBe("diorama");
    expect(getSavedBoardSkin()).toBe("diorama");
  });

  it("returns correct tile URLs based on selected theme", () => {
    const dioramaBrick = getTileIllustrationUrl("BRICK", "diorama");
    expect(dioramaBrick).toBe("/assets/illustrations/tiles/themes/diorama/brick.webp");

    const classicBrick = getTileIllustrationUrl("BRICK", "classic");
    expect(classicBrick).toBe("/assets/illustrations/tiles/themes/classic/brick.webp");

    const dioramaWood = getTileIllustrationUrl("WOOD", "diorama");
    expect(dioramaWood).toBe("/assets/illustrations/tiles/themes/diorama/wood.webp");

    const dioramaDesert = getTileIllustrationUrl("DESERT", "diorama");
    expect(dioramaDesert).toBe("/assets/illustrations/tiles/themes/diorama/desert.webp");
    expect(getTileIllustrationUrl("DESERT", "vector")).toBeUndefined();
  });
});
