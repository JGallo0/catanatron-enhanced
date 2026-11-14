import type {
  AvatarConfig,
  BotDifficulty,
  BotSpeed,
  Color,
  GameState,
  SeatAvatarMeta,
} from "../utils/api.types";
import { sanitizeAvatarConfig } from "./avatarCatalog";
import { getCurrentLanguage, type AppLanguage } from "../i18n";

export const OPEN_SEAT_LABEL = "Assento livre" as const;
export const OPEN_SEAT_LABEL_EN = "Open seat" as const;

export function getOpenSeatLabel(lang: AppLanguage = getCurrentLanguage()): string {
  return lang === "en" ? OPEN_SEAT_LABEL_EN : OPEN_SEAT_LABEL;
}

export function localizeSeatLabel(
  name?: string | null,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const clean = (name ?? "").trim();
  if (isOpenSeatPlaceholderName(clean) || clean === OPEN_SEAT_LABEL_EN) {
    return getOpenSeatLabel(lang);
  }
  if (clean === "Anfitrião" || clean === "Host") {
    return lang === "en" ? "Host" : "Anfitrião";
  }
  return clean;
}

const LEGACY_OPEN_SEAT_PLACEHOLDERS = new Set([
  "Assento livre",
  "Open seat",
  "Aguardando Amigo...",
  "Vaga Aberta",
  "Vaga para Amigo",
  "",
]);

export function isOpenSeatPlaceholderName(name?: string | null): boolean {
  return LEGACY_OPEN_SEAT_PLACEHOLDERS.has((name ?? "").trim());
}

export type BotDifficultyOption = {
  value: BotDifficulty;
  label: string;
  description: string;
  playerKey: "W" | "F" | "CATANATRON";
};

export const BOT_DIFFICULTY_OPTIONS: ReadonlyArray<BotDifficultyOption> = [
  {
    value: "easy",
    label: "Fácil",
    description: "Jogadas mais leves e ocasionais",
    playerKey: "W",
  },
  {
    value: "medium",
    label: "Moderado",
    description: "Estratégia equilibrada em ritmo rápido",
    playerKey: "F",
  },
  {
    value: "hard",
    label: "Difícil",
    description: "Estratégia avançada com planejamento de jogadas",
    playerKey: "CATANATRON",
  },
];

export const BOT_DIFFICULTY_OPTIONS_EN: ReadonlyArray<BotDifficultyOption> = [
  {
    value: "easy",
    label: "Easy",
    description: "Lighter, more casual plays",
    playerKey: "W",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Balanced strategy at a brisk pace",
    playerKey: "F",
  },
  {
    value: "hard",
    label: "Hard",
    description: "Advanced strategy with look-ahead planning",
    playerKey: "CATANATRON",
  },
];

export function getBotDifficultyOptions(
  lang: AppLanguage = getCurrentLanguage()
): ReadonlyArray<BotDifficultyOption> {
  return lang === "en" ? BOT_DIFFICULTY_OPTIONS_EN : BOT_DIFFICULTY_OPTIONS;
}

export function normalizeBotDifficulty(raw: unknown): BotDifficulty | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().toLowerCase();
  if (clean === "easy" || clean === "medium" || clean === "hard") {
    return clean;
  }
  return null;
}

export function playerKeyForDifficulty(
  difficulty?: BotDifficulty | null
): "W" | "F" | "CATANATRON" {
  if (difficulty === "easy") return "W";
  if (difficulty === "hard") return "CATANATRON";
  return "F";
}

export function difficultyFromPlayerKey(playerKey?: string | null): BotDifficulty {
  const key = (playerKey ?? "").split(":")[0].trim().toUpperCase();
  if (key === "W" || key === "WEIGHTED_RANDOM" || key === "R" || key === "RANDOM") {
    return "easy";
  }
  if (key === "CATANATRON" || key === "AB" || key === "SAB") {
    return "hard";
  }
  return "medium";
}

export function formatBotDifficultyLabel(
  difficulty?: BotDifficulty | null,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const options = getBotDifficultyOptions(lang);
  const found = options.find((d) => d.value === difficulty);
  return found ? found.label : options[1].label;
}

export type BotSpeedOption = {
  value: BotSpeed;
  label: string;
  icon: string;
  description: string;
};

export const BOT_SPEED_OPTIONS: ReadonlyArray<BotSpeedOption> = [
  { value: "slow", label: "Lenta", icon: "🐢", description: "Bots pensam antes de agir, com pausas para acompanhar a mesa" },
  {
    value: "normal",
    label: "Normal",
    icon: "🐢",
    description: "Ritmo clássico de tabuleiro para acompanhar dados e jogadas",
  },
  {
    value: "fast",
    label: "Rápida",
    icon: "⏩",
    description: "Transições ágeis mantendo destaque visual das jogadas",
  },
  {
    value: "turbo",
    label: "Turbo",
    icon: "⚡",
    description: "Bots respondem quase instantaneamente para partidas rápidas",
  },
];

export const BOT_SPEED_OPTIONS_EN: ReadonlyArray<BotSpeedOption> = [
  { value: "slow", label: "Lenta", icon: "🐢", description: "Bots pensam antes de agir, com pausas para acompanhar a mesa" },
  {
    value: "normal",
    label: "Normal",
    icon: "🐢",
    description: "Classic tabletop pace to follow every roll and move",
  },
  {
    value: "fast",
    label: "Fast",
    icon: "⏩",
    description: "Brisk transitions while keeping move highlights clear",
  },
  {
    value: "turbo",
    label: "Turbo",
    icon: "⚡",
    description: "Bots respond almost instantly for rapid matches",
  },
];

export function getBotSpeedOptions(
  lang: AppLanguage = getCurrentLanguage()
): ReadonlyArray<BotSpeedOption> {
  return lang === "en" ? BOT_SPEED_OPTIONS_EN : BOT_SPEED_OPTIONS;
}

export function normalizeBotSpeed(raw: unknown): BotSpeed | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().toLowerCase();
  if (clean === "slow" || clean === "normal" || clean === "fast" || clean === "turbo") {
    return clean;
  }
  return null;
}

export function formatBotSpeedLabel(
  speed?: BotSpeed | null,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const options = getBotSpeedOptions(lang);
  const found = options.find((s) => s.value === speed);
  return found ? found.label : "Normal";
}

export const MAP_TEMPLATE_OPTIONS: ReadonlyArray<{
  value: "BASE" | "MINI" | "TOURNAMENT";
  label: string;
}> = [
  { value: "BASE", label: "Padrão (Mapa aleatório)" },
  { value: "MINI", label: "Mini" },
  { value: "TOURNAMENT", label: "Torneio (Mapa fixo)" },
];

export const MAP_TEMPLATE_OPTIONS_EN: ReadonlyArray<{
  value: "BASE" | "MINI" | "TOURNAMENT";
  label: string;
}> = [
  { value: "BASE", label: "Standard (Random Map)" },
  { value: "MINI", label: "Mini" },
  { value: "TOURNAMENT", label: "Tournament (Fixed Map)" },
];

export function getMapTemplateOptions(
  lang: AppLanguage = getCurrentLanguage()
): ReadonlyArray<{ value: "BASE" | "MINI" | "TOURNAMENT"; label: string }> {
  return lang === "en" ? MAP_TEMPLATE_OPTIONS_EN : MAP_TEMPLATE_OPTIONS;
}

export function formatMapTemplateLabel(
  template?: string | null,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const clean = (template ?? "").trim().toUpperCase();
  const options = getMapTemplateOptions(lang);
  const match = options.find((opt) => opt.value === clean);
  return match ? match.label : clean || options[0].label;
}

export const OFFICIAL_BOT_NAMES = [
  "Creitu",
  "Felire",
  "Guiri",
  "Jaó",
  "Angeleri",
] as const;

export type OfficialBotName = (typeof OFFICIAL_BOT_NAMES)[number];

export const BOT_AVATAR_PROFILES: Record<OfficialBotName, AvatarConfig> = {
  Creitu: {
    skin: "warm",
    eyes: "sharp",
    hair: "short",
    hairColor: "navy",
    beard: "goatee",
    hat: "captain",
    outfit: "captain",
    outfitColor: "royal",
    background: "ocean",
    frame: "bronze",
  },
  Felire: {
    skin: "fair",
    eyes: "cheerful",
    hair: "wavy",
    hairColor: "red",
    beard: "none",
    hat: "explorer",
    outfit: "settler",
    outfitColor: "emerald",
    background: "forest",
    frame: "bronze",
  },
  Guiri: {
    skin: "tan",
    eyes: "wise",
    hair: "curly",
    hairColor: "brown",
    beard: "mustache",
    hat: "bandana",
    outfit: "merchant",
    outfitColor: "amber",
    background: "sunset",
    frame: "bronze",
  },
  Jaó: {
    skin: "brown",
    eyes: "sharp",
    hair: "short",
    hairColor: "silver",
    beard: "full",
    hat: "helm",
    outfit: "armor",
    outfitColor: "slate",
    background: "mountain",
    frame: "silver",
  },
  Angeleri: {
    skin: "porcelain",
    eyes: "calm",
    hair: "braids",
    hairColor: "blonde",
    beard: "none",
    hat: "none",
    outfit: "merchant",
    outfitColor: "crimson",
    background: "gold",
    frame: "silver",
  },
};

export function isOfficialBotName(name?: string | null): name is OfficialBotName {
  if (!name) return false;
  return (OFFICIAL_BOT_NAMES as readonly string[]).includes(name);
}

export function prescanRequestedBotNames(
  entries: Array<{ isBot: boolean; requestedName?: string | null }>
): { explicitByIndex: Map<number, OfficialBotName>; usedNames: Set<OfficialBotName> } {
  const explicitByIndex = new Map<number, OfficialBotName>();
  const usedNames = new Set<OfficialBotName>();
  entries.forEach((entry, idx) => {
    if (!entry.isBot) return;
    const clean = (entry.requestedName ?? "").trim();
    if (isOfficialBotName(clean) && !usedNames.has(clean)) {
      explicitByIndex.set(idx, clean);
      usedNames.add(clean);
    }
  });
  return { explicitByIndex, usedNames };
}

export function pickBotNames(
  count: number,
  exclude?: Iterable<string | null | undefined>
): OfficialBotName[] {
  const used = new Set<string>();
  if (exclude) {
    for (const item of exclude) {
      if (typeof item === "string" && item) used.add(item);
    }
  }
  const shufflePool = (items: OfficialBotName[]) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  let available = shufflePool(
    OFFICIAL_BOT_NAMES.filter((name) => !used.has(name))
  );
  const chosen: OfficialBotName[] = [];
  while (chosen.length < count) {
    if (available.length === 0) {
      available = shufflePool([...OFFICIAL_BOT_NAMES]);
    }
    const pick = available.shift()!;
    chosen.push(pick);
    used.add(pick);
  }
  return chosen;
}

export function pickBotNameDeterministic(
  seatIndex: number,
  exclude?: Iterable<string | null | undefined>
): OfficialBotName {
  const used = new Set<string>();
  if (exclude) {
    for (const item of exclude) {
      if (typeof item === "string" && item) used.add(item);
    }
  }
  const len = OFFICIAL_BOT_NAMES.length;
  for (let offset = 0; offset < len; offset++) {
    const candidate = OFFICIAL_BOT_NAMES[(Math.max(0, seatIndex) + offset) % len];
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return OFFICIAL_BOT_NAMES[Math.max(0, seatIndex) % len];
}

const LEGACY_COLOR_NAME_RE =
  /^(bot|ia\s*\(.*\)|mestre da ilha.*|vermelho|azul|laranja|branco|red|blue|orange|white|bot\s+(vermelho|azul|laranja|branco))$/i;

export function resolveBotDisplayName(
  gameState: Pick<GameState, "colors" | "bot_colors" | "seat_names">,
  color: Color
): OfficialBotName {
  const raw = gameState.seat_names?.[color]?.trim();
  if (isOfficialBotName(raw)) {
    return raw;
  }
  const colors = gameState.colors || [];
  const botColors = gameState.bot_colors || [];
  const used = new Set<string>();
  for (const c of botColors) {
    if (c === color) break;
    const prevRaw = gameState.seat_names?.[c]?.trim();
    if (isOfficialBotName(prevRaw)) {
      used.add(prevRaw);
    } else {
      const idx = Math.max(0, colors.indexOf(c));
      used.add(pickBotNameDeterministic(idx, used));
    }
  }
  const seatIdx = Math.max(0, colors.indexOf(color));
  return pickBotNameDeterministic(seatIdx, used);
}

export function isTakenOverSeat(
  gameState: Pick<GameState, "taken_over_colors" | "seat_takeover" | "seat_names">,
  color: Color
): boolean {
  if ((gameState.taken_over_colors || []).includes(color)) return true;
  if (gameState.seat_takeover?.[color]?.taken_over) return true;
  const raw = gameState.seat_names?.[color]?.trim();
  return Boolean(raw && raw.endsWith(" (Bot)"));
}

export function resolvePlayerDisplayName(
  gameState: Pick<
    GameState,
    "colors" | "bot_colors" | "seat_names" | "taken_over_colors" | "seat_takeover"
  >,
  color: Color,
  fallbackColorLabel: string
): string {
  const isBot = (gameState.bot_colors || []).includes(color);
  const raw = gameState.seat_names?.[color]?.trim();
  if (isBot && isTakenOverSeat(gameState, color)) {
    const orig = gameState.seat_takeover?.[color]?.original_display_name;
    return raw || (orig ? `${orig} (Bot)` : `${fallbackColorLabel} (Bot)`);
  }
  if (isBot) {
    return resolveBotDisplayName(gameState, color);
  }
  if (raw && !LEGACY_COLOR_NAME_RE.test(raw)) {
    return raw;
  }
  return raw || fallbackColorLabel;
}

export function resolveSeatAvatarProps(options: {
  color: Color;
  isBot: boolean;
  isTakenOver?: boolean;
  seatIndex: number;
  seatName: string;
  seatAvatar?: SeatAvatarMeta | null;
  originalUsername?: string | null;
  isMySeat?: boolean;
  accountAvatar?: Partial<AvatarConfig> | null;
  accountUsername?: string | null;
  guestCustomAvatar?: Partial<AvatarConfig> | null;
}): {
  config?: Partial<AvatarConfig>;
  username: string;
  isCustomUserOrGuest: boolean;
} {
  const {
    color,
    isBot,
    isTakenOver = false,
    seatIndex,
    seatName,
    seatAvatar,
    originalUsername,
    isMySeat = false,
    accountAvatar,
    accountUsername,
    guestCustomAvatar,
  } = options;

  if ((isBot || seatAvatar?.seat_kind === "BOT") && isTakenOver) {
    const metaCfg = sanitizeAvatarConfig(seatAvatar?.avatar_config);
    const localAccountCfg = isMySeat ? sanitizeAvatarConfig(accountAvatar) : {};
    const localGuestCfg =
      isMySeat && !accountUsername ? sanitizeAvatarConfig(guestCustomAvatar) : {};
    const merged = { ...metaCfg, ...localGuestCfg, ...localAccountCfg };
    return {
      config: Object.keys(merged).length > 0 ? merged : undefined,
      username:
        originalUsername ||
        seatAvatar?.username ||
        accountUsername ||
        seatName.replace(/ \(Bot\)$/, "") ||
        color,
      isCustomUserOrGuest: Object.keys(merged).length > 0,
    };
  }

  if (isBot || seatAvatar?.seat_kind === "BOT") {
    const botName = isOfficialBotName(seatName)
      ? seatName
      : pickBotNameDeterministic(seatIndex);
    const metaCfg = sanitizeAvatarConfig(seatAvatar?.avatar_config);
    return {
      config:
        Object.keys(metaCfg).length > 0
          ? metaCfg
          : BOT_AVATAR_PROFILES[botName],
      username: botName,
      isCustomUserOrGuest: false,
    };
  }

  if (seatAvatar?.seat_kind === "USER") {
    const metaCfg = sanitizeAvatarConfig(seatAvatar.avatar_config);
    const localAccountCfg = isMySeat ? sanitizeAvatarConfig(accountAvatar) : {};
    const merged = { ...metaCfg, ...localAccountCfg };
    return {
      config: Object.keys(merged).length > 0 ? merged : undefined,
      username: seatAvatar.username || accountUsername || seatName || color,
      isCustomUserOrGuest: true,
    };
  }

  const metaGuestCfg = sanitizeAvatarConfig(seatAvatar?.avatar_config);
  const localGuestCfg =
    isMySeat && !accountUsername ? sanitizeAvatarConfig(guestCustomAvatar) : {};
  const mergedGuestCfg = { ...metaGuestCfg, ...localGuestCfg };
  if (Object.keys(mergedGuestCfg).length > 0) {
    return {
      config: mergedGuestCfg,
      username: seatName || color,
      isCustomUserOrGuest: true,
    };
  }

  return {
    config: undefined,
    username: seatName || color,
    isCustomUserOrGuest: false,
  };
}
