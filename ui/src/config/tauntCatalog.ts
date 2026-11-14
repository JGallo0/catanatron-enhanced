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
    id: "olha_trairagem",
    emoji: "😤",
    label: "Mas que trairagem!",
    bubbleText: "😤 Mas que trairagem é essa, Charlie?!",
    labelEn: "What a betrayal!",
    bubbleTextEn: "😤 Mas que trairagem é essa, Charlie?!",
    tone: "anger",
  },
  {
    id: "isso_nao",
    emoji: "❗",
    label: "Isso não !!!",
    bubbleText: "❗ Isso não !!!",
    labelEn: "Not this !!!",
    bubbleTextEn: "❗ Isso não !!!",
    tone: "anger",
  },
  {
    id: "troca_honesta",
    emoji: "🤝",
    label: "Bora fazer rolo?",
    bubbleText: "🤝 Bora fazer rolo na moral? Troquinha justa?",
    labelEn: "Fair trade?",
    bubbleTextEn: "🤝 Bora fazer rolo na moral? Troquinha justa?",
    tone: "trade",
  },
  {
    id: "praca_nossa",
    emoji: "👑",
    label: "A Praça é Nossa",
    bubbleText: "👑 A Praça é nossa mas essa ilha é minha!",
    labelEn: "A Praça é Nossa",
    bubbleTextEn: "👑 A Praça é nossa mas essa ilha é minha!",
    tone: "crown",
  },
  {
    id: "ai_e_grave",
    emoji: "🤔",
    label: "Aí é grave",
    bubbleText: "🤔 Aí é grave. Gravíssimo",
    labelEn: "That's serious",
    bubbleTextEn: "🤔 Aí é grave. Gravíssimo",
    tone: "think",
  },
  {
    id: "quedi_a_paia",
    emoji: "🚬",
    label: "Quedi a paia?",
    bubbleText: "Quedi a paia? 🚬",
    labelEn: "Quedi a paia?",
    bubbleTextEn: "Quedi a paia? 🚬",
    tone: "rally",
  },
  {
    id: "gostei_dos_dados",
    emoji: "🎲",
    label: "Gostei desses dados",
    bubbleText: "🎲 Boa! Gostei desses dados aí",
    labelEn: "Nice dice!",
    bubbleTextEn: "🎲 Boa! Gostei desses dados aí",
    tone: "cheer",
  },
  {
    id: "tchita_3x3",
    emoji: "⚔️",
    label: "3 contra 3 na Tchita",
    bubbleText: "⚔️ 3 contra 3 na Tchita",
    labelEn: "3v3 on Tchita",
    bubbleTextEn: "⚔️ 3 contra 3 na Tchita",
    tone: "rally",
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
        id: "quedi_a_paia",
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
