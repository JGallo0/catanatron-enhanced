import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";

export type AppLanguage = "pt" | "en";

export const LANGUAGE_STORAGE_KEY = "catan_language_v1";

export const DEFAULT_LANGUAGE: AppLanguage = "pt";

const listeners = new Set<() => void>();

export function normalizeLanguage(raw: unknown): AppLanguage {
  if (typeof raw === "string" && raw.trim().toLowerCase().startsWith("en")) {
    return "en";
  }
  return "pt";
}

export function getCurrentLanguage(): AppLanguage {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(LANGUAGE_STORAGE_KEY)
        : null;
    return normalizeLanguage(raw);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function syncDocumentMetadata(lang: AppLanguage) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  document.title =
    lang === "en"
      ? "Rule the Isle — Online matches with friends & offline bots that never stall"
      : "Rule the Isle — Confrontos online entre amigos e offline com bots que não travam";
}

export function setLanguage(nextLanguage: AppLanguage): void {
  const normalized = normalizeLanguage(nextLanguage);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    }
  } catch {
    // ignore storage errors
  }
  syncDocumentMetadata(normalized);
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function tr(
  pt: string,
  en: string,
  lang: AppLanguage = getCurrentLanguage()
): string {
  return lang === "en" ? en : pt;
}

export function pickText<T>(
  pt: T,
  en: T,
  lang: AppLanguage = getCurrentLanguage()
): T {
  return lang === "en" ? en : pt;
}

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (pt: string, en: string) => string;
  isEnglish: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getCurrentLanguage,
    () => DEFAULT_LANGUAGE
  );

  useEffect(() => {
    syncDocumentMetadata(language);
  }, [language]);

  const updateLanguage = useCallback((next: AppLanguage) => {
    setLanguage(next);
  }, []);

  const t = useCallback(
    (pt: string, en: string) => (language === "en" ? en : pt),
    [language]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: updateLanguage,
      t,
      isEnglish: language === "en",
    }),
    [language, updateLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Works both inside <I18nProvider> and in isolated unit tests that render
 * individual components directly without wrapping in <App />.
 */
export function useLanguage(): I18nContextValue {
  const ctx = useContext(I18nContext);
  const storeLanguage = useSyncExternalStore(
    subscribeLanguage,
    getCurrentLanguage,
    () => DEFAULT_LANGUAGE
  );

  const fallbackT = useCallback(
    (pt: string, en: string) => (storeLanguage === "en" ? en : pt),
    [storeLanguage]
  );

  if (ctx) {
    return ctx;
  }

  return {
    language: storeLanguage,
    setLanguage,
    t: fallbackT,
    isEnglish: storeLanguage === "en",
  };
}
