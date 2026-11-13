import { useEffect, useState } from "react";

export type PieceSkinId = "contrast" | "cottage";

export interface PieceSkinMeta {
  id: PieceSkinId;
  namePt: string;
  nameEn: string;
  badgePt: string;
  badgeEn: string;
  descriptionPt: string;
  descriptionEn: string;
  isDefault: boolean;
}

export const PIECE_SKINS: Record<PieceSkinId, PieceSkinMeta> = {
  contrast: {
    id: "contrast",
    namePt: "Alto Contraste",
    nameEn: "High Contrast",
    badgePt: "Padrão",
    badgeEn: "Default",
    descriptionPt: "Silhuetas sólidas, borda dupla e máxima legibilidade nos terrenos",
    descriptionEn: "Solid silhouettes, dual-border & maximum terrain readability",
    isDefault: true,
  },
  cottage: {
    id: "cottage",
    namePt: "Vilarejo Detalhado",
    nameEn: "Detailed Cottage",
    badgePt: "Variante",
    badgeEn: "Variant",
    descriptionPt: "Casas ilustradas com chaminés e estradas chanfradas decorativas",
    descriptionEn: "Illustrated cottages with chimneys & decorative beveled roads",
    isDefault: false,
  },
};

export const PIECE_SKIN_STORAGE_KEY = "catan_piece_skin_v1";
export const PIECE_SKIN_EVENT = "catan_piece_skin_changed";

export function getSavedPieceSkin(): PieceSkinId {
  try {
    const saved = localStorage.getItem(PIECE_SKIN_STORAGE_KEY);
    if (saved === "cottage" || saved === "contrast") {
      return saved;
    }
    return "contrast";
  } catch {
    return "contrast";
  }
}

export function savePieceSkin(skin: PieceSkinId): void {
  try {
    localStorage.setItem(PIECE_SKIN_STORAGE_KEY, skin);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(PIECE_SKIN_EVENT, { detail: skin })
      );
    }
  } catch {
    // Ignore storage errors
  }
}

export function togglePieceSkin(current?: PieceSkinId): PieceSkinId {
  const active = current ?? getSavedPieceSkin();
  const next: PieceSkinId = active === "contrast" ? "cottage" : "contrast";
  savePieceSkin(next);
  return next;
}

export function usePieceSkin() {
  const [skin, setSkinState] = useState<PieceSkinId>(getSavedPieceSkin);

  useEffect(() => {
    const handleSkinChange = (e: Event) => {
      const customEvent = e as CustomEvent<PieceSkinId>;
      if (
        customEvent.detail &&
        (customEvent.detail === "contrast" || customEvent.detail === "cottage")
      ) {
        setSkinState(customEvent.detail);
      } else {
        setSkinState(getSavedPieceSkin());
      }
    };

    window.addEventListener(PIECE_SKIN_EVENT, handleSkinChange);
    return () => {
      window.removeEventListener(PIECE_SKIN_EVENT, handleSkinChange);
    };
  }, []);

  const setSkin = (newSkin: PieceSkinId) => {
    savePieceSkin(newSkin);
    setSkinState(newSkin);
  };

  const toggle = () => {
    const next = togglePieceSkin(skin);
    setSkinState(next);
    return next;
  };

  return {
    skin,
    setSkin,
    toggle,
    meta: PIECE_SKINS[skin],
  };
}
