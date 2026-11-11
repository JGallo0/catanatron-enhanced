import { describe, expect, test } from "vitest";
import {
  AVATAR_PRESETS,
  getAvatarItemRequirement,
  isAvatarItemUnlocked,
  randomizeUnlockedAvatar,
  resolveAvatarConfig,
} from "./avatarCatalog";

describe("avatarCatalog", () => {
  test("resolveAvatarConfig generates deterministic unlocked defaults from username when raw config is empty", () => {
    const first = resolveAvatarConfig({}, "joao_gallo");
    const second = resolveAvatarConfig(undefined, "joao_gallo");
    const other = resolveAvatarConfig({}, "maria_isle");

    expect(first).toEqual(second);
    expect(first.frame).toBe("wood");
    expect(isAvatarItemUnlocked("frame", first.frame, 0)).toBe(true);
    expect(isAvatarItemUnlocked("hat", first.hat, 0)).toBe(true);
    expect(first).not.toEqual(other);

    // Ensure unsigned bit-shifting never returns undefined for bit-31-set FNV hashes (e.g. "cavaleiro")
    for (const uname of ["cavaleiro", "ana", "pedro", "bruno", "diana", "sol"]) {
      const resolved = resolveAvatarConfig({}, uname);
      expect(Object.values(resolved).every((v) => typeof v === "string" && v.length > 0)).toBe(
        true
      );
    }
  });

  test("enforces ranked win unlock thresholds accurately", () => {
    expect(getAvatarItemRequirement("frame", "wood")).toBe(0);
    expect(getAvatarItemRequirement("frame", "bronze")).toBe(1);
    expect(getAvatarItemRequirement("frame", "silver")).toBe(3);
    expect(getAvatarItemRequirement("frame", "gold")).toBe(5);
    expect(getAvatarItemRequirement("hat", "crown_gold")).toBe(7);
    expect(getAvatarItemRequirement("frame", "imperial")).toBe(10);

    expect(isAvatarItemUnlocked("frame", "bronze", 0)).toBe(false);
    expect(isAvatarItemUnlocked("frame", "bronze", 1)).toBe(true);
    expect(isAvatarItemUnlocked("hat", "crown_gold", 6)).toBe(false);
    expect(isAvatarItemUnlocked("hat", "crown_gold", 7)).toBe(true);
    expect(isAvatarItemUnlocked("frame", "imperial", 9)).toBe(false);
    expect(isAvatarItemUnlocked("frame", "imperial", 10)).toBe(true);
  });

  test("all 6 presets are unlocked at 0 wins", () => {
    expect(AVATAR_PRESETS).toHaveLength(6);
    for (const preset of AVATAR_PRESETS) {
      expect(isAvatarItemUnlocked("frame", preset.config.frame, 0)).toBe(true);
      expect(isAvatarItemUnlocked("hat", preset.config.hat, 0)).toBe(true);
    }
  });

  test("randomizeUnlockedAvatar never selects locked items", () => {
    for (let i = 0; i < 40; i++) {
      const cfg = randomizeUnlockedAvatar(0);
      expect(isAvatarItemUnlocked("frame", cfg.frame, 0)).toBe(true);
      expect(isAvatarItemUnlocked("hat", cfg.hat, 0)).toBe(true);
    }
  });
});
