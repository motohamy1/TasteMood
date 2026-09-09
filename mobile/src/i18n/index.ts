/**
 * Language + RTL core. EN/AR with full layout mirroring:
 * `I18nManager.forceRTL` mirrors the whole layout when Arabic is active —
 * it only takes effect on app restart, which the profile switcher prompts
 * for. Persisted via SecureStore; defaults to the device locale on first run.
 */

import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { I18nManager } from "react-native";

import {
  dictionaries,
  type Lang,
  type TranslationKey,
} from "./dictionaries";

const STORAGE_KEY = "tastemood.lang";

interface LanguageState {
  lang: Lang;
  hydrated: boolean;
  setLang: (lang: Lang) => void;
  hydrate: () => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  lang: "en",
  hydrated: false,

  setLang: (lang) => {
    set({ lang });
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(lang === "ar");
    void SecureStore.setItemAsync(STORAGE_KEY, lang);
  },

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      const lang: Lang = stored === "ar" ? "ar" : stored === "en" ? "en" : detectLang();
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(lang === "ar");
      set({ lang, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

function detectLang(): Lang {
  try {
    // expo-localization is not a dependency; use the RN locale if exposed.
    const locale =
      (Intl.DateTimeFormat().resolvedOptions().locale as string) ?? "en";
    return locale.startsWith("ar") ? "ar" : "en";
  } catch {
    return "en";
  }
}

/** Bound translator: t("personality.matchWithSession", { pct: 82 }) */
export function useT() {
  const lang = useLanguageStore((s) => s.lang);
  return (key: TranslationKey, vars?: Record<string, string | number>): string => {
    let text: string = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

export function useLang(): Lang {
  return useLanguageStore((s) => s.lang);
}

export function isRTL(lang: Lang): boolean {
  return lang === "ar";
}

/** Display name for dishes/places: Arabic source name, English when requested. */
export function displayName(
  lang: Lang,
  item: { name: string; nameEn?: string | null }
): string {
  return lang === "ar" ? item.name : (item.nameEn ?? item.name);
}

/** Display description: localized, falling back across languages. */
export function displayDescription(
  lang: Lang,
  item: { description?: string | null; descriptionEn?: string | null }
): string | null {
  if (lang === "ar") return item.description ?? item.descriptionEn ?? null;
  return item.descriptionEn ?? item.description ?? null;
}

/** Pick a localized label from an EN/AR pair (option lists in lib modules). */
export function pickLabel(
  lang: Lang,
  en: string,
  ar?: string
): string {
  return lang === "ar" && ar ? ar : en;
}
