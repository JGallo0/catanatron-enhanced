import { useEffect, useState } from "react";
import type { ResourceCard } from "./api.types";

export type BoardSkinId = "diorama" | "classic";

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
};

export const BOARD_SKIN_STORAGE_KEY = "catan_board_skin_v1";
export const BOARD_SKIN_EVENT = "catan_board_skin_changed";

export function getSavedBoardSkin(): BoardSkinId {
  try {
    const saved = localStorage.getItem(BOARD_SKIN_STORAGE_KEY);
    if (saved === "classic" || saved === "diorama") {
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
  const next: BoardSkinId = active === "diorama" ? "classic" : "diorama";
  saveBoardSkin(next);
  return next;
}

export function getTileIllustrationUrl(
  terrain: ResourceCard | "DESERT",
  skin: BoardSkinId = getSavedBoardSkin()
): string {
  const filename = terrain.toLowerCase();
  if (skin === "classic") {
    return `/assets/illustrations/tiles/themes/classic/${filename}.webp`;
  }
  return `/assets/illustrations/tiles/themes/diorama/${filename}.webp`;
}

export function useBoardSkin() {
  const [skin, setSkin] = useState<BoardSkinId>(getSavedBoardSkin);

  useEffect(() => {
    const handleSkinChange = (e: Event) => {
      const customEvent = e as CustomEvent<BoardSkinId>;
      if (customEvent.detail && (customEvent.detail === "diorama" || customEvent.detail === "classic")) {
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
