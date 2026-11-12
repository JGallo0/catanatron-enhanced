import type {
  AvatarBackground,
  AvatarBeard,
  AvatarConfig,
  AvatarEyes,
  AvatarFrame,
  AvatarHair,
  AvatarHairColor,
  AvatarHat,
  AvatarOutfit,
  AvatarOutfitColor,
  AvatarSkin,
} from "../utils/api.types";
import { getCurrentLanguage, type AppLanguage } from "../i18n";

export type AvatarOption<T extends string = string> = {
  value: T;
  label: string;
  labelEn?: string;
  swatch?: string;
  secondarySwatch?: string;
  requiredWins?: number;
  subtitle?: string;
  subtitleEn?: string;
};

export const AVATAR_SKIN_OPTIONS: AvatarOption<AvatarSkin>[] = [
  { value: "porcelain", label: "Porcelana", labelEn: "Porcelain", swatch: "#fbe2d1", secondarySwatch: "#e7b99e" },
  { value: "fair", label: "Clara", labelEn: "Fair", swatch: "#f3cfb3", secondarySwatch: "#d8a47f" },
  { value: "warm", label: "Dourada", labelEn: "Warm", swatch: "#e4b287", secondarySwatch: "#c58958" },
  { value: "tan", label: "Bronzeada", labelEn: "Tan", swatch: "#c98b5b", secondarySwatch: "#a46539" },
  { value: "brown", label: "Castanha", labelEn: "Brown", swatch: "#995c37", secondarySwatch: "#764021" },
  { value: "deep", label: "Ébano", labelEn: "Deep", swatch: "#633722", secondarySwatch: "#432111" },
];

export const AVATAR_EYES_OPTIONS: AvatarOption<AvatarEyes>[] = [
  { value: "calm", label: "Sereno", labelEn: "Calm" },
  { value: "cheerful", label: "Sorriso", labelEn: "Cheerful" },
  { value: "sharp", label: "Estrategista", labelEn: "Strategist" },
  { value: "wise", label: "Sábio", labelEn: "Wise" },
];

export const AVATAR_HAIR_OPTIONS: AvatarOption<AvatarHair>[] = [
  { value: "none", label: "Careca", labelEn: "Bald" },
  { value: "short", label: "Curto", labelEn: "Short" },
  { value: "wavy", label: "Ondulado", labelEn: "Wavy" },
  { value: "bun", label: "Coque", labelEn: "Bun" },
  { value: "braids", label: "Tranças", labelEn: "Braids" },
  { value: "curly", label: "Cacheado", labelEn: "Curly" },
  { value: "long", label: "Longo", labelEn: "Long" },
];

export const AVATAR_HAIR_COLOR_OPTIONS: AvatarOption<AvatarHairColor>[] = [
  { value: "brown", label: "Castanho", labelEn: "Brown", swatch: "#5a3821", secondarySwatch: "#3b2313" },
  { value: "black", label: "Preto", labelEn: "Black", swatch: "#1f242d", secondarySwatch: "#0d1117" },
  { value: "blonde", label: "Loiro", labelEn: "Blonde", swatch: "#eab308", secondarySwatch: "#a16207" },
  { value: "red", label: "Ruivo", labelEn: "Auburn", swatch: "#c2410c", secondarySwatch: "#7c2d12" },
  { value: "silver", label: "Prateado", labelEn: "Silver", swatch: "#cbd5e1", secondarySwatch: "#64748b" },
  { value: "navy", label: "Marinho", labelEn: "Navy", swatch: "#1e40af", secondarySwatch: "#1e3a8a" },
];

export const AVATAR_BEARD_OPTIONS: AvatarOption<AvatarBeard>[] = [
  { value: "none", label: "Sem Barba", labelEn: "Clean-Shaven" },
  { value: "goatee", label: "Cavanhaque", labelEn: "Goatee" },
  { value: "full", label: "Barba Cheia", labelEn: "Full Beard" },
  { value: "mustache", label: "Bigode", labelEn: "Mustache" },
];

export const AVATAR_HAT_OPTIONS: AvatarOption<AvatarHat>[] = [
  { value: "none", label: "Sem Chapéu", labelEn: "No Hat", requiredWins: 0 },
  { value: "captain", label: "Tricórnio de Capitão", labelEn: "Captain's Tricorne", requiredWins: 0 },
  { value: "explorer", label: "Chapéu Explorador", labelEn: "Explorer Hat", requiredWins: 0 },
  { value: "bandana", label: "Bandana Marítima", labelEn: "Sea Bandana", requiredWins: 0 },
  { value: "helm", label: "Elmo de Ferro", labelEn: "Iron Helm", requiredWins: 0 },
  {
    value: "crown_gold",
    label: "Coroa Dourada do Soberano",
    labelEn: "Sovereign Golden Crown",
    requiredWins: 7,
    subtitle: "Prestígio Real",
    subtitleEn: "Royal Prestige",
  },
];

export const AVATAR_OUTFIT_OPTIONS: AvatarOption<AvatarOutfit>[] = [
  { value: "settler", label: "Túnica de Colono", labelEn: "Settler Tunic" },
  { value: "captain", label: "Casaco de Capitão", labelEn: "Captain Coat" },
  { value: "armor", label: "Armadura Medieval", labelEn: "Medieval Armor" },
  { value: "merchant", label: "Manto de Mercador", labelEn: "Merchant Cloak" },
];

export const AVATAR_OUTFIT_COLOR_OPTIONS: AvatarOption<AvatarOutfitColor>[] = [
  { value: "crimson", label: "Carmesim", labelEn: "Crimson", swatch: "#dc2626", secondarySwatch: "#7f1d1d" },
  { value: "royal", label: "Azul Real", labelEn: "Royal Blue", swatch: "#2563eb", secondarySwatch: "#1e3a8a" },
  { value: "emerald", label: "Esmeralda", labelEn: "Emerald", swatch: "#059669", secondarySwatch: "#064e3b" },
  { value: "amber", label: "Âmbar", labelEn: "Amber", swatch: "#d97706", secondarySwatch: "#78350f" },
  { value: "slate", label: "Ardósia", labelEn: "Slate", swatch: "#475569", secondarySwatch: "#1e293b" },
];

export const AVATAR_BACKGROUND_OPTIONS: AvatarOption<AvatarBackground>[] = [
  { value: "ocean", label: "Oceano", labelEn: "Ocean", swatch: "#0e4d7a", secondarySwatch: "#06213c" },
  { value: "sunset", label: "Pôr do Sol", labelEn: "Sunset", swatch: "#ea580c", secondarySwatch: "#581c87" },
  { value: "forest", label: "Floresta", labelEn: "Forest", swatch: "#15803d", secondarySwatch: "#052e16" },
  { value: "mountain", label: "Montanhas", labelEn: "Mountains", swatch: "#334155", secondarySwatch: "#0f172a" },
  { value: "gold", label: "Campos de Trigo", labelEn: "Wheat Fields", swatch: "#ca8a04", secondarySwatch: "#713f12" },
  { value: "crimson", label: "Fortaleza", labelEn: "Fortress", swatch: "#991b1b", secondarySwatch: "#450a0a" },
];

export const AVATAR_FRAME_OPTIONS: AvatarOption<AvatarFrame>[] = [
  {
    value: "wood",
    label: "Madeira de Colono",
    labelEn: "Settler Wood",
    swatch: "#925d30",
    secondarySwatch: "#5a3618",
    requiredWins: 0,
    subtitle: "Inicial",
    subtitleEn: "Starter",
  },
  {
    value: "bronze",
    label: "Bronze de Navegador",
    labelEn: "Navigator Bronze",
    swatch: "#d97736",
    secondarySwatch: "#7c3b15",
    requiredWins: 1,
    subtitle: "1 Vitória",
    subtitleEn: "1 Win",
  },
  {
    value: "silver",
    label: "Prata da Guilda",
    labelEn: "Guild Silver",
    swatch: "#e2e8f0",
    secondarySwatch: "#64748b",
    requiredWins: 3,
    subtitle: "3 Vitórias",
    subtitleEn: "3 Wins",
  },
  {
    value: "gold",
    label: "Ouro Real",
    labelEn: "Royal Gold",
    swatch: "#facc15",
    secondarySwatch: "#b45309",
    requiredWins: 5,
    subtitle: "5 Vitórias",
    subtitleEn: "5 Wins",
  },
  {
    value: "imperial",
    label: "Imperial da Ilha",
    labelEn: "Isle Imperial",
    swatch: "#10b981",
    secondarySwatch: "#facc15",
    requiredWins: 10,
    subtitle: "10 Vitórias",
    subtitleEn: "10 Wins",
  },
];

export const AVATAR_VALID_VALUES: Record<keyof AvatarConfig, readonly string[]> = {
  skin: AVATAR_SKIN_OPTIONS.map((o) => o.value),
  eyes: AVATAR_EYES_OPTIONS.map((o) => o.value),
  hair: AVATAR_HAIR_OPTIONS.map((o) => o.value),
  hairColor: AVATAR_HAIR_COLOR_OPTIONS.map((o) => o.value),
  beard: AVATAR_BEARD_OPTIONS.map((o) => o.value),
  hat: AVATAR_HAT_OPTIONS.map((o) => o.value),
  outfit: AVATAR_OUTFIT_OPTIONS.map((o) => o.value),
  outfitColor: AVATAR_OUTFIT_COLOR_OPTIONS.map((o) => o.value),
  background: AVATAR_BACKGROUND_OPTIONS.map((o) => o.value),
  frame: AVATAR_FRAME_OPTIONS.map((o) => o.value),
};

export const AVATAR_UNLOCK_REQUIREMENTS: Partial<
  Record<keyof AvatarConfig, Record<string, number>>
> = {
  frame: { bronze: 1, silver: 3, gold: 5, imperial: 10 },
  hat: { crown_gold: 7 },
};

export type AvatarPreset = {
  id: string;
  label: string;
  labelEn: string;
  config: AvatarConfig;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "sea_captain",
    label: "Capitão dos Mares",
    labelEn: "Sea Captain",
    config: {
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
    },
  },
  {
    id: "isle_botanist",
    label: "Guardiã da Floresta",
    labelEn: "Forest Warden",
    config: {
      skin: "fair",
      eyes: "cheerful",
      hair: "braids",
      hairColor: "red",
      beard: "none",
      hat: "explorer",
      outfit: "settler",
      outfitColor: "emerald",
      background: "forest",
      frame: "wood",
    },
  },
  {
    id: "forge_sentinel",
    label: "Sentinela da Serra",
    labelEn: "Mountain Sentinel",
    config: {
      skin: "tan",
      eyes: "sharp",
      hair: "short",
      hairColor: "silver",
      beard: "full",
      hat: "helm",
      outfit: "armor",
      outfitColor: "slate",
      background: "mountain",
      frame: "wood",
    },
  },
  {
    id: "amber_broker",
    label: "Mercador do Porto",
    labelEn: "Harbor Merchant",
    config: {
      skin: "warm",
      eyes: "wise",
      hair: "wavy",
      hairColor: "brown",
      beard: "mustache",
      hat: "none",
      outfit: "merchant",
      outfitColor: "amber",
      background: "gold",
      frame: "wood",
    },
  },
  {
    id: "crimson_mason",
    label: "Mestre Construtora",
    labelEn: "Master Builder",
    config: {
      skin: "brown",
      eyes: "calm",
      hair: "long",
      hairColor: "black",
      beard: "none",
      hat: "bandana",
      outfit: "settler",
      outfitColor: "crimson",
      background: "crimson",
      frame: "wood",
    },
  },
  {
    id: "sunset_cartographer",
    label: "Cartógrafo do Poente",
    labelEn: "Sunset Cartographer",
    config: {
      skin: "deep",
      eyes: "cheerful",
      hair: "curly",
      hairColor: "blonde",
      beard: "goatee",
      hat: "none",
      outfit: "merchant",
      outfitColor: "royal",
      background: "sunset",
      frame: "wood",
    },
  },
];

export function localizeAvatarOption<T extends string>(
  opt: AvatarOption<T>,
  lang: AppLanguage = getCurrentLanguage()
): AvatarOption<T> {
  if (lang !== "en") return opt;
  return {
    ...opt,
    label: opt.labelEn ?? opt.label,
    subtitle: opt.subtitleEn ?? opt.subtitle,
  };
}

export function getFrameLabel(
  frame: AvatarFrame,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const found = AVATAR_FRAME_OPTIONS.find((f) => f.value === frame);
  if (!found) return lang === "en" ? "Settler Wood" : "Madeira de Colono";
  return lang === "en" ? found.labelEn ?? found.label : found.label;
}

export function getDefaultGuestDisplayName(
  lang: AppLanguage = getCurrentLanguage()
): string {
  return lang === "en" ? "Island Explorer" : DEFAULT_GUEST_DISPLAY_NAME;
}

export function localizeGuestDisplayName(
  name: string,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === DEFAULT_GUEST_DISPLAY_NAME ||
    trimmed === "Island Explorer"
  ) {
    return getDefaultGuestDisplayName(lang);
  }
  return name;
}

export function getAvatarItemRequirement(
  field: keyof AvatarConfig,
  value: string
): number {
  return AVATAR_UNLOCK_REQUIREMENTS[field]?.[value] ?? 0;
}

export function isAvatarItemUnlocked(
  field: keyof AvatarConfig,
  value: string,
  wins = 0
): boolean {
  return wins >= getAvatarItemRequirement(field, value);
}

export function sanitizeAvatarConfig(
  raw?: Partial<AvatarConfig> | Record<string, unknown> | null
): Partial<AvatarConfig> {
  if (!raw || typeof raw !== "object") return {};
  const result: Partial<AvatarConfig> = {};
  for (const field of Object.keys(AVATAR_VALID_VALUES) as Array<keyof AvatarConfig>) {
    const val = (raw as Record<string, unknown>)[field];
    if (typeof val === "string" && AVATAR_VALID_VALUES[field].includes(val)) {
      (result as Record<string, string>)[field] = val;
    }
  }
  return result;
}

function hashUsername(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolveAvatarConfig(
  raw?: Partial<AvatarConfig> | Record<string, unknown> | null,
  username?: string | null
): AvatarConfig {
  const seed = hashUsername((username || "colono").toLowerCase().trim() || "colono");
  const pick = <T extends string>(arr: readonly T[], shift: number): T =>
    arr[(seed >>> shift) % arr.length];

  const baseHats = AVATAR_HAT_OPTIONS.filter((h) => !h.requiredWins).map((h) => h.value);
  const defaults: AvatarConfig = {
    skin: pick(AVATAR_VALID_VALUES.skin as readonly AvatarSkin[], 0),
    eyes: pick(AVATAR_VALID_VALUES.eyes as readonly AvatarEyes[], 3),
    hair: pick(AVATAR_VALID_VALUES.hair as readonly AvatarHair[], 5),
    hairColor: pick(AVATAR_VALID_VALUES.hairColor as readonly AvatarHairColor[], 8),
    beard: pick(AVATAR_VALID_VALUES.beard as readonly AvatarBeard[], 11),
    hat: pick(baseHats, 13),
    outfit: pick(AVATAR_VALID_VALUES.outfit as readonly AvatarOutfit[], 16),
    outfitColor: pick(AVATAR_VALID_VALUES.outfitColor as readonly AvatarOutfitColor[], 19),
    background: pick(AVATAR_VALID_VALUES.background as readonly AvatarBackground[], 22),
    frame: "wood",
  };

  return {
    ...defaults,
    ...sanitizeAvatarConfig(raw),
  };
}

export function randomizeUnlockedAvatar(wins = 0): AvatarConfig {
  const unlockedPick = <T extends string>(
    field: keyof AvatarConfig,
    options: readonly AvatarOption<T>[]
  ): T => {
    const eligible = options.filter((o) => isAvatarItemUnlocked(field, o.value, wins));
    const list = eligible.length > 0 ? eligible : options;
    return list[Math.floor(Math.random() * list.length)].value;
  };

  return {
    skin: unlockedPick("skin", AVATAR_SKIN_OPTIONS),
    eyes: unlockedPick("eyes", AVATAR_EYES_OPTIONS),
    hair: unlockedPick("hair", AVATAR_HAIR_OPTIONS),
    hairColor: unlockedPick("hairColor", AVATAR_HAIR_COLOR_OPTIONS),
    beard: unlockedPick("beard", AVATAR_BEARD_OPTIONS),
    hat: unlockedPick("hat", AVATAR_HAT_OPTIONS),
    outfit: unlockedPick("outfit", AVATAR_OUTFIT_OPTIONS),
    outfitColor: unlockedPick("outfitColor", AVATAR_OUTFIT_COLOR_OPTIONS),
    background: unlockedPick("background", AVATAR_BACKGROUND_OPTIONS),
    frame: unlockedPick("frame", AVATAR_FRAME_OPTIONS),
  };
}

export const GUEST_PROFILE_STORAGE_KEY = "catan_guest_profile_v1";
export const DEFAULT_GUEST_DISPLAY_NAME = "Explorador da Ilha";

export type GuestProfile = {
  display_name: string;
  avatar_config: Partial<AvatarConfig>;
  customized: boolean;
};

export function filterUnlockedAvatarConfig(
  raw?: Partial<AvatarConfig> | Record<string, unknown> | null,
  wins = 0
): Partial<AvatarConfig> {
  const clean = sanitizeAvatarConfig(raw);
  const unlocked: Partial<AvatarConfig> = {};
  for (const field of Object.keys(clean) as Array<keyof AvatarConfig>) {
    const val = clean[field];
    if (val && isAvatarItemUnlocked(field, val, wins)) {
      (unlocked as Record<string, string>)[field] = val;
    }
  }
  return unlocked;
}

export function getGuestProfile(): GuestProfile {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    const fallbackName =
      localStorage.getItem("catan_player_name")?.trim() ||
      DEFAULT_GUEST_DISPLAY_NAME;
    if (!raw) {
      return {
        display_name: fallbackName,
        avatar_config: {},
        customized: false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<GuestProfile>;
    const cleanAvatar = filterUnlockedAvatarConfig(parsed?.avatar_config, 0);
    const cleanName =
      (parsed?.display_name || fallbackName).trim().slice(0, 32) ||
      DEFAULT_GUEST_DISPLAY_NAME;
    return {
      display_name: cleanName,
      avatar_config: cleanAvatar,
      customized: Boolean(parsed?.customized && Object.keys(cleanAvatar).length > 0),
    };
  } catch {
    return {
      display_name: DEFAULT_GUEST_DISPLAY_NAME,
      avatar_config: {},
      customized: false,
    };
  }
}

export function saveGuestProfile(options: {
  displayName?: string;
  avatarConfig: Partial<AvatarConfig>;
}): GuestProfile {
  const cleanName =
    (options.displayName || DEFAULT_GUEST_DISPLAY_NAME).trim().slice(0, 32) ||
    DEFAULT_GUEST_DISPLAY_NAME;
  const fullUnlocked = resolveAvatarConfig(
    filterUnlockedAvatarConfig(options.avatarConfig, 0),
    cleanName
  );
  const cleanAvatar = filterUnlockedAvatarConfig(fullUnlocked, 0);
  const profile: GuestProfile = {
    display_name: cleanName,
    avatar_config: cleanAvatar,
    customized: true,
  };
  try {
    localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem("catan_player_name", cleanName);
  } catch {
    // ignore storage limits
  }
  return profile;
}

export function getCustomGuestAvatarPayload(): Partial<AvatarConfig> | undefined {
  const guest = getGuestProfile();
  if (!guest.customized || Object.keys(guest.avatar_config).length === 0) {
    return undefined;
  }
  return guest.avatar_config;
}

export function getSavedAccountAvatarSummary(): {
  username: string;
  avatar_config?: Partial<AvatarConfig>;
} | null {
  try {
    const raw = localStorage.getItem("catan_player_account");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      username?: string;
      avatar_config?: Partial<AvatarConfig>;
    };
    if (!parsed?.username) return null;
    return {
      username: parsed.username,
      avatar_config: parsed.avatar_config,
    };
  } catch {
    return null;
  }
}
