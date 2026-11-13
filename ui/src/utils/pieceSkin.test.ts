import { describe, it, expect, beforeEach } from "vitest";
import {
  PIECE_SKIN_STORAGE_KEY,
  PIECE_SKINS,
  getSavedPieceSkin,
  savePieceSkin,
  togglePieceSkin,
} from "./pieceSkin";

describe("pieceSkin utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to contrast skin when nothing is stored", () => {
    expect(getSavedPieceSkin()).toBe("contrast");
    expect(PIECE_SKINS.contrast.isDefault).toBe(true);
    expect(PIECE_SKINS.cottage.isDefault).toBe(false);
  });

  it("persists skin in localStorage and retrieves saved value", () => {
    savePieceSkin("cottage");
    expect(localStorage.getItem(PIECE_SKIN_STORAGE_KEY)).toBe("cottage");
    expect(getSavedPieceSkin()).toBe("cottage");

    savePieceSkin("contrast");
    expect(localStorage.getItem(PIECE_SKIN_STORAGE_KEY)).toBe("contrast");
    expect(getSavedPieceSkin()).toBe("contrast");
  });

  it("toggles between contrast and cottage cleanly", () => {
    expect(getSavedPieceSkin()).toBe("contrast");
    const next = togglePieceSkin();
    expect(next).toBe("cottage");
    expect(getSavedPieceSkin()).toBe("cottage");

    const back = togglePieceSkin();
    expect(back).toBe("contrast");
    expect(getSavedPieceSkin()).toBe("contrast");
  });
});
