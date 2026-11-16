import { useEffect } from "react";

import { unlockAndPlayMusic } from "../utils/gameAudio";

export function useGameMusic(): void {
  useEffect(() => {
    let active = true;

    const removeUnlockListeners = () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
    const unlock = () => {
      void unlockAndPlayMusic().then((unlocked) => {
        if (active && unlocked) removeUnlockListeners();
      });
    };

    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      active = false;
      removeUnlockListeners();
    };
  }, []);
}
