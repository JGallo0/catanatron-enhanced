import { getCurrentLanguage, type AppLanguage } from "../i18n";

export type TauntTone =
  | "rally"
  | "warm"
  | "think"
  | "anger"
  | "cheer"
  | "trade"
  | "watch"
  | "crown";

export type TauntDefinition = {
  id: string;
  emoji: string;
  label: string;
  bubbleText: string;
  labelEn?: string;
  bubbleTextEn?: string;
  tone: TauntTone;
};

export const TAUNT_COOLDOWN_MS = 3000;
export const TAUNT_DISPLAY_MS = 2700;

export const TAUNT_CATALOG: TauntDefinition[] = [
  {
    id: "boa_guerra",
    emoji: "⚔️",
    label: "Boa Guerra!",
    bubbleText: "⚔️ Boa guerra a todos!",
    labelEn: "Good War!",
    bubbleTextEn: "⚔️ May fortune favor the bold!",
    tone: "rally",
  },
  {
    id: "saudacao",
    emoji: "👋",
    label: "Saudação",
    bubbleText: "👋 Saudações, navegantes!",
    labelEn: "Greeting",
    bubbleTextEn: "👋 Ahoy, fellow settlers!",
    tone: "warm",
  },
  {
    id: "negocio",
    emoji: "🤝",
    label: "Bora Trocar?",
    bubbleText: "🤝 Alguém topa uma troca?",
    labelEn: "Trade?",
    bubbleTextEn: "🤝 Anyone up for a trade?",
    tone: "trade",
  },
  {
    id: "pensando",
    emoji: "🤔",
    label: "Pensando...",
    bubbleText: "🤔 Hmm... calculando jogada!",
    labelEn: "Thinking...",
    bubbleTextEn: "🤔 Hmm... plotting my next move!",
    tone: "think",
  },
  {
    id: "furioso_ladrao",
    emoji: "😡",
    label: "Ladrão!",
    bubbleText: "😡 Esse ladrão vai ter troco!",
    labelEn: "Robber!",
    bubbleTextEn: "😡 That robber will pay for this!",
    tone: "anger",
  },
  {
    id: "olho_vivo",
    emoji: "🧐",
    label: "Olho Vivo!",
    bubbleText: "🧐 De olho nessa sua estrada!",
    labelEn: "Watching You!",
    bubbleTextEn: "🧐 Keeping an eye on that road!",
    tone: "watch",
  },
  {
    id: "brinde",
    emoji: "🍻",
    label: "Brinde!",
    bubbleText: "🍻 Um brinde à ilha!",
    labelEn: "Cheers!",
    bubbleTextEn: "🍻 A toast to the island!",
    tone: "cheer",
  },
  {
    id: "ouro",
    emoji: "👑",
    label: "Rumo à Coroa",
    bubbleText: "👑 A ilha já tem dono!",
    labelEn: "To the Crown",
    bubbleTextEn: "👑 The island already has a ruler!",
    tone: "crown",
  },
];

const TAUNT_BY_ID = new Map<string, TauntDefinition>(
  TAUNT_CATALOG.map((item) => [item.id, item])
);

export function localizeTaunt(
  taunt: TauntDefinition,
  lang: AppLanguage = getCurrentLanguage()
): TauntDefinition {
  if (lang !== "en") return taunt;
  return {
    ...taunt,
    label: taunt.labelEn ?? taunt.label,
    bubbleText: taunt.bubbleTextEn ?? taunt.bubbleText,
  };
}

export function getTauntCatalog(
  lang: AppLanguage = getCurrentLanguage()
): TauntDefinition[] {
  return TAUNT_CATALOG.map((item) => localizeTaunt(item, lang));
}

export function getTauntById(
  id: string,
  lang: AppLanguage = getCurrentLanguage()
): TauntDefinition | null {
  const found = TAUNT_BY_ID.get(id);
  return found ? localizeTaunt(found, lang) : null;
}

export function encodeTauntBody(tauntId: string): string {
  const def = TAUNT_BY_ID.get(tauntId) ?? TAUNT_CATALOG[0];
  return `[TAUNT:${def.id}] ${def.bubbleText}`;
}

export function parseTauntMessage(
  body: string,
  kind?: string,
  lang: AppLanguage = getCurrentLanguage()
): { taunt: TauntDefinition | null; displayText: string } {
  const trimmed = (body || "").trim();
  const match = /^\[TAUNT:([a-z0-9_]+)\]\s*(.*)$/i.exec(trimmed);
  if (match) {
    const raw = TAUNT_BY_ID.get(match[1].toLowerCase()) ?? null;
    const found = raw ? localizeTaunt(raw, lang) : null;
    const clean =
      lang === "en" && found
        ? found.bubbleText
        : (match[2] || found?.bubbleText || trimmed).trim();
    return { taunt: found, displayText: clean };
  }
  if (kind === "TAUNT") {
    const rawMatch =
      TAUNT_CATALOG.find(
        (t) =>
          t.bubbleText === trimmed ||
          t.label === trimmed ||
          t.bubbleTextEn === trimmed ||
          t.labelEn === trimmed ||
          trimmed.startsWith(t.emoji)
      ) ?? {
        id: "saudacao",
        emoji: "🎭",
        label: lang === "en" ? "Taunt" : "Provocação",
        bubbleText: trimmed,
        tone: "cheer" as const,
      };
    const byText = localizeTaunt(rawMatch, lang);
    return {
      taunt: byText,
      displayText: lang === "en" ? byText.bubbleText : trimmed,
    };
  }
  return { taunt: null, displayText: body };
}
