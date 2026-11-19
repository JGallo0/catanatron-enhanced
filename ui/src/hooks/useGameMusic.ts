import { useEffect } from "react";

import { stopGameMusic, unlockAndPlayMusic } from "../utils/gameAudio";

export function useGameMusic(enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      stopGameMusic();
      return;
    }

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

    unlock();
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      active = false;
      removeUnlockListeners();
    };
  }, [enabled]);
}
