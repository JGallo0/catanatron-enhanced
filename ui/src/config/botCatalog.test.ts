import { describe, expect, test } from "vitest";
import {
  BOT_AVATAR_PROFILES,
  BOT_DIFFICULTY_OPTIONS,
  MAP_TEMPLATE_OPTIONS,
  OFFICIAL_BOT_NAMES,
  OPEN_SEAT_LABEL,
  difficultyFromPlayerKey,
  formatBotDifficultyLabel,
  formatMapTemplateLabel,
  isOfficialBotName,
  isOpenSeatPlaceholderName,
  isTakenOverSeat,
  normalizeBotDifficulty,
  pickBotNameDeterministic,
  pickBotNames,
  playerKeyForDifficulty,
  prescanRequestedBotNames,
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

  test("preserves taken-over seat '<Name> (Bot)' label and original user/guest avatar", () => {
    const takenOverState = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["BLUE"],
      taken_over_colors: ["BLUE"],
      seat_names: { RED: "Ana", BLUE: "Beto (Bot)" },
      seat_avatars: {
        RED: { seat_kind: "USER", username: "ana", avatar_config: {} },
        BLUE: {
          seat_kind: "BOT",
          username: null,
          avatar_config: { hat: "explorer", background: "forest", frame: "wood" },
        },
      },
      seat_takeover: {
        BLUE: {
          taken_over: true,
          reason: "DISCONNECTED",
          original_username: "beto",
          original_display_name: "Beto",
        },
      },
    });

    expect(isTakenOverSeat(takenOverState, "BLUE")).toBe(true);
    expect(isTakenOverSeat(takenOverState, "RED")).toBe(false);
    expect(resolvePlayerDisplayName(takenOverState, "BLUE", "Azul")).toBe(
      "Beto (Bot)"
    );

    const avatar = resolveSeatAvatarProps({
      color: "BLUE",
      isBot: true,
      isTakenOver: true,
      seatIndex: 1,
      seatName: "Beto (Bot)",
      seatAvatar: takenOverState.seat_avatars?.BLUE,
      originalUsername: takenOverState.seat_takeover?.BLUE?.original_username,
    });
    expect(avatar.isCustomUserOrGuest).toBe(true);
    expect(avatar.username).toBe("beto");
    expect(avatar.config?.hat).toBe("explorer");
  });

  test("maps unified bot difficulty levels, Open Seat placeholders, map template labels, and prescan names", () => {
    expect(OPEN_SEAT_LABEL).toBe("Assento livre");
    expect(isOpenSeatPlaceholderName("Assento livre")).toBe(true);
    expect(isOpenSeatPlaceholderName("Aguardando Amigo...")).toBe(true);
    expect(isOpenSeatPlaceholderName("Vaga Aberta")).toBe(true);
    expect(isOpenSeatPlaceholderName("   ")).toBe(true);
    expect(isOpenSeatPlaceholderName("Marina")).toBe(false);

    expect(BOT_DIFFICULTY_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["easy", "Fácil"],
      ["medium", "Moderado"],
      ["hard", "Difícil"],
    ]);
    expect(normalizeBotDifficulty("EASY")).toBe("easy");
    expect(normalizeBotDifficulty("invalid")).toBeNull();
    expect(playerKeyForDifficulty("easy")).toBe("W");
    expect(playerKeyForDifficulty("medium")).toBe("F");
    expect(playerKeyForDifficulty("hard")).toBe("CATANATRON");
    expect(difficultyFromPlayerKey("W")).toBe("easy");
    expect(difficultyFromPlayerKey("F")).toBe("medium");
    expect(difficultyFromPlayerKey("CATANATRON")).toBe("hard");
    expect(formatBotDifficultyLabel("easy")).toBe("Fácil");
    expect(formatBotDifficultyLabel("medium")).toBe("Moderado");
    expect(formatBotDifficultyLabel("hard")).toBe("Difícil");

    expect(MAP_TEMPLATE_OPTIONS.map((m) => [m.value, m.label])).toEqual([
      ["BASE", "Padrão (Mapa aleatório)"],
      ["MINI", "Mini"],
      ["TOURNAMENT", "Torneio (Mapa fixo)"],
    ]);
    expect(formatMapTemplateLabel("BASE")).toBe("Padrão (Mapa aleatório)");
    expect(formatMapTemplateLabel("MINI")).toBe("Mini");
    expect(formatMapTemplateLabel("TOURNAMENT")).toBe("Torneio (Mapa fixo)");

    const prescan = prescanRequestedBotNames([
      { isBot: false, requestedName: "Anfitrião" },
      { isBot: true, requestedName: "Angeleri" },
      { isBot: true, requestedName: "Angeleri" },
      { isBot: true, requestedName: "Guiri" },
    ]);
    expect(Array.from(prescan.explicitByIndex.entries())).toEqual([
      [1, "Angeleri"],
      [3, "Guiri"],
    ]);
    expect(Array.from(prescan.usedNames)).toEqual(["Angeleri", "Guiri"]);
  });
});
