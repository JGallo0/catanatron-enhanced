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
    id: "coyote",
    emoji: "🚬",
    label: "Acende o Coyote",
    bubbleText: "🚬 Acende um Coyote aí, Charlie! Essa mesa tá muito quieta.",
    labelEn: "Light a Coyote",
    bubbleTextEn: "🚬 Light up a Coyote, Charlie! This table is way too quiet.",
    tone: "rally",
  },
  {
    id: "cerveja_mesa",
    emoji: "🍻",
    label: "Bora de Gelada",
    bubbleText: "🍻 Pega mais uma gelada que essa rodada vai feder pro seu lado, Charles!",
    labelEn: "Cold Beer!",
    bubbleTextEn: "🍻 Grab another cold one, Charles — this round is getting rough for you!",
    tone: "cheer",
  },
  {
    id: "bambu_gigante",
    emoji: "🎋",
    label: "Bate no Bambu",
    bubbleText: "🎋 Bate a cinza no bambu gigante que o jogo tá tenso!",
    labelEn: "Tap the Bamboo",
    bubbleTextEn: "🎋 Tap that ash in the giant bamboo — this match is tense!",
    tone: "watch",
  },
  {
    id: "caixa_dados",
    emoji: "🎲",
    label: "Rola na Caixa",
    bubbleText: "🎲 Joga esses dados direito dentro da caixa, Charlie!",
    labelEn: "Roll in the Box",
    bubbleTextEn: "🎲 Roll those dice right inside the box lid, Charlie!",
    tone: "think",
  },
  {
    id: "olha_trairagem",
    emoji: "😤",
    label: "Olha a Trairagem",
    bubbleText: "😤 Mas que trairagem é essa, Charlie?! Isso não se faz na Praça!",
    labelEn: "Betrayal!",
    bubbleTextEn: "😤 What kind of betrayal is this, Charlie?! Not in our house!",
    tone: "anger",
  },
  {
    id: "troca_honesta",
    emoji: "🤝",
    label: "Negócio de Irmão",
    bubbleText: "🤝 Bora trocar na moral, Charlie? Ninguém sai perdendo aqui!",
    labelEn: "Brother's Deal",
    bubbleTextEn: "🤝 Fair trade, Charlie? Nobody loses here!",
    tone: "trade",
  },
  {
    id: "roda_violao",
    emoji: "🎸",
    label: "Puxa a Moda",
    bubbleText: "🎸 Quem vai puxar uma moda de viola enquanto o Charlie calcula a jogada?",
    labelEn: "Strum a Tune",
    bubbleTextEn: "🎸 Who's strumming a tune while Charlie calculates his move?",
    tone: "warm",
  },
  {
    id: "praca_nossa",
    emoji: "👑",
    label: "A Praça é Nossa",
    bubbleText: "👑 A Praça é nossa e essa ilha também, Charles! Aceita!",
    labelEn: "The Square is Ours",
    bubbleTextEn: "👑 A Praça é Nossa and so is this island, Charles!",
    tone: "crown",
  },
];

const LEGACY_TAUNT_FALLBACKS: TauntDefinition[] = [
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
  [...LEGACY_TAUNT_FALLBACKS, ...TAUNT_CATALOG].map((item) => [item.id, item])
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
