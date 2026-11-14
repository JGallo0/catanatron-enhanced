import { useEffect, useState } from "react";
import type { ResourceCard } from "./api.types";

export type BoardSkinId = "diorama" | "classic" | "vector";

export interface BoardSkinMeta {
  id: BoardSkinId;
  namePt: string;
  nameEn: string;
  badgePt: string;
  badgeEn: string;
  descriptionPt: string;
  descriptionEn: string;
  isDefault: boolean;
  isVip: boolean;
}

export const BOARD_SKINS: Record<BoardSkinId, BoardSkinMeta> = {
  diorama: {
    id: "diorama",
    namePt: "Diorama 3D",
    nameEn: "3D Diorama",
    badgePt: "Padrão",
    badgeEn: "Default",
    descriptionPt: "Relevo estilizado, cores vibrantes e máxima legibilidade",
    descriptionEn: "Stylized 3D relief, vibrant colors & maximum readability",
    isDefault: true,
    isVip: false,
  },
  classic: {
    id: "classic",
    namePt: "Pintura Clássica",
    nameEn: "Classic Painted",
    badgePt: "Variante",
    badgeEn: "Variant",
    descriptionPt: "Ilustrações artísticas hiper-detalhadas de paisagem",
    descriptionEn: "Hyper-detailed artistic landscape illustrations",
    isDefault: false,
    isVip: false,
  },
  vector: {
    id: "vector",
    namePt: "Vetorial Simplificado",
    nameEn: "Simplified Vector",
    badgePt: "Variante",
    badgeEn: "Variant",
    descriptionPt: "Ilustrações vetoriais com formas mais simples",
    descriptionEn: "Vector illustrations with simpler shapes",
    isDefault: false,
    isVip: false,
  },
};

const BOARD_SKIN_ORDER: BoardSkinId[] = ["diorama", "classic", "vector"];

function isBoardSkin(value: unknown): value is BoardSkinId {
  return value === "diorama" || value === "classic" || value === "vector";
}

export const BOARD_SKIN_STORAGE_KEY = "catan_board_skin_v1";
export const BOARD_SKIN_EVENT = "catan_board_skin_changed";

export function getSavedBoardSkin(): BoardSkinId {
  try {
    const saved = localStorage.getItem(BOARD_SKIN_STORAGE_KEY);
    if (isBoardSkin(saved)) {
      return saved;
    }
    return "diorama";
  } catch {
    return "diorama";
  }
}

export function saveBoardSkin(skin: BoardSkinId): void {
  try {
    localStorage.setItem(BOARD_SKIN_STORAGE_KEY, skin);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(BOARD_SKIN_EVENT, { detail: skin })
      );
    }
  } catch {
    // Ignore storage errors
  }
}

export function toggleBoardSkin(current?: BoardSkinId): BoardSkinId {
  const active = current ?? getSavedBoardSkin();
  const next = BOARD_SKIN_ORDER[(BOARD_SKIN_ORDER.indexOf(active) + 1) % BOARD_SKIN_ORDER.length];
  saveBoardSkin(next);
  return next;
}

export function getTileIllustrationUrl(
  terrain: ResourceCard | "DESERT",
  skin: BoardSkinId = getSavedBoardSkin()
): string | undefined {
  if (skin === "vector") return undefined;
  return `/assets/illustrations/tiles/themes/${skin}/${terrain.toLowerCase()}.webp`;
}

export function useBoardSkin() {
  const [skin, setSkin] = useState<BoardSkinId>(getSavedBoardSkin);

  useEffect(() => {
    const handleSkinChange = (e: Event) => {
      const customEvent = e as CustomEvent<BoardSkinId>;
      if (isBoardSkin(customEvent.detail)) {
        setSkin(customEvent.detail);
      } else {
        setSkin(getSavedBoardSkin());
      }
    };

    window.addEventListener(BOARD_SKIN_EVENT, handleSkinChange);
    window.addEventListener("storage", handleSkinChange);
    return () => {
      window.removeEventListener(BOARD_SKIN_EVENT, handleSkinChange);
      window.removeEventListener("storage", handleSkinChange);
    };
  }, []);

  const changeSkin = (newSkin: BoardSkinId) => {
    saveBoardSkin(newSkin);
    setSkin(newSkin);
  };

  const toggle = () => {
    const next = toggleBoardSkin(skin);
    setSkin(next);
    return next;
  };

  return { skin, changeSkin, toggle, skins: BOARD_SKINS };
}
