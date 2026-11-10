import type {
  Color,
  DevelopmentCard,
  ResourceCard,
  VictoryPointCard,
} from "../utils/api.types";
import brickTileSvg from "../assets/tile_brick.svg";
import desertTileSvg from "../assets/tile_desert.svg";
import grainTileSvg from "../assets/tile_wheat.svg";
import lumberTileSvg from "../assets/tile_wood.svg";
import oreTileSvg from "../assets/tile_ore.svg";
import woolTileSvg from "../assets/tile_sheep.svg";
import maritimeTileSvg from "../assets/tile_maritime.svg";

export type ResourceMeta = {
  id: ResourceCard;
  label: string;
  shortLabel: string;
  terrainName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderColor: string;
  textColor: string;
  legacyTileSvg: string;
  /** Optional Nano Banana Pro custom illustration path in /public/assets/illustrations/ */
  customTileIllustration?: string;
  customCardIllustration?: string;
};

export const RESOURCE_META: Record<ResourceCard, ResourceMeta> = {
  WOOD: {
    id: "WOOD",
    label: "Madeira",
    shortLabel: "MAD",
    terrainName: "Floresta",
    primaryColor: "#14532D",
    secondaryColor: "#16A34A",
    accentColor: "#4ADE80",
    borderColor: "#86EFAC",
    textColor: "#DCFCE7",
    legacyTileSvg: lumberTileSvg,
    customTileIllustration: "/assets/illustrations/tiles/wood.webp",
    customCardIllustration: "/assets/illustrations/cards/wood.webp",
  },
  BRICK: {
    id: "BRICK",
    label: "Argila",
    shortLabel: "ARG",
    terrainName: "Colinas",
    primaryColor: "#7C2D12",
    secondaryColor: "#EA580C",
    accentColor: "#FB923C",
    borderColor: "#FDBA74",
    textColor: "#FFEDD5",
    legacyTileSvg: brickTileSvg,
    customTileIllustration: "/assets/illustrations/tiles/brick.webp",
    customCardIllustration: "/assets/illustrations/cards/brick.webp",
  },
  SHEEP: {
    id: "SHEEP",
    label: "Lã",
    shortLabel: "LÃ",
    terrainName: "Pastagem",
    primaryColor: "#365314",
    secondaryColor: "#65A30D",
    accentColor: "#A3E635",
    borderColor: "#BEF264",
    textColor: "#ECFCCB",
    legacyTileSvg: woolTileSvg,
    customTileIllustration: "/assets/illustrations/tiles/sheep.webp",
    customCardIllustration: "/assets/illustrations/cards/sheep.webp",
  },
  WHEAT: {
    id: "WHEAT",
    label: "Trigo",
    shortLabel: "TRI",
    terrainName: "Campos",
    primaryColor: "#78350F",
    secondaryColor: "#D97706",
    accentColor: "#FACC15",
    borderColor: "#FDE047",
    textColor: "#FEF9C3",
    legacyTileSvg: grainTileSvg,
    customTileIllustration: "/assets/illustrations/tiles/wheat.webp",
    customCardIllustration: "/assets/illustrations/cards/wheat.webp",
  },
  ORE: {
    id: "ORE",
    label: "Minério",
    shortLabel: "MIN",
    terrainName: "Montanha",
    primaryColor: "#1E293B",
    secondaryColor: "#475569",
    accentColor: "#94A3B8",
    borderColor: "#CBD5E1",
    textColor: "#F1F5F9",
    legacyTileSvg: oreTileSvg,
    customTileIllustration: "/assets/illustrations/tiles/ore.webp",
    customCardIllustration: "/assets/illustrations/cards/ore.webp",
  },
};

export const DESERT_META = {
  label: "Deserto",
  terrainName: "Deserto",
  primaryColor: "#785A28",
  secondaryColor: "#C29B61",
  accentColor: "#E6C786",
  legacyTileSvg: desertTileSvg,
  customTileIllustration: "/assets/illustrations/tiles/desert.webp",
};

export const MARITIME_META = {
  legacyTileSvg: maritimeTileSvg,
};

export type DevCardType = DevelopmentCard | VictoryPointCard;

export type DevCardMeta = {
  id: DevCardType;
  label: string;
  shortCode: string;
  description: string;
  accentColor: string;
  customIllustration?: string;
};

export const DEV_CARD_META: Record<DevCardType, DevCardMeta> = {
  KNIGHT: {
    id: "KNIGHT",
    label: "Cavaleiro",
    shortCode: "KN",
    description:
      "Mova o Ladrão para outro hexágono e roube 1 recurso de um jogador adjacente. Conta para o Maior Exército (3+ = 2 PV).",
    accentColor: "#EF4444",
    customIllustration: "/assets/illustrations/dev/knight.webp",
  },
  VICTORY_POINT: {
    id: "VICTORY_POINT",
    label: "Ponto de Vitória",
    shortCode: "VP",
    description: "Concede +1 Ponto de Vitória oculto imediatamente.",
    accentColor: "#FACC15",
    customIllustration: "/assets/illustrations/dev/victory_point.webp",
  },
  ROAD_BUILDING: {
    id: "ROAD_BUILDING",
    label: "Construção de Estradas",
    shortCode: "RB",
    description: "Construa imediatamente 2 estradas gratuitas no tabuleiro.",
    accentColor: "#10B981",
    customIllustration: "/assets/illustrations/dev/road_building.webp",
  },
  YEAR_OF_PLENTY: {
    id: "YEAR_OF_PLENTY",
    label: "Ano da Fartura",
    shortCode: "YP",
    description: "Pegue imediatamente quaisquer 2 cartas de recurso do banco.",
    accentColor: "#3B82F6",
    customIllustration: "/assets/illustrations/dev/year_of_plenty.webp",
  },
  MONOPOLY: {
    id: "MONOPOLY",
    label: "Monopólio",
    shortCode: "MO",
    description:
      "Escolha 1 tipo de recurso. Todos os outros jogadores devem entregar todas as cartas desse tipo que tiverem na mão.",
    accentColor: "#A855F7",
    customIllustration: "/assets/illustrations/dev/monopoly.webp",
  },
};

export type PlayerColorMeta = {
  id: Color;
  label: string;
  primary: string;
  secondary: string;
  dark: string;
  glow: string;
  textOnFill: string;
};

export const PLAYER_COLOR_META: Record<Color, PlayerColorMeta> = {
  RED: {
    id: "RED",
    label: "Vermelho",
    primary: "#EF4444",
    secondary: "#FCA5A5",
    dark: "#991B1B",
    glow: "rgba(239, 68, 68, 0.45)",
    textOnFill: "#FFFFFF",
  },
  BLUE: {
    id: "BLUE",
    label: "Azul",
    primary: "#3B82F6",
    secondary: "#93C5FD",
    dark: "#1E40AF",
    glow: "rgba(59, 130, 246, 0.45)",
    textOnFill: "#FFFFFF",
  },
  ORANGE: {
    id: "ORANGE",
    label: "Laranja",
    primary: "#F59E0B",
    secondary: "#FDE68A",
    dark: "#92400E",
    glow: "rgba(245, 158, 11, 0.45)",
    textOnFill: "#1E293B",
  },
  WHITE: {
    id: "WHITE",
    label: "Branco",
    primary: "#F8FAFC",
    secondary: "#E2E8F0",
    dark: "#334155",
    glow: "rgba(248, 250, 252, 0.45)",
    textOnFill: "#0F172A",
  },
};

export const BUILDING_COSTS: Record<
  "ROAD" | "SETTLEMENT" | "CITY" | "DEV_CARD",
  { label: string; vps: string; recipe: Partial<Record<ResourceCard, number>> }
> = {
  ROAD: {
    label: "Estrada",
    vps: "Maior Estrada = 2 PV",
    recipe: { WOOD: 1, BRICK: 1 },
  },
  SETTLEMENT: {
    label: "Aldeia",
    vps: "+1 PV",
    recipe: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 },
  },
  CITY: {
    label: "Cidade",
    vps: "+2 PV",
    recipe: { WHEAT: 2, ORE: 3 },
  },
  DEV_CARD: {
    label: "Carta de Desenv.",
    vps: "Especial / +1 PV",
    recipe: { SHEEP: 1, WHEAT: 1, ORE: 1 },
  },
};
