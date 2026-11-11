import { describe, expect, test } from "vitest";
import {
  BOT_AVATAR_PROFILES,
  OFFICIAL_BOT_NAMES,
  isOfficialBotName,
  pickBotNameDeterministic,
  pickBotNames,
  resolveBotDisplayName,
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "./botCatalog";
import { makeGameState } from "../test/fixtures";

describe("botCatalog", () => {
  test("contains the exact 5 official bot names and matching avatar profiles", () => {
    expect(Array.from(OFFICIAL_BOT_NAMES)).toEqual([
      "Creitu",
      "Felire",
      "Guiri",
      "Jaó",
      "Angeleri",
    ]);
    for (const name of OFFICIAL_BOT_NAMES) {
      expect(isOfficialBotName(name)).toBe(true);
      expect(BOT_AVATAR_PROFILES[name]).toBeDefined();
    }
    expect(isOfficialBotName("Bot Vermelho")).toBe(false);
    expect(isOfficialBotName("IA (CATANATRON)")).toBe(false);
  });

  test("picks unique bot names per table and strips legacy color names", () => {
    const picked = pickBotNames(4);
    expect(picked).toHaveLength(4);
    expect(new Set(picked).size).toBe(4);
    for (const name of picked) {
      expect(isOfficialBotName(name)).toBe(true);
    }

    const legacyGame = makeGameState({
      colors: ["RED", "BLUE", "ORANGE", "WHITE"],
      bot_colors: ["BLUE", "ORANGE", "WHITE"],
      seat_names: {
        RED: "João",
        BLUE: "Azul",
        ORANGE: "IA (CATANATRON)",
        WHITE: "Bot Branco",
      },
    });

    const b1 = resolveBotDisplayName(legacyGame, "BLUE");
    const b2 = resolveBotDisplayName(legacyGame, "ORANGE");
    const b3 = resolveBotDisplayName(legacyGame, "WHITE");
    expect(isOfficialBotName(b1)).toBe(true);
    expect(isOfficialBotName(b2)).toBe(true);
    expect(isOfficialBotName(b3)).toBe(true);
    expect(new Set([b1, b2, b3]).size).toBe(3);

    expect(resolvePlayerDisplayName(legacyGame, "RED", "Vermelho")).toBe("João");
    expect(resolvePlayerDisplayName(legacyGame, "WHITE", "Branco")).toBe(b3);
  });

  test("resolves original PlayerAvatar props prioritizing custom user/guest avatar", () => {
    const guestResolved = resolveSeatAvatarProps({
      color: "RED",
      isBot: false,
      seatIndex: 0,
      seatName: "Viajante",
      seatAvatar: { seat_kind: "GUEST", username: null, avatar_config: {} },
      isMySeat: true,
      guestCustomAvatar: { hat: "captain", outfit: "merchant", background: "sunset" },
    });
    expect(guestResolved.isCustomUserOrGuest).toBe(true);
    expect(guestResolved.config?.hat).toBe("captain");
    expect(guestResolved.config?.background).toBe("sunset");

    const botResolved = resolveSeatAvatarProps({
      color: "WHITE",
      isBot: true,
      seatIndex: 3,
      seatName: "Bot Branco",
      seatAvatar: { seat_kind: "BOT", username: null, avatar_config: {} },
    });
    expect(botResolved.isCustomUserOrGuest).toBe(false);
    expect(isOfficialBotName(botResolved.username)).toBe(true);
    expect(botResolved.config).toEqual(
      BOT_AVATAR_PROFILES[pickBotNameDeterministic(3)]
    );
  });
});
