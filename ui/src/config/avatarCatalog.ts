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

export type AvatarOption<T extends string = string> = {
  value: T;
  label: string;
  swatch?: string;
  secondarySwatch?: string;
  requiredWins?: number;
  subtitle?: string;
};

export const AVATAR_SKIN_OPTIONS: AvatarOption<AvatarSkin>[] = [
  { value: "porcelain", label: "Porcelana", swatch: "#fbe2d1", secondarySwatch: "#e7b99e" },
  { value: "fair", label: "Clara", swatch: "#f3cfb3", secondarySwatch: "#d8a47f" },
  { value: "warm", label: "Dourada", swatch: "#e4b287", secondarySwatch: "#c58958" },
  { value: "tan", label: "Bronzeada", swatch: "#c98b5b", secondarySwatch: "#a46539" },
  { value: "brown", label: "Castanha", swatch: "#995c37", secondarySwatch: "#764021" },
  { value: "deep", label: "Ébano", swatch: "#633722", secondarySwatch: "#432111" },
];

export const AVATAR_EYES_OPTIONS: AvatarOption<AvatarEyes>[] = [
  { value: "calm", label: "Sereno" },
  { value: "cheerful", label: "Sorriso" },
  { value: "sharp", label: "Estrategista" },
  { value: "wise", label: "Sábio" },
];

export const AVATAR_HAIR_OPTIONS: AvatarOption<AvatarHair>[] = [
  { value: "none", label: "Careca" },
  { value: "short", label: "Curto" },
  { value: "wavy", label: "Ondulado" },
  { value: "bun", label: "Coque" },
  { value: "braids", label: "Tranças" },
  { value: "curly", label: "Cacheado" },
  { value: "long", label: "Longo" },
];

export const AVATAR_HAIR_COLOR_OPTIONS: AvatarOption<AvatarHairColor>[] = [
  { value: "brown", label: "Castanho", swatch: "#5a3821", secondarySwatch: "#3b2313" },
  { value: "black", label: "Preto", swatch: "#1f242d", secondarySwatch: "#0d1117" },
  { value: "blonde", label: "Loiro", swatch: "#eab308", secondarySwatch: "#a16207" },
  { value: "red", label: "Ruivo", swatch: "#c2410c", secondarySwatch: "#7c2d12" },
  { value: "silver", label: "Prateado", swatch: "#cbd5e1", secondarySwatch: "#64748b" },
  { value: "navy", label: "Marinho", swatch: "#1e40af", secondarySwatch: "#1e3a8a" },
];

export const AVATAR_BEARD_OPTIONS: AvatarOption<AvatarBeard>[] = [
  { value: "none", label: "Sem Barba" },
  { value: "goatee", label: "Cavanhaque" },
  { value: "full", label: "Barba Cheia" },
  { value: "mustache", label: "Bigode" },
];

export const AVATAR_HAT_OPTIONS: AvatarOption<AvatarHat>[] = [
  { value: "none", label: "Sem Chapéu", requiredWins: 0 },
  { value: "captain", label: "Tricórnio de Capitão", requiredWins: 0 },
  { value: "explorer", label: "Chapéu Explorador", requiredWins: 0 },
  { value: "bandana", label: "Bandana Marítima", requiredWins: 0 },
  { value: "helm", label: "Elmo de Ferro", requiredWins: 0 },
  {
    value: "crown_gold",
    label: "Coroa Dourada do Soberano",
    requiredWins: 7,
    subtitle: "Prestígio Real",
  },
];

export const AVATAR_OUTFIT_OPTIONS: AvatarOption<AvatarOutfit>[] = [
  { value: "settler", label: "Túnica de Colono" },
  { value: "captain", label: "Casaco de Capitão" },
  { value: "armor", label: "Armadura Medieval" },
  { value: "merchant", label: "Manto de Mercador" },
];

export const AVATAR_OUTFIT_COLOR_OPTIONS: AvatarOption<AvatarOutfitColor>[] = [
  { value: "crimson", label: "Carmesim", swatch: "#dc2626", secondarySwatch: "#7f1d1d" },
  { value: "royal", label: "Azul Real", swatch: "#2563eb", secondarySwatch: "#1e3a8a" },
  { value: "emerald", label: "Esmeralda", swatch: "#059669", secondarySwatch: "#064e3b" },
  { value: "amber", label: "Âmbar", swatch: "#d97706", secondarySwatch: "#78350f" },
  { value: "slate", label: "Ardósia", swatch: "#475569", secondarySwatch: "#1e293b" },
];

export const AVATAR_BACKGROUND_OPTIONS: AvatarOption<AvatarBackground>[] = [
  { value: "ocean", label: "Oceano", swatch: "#0e4d7a", secondarySwatch: "#06213c" },
  { value: "sunset", label: "Pôr do Sol", swatch: "#ea580c", secondarySwatch: "#581c87" },
  { value: "forest", label: "Floresta", swatch: "#15803d", secondarySwatch: "#052e16" },
  { value: "mountain", label: "Montanhas", swatch: "#334155", secondarySwatch: "#0f172a" },
  { value: "gold", label: "Campos de Trigo", swatch: "#ca8a04", secondarySwatch: "#713f12" },
  { value: "crimson", label: "Fortaleza", swatch: "#991b1b", secondarySwatch: "#450a0a" },
];

export const AVATAR_FRAME_OPTIONS: AvatarOption<AvatarFrame>[] = [
  {
    value: "wood",
    label: "Madeira de Colono",
    swatch: "#925d30",
    secondarySwatch: "#5a3618",
    requiredWins: 0,
    subtitle: "Inicial",
  },
  {
    value: "bronze",
    label: "Bronze de Navegador",
    swatch: "#d97736",
    secondarySwatch: "#7c3b15",
    requiredWins: 1,
    subtitle: "1 Vitória",
  },
  {
    value: "silver",
    label: "Prata da Guilda",
    swatch: "#e2e8f0",
    secondarySwatch: "#64748b",
    requiredWins: 3,
    subtitle: "3 Vitórias",
  },
  {
    value: "gold",
    label: "Ouro Real",
    swatch: "#facc15",
    secondarySwatch: "#b45309",
    requiredWins: 5,
    subtitle: "5 Vitórias",
  },
  {
    value: "imperial",
    label: "Imperial da Ilha",
    swatch: "#10b981",
    secondarySwatch: "#facc15",
    requiredWins: 10,
    subtitle: "10 Vitórias",
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
  config: AvatarConfig;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "sea_captain",
    label: "Capitão dos Mares",
    config: {
      skin: "warm",
      eyes: "sharp",
      hair: "short",
      hairColor: "brown",
      beard: "full",
      hat: "captain",
      outfit: "captain",
      outfitColor: "royal",
      background: "ocean",
      frame: "wood",
    },
  },
  {
    id: "north_explorer",
    label: "Exploradora do Norte",
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
    id: "hill_knight",
    label: "Cavaleiro da Colina",
    config: {
      skin: "tan",
      eyes: "sharp",
      hair: "short",
      hairColor: "black",
      beard: "goatee",
      hat: "helm",
      outfit: "armor",
      outfitColor: "slate",
      background: "mountain",
      frame: "wood",
    },
  },
  {
    id: "wheat_merchant",
    label: "Mercador de Trigo",
    config: {
      skin: "warm",
      eyes: "cheerful",
      hair: "wavy",
      hairColor: "blonde",
      beard: "mustache",
      hat: "none",
      outfit: "merchant",
      outfitColor: "amber",
      background: "gold",
      frame: "wood",
    },
  },
  {
    id: "mountain_artificer",
    label: "Artífice das Montanhas",
    config: {
      skin: "brown",
      eyes: "wise",
      hair: "short",
      hairColor: "silver",
      beard: "goatee",
      hat: "none",
      outfit: "settler",
      outfitColor: "crimson",
      background: "crimson",
      frame: "wood",
    },
  },
  {
    id: "sun_navigator",
    label: "Navegadora do Sol",
    config: {
      skin: "deep",
      eyes: "calm",
      hair: "bun",
      hairColor: "black",
      beard: "none",
      hat: "bandana",
      outfit: "settler",
      outfitColor: "royal",
      background: "sunset",
      frame: "wood",
    },
  },
];

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
    arr[(seed >> shift) % arr.length];

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
