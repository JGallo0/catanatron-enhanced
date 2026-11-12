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
    tone: "rally",
  },
  {
    id: "saudacao",
    emoji: "👋",
    label: "Saudação",
    bubbleText: "👋 Saudações, navegantes!",
    tone: "warm",
  },
  {
    id: "negocio",
    emoji: "🤝",
    label: "Bora Trocar?",
    bubbleText: "🤝 Alguém topa uma troca?",
    tone: "trade",
  },
  {
    id: "pensando",
    emoji: "🤔",
    label: "Pensando...",
    bubbleText: "🤔 Hmm... calculando jogada!",
    tone: "think",
  },
  {
    id: "furioso_ladrao",
    emoji: "😡",
    label: "Ladrão!",
    bubbleText: "😡 Esse ladrão vai ter troco!",
    tone: "anger",
  },
  {
    id: "olho_vivo",
    emoji: "🧐",
    label: "Olho Vivo!",
    bubbleText: "🧐 De olho nessa sua estrada!",
    tone: "watch",
  },
  {
    id: "brinde",
    emoji: "🍻",
    label: "Brinde!",
    bubbleText: "🍻 Um brinde à ilha!",
    tone: "cheer",
  },
  {
    id: "ouro",
    emoji: "👑",
    label: "Rumo à Coroa",
    bubbleText: "👑 A ilha já tem dono!",
    tone: "crown",
  },
];

const TAUNT_BY_ID = new Map<string, TauntDefinition>(
  TAUNT_CATALOG.map((item) => [item.id, item])
);

export function getTauntById(id: string): TauntDefinition | null {
  return TAUNT_BY_ID.get(id) ?? null;
}

export function encodeTauntBody(tauntId: string): string {
  const def = TAUNT_BY_ID.get(tauntId) ?? TAUNT_CATALOG[0];
  return `[TAUNT:${def.id}] ${def.bubbleText}`;
}

export function parseTauntMessage(
  body: string,
  kind?: string
): { taunt: TauntDefinition | null; displayText: string } {
  const trimmed = (body || "").trim();
  const match = /^\[TAUNT:([a-z0-9_]+)\]\s*(.*)$/i.exec(trimmed);
  if (match) {
    const found = TAUNT_BY_ID.get(match[1].toLowerCase()) ?? null;
    const clean = (match[2] || found?.bubbleText || trimmed).trim();
    return { taunt: found, displayText: clean };
  }
  if (kind === "TAUNT") {
    const byText =
      TAUNT_CATALOG.find(
        (t) => t.bubbleText === trimmed || t.label === trimmed || trimmed.startsWith(t.emoji)
      ) ?? {
        id: "saudacao",
        emoji: "🎭",
        label: "Provocação",
        bubbleText: trimmed,
        tone: "cheer" as const,
      };
    return { taunt: byText, displayText: trimmed };
  }
  return { taunt: null, displayText: body };
}
