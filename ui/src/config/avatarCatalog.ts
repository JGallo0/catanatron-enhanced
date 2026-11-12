import type {
  AvatarBackground,
  AvatarBeard,
  AvatarBodyType,
  AvatarBrowStyle,
  AvatarCatalogEntry,
  AvatarColors,
  AvatarConfig,
  AvatarConfigV2,
  AvatarEyeStyle,
  AvatarEyes,
  AvatarFrame,
  AvatarHair,
  AvatarHairColor,
  AvatarHat,
  AvatarHeadShape,
  AvatarItemSlot,
  AvatarMouthStyle,
  AvatarNoseStyle,
  AvatarOutfit,
  AvatarOutfitColor,
  AvatarSkin,
  LockedAvatarItem,
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

export type AvatarColorSwatch = {
  hex: string;
  label: string;
  labelEn: string;
};

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const MAX_PORTRAIT_SNAPSHOT_CHARS = 65536;
export const PORTRAIT_SNAPSHOT_RE =
  /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/=]+$/;

export function isValidHexColor(val: unknown): val is string {
  return typeof val === "string" && HEX_COLOR_RE.test(val);
}

export function isValidPortraitSnapshot(val: unknown): val is string {
  return (
    typeof val === "string" &&
    val.length > 0 &&
    val.length <= MAX_PORTRAIT_SNAPSHOT_CHARS &&
    PORTRAIT_SNAPSHOT_RE.test(val)
  );
}

export const AVATAR_COLOR_SWATCHES: Record<
  keyof AvatarColors,
  readonly AvatarColorSwatch[]
> = {
  skin: [
    { hex: "#fbe2d1", label: "Porcelana", labelEn: "Porcelain" },
    { hex: "#f3cfb3", label: "Clara", labelEn: "Fair" },
    { hex: "#e4b287", label: "Dourada", labelEn: "Warm" },
    { hex: "#c98b5b", label: "Bronzeada", labelEn: "Tan" },
    { hex: "#995c37", label: "Castanha", labelEn: "Brown" },
    { hex: "#633722", label: "Ébano", labelEn: "Deep" },
  ],
  hair: [
    { hex: "#5a3821", label: "Castanho", labelEn: "Brown" },
    { hex: "#1f242d", label: "Preto", labelEn: "Black" },
    { hex: "#eab308", label: "Loiro", labelEn: "Blonde" },
    { hex: "#c2410c", label: "Ruivo", labelEn: "Auburn" },
    { hex: "#cbd5e1", label: "Prateado", labelEn: "Silver" },
    { hex: "#1e40af", label: "Marinho", labelEn: "Navy" },
    { hex: "#432316", label: "Mogno", labelEn: "Mahogany" },
    { hex: "#f8fafc", label: "Branco Lunar", labelEn: "Lunar White" },
  ],
  eyes: [
    { hex: "#1e293b", label: "Obsidiana", labelEn: "Obsidian" },
    { hex: "#0284c7", label: "Azul Oceano", labelEn: "Ocean Blue" },
    { hex: "#16a34a", label: "Esmeralda", labelEn: "Emerald" },
    { hex: "#92400e", label: "Âmbar", labelEn: "Amber" },
    { hex: "#7c3aed", label: "Ametista", labelEn: "Amethyst" },
    { hex: "#dc2626", label: "Rubi", labelEn: "Ruby" },
  ],
  outfitPrimary: [
    { hex: "#dc2626", label: "Carmesim", labelEn: "Crimson" },
    { hex: "#2563eb", label: "Azul Real", labelEn: "Royal Blue" },
    { hex: "#059669", label: "Esmeralda", labelEn: "Emerald" },
    { hex: "#d97706", label: "Âmbar", labelEn: "Amber" },
    { hex: "#475569", label: "Ardósia", labelEn: "Slate" },
    { hex: "#1d4ed8", label: "Safira", labelEn: "Sapphire" },
    { hex: "#581c87", label: "Púrpura Imperial", labelEn: "Imperial Purple" },
    { hex: "#0f172a", label: "Noite", labelEn: "Midnight" },
  ],
  outfitSecondary: [
    { hex: "#7f1d1d", label: "Vinho", labelEn: "Burgundy" },
    { hex: "#1e3a8a", label: "Marinho Profundo", labelEn: "Deep Navy" },
    { hex: "#064e3b", label: "Pinho", labelEn: "Pine" },
    { hex: "#78350f", label: "Couro", labelEn: "Leather" },
    { hex: "#1e293b", label: "Carvão", labelEn: "Charcoal" },
    { hex: "#991b1b", label: "Escarlate", labelEn: "Scarlet" },
    { hex: "#cbd5e1", label: "Linho", labelEn: "Linen" },
  ],
  outfitTrim: [
    { hex: "#facc15", label: "Ouro Antigo", labelEn: "Antique Gold" },
    { hex: "#fde047", label: "Ouro Solar", labelEn: "Sun Gold" },
    { hex: "#e2e8f0", label: "Prata Polida", labelEn: "Polished Silver" },
    { hex: "#d97736", label: "Bronze", labelEn: "Bronze" },
    { hex: "#38bdf8", label: "Ciano Místico", labelEn: "Mystic Cyan" },
  ],
  mount: [
    { hex: "#854d0e", label: "Alazão", labelEn: "Chestnut" },
    { hex: "#e2e8f0", label: "Branco Glacial", labelEn: "Glacial White" },
    { hex: "#334155", label: "Cinza Tempestade", labelEn: "Storm Grey" },
    { hex: "#1e293b", label: "Obsidiana", labelEn: "Obsidian" },
    { hex: "#d97706", label: "Dourado", labelEn: "Golden" },
    { hex: "#f8fafc", label: "Neve", labelEn: "Snow" },
  ],
};

// ===== V1 Option Lists (preserved for full backward compatibility) =====
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

// ===== Unified V2 Catalog (3D Modular + Monetization + Achievements) =====
export const AVATAR_CATALOG_ITEMS: readonly AvatarCatalogEntry[] = [
  // bodyType
  { slot: "bodyType", id: "athletic", label: "Atlético", labelEn: "Athletic", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/bodies/athletic.glb" },
  { slot: "bodyType", id: "sturdy", label: "Robusto", labelEn: "Sturdy", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/bodies/sturdy.glb" },
  { slot: "bodyType", id: "slender", label: "Esguio", labelEn: "Slender", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/bodies/slender.glb" },

  // headShape
  { slot: "headShape", id: "oval", label: "Oval", labelEn: "Oval", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/heads/oval.glb" },
  { slot: "headShape", id: "square", label: "Quadrado", labelEn: "Square", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/heads/square.glb" },
  { slot: "headShape", id: "heart", label: "Coração", labelEn: "Heart", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/heads/heart.glb" },
  { slot: "headShape", id: "chiseled", label: "Esculpido", labelEn: "Chiseled", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/heads/chiseled.glb" },

  // eyeStyle
  { slot: "eyeStyle", id: "noble", label: "Nobre", labelEn: "Noble", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "eyeStyle", id: "fierce", label: "Feroz", labelEn: "Fierce", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "eyeStyle", id: "wise", label: "Sábio", labelEn: "Wise", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "eyeStyle", id: "cheerful", label: "Sorriso", labelEn: "Cheerful", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "eyeStyle", id: "calm", label: "Sereno", labelEn: "Calm", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "eyeStyle", id: "sharp", label: "Estrategista", labelEn: "Strategist", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },

  // browStyle
  { slot: "browStyle", id: "arched", label: "Arqueada", labelEn: "Arched", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "browStyle", id: "thick", label: "Espessa", labelEn: "Thick", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "browStyle", id: "calm", label: "Serena", labelEn: "Calm", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "browStyle", id: "scarred", label: "Com Cicatriz", labelEn: "Scarred", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },

  // noseStyle
  { slot: "noseStyle", id: "straight", label: "Reto", labelEn: "Straight", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "noseStyle", id: "aquiline", label: "Aquilino", labelEn: "Aquiline", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "noseStyle", id: "broad", label: "Largo", labelEn: "Broad", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "noseStyle", id: "button", label: "Fino", labelEn: "Button", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },

  // mouthStyle
  { slot: "mouthStyle", id: "confident", label: "Confiante", labelEn: "Confident", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "mouthStyle", id: "smile", label: "Sorridente", labelEn: "Smiling", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "mouthStyle", id: "serious", label: "Sério", labelEn: "Serious", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "mouthStyle", id: "smirk", label: "Sarcástico", labelEn: "Smirk", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },

  // hair
  { slot: "hair", id: "none", label: "Careca", labelEn: "Bald", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "hair", id: "short", label: "Curto", labelEn: "Short", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hair/short.glb" },
  { slot: "hair", id: "wavy", label: "Ondulado", labelEn: "Wavy", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hair/wavy.glb" },
  { slot: "hair", id: "bun", label: "Coque", labelEn: "Bun", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hair/bun.glb" },
  { slot: "hair", id: "braids", label: "Tranças", labelEn: "Braids", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hair/braids.glb" },
  { slot: "hair", id: "curly", label: "Cacheado", labelEn: "Curly", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hair/curly.glb" },
  { slot: "hair", id: "long", label: "Longo", labelEn: "Long", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hair/long.glb" },
  { slot: "hair", id: "navigator", label: "Navegador", labelEn: "Navigator", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hair/navigator.glb" },
  { slot: "hair", id: "royal_bun", label: "Coque Real", labelEn: "Royal Bun", tier: "vip", rarity: "rare", requiredWins: 0, sku: "vip_hair_royal_bun", priceBrlCents: 690, modelPath: "/assets/models/avatars/hair/royal_bun.glb" },

  // beard
  { slot: "beard", id: "none", label: "Sem Barba", labelEn: "Clean-Shaven", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "beard", id: "goatee", label: "Cavanhaque", labelEn: "Goatee", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/beards/goatee.glb" },
  { slot: "beard", id: "full", label: "Barba Cheia", labelEn: "Full Beard", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/beards/full.glb" },
  { slot: "beard", id: "mustache", label: "Bigode", labelEn: "Mustache", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/beards/mustache.glb" },
  { slot: "beard", id: "captain_trimmed", label: "Barba de Capitão", labelEn: "Captain's Trim", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/beards/captain_trimmed.glb" },
  { slot: "beard", id: "full_viking", label: "Barba Viking Real", labelEn: "Royal Viking Beard", tier: "vip", rarity: "rare", requiredWins: 0, sku: "vip_beard_viking", priceBrlCents: 690, modelPath: "/assets/models/avatars/beards/full_viking.glb" },

  // outfit
  { slot: "outfit", id: "settler", label: "Túnica de Colono", labelEn: "Settler Tunic", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/outfits/settler.glb" },
  { slot: "outfit", id: "captain", label: "Casaco de Capitão", labelEn: "Captain Coat", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/outfits/captain.glb" },
  { slot: "outfit", id: "armor", label: "Armadura Medieval", labelEn: "Medieval Armor", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/outfits/armor.glb" },
  { slot: "outfit", id: "merchant", label: "Manto de Mercador", labelEn: "Merchant Cloak", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/outfits/merchant.glb" },
  { slot: "outfit", id: "imperial_lord", label: "Traje de Lorde Imperial", labelEn: "Imperial Lord Attire", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_outfit_imperial_lord", priceBrlCents: 1490, modelPath: "/assets/models/avatars/outfits/imperial_lord.glb" },

  // legsBoots
  { slot: "legsBoots", id: "traveler", label: "Botas de Viajante", labelEn: "Traveler Boots", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/legs/traveler.glb" },
  { slot: "legsBoots", id: "cuffed_boots", label: "Botas Dobradas", labelEn: "Cuffed Boots", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/legs/cuffed_boots.glb" },
  { slot: "legsBoots", id: "greaves", label: "Grevas de Aço", labelEn: "Steel Greaves", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/legs/greaves.glb" },
  { slot: "legsBoots", id: "royal_greaves", label: "Grevas Reais", labelEn: "Royal Greaves", tier: "vip", rarity: "rare", requiredWins: 0, sku: "vip_legs_royal_greaves", priceBrlCents: 790, modelPath: "/assets/models/avatars/legs/royal_greaves.glb" },

  // cape
  { slot: "cape", id: "none", label: "Sem Capa", labelEn: "No Cape", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "cape", id: "traveler", label: "Capa de Viajante", labelEn: "Traveler Cloak", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/capes/traveler.glb" },
  { slot: "cape", id: "navy_commander", label: "Manto de Comandante", labelEn: "Navy Commander Cape", tier: "earnable", rarity: "rare", requiredWins: 2, modelPath: "/assets/models/avatars/capes/navy_commander.glb" },
  { slot: "cape", id: "royal_mantle", label: "Manto Real Imperial", labelEn: "Royal Mantle", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_cape_royal_mantle", priceBrlCents: 1290, modelPath: "/assets/models/avatars/capes/royal_mantle.glb" },

  // hat
  { slot: "hat", id: "none", label: "Sem Chapéu", labelEn: "No Hat", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "hat", id: "captain", label: "Tricórnio de Capitão", labelEn: "Captain's Tricorne", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hats/captain.glb" },
  { slot: "hat", id: "explorer", label: "Chapéu Explorador", labelEn: "Explorer Hat", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hats/explorer.glb" },
  { slot: "hat", id: "bandana", label: "Bandana Marítima", labelEn: "Sea Bandana", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hats/bandana.glb" },
  { slot: "hat", id: "helm", label: "Elmo de Ferro", labelEn: "Iron Helm", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/hats/helm.glb" },
  { slot: "hat", id: "crown_gold", label: "Coroa Dourada do Soberano", labelEn: "Sovereign Golden Crown", tier: "earnable", rarity: "epic", requiredWins: 7, subtitle: "Prestígio Real", subtitleEn: "Royal Prestige", modelPath: "/assets/models/avatars/hats/crown_gold.glb" },
  { slot: "hat", id: "admiral_bicorne", label: "Bicórnio do Almirante", labelEn: "Admiral's Bicorne", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_hat_admiral_bicorne", priceBrlCents: 990, modelPath: "/assets/models/avatars/hats/admiral_bicorne.glb" },

  // handProp
  { slot: "handProp", id: "none", label: "Mãos Livres", labelEn: "Empty Hand", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "handProp", id: "spyglass", label: "Luneta Dourada", labelEn: "Golden Spyglass", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/props_hand/spyglass.glb" },
  { slot: "handProp", id: "scroll", label: "Pergaminho de Rotas", labelEn: "Route Scroll", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/props_hand/scroll.glb" },
  { slot: "handProp", id: "royal_scepter", label: "Cetro Real", labelEn: "Royal Scepter", tier: "earnable", rarity: "rare", requiredWins: 4, modelPath: "/assets/models/avatars/props_hand/royal_scepter.glb" },
  { slot: "handProp", id: "sun_rapier", label: "Rapieira do Sol", labelEn: "Sun Rapier", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_prop_sun_rapier", priceBrlCents: 1190, modelPath: "/assets/models/avatars/props_hand/sun_rapier.glb" },

  // backProp
  { slot: "backProp", id: "none", label: "Sem Item nas Costas", labelEn: "None", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "backProp", id: "explorer_pack", label: "Mochila de Explorador", labelEn: "Explorer Pack", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/props_back/explorer_pack.glb" },
  { slot: "backProp", id: "sheathed_sword", label: "Espada Embainhada", labelEn: "Sheathed Sword", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/props_back/sheathed_sword.glb" },
  { slot: "backProp", id: "imperial_shield", label: "Escudo Imperial", labelEn: "Imperial Shield", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_prop_shield", priceBrlCents: 1190, modelPath: "/assets/models/avatars/props_back/imperial_shield.glb" },

  // pet
  { slot: "pet", id: "none", label: "Sem Mascote", labelEn: "No Pet", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "pet", id: "owl", label: "Coruja Cartógrafa", labelEn: "Cartographer Owl", tier: "earnable", rarity: "rare", requiredWins: 6, modelPath: "/assets/models/avatars/pets/owl.glb" },
  { slot: "pet", id: "parrot", label: "Papagaio Corsário", labelEn: "Corsair Parrot", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_pet_parrot", priceBrlCents: 1490, modelPath: "/assets/models/avatars/pets/parrot.glb" },
  { slot: "pet", id: "falcon", label: "Falcão Real", labelEn: "Royal Falcon", tier: "vip", rarity: "legendary", requiredWins: 0, sku: "vip_pet_falcon", priceBrlCents: 1990, modelPath: "/assets/models/avatars/pets/falcon.glb" },

  // mount
  { slot: "mount", id: "none", label: "Sem Montaria", labelEn: "No Mount", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "mount", id: "island_horse", label: "Corcel da Ilha", labelEn: "Island Steed", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/mounts/island_horse.glb" },
  { slot: "mount", id: "snow_wolf", label: "Lobo das Neves", labelEn: "Snow Wolf", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_mount_snow_wolf", priceBrlCents: 1990, modelPath: "/assets/models/avatars/mounts/snow_wolf.glb" },
  { slot: "mount", id: "royal_stag", label: "Cervo Real", labelEn: "Royal Stag", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_mount_royal_stag", priceBrlCents: 1990, modelPath: "/assets/models/avatars/mounts/royal_stag.glb" },
  { slot: "mount", id: "imperial_griffin", label: "Grifo Imperial", labelEn: "Imperial Griffin", tier: "vip", rarity: "legendary", requiredWins: 0, sku: "vip_mount_griffin", priceBrlCents: 2990, modelPath: "/assets/models/avatars/mounts/imperial_griffin.glb" },

  // pedestal
  { slot: "pedestal", id: "stone_wood", label: "Pedestal Pedra & Carvalho", labelEn: "Stone & Oak Pedestal", tier: "free", rarity: "common", requiredWins: 0, modelPath: "/assets/models/avatars/pedestals/stone_wood.glb" },
  { slot: "pedestal", id: "runic_gold", label: "Pedestal Rúnico Dourado", labelEn: "Golden Runic Pedestal", tier: "earnable", rarity: "rare", requiredWins: 5, modelPath: "/assets/models/avatars/pedestals/runic_gold.glb" },
  { slot: "pedestal", id: "obsidian_crown", label: "Trono de Obsidiana", labelEn: "Obsidian Crown Base", tier: "vip", rarity: "epic", requiredWins: 0, sku: "vip_pedestal_obsidian", priceBrlCents: 990, modelPath: "/assets/models/avatars/pedestals/obsidian_crown.glb" },

  // aura
  { slot: "aura", id: "none", label: "Sem Aura", labelEn: "No Aura", tier: "free", rarity: "common", requiredWins: 0, modelPath: null },
  { slot: "aura", id: "sun_motes", label: "Partículas Solares", labelEn: "Sun Motes", tier: "earnable", rarity: "epic", requiredWins: 8, modelPath: null },
  { slot: "aura", id: "sea_mist", label: "Bruma Marinha", labelEn: "Sea Mist", tier: "vip", rarity: "rare", requiredWins: 0, sku: "vip_aura_sea_mist", priceBrlCents: 890, modelPath: null },
  { slot: "aura", id: "imperial_flame", label: "Chama Imperial", labelEn: "Imperial Flame", tier: "vip", rarity: "legendary", requiredWins: 0, sku: "vip_aura_imperial_flame", priceBrlCents: 1790, modelPath: null },

  // background
  { slot: "background", id: "ocean", label: "Oceano", labelEn: "Ocean", tier: "free", rarity: "common", requiredWins: 0, swatch: "#0e4d7a", secondarySwatch: "#06213c", modelPath: null },
  { slot: "background", id: "sunset", label: "Pôr do Sol", labelEn: "Sunset", tier: "free", rarity: "common", requiredWins: 0, swatch: "#ea580c", secondarySwatch: "#581c87", modelPath: null },
  { slot: "background", id: "forest", label: "Floresta", labelEn: "Forest", tier: "free", rarity: "common", requiredWins: 0, swatch: "#15803d", secondarySwatch: "#052e16", modelPath: null },
  { slot: "background", id: "mountain", label: "Montanhas", labelEn: "Mountains", tier: "free", rarity: "common", requiredWins: 0, swatch: "#334155", secondarySwatch: "#0f172a", modelPath: null },
  { slot: "background", id: "gold", label: "Campos de Trigo", labelEn: "Wheat Fields", tier: "free", rarity: "common", requiredWins: 0, swatch: "#ca8a04", secondarySwatch: "#713f12", modelPath: null },
  { slot: "background", id: "crimson", label: "Fortaleza", labelEn: "Fortress", tier: "free", rarity: "common", requiredWins: 0, swatch: "#991b1b", secondarySwatch: "#450a0a", modelPath: null },

  // frame
  { slot: "frame", id: "wood", label: "Madeira de Colono", labelEn: "Settler Wood", tier: "free", rarity: "common", requiredWins: 0, swatch: "#925d30", secondarySwatch: "#5a3618", subtitle: "Inicial", subtitleEn: "Starter", modelPath: null },
  { slot: "frame", id: "bronze", label: "Bronze de Navegador", labelEn: "Navigator Bronze", tier: "earnable", rarity: "common", requiredWins: 1, swatch: "#d97736", secondarySwatch: "#7c3b15", subtitle: "1 Vitória", subtitleEn: "1 Win", modelPath: null },
  { slot: "frame", id: "silver", label: "Prata da Guilda", labelEn: "Guild Silver", tier: "earnable", rarity: "rare", requiredWins: 3, swatch: "#e2e8f0", secondarySwatch: "#64748b", subtitle: "3 Vitórias", subtitleEn: "3 Wins", modelPath: null },
  { slot: "frame", id: "gold", label: "Ouro Real", labelEn: "Royal Gold", tier: "earnable", rarity: "epic", requiredWins: 5, swatch: "#facc15", secondarySwatch: "#b45309", subtitle: "5 Vitórias", subtitleEn: "5 Wins", modelPath: null },
  { slot: "frame", id: "imperial", label: "Imperial da Ilha", labelEn: "Isle Imperial", tier: "earnable", rarity: "legendary", requiredWins: 10, swatch: "#10b981", secondarySwatch: "#facc15", subtitle: "10 Vitórias", subtitleEn: "10 Wins", modelPath: null },
  { slot: "frame", id: "vip_dragon", label: "Dragão Imperial", labelEn: "Imperial Dragon", tier: "vip", rarity: "legendary", requiredWins: 0, sku: "vip_frame_dragon", priceBrlCents: 1690, swatch: "#f59e0b", secondarySwatch: "#7f1d1d", subtitle: "VIP Exclusivo", subtitleEn: "VIP Exclusive", modelPath: null },
];

export const AVATAR_CATALOG_SLOTS: readonly AvatarItemSlot[] = [
  "bodyType",
  "headShape",
  "eyeStyle",
  "browStyle",
  "noseStyle",
  "mouthStyle",
  "hair",
  "beard",
  "outfit",
  "legsBoots",
  "cape",
  "hat",
  "handProp",
  "backProp",
  "pet",
  "mount",
  "pedestal",
  "aura",
  "background",
  "frame",
];

const CATALOG_LOOKUP = new Map<string, AvatarCatalogEntry>(
  AVATAR_CATALOG_ITEMS.map((entry) => [`${entry.slot}:${entry.id}`, entry])
);

const VALID_IDS_BY_SLOT: Record<AvatarItemSlot, readonly string[]> =
  AVATAR_CATALOG_SLOTS.reduce(
    (acc, slot) => {
      acc[slot] = AVATAR_CATALOG_ITEMS.filter((i) => i.slot === slot).map(
        (i) => i.id
      );
      return acc;
    },
    {} as Record<AvatarItemSlot, readonly string[]>
  );

export function findAvatarCatalogItem(
  slot: AvatarItemSlot,
  id: string
): AvatarCatalogEntry | undefined {
  return CATALOG_LOOKUP.get(`${slot}:${id}`);
}

export function getAvatarCatalogBySlot(
  slot: AvatarItemSlot
): AvatarCatalogEntry[] {
  return AVATAR_CATALOG_ITEMS.filter((entry) => entry.slot === slot);
}

export const AVATAR_VALID_VALUES: Record<
  "skin" | "eyes" | "hair" | "hairColor" | "beard" | "hat" | "outfit" | "outfitColor" | "background" | "frame",
  readonly string[]
> = {
  skin: AVATAR_SKIN_OPTIONS.map((o) => o.value),
  eyes: AVATAR_EYES_OPTIONS.map((o) => o.value),
  hair: VALID_IDS_BY_SLOT.hair,
  hairColor: AVATAR_HAIR_COLOR_OPTIONS.map((o) => o.value),
  beard: VALID_IDS_BY_SLOT.beard,
  hat: VALID_IDS_BY_SLOT.hat,
  outfit: VALID_IDS_BY_SLOT.outfit,
  outfitColor: AVATAR_OUTFIT_COLOR_OPTIONS.map((o) => o.value),
  background: VALID_IDS_BY_SLOT.background,
  frame: VALID_IDS_BY_SLOT.frame,
};

export const AVATAR_UNLOCK_REQUIREMENTS: Partial<
  Record<keyof AvatarConfig, Record<string, number>>
> = {
  frame: { bronze: 1, silver: 3, gold: 5, imperial: 10 },
  hat: { crown_gold: 7 },
  cape: { navy_commander: 2 },
  handProp: { royal_scepter: 4 },
  pedestal: { runic_gold: 5 },
  pet: { owl: 6 },
  aura: { sun_motes: 8 },
};

const SKIN_HEX_BY_V1: Record<AvatarSkin, string> = {
  porcelain: "#fbe2d1",
  fair: "#f3cfb3",
  warm: "#e4b287",
  tan: "#c98b5b",
  brown: "#995c37",
  deep: "#633722",
};

const HAIR_HEX_BY_V1: Record<AvatarHairColor, string> = {
  brown: "#5a3821",
  black: "#1f242d",
  blonde: "#eab308",
  red: "#c2410c",
  silver: "#cbd5e1",
  navy: "#1e40af",
};

const OUTFIT_COLORS_BY_V1: Record<
  AvatarOutfitColor,
  { primary: string; secondary: string; trim: string }
> = {
  crimson: { primary: "#dc2626", secondary: "#7f1d1d", trim: "#fde047" },
  royal: { primary: "#2563eb", secondary: "#1e3a8a", trim: "#facc15" },
  emerald: { primary: "#059669", secondary: "#064e3b", trim: "#fde68a" },
  amber: { primary: "#d97706", secondary: "#78350f", trim: "#fef08a" },
  slate: { primary: "#475569", secondary: "#1e293b", trim: "#e2e8f0" },
};

const COLOR_KEYS: readonly (keyof AvatarColors)[] = [
  "skin",
  "hair",
  "eyes",
  "outfitPrimary",
  "outfitSecondary",
  "outfitTrim",
  "mount",
];

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
      version: 2,
      bodyType: "athletic",
      headShape: "chiseled",
      eyeStyle: "sharp",
      browStyle: "thick",
      noseStyle: "aquiline",
      mouthStyle: "confident",
      skin: "warm",
      eyes: "sharp",
      hair: "short",
      hairColor: "navy",
      beard: "goatee",
      hat: "captain",
      outfit: "captain",
      outfitColor: "royal",
      legsBoots: "cuffed_boots",
      cape: "none",
      handProp: "spyglass",
      backProp: "none",
      pet: "none",
      mount: "none",
      pedestal: "stone_wood",
      aura: "none",
      background: "ocean",
      frame: "wood",
      colors: {
        skin: "#e4b287",
        hair: "#1e40af",
        eyes: "#0284c7",
        outfitPrimary: "#2563eb",
        outfitSecondary: "#1e3a8a",
        outfitTrim: "#facc15",
        mount: "#854d0e",
      },
    },
  },
  {
    id: "isle_botanist",
    label: "Guardiã da Floresta",
    labelEn: "Forest Warden",
    config: {
      version: 2,
      bodyType: "slender",
      headShape: "heart",
      eyeStyle: "cheerful",
      browStyle: "arched",
      noseStyle: "button",
      mouthStyle: "smile",
      skin: "fair",
      eyes: "cheerful",
      hair: "braids",
      hairColor: "red",
      beard: "none",
      hat: "explorer",
      outfit: "settler",
      outfitColor: "emerald",
      legsBoots: "traveler",
      cape: "traveler",
      handProp: "scroll",
      backProp: "explorer_pack",
      pet: "none",
      mount: "none",
      pedestal: "stone_wood",
      aura: "none",
      background: "forest",
      frame: "wood",
      colors: {
        skin: "#f3cfb3",
        hair: "#c2410c",
        eyes: "#16a34a",
        outfitPrimary: "#059669",
        outfitSecondary: "#064e3b",
        outfitTrim: "#fde68a",
        mount: "#854d0e",
      },
    },
  },
  {
    id: "forge_sentinel",
    label: "Sentinela da Serra",
    labelEn: "Mountain Sentinel",
    config: {
      version: 2,
      bodyType: "sturdy",
      headShape: "square",
      eyeStyle: "fierce",
      browStyle: "scarred",
      noseStyle: "broad",
      mouthStyle: "serious",
      skin: "tan",
      eyes: "sharp",
      hair: "short",
      hairColor: "silver",
      beard: "full",
      hat: "helm",
      outfit: "armor",
      outfitColor: "slate",
      legsBoots: "greaves",
      cape: "none",
      handProp: "none",
      backProp: "sheathed_sword",
      pet: "none",
      mount: "none",
      pedestal: "stone_wood",
      aura: "none",
      background: "mountain",
      frame: "wood",
      colors: {
        skin: "#c98b5b",
        hair: "#cbd5e1",
        eyes: "#1e293b",
        outfitPrimary: "#475569",
        outfitSecondary: "#1e293b",
        outfitTrim: "#e2e8f0",
        mount: "#334155",
      },
    },
  },
  {
    id: "amber_broker",
    label: "Mercador do Porto",
    labelEn: "Harbor Merchant",
    config: {
      version: 2,
      bodyType: "athletic",
      headShape: "oval",
      eyeStyle: "wise",
      browStyle: "calm",
      noseStyle: "straight",
      mouthStyle: "smirk",
      skin: "warm",
      eyes: "wise",
      hair: "wavy",
      hairColor: "brown",
      beard: "mustache",
      hat: "none",
      outfit: "merchant",
      outfitColor: "amber",
      legsBoots: "cuffed_boots",
      cape: "traveler",
      handProp: "scroll",
      backProp: "none",
      pet: "none",
      mount: "none",
      pedestal: "stone_wood",
      aura: "none",
      background: "gold",
      frame: "wood",
      colors: {
        skin: "#e4b287",
        hair: "#5a3821",
        eyes: "#92400e",
        outfitPrimary: "#d97706",
        outfitSecondary: "#78350f",
        outfitTrim: "#fef08a",
        mount: "#854d0e",
      },
    },
  },
  {
    id: "crimson_mason",
    label: "Mestre Construtora",
    labelEn: "Master Builder",
    config: {
      version: 2,
      bodyType: "sturdy",
      headShape: "oval",
      eyeStyle: "calm",
      browStyle: "arched",
      noseStyle: "straight",
      mouthStyle: "confident",
      skin: "brown",
      eyes: "calm",
      hair: "long",
      hairColor: "black",
      beard: "none",
      hat: "bandana",
      outfit: "settler",
      outfitColor: "crimson",
      legsBoots: "traveler",
      cape: "none",
      handProp: "none",
      backProp: "explorer_pack",
      pet: "none",
      mount: "none",
      pedestal: "stone_wood",
      aura: "none",
      background: "crimson",
      frame: "wood",
      colors: {
        skin: "#995c37",
        hair: "#1f242d",
        eyes: "#1e293b",
        outfitPrimary: "#dc2626",
        outfitSecondary: "#7f1d1d",
        outfitTrim: "#fde047",
        mount: "#854d0e",
      },
    },
  },
  {
    id: "sunset_cartographer",
    label: "Cartógrafo do Poente",
    labelEn: "Sunset Cartographer",
    config: {
      version: 2,
      bodyType: "slender",
      headShape: "heart",
      eyeStyle: "noble",
      browStyle: "calm",
      noseStyle: "aquiline",
      mouthStyle: "smile",
      skin: "deep",
      eyes: "cheerful",
      hair: "curly",
      hairColor: "blonde",
      beard: "goatee",
      hat: "none",
      outfit: "merchant",
      outfitColor: "royal",
      legsBoots: "cuffed_boots",
      cape: "traveler",
      handProp: "spyglass",
      backProp: "none",
      pet: "none",
      mount: "island_horse",
      pedestal: "stone_wood",
      aura: "none",
      background: "sunset",
      frame: "wood",
      colors: {
        skin: "#633722",
        hair: "#eab308",
        eyes: "#0284c7",
        outfitPrimary: "#2563eb",
        outfitSecondary: "#1e3a8a",
        outfitTrim: "#facc15",
        mount: "#854d0e",
      },
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
  frame: AvatarFrame | string,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const foundV1 = AVATAR_FRAME_OPTIONS.find((f) => f.value === frame);
  if (foundV1) {
    return lang === "en" ? foundV1.labelEn ?? foundV1.label : foundV1.label;
  }
  const foundV2 = findAvatarCatalogItem("frame", frame);
  if (foundV2) {
    return lang === "en" ? foundV2.labelEn : foundV2.label;
  }
  return lang === "en" ? "Settler Wood" : "Madeira de Colono";
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
  field: keyof AvatarConfig | AvatarItemSlot | string,
  value: string
): number {
  const catalogEntry = CATALOG_LOOKUP.get(`${field}:${value}`);
  if (catalogEntry) {
    return catalogEntry.requiredWins;
  }
  return (
    AVATAR_UNLOCK_REQUIREMENTS[field as keyof AvatarConfig]?.[value] ?? 0
  );
}

export function isAvatarItemUnlocked(
  field: keyof AvatarConfig | AvatarItemSlot | string,
  value: unknown,
  wins = 0,
  entitlements: readonly string[] = []
): boolean {
  if (typeof value !== "string") return false;
  if (
    field === "skin" ||
    field === "eyes" ||
    field === "hairColor" ||
    field === "outfitColor"
  ) {
    return AVATAR_VALID_VALUES[field].includes(value);
  }
  const entry = CATALOG_LOOKUP.get(`${field}:${value}`);
  if (!entry) {
    return wins >= getAvatarItemRequirement(field, value);
  }
  if (entry.tier === "free") {
    return true;
  }
  const itemKey = `${entry.slot}:${entry.id}`;
  if (entitlements.includes(itemKey)) {
    return true;
  }
  if (entry.tier === "earnable") {
    return wins >= entry.requiredWins;
  }
  return false;
}

export function sanitizeAvatarColors(
  rawColors: unknown
): Partial<AvatarColors> {
  if (!rawColors || typeof rawColors !== "object" || Array.isArray(rawColors)) {
    return {};
  }
  const src = rawColors as Record<string, unknown>;
  const out: Partial<AvatarColors> = {};
  for (const key of COLOR_KEYS) {
    const val = src[key];
    if (isValidHexColor(val)) {
      out[key] = val;
    }
  }
  return out;
}

export function sanitizeAvatarConfig(
  raw?: Partial<AvatarConfig> | Partial<AvatarConfigV2> | Record<string, unknown> | null
): Partial<AvatarConfig> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if (src.version === 1 || src.version === 2) {
    result.version = src.version;
  }

  for (const field of [
    "skin",
    "eyes",
    "hairColor",
    "outfitColor",
  ] as const) {
    const val = src[field];
    if (typeof val === "string" && AVATAR_VALID_VALUES[field].includes(val)) {
      result[field] = val;
    }
  }

  for (const slot of AVATAR_CATALOG_SLOTS) {
    const val = src[slot];
    if (typeof val === "string" && VALID_IDS_BY_SLOT[slot].includes(val)) {
      result[slot] = val;
    }
  }

  const cleanColors = sanitizeAvatarColors(src.colors);
  if (Object.keys(cleanColors).length > 0) {
    result.colors = cleanColors;
  }

  if (isValidPortraitSnapshot(src.portraitSnapshot)) {
    result.portraitSnapshot = src.portraitSnapshot;
  }

  return result as Partial<AvatarConfig>;
}

function hashUsername(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function v1EyesFromV2EyeStyle(eyeStyle: AvatarEyeStyle): AvatarEyes {
  if (eyeStyle === "wise" || eyeStyle === "cheerful" || eyeStyle === "calm" || eyeStyle === "sharp") {
    return eyeStyle;
  }
  if (eyeStyle === "fierce") return "sharp";
  return "calm";
}

export type ResolvedAvatarConfig = AvatarConfigV2 & {
  skin: AvatarSkin;
  eyes: AvatarEyes;
  hairColor: AvatarHairColor;
  outfitColor: AvatarOutfitColor;
};

export function resolveAvatarConfig(
  raw?: Partial<AvatarConfig> | Partial<AvatarConfigV2> | Record<string, unknown> | null,
  username?: string | null
): ResolvedAvatarConfig {
  const seed = hashUsername(
    (username || "colono").toLowerCase().trim() || "colono"
  );
  const pick = <T extends string>(arr: readonly T[], shift: number): T =>
    arr[(seed >>> shift) % arr.length];

  const freeIds = <T extends string>(slot: AvatarItemSlot): readonly T[] =>
    AVATAR_CATALOG_ITEMS.filter(
      (i) => i.slot === slot && i.tier === "free"
    ).map((i) => i.id) as T[];

  const defaultSkinV1 = pick(
    AVATAR_VALID_VALUES.skin as readonly AvatarSkin[],
    0
  );
  const defaultEyesV1 = pick(
    AVATAR_VALID_VALUES.eyes as readonly AvatarEyes[],
    3
  );
  const defaultHairColorV1 = pick(
    AVATAR_VALID_VALUES.hairColor as readonly AvatarHairColor[],
    8
  );
  const defaultOutfitColorV1 = pick(
    AVATAR_VALID_VALUES.outfitColor as readonly AvatarOutfitColor[],
    19
  );

  const clean = sanitizeAvatarConfig(raw);
  const resolvedSkinV1: AvatarSkin = clean.skin ?? defaultSkinV1;
  const resolvedHairColorV1: AvatarHairColor =
    clean.hairColor ?? defaultHairColorV1;
  const resolvedOutfitColorV1: AvatarOutfitColor =
    clean.outfitColor ?? defaultOutfitColorV1;

  const resolvedEyeStyle: AvatarEyeStyle =
    (clean.eyeStyle as AvatarEyeStyle | undefined) ??
    (clean.eyes as AvatarEyeStyle | undefined) ??
    defaultEyesV1;
  const resolvedEyesV1: AvatarEyes =
    clean.eyes ?? v1EyesFromV2EyeStyle(resolvedEyeStyle);

  const outfitV1Colors = OUTFIT_COLORS_BY_V1[resolvedOutfitColorV1];
  const rawColors = (clean.colors ?? {}) as Partial<AvatarColors>;
  const defaultEyeHex =
    AVATAR_COLOR_SWATCHES.eyes[seed % AVATAR_COLOR_SWATCHES.eyes.length].hex;
  const defaultMountHex =
    AVATAR_COLOR_SWATCHES.mount[(seed >>> 7) % AVATAR_COLOR_SWATCHES.mount.length]
      .hex;

  const colors: AvatarColors = {
    skin: rawColors.skin ?? SKIN_HEX_BY_V1[resolvedSkinV1],
    hair: rawColors.hair ?? HAIR_HEX_BY_V1[resolvedHairColorV1],
    eyes: rawColors.eyes ?? defaultEyeHex,
    outfitPrimary: rawColors.outfitPrimary ?? outfitV1Colors.primary,
    outfitSecondary: rawColors.outfitSecondary ?? outfitV1Colors.secondary,
    outfitTrim: rawColors.outfitTrim ?? outfitV1Colors.trim,
    mount: rawColors.mount ?? defaultMountHex,
  };

  const resolved: ResolvedAvatarConfig = {
    version: 2,
    bodyType:
      (clean.bodyType as AvatarBodyType | undefined) ??
      pick(freeIds<AvatarBodyType>("bodyType"), 1),
    headShape:
      (clean.headShape as AvatarHeadShape | undefined) ??
      pick(freeIds<AvatarHeadShape>("headShape"), 4),
    eyeStyle: resolvedEyeStyle,
    browStyle:
      (clean.browStyle as AvatarBrowStyle | undefined) ??
      pick(freeIds<AvatarBrowStyle>("browStyle"), 6),
    noseStyle:
      (clean.noseStyle as AvatarNoseStyle | undefined) ??
      pick(freeIds<AvatarNoseStyle>("noseStyle"), 9),
    mouthStyle:
      (clean.mouthStyle as AvatarMouthStyle | undefined) ??
      pick(freeIds<AvatarMouthStyle>("mouthStyle"), 12),
    hair: clean.hair ?? pick(freeIds("hair"), 5),
    beard: clean.beard ?? pick(freeIds("beard"), 11),
    outfit: clean.outfit ?? pick(freeIds("outfit"), 16),
    legsBoots: clean.legsBoots ?? pick(freeIds("legsBoots"), 14),
    cape: clean.cape ?? "none",
    hat: clean.hat ?? pick(freeIds("hat"), 13),
    handProp: clean.handProp ?? "none",
    backProp: clean.backProp ?? "none",
    pet: clean.pet ?? "none",
    mount: clean.mount ?? "none",
    pedestal: clean.pedestal ?? "stone_wood",
    aura: clean.aura ?? "none",
    background:
      (clean.background as AvatarBackground | undefined) ??
      pick(freeIds<AvatarBackground>("background"), 22),
    frame: clean.frame ?? "wood",
    colors,
    skin: resolvedSkinV1,
    eyes: resolvedEyesV1,
    hairColor: resolvedHairColorV1,
    outfitColor: resolvedOutfitColorV1,
  };

  if (clean.portraitSnapshot) {
    resolved.portraitSnapshot = clean.portraitSnapshot;
  }

  return resolved;
}

export function findLockedAvatarItems(
  config?:
    | Partial<AvatarConfig>
    | Partial<AvatarConfigV2>
    | Record<string, unknown>
    | null,
  wins = 0,
  entitlements: readonly string[] = []
): LockedAvatarItem[] {
  if (!config || typeof config !== "object") return [];
  const src = config as Record<string, unknown>;
  const locked: LockedAvatarItem[] = [];
  for (const slot of AVATAR_CATALOG_SLOTS) {
    const val = src[slot];
    if (typeof val !== "string" || !val) continue;
    const entry = findAvatarCatalogItem(slot, val);
    if (!entry) continue;
    if (!isAvatarItemUnlocked(slot, val, wins, entitlements)) {
      locked.push({
        slot,
        id: val,
        tier: entry.tier,
        required_wins: entry.requiredWins,
        ...(entry.sku ? { sku: entry.sku } : {}),
      });
    }
  }
  return locked;
}

export function stripLockedAvatarItems(
  config?:
    | Partial<AvatarConfig>
    | Partial<AvatarConfigV2>
    | Record<string, unknown>
    | null,
  fallback?:
    | Partial<AvatarConfig>
    | Partial<AvatarConfigV2>
    | Record<string, unknown>
    | null,
  wins = 0,
  entitlements: readonly string[] = []
): ResolvedAvatarConfig {
  const resolved = resolveAvatarConfig(config);
  const resolvedFallback = resolveAvatarConfig(fallback);
  const next: Record<string, unknown> = {
    ...resolved,
    colors: { ...resolved.colors },
  };

  for (const slot of AVATAR_CATALOG_SLOTS) {
    const currentVal = resolved[slot];
    if (
      typeof currentVal === "string" &&
      isAvatarItemUnlocked(slot, currentVal, wins, entitlements)
    ) {
      continue;
    }
    const fallbackVal = resolvedFallback[slot];
    if (
      typeof fallbackVal === "string" &&
      isAvatarItemUnlocked(slot, fallbackVal, wins, entitlements)
    ) {
      next[slot] = fallbackVal;
    } else {
      const firstFree = AVATAR_CATALOG_ITEMS.find(
        (i) => i.slot === slot && i.tier === "free"
      );
      next[slot] = firstFree ? firstFree.id : "none";
    }
  }

  return next as ResolvedAvatarConfig;
}

export function randomizeUnlockedAvatar(
  wins = 0,
  entitlements: readonly string[] = []
): ResolvedAvatarConfig {
  const pickRandom = <T>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

  const pickUnlockedSlot = (slot: AvatarItemSlot): string => {
    const candidates = AVATAR_CATALOG_ITEMS.filter(
      (i) =>
        i.slot === slot &&
        isAvatarItemUnlocked(slot, i.id, wins, entitlements)
    );
    const list =
      candidates.length > 0
        ? candidates
        : AVATAR_CATALOG_ITEMS.filter((i) => i.slot === slot && i.tier === "free");
    return pickRandom(list).id;
  };

  const skinV1 = pickRandom(AVATAR_SKIN_OPTIONS).value;
  const hairColorV1 = pickRandom(AVATAR_HAIR_COLOR_OPTIONS).value;
  const outfitColorV1 = pickRandom(AVATAR_OUTFIT_COLOR_OPTIONS).value;
  const eyeStyle = pickUnlockedSlot("eyeStyle") as AvatarEyeStyle;

  return {
    version: 2,
    bodyType: pickUnlockedSlot("bodyType") as AvatarBodyType,
    headShape: pickUnlockedSlot("headShape") as AvatarHeadShape,
    eyeStyle,
    browStyle: pickUnlockedSlot("browStyle") as AvatarBrowStyle,
    noseStyle: pickUnlockedSlot("noseStyle") as AvatarNoseStyle,
    mouthStyle: pickUnlockedSlot("mouthStyle") as AvatarMouthStyle,
    hair: pickUnlockedSlot("hair"),
    beard: pickUnlockedSlot("beard"),
    outfit: pickUnlockedSlot("outfit"),
    legsBoots: pickUnlockedSlot("legsBoots"),
    cape: pickUnlockedSlot("cape"),
    hat: pickUnlockedSlot("hat"),
    handProp: pickUnlockedSlot("handProp"),
    backProp: pickUnlockedSlot("backProp"),
    pet: pickUnlockedSlot("pet"),
    mount: pickUnlockedSlot("mount"),
    pedestal: pickUnlockedSlot("pedestal"),
    aura: pickUnlockedSlot("aura"),
    background: pickUnlockedSlot("background") as AvatarBackground,
    frame: pickUnlockedSlot("frame"),
    colors: {
      skin: pickRandom(AVATAR_COLOR_SWATCHES.skin).hex,
      hair: pickRandom(AVATAR_COLOR_SWATCHES.hair).hex,
      eyes: pickRandom(AVATAR_COLOR_SWATCHES.eyes).hex,
      outfitPrimary: pickRandom(AVATAR_COLOR_SWATCHES.outfitPrimary).hex,
      outfitSecondary: pickRandom(AVATAR_COLOR_SWATCHES.outfitSecondary).hex,
      outfitTrim: pickRandom(AVATAR_COLOR_SWATCHES.outfitTrim).hex,
      mount: pickRandom(AVATAR_COLOR_SWATCHES.mount).hex,
    },
    skin: skinV1,
    eyes: v1EyesFromV2EyeStyle(eyeStyle),
    hairColor: hairColorV1,
    outfitColor: outfitColorV1,
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
  raw?: Partial<AvatarConfig> | Partial<AvatarConfigV2> | Record<string, unknown> | null,
  wins = 0,
  entitlements: readonly string[] = []
): Partial<AvatarConfig> {
  const clean = sanitizeAvatarConfig(raw);
  const unlocked: Record<string, unknown> = {};
  for (const [field, val] of Object.entries(clean)) {
    if (field === "version" || field === "colors" || field === "portraitSnapshot") {
      unlocked[field] = val;
      continue;
    }
    if (
      typeof val === "string" &&
      isAvatarItemUnlocked(field, val, wins, entitlements)
    ) {
      unlocked[field] = val;
    }
  }
  return unlocked as Partial<AvatarConfig>;
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
