import { afterEach, describe, expect, test } from "vitest";
import {
  AVATAR_CATALOG_ITEMS,
  AVATAR_COLOR_SWATCHES,
  AVATAR_PRESETS,
  findLockedAvatarItems,
  getAvatarItemRequirement,
  isAvatarItemUnlocked,
  isValidHexColor,
  isValidPortraitSnapshot,
  randomizeUnlockedAvatar,
  resolveAvatarConfig,
  sanitizeAvatarConfig,
  stripLockedAvatarItems,
} from "./avatarCatalog";
import { localRegisterUser, localUpdateProfile } from "../utils/localEngine";

afterEach(() => {
  localStorage.clear();
});

describe("avatarCatalog", () => {
  test("resolveAvatarConfig generates deterministic unlocked V2 defaults from username when raw config is empty", () => {
    const first = resolveAvatarConfig({}, "joao_gallo");
    const second = resolveAvatarConfig(undefined, "joao_gallo");
    const other = resolveAvatarConfig({}, "maria_isle");

    expect(first).toEqual(second);
    expect(first.version).toBe(2);
    expect(first.frame).toBe("wood");
    expect(isAvatarItemUnlocked("frame", first.frame, 0)).toBe(true);
    expect(isAvatarItemUnlocked("hat", first.hat, 0)).toBe(true);
    expect(findLockedAvatarItems(first, 0, [])).toEqual([]);
    expect(first).not.toEqual(other);

    // Ensure unsigned bit-shifting never returns undefined for bit-31-set FNV hashes (e.g. "cavaleiro")
    for (const uname of ["cavaleiro", "ana", "pedro", "bruno", "diana", "sol"]) {
      const resolved = resolveAvatarConfig({}, uname);
      expect(resolved.version).toBe(2);
      for (const [key, val] of Object.entries(resolved)) {
        if (key === "version" || key === "colors" || key === "portraitSnapshot") continue;
        expect(typeof val === "string" && val.length > 0).toBe(true);
      }
      for (const hex of Object.values(resolved.colors)) {
        expect(isValidHexColor(hex)).toBe(true);
      }
    }
  });

  test("upgrades V1 AvatarConfig seamlessly to V2 preserving colors and slot mappings", () => {
    const v1 = {
      skin: "warm",
      eyes: "sharp",
      hair: "short",
      hairColor: "navy",
      beard: "goatee",
      hat: "captain",
      outfit: "captain",
      outfitColor: "royal",
      background: "ocean",
      frame: "wood",
    };

    const upgraded = resolveAvatarConfig(v1, "cap_teste");
    expect(upgraded.version).toBe(2);
    expect(upgraded.eyeStyle).toBe("sharp");
    expect(upgraded.hair).toBe("short");
    expect(upgraded.beard).toBe("goatee");
    expect(upgraded.hat).toBe("captain");
    expect(upgraded.outfit).toBe("captain");
    expect(upgraded.background).toBe("ocean");
    expect(upgraded.frame).toBe("wood");
    expect(upgraded.colors.skin).toBe("#e4b287");
    expect(upgraded.colors.hair).toBe("#1e40af");
    expect(upgraded.colors.outfitPrimary).toBe("#2563eb");
    expect(upgraded.colors.outfitSecondary).toBe("#1e3a8a");
    expect(upgraded.colors.outfitTrim).toBe("#facc15");
    // V1 legacy compatibility fields preserved
    expect(upgraded.skin).toBe("warm");
    expect(upgraded.eyes).toBe("sharp");
    expect(upgraded.hairColor).toBe("navy");
    expect(upgraded.outfitColor).toBe("royal");
  });

  test("sanitizes hex colors and portraitSnapshot safely", () => {
    expect(isValidHexColor("#e4b287")).toBe(true);
    expect(isValidHexColor("#ABCDEF")).toBe(true);
    expect(isValidHexColor("#12345")).toBe(false);
    expect(isValidHexColor("javascript:alert(1)")).toBe(false);

    const validWebp =
      "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
    const validPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const badSvg = "data:image/svg+xml;base64,PHN2Zz4=";
    const hugeSnap = "data:image/webp;base64," + "A".repeat(70000);

    expect(isValidPortraitSnapshot(validWebp)).toBe(true);
    expect(isValidPortraitSnapshot(validPng)).toBe(true);
    expect(isValidPortraitSnapshot(badSvg)).toBe(false);
    expect(isValidPortraitSnapshot(hugeSnap)).toBe(false);

    const sanitized = sanitizeAvatarConfig({
      version: 2,
      mount: "island_horse",
      colors: {
        skin: "#e4b287",
        hair: "#2c1810",
        outfitSecondary: "javascript:alert(1)",
        outfitTrim: "#facc15",
        backpack: "#065f46",
      },
      portraitSnapshot: validWebp,
      __proto__: { polluted: true },
    });

    expect(sanitized.version).toBe(2);
    expect(sanitized.mount).toBe("island_horse");
    expect(sanitized.colors).toEqual({
      skin: "#e4b287",
      hair: "#2c1810",
      outfitTrim: "#facc15",
      backpack: "#065f46",
    });
    expect(sanitized.portraitSnapshot).toBe(validWebp);

    const droppedSnap = sanitizeAvatarConfig({
      version: 2,
      portraitSnapshot: badSvg,
    });
    expect(droppedSnap.portraitSnapshot).toBeUndefined();
  });

  test("enforces ranked win unlock thresholds and VIP entitlements accurately", () => {
    expect(getAvatarItemRequirement("frame", "wood")).toBe(0);
    expect(getAvatarItemRequirement("frame", "bronze")).toBe(1);
    expect(getAvatarItemRequirement("cape", "navy_commander")).toBe(2);
    expect(getAvatarItemRequirement("frame", "silver")).toBe(3);
    expect(getAvatarItemRequirement("handProp", "royal_scepter")).toBe(4);
    expect(getAvatarItemRequirement("frame", "gold")).toBe(5);
    expect(getAvatarItemRequirement("pedestal", "runic_gold")).toBe(5);
    expect(getAvatarItemRequirement("pet", "owl")).toBe(6);
    expect(getAvatarItemRequirement("hat", "crown_gold")).toBe(7);
    expect(getAvatarItemRequirement("aura", "sun_motes")).toBe(8);
    expect(getAvatarItemRequirement("frame", "imperial")).toBe(10);

    expect(isAvatarItemUnlocked("frame", "bronze", 0)).toBe(false);
    expect(isAvatarItemUnlocked("frame", "bronze", 1)).toBe(true);
    expect(isAvatarItemUnlocked("hat", "crown_gold", 6)).toBe(false);
    expect(isAvatarItemUnlocked("hat", "crown_gold", 7)).toBe(true);
    expect(isAvatarItemUnlocked("frame", "imperial", 9)).toBe(false);
    expect(isAvatarItemUnlocked("frame", "imperial", 10)).toBe(true);

    // VIP items require explicit entitlement regardless of wins
    expect(isAvatarItemUnlocked("mount", "imperial_griffin", 99, [])).toBe(false);
    expect(
      isAvatarItemUnlocked("mount", "imperial_griffin", 0, ["mount:imperial_griffin"])
    ).toBe(true);

    // Earnable items can also be granted via entitlement
    expect(isAvatarItemUnlocked("cape", "navy_commander", 0, ["cape:navy_commander"])).toBe(true);
  });

  test("findLockedAvatarItems flags earnable and VIP items and clears them when unlocked", () => {
    const draft = resolveAvatarConfig(
      {
        version: 2,
        cape: "navy_commander", // earnable, 2 wins
        mount: "imperial_griffin", // vip
        frame: "vip_dragon", // vip
      },
      "bruno"
    );

    const locked0 = findLockedAvatarItems(draft, 0, []);
    expect(locked0).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: "cape", id: "navy_commander", tier: "earnable", required_wins: 2 }),
        expect.objectContaining({ slot: "mount", id: "imperial_griffin", tier: "vip", sku: "vip_mount_griffin" }),
        expect.objectContaining({ slot: "frame", id: "vip_dragon", tier: "vip", sku: "vip_frame_dragon" }),
      ])
    );

    const lockedWithWinsAndOneVip = findLockedAvatarItems(draft, 2, ["mount:imperial_griffin"]);
    expect(lockedWithWinsAndOneVip).toHaveLength(1);
    expect(lockedWithWinsAndOneVip[0]).toMatchObject({
      slot: "frame",
      id: "vip_dragon",
      tier: "vip",
    });

    const cleared = findLockedAvatarItems(draft, 2, [
      "mount:imperial_griffin",
      "frame:vip_dragon",
    ]);
    expect(cleared).toEqual([]);
  });

  test("stripLockedAvatarItems replaces only locked slots while preserving unlocked items and custom colors", () => {
    const fallback = resolveAvatarConfig(
      {
        version: 2,
        hat: "captain",
        frame: "bronze",
        mount: "none",
      },
      "clara"
    );

    const draft = resolveAvatarConfig(
      {
        version: 2,
        hat: "crown_gold", // locked at 2 wins (requires 7)
        cape: "navy_commander", // unlocked at 2 wins
        mount: "imperial_griffin", // VIP locked
        outfit: "armor", // free unlocked
        frame: "vip_dragon", // VIP locked
        colors: {
          skin: "#c98b5b",
          hair: "#eab308",
          eyes: "#0284c7",
          outfitPrimary: "#7c3aed",
          outfitSecondary: "#1e293b",
          outfitTrim: "#fde047",
          mount: "#334155",
        },
        portraitSnapshot:
          "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=",
      },
      "clara"
    );

    const stripped = stripLockedAvatarItems(draft, fallback, 2, []);
    expect(stripped.hat).toBe("captain");
    expect(stripped.frame).toBe("bronze");
    expect(stripped.mount).toBe("none");
    expect(stripped.cape).toBe("navy_commander");
    expect(stripped.outfit).toBe("armor");
    expect(stripped.colors).toEqual(draft.colors);
    expect(stripped.portraitSnapshot).toBe(draft.portraitSnapshot);
    expect(findLockedAvatarItems(stripped, 2, [])).toEqual([]);
  });

  test("catalog exposes expanded unique color swatches including backpack, 3D modelPaths, and monetization metadata", () => {
    expect(AVATAR_COLOR_SWATCHES.skin.length).toBeGreaterThanOrEqual(10);
    expect(AVATAR_COLOR_SWATCHES.hair.length).toBeGreaterThanOrEqual(12);
    expect(AVATAR_COLOR_SWATCHES.outfitPrimary.length).toBeGreaterThanOrEqual(12);
    expect(AVATAR_COLOR_SWATCHES.mount.length).toBeGreaterThanOrEqual(10);
    expect(AVATAR_COLOR_SWATCHES.backpack.length).toBeGreaterThanOrEqual(10);
    for (const list of Object.values(AVATAR_COLOR_SWATCHES)) {
      const hexes = list.map((s) => s.hex.toLowerCase());
      expect(new Set(hexes).size).toBe(hexes.length);
    }

    const griffin = AVATAR_CATALOG_ITEMS.find(
      (i) => i.slot === "mount" && i.id === "imperial_griffin"
    );
    expect(griffin).toMatchObject({
      tier: "vip",
      rarity: "legendary",
      sku: "vip_mount_griffin",
      priceBrlCents: 2990,
      modelPath: "/assets/models/avatars/mounts/imperial_griffin.glb",
    });

    const spyglass = AVATAR_CATALOG_ITEMS.find(
      (i) => i.slot === "handProp" && i.id === "spyglass"
    );
    expect(spyglass?.modelPath).toBe("/assets/models/avatars/props_hand/spyglass.glb");
  });

  test("all 6 presets are unlocked at 0 wins", () => {
    expect(AVATAR_PRESETS).toHaveLength(6);
    for (const preset of AVATAR_PRESETS) {
      expect(isAvatarItemUnlocked("frame", preset.config.frame, 0)).toBe(true);
      expect(isAvatarItemUnlocked("hat", preset.config.hat, 0)).toBe(true);
      expect(findLockedAvatarItems(preset.config, 0, [])).toEqual([]);
    }
  });

  test("randomizeUnlockedAvatar never selects locked items", () => {
    for (let i = 0; i < 40; i++) {
      const cfg = randomizeUnlockedAvatar(0, []);
      expect(findLockedAvatarItems(cfg, 0, [])).toEqual([]);
      expect(isAvatarItemUnlocked("frame", cfg.frame, 0)).toBe(true);
      expect(isAvatarItemUnlocked("hat", cfg.hat, 0)).toBe(true);
      expect(cfg.version).toBe(2);
      expect(isValidHexColor(cfg.colors.skin)).toBe(true);
    }
  });

  test("localUpdateProfile enforces V2 unlocks with 403 locked_items and preserves V2 colors & snapshot", () => {
    localRegisterUser({
      username: "diego",
      password: "secret",
      displayName: "Diego",
    });

    expect(() =>
      localUpdateProfile({
        username: "diego",
        avatarConfig: {
          version: 2,
          mount: "imperial_griffin",
        },
      })
    ).toThrowError();

    let caught: any = null;
    try {
      localUpdateProfile({
        username: "diego",
        avatarConfig: {
          version: 2,
          mount: "imperial_griffin",
          cape: "navy_commander",
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught?.response?.status).toBe(403);
    expect(caught?.response?.data?.locked_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: "mount", id: "imperial_griffin", tier: "vip" }),
        expect.objectContaining({ slot: "cape", id: "navy_commander", tier: "earnable", required_wins: 2 }),
      ])
    );

    const validSnap =
      "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
    const updated = localUpdateProfile({
      username: "diego",
      displayName: "Cap. Diego",
      avatarConfig: {
        version: 2,
        bodyType: "sturdy",
        mount: "island_horse",
        colors: {
          skin: "#e4b287",
          hair: "#1f242d",
          eyes: "#0284c7",
          outfitPrimary: "#dc2626",
          outfitSecondary: "#7f1d1d",
          outfitTrim: "#facc15",
          mount: "#854d0e",
        },
        portraitSnapshot: validSnap,
      },
    });
    expect(updated.display_name).toBe("Cap. Diego");
    expect(updated.entitlements).toEqual([]);
    expect(updated.avatar_config?.version).toBe(2);
    expect(updated.avatar_config?.bodyType).toBe("sturdy");
    expect(updated.avatar_config?.mount).toBe("island_horse");
    expect(updated.avatar_config?.colors?.outfitPrimary).toBe("#dc2626");
    expect(updated.avatar_config?.portraitSnapshot).toBe(validSnap);
  });
});
