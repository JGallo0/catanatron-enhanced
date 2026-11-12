import { afterEach, describe, expect, test } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getCurrentLanguage,
  normalizeLanguage,
  pickText,
  setLanguage,
  subscribeLanguage,
  tr,
} from "./index";

afterEach(() => {
  localStorage.clear();
  setLanguage("pt");
});

describe("i18n runtime helper", () => {
  test("defaults to pt and persists updates in localStorage", () => {
    expect(getCurrentLanguage()).toBe(DEFAULT_LANGUAGE);
    expect(tr("Olá", "Hello")).toBe("Olá");
    expect(pickText("A", "B")).toBe("A");

    let notified = 0;
    const unsub = subscribeLanguage(() => {
      notified += 1;
    });

    setLanguage("en");
    expect(getCurrentLanguage()).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toContain("bots that never stall");
    expect(tr("Olá", "Hello")).toBe("Hello");
    expect(pickText("A", "B")).toBe("B");
    expect(notified).toBe(1);

    setLanguage("pt");
    expect(document.documentElement.lang).toBe("pt-BR");
    expect(document.title).toContain("bots que não travam");
    unsub();
  });

  test("normalizes unknown language codes safely to pt", () => {
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("EN")).toBe("en");
    expect(normalizeLanguage("pt-BR")).toBe("pt");
    expect(normalizeLanguage("fr")).toBe("pt");
    expect(normalizeLanguage(null)).toBe("pt");
  });
});
