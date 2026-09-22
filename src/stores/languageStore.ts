import { create } from 'zustand';
import { getSetting, setSetting } from '@/lib/db/repositories/settings';
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
  getTranslation,
} from '@/lib/i18n/translations';

interface LanguageState {
  language: SupportedLanguage;
  initialized: boolean;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  initializeLanguage: () => Promise<void>;
  t: (key: string) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: 'en',
  initialized: false,

  initializeLanguage: async () => {
    try {
      const saved = await getSetting('language', 'en');
      const validLang = SUPPORTED_LANGUAGES.some(l => l.code === saved)
        ? (saved as SupportedLanguage)
        : 'en';
      set({ language: validLang, initialized: true });
    } catch {
      set({ language: 'en', initialized: true });
    }
  },

  setLanguage: async (lang: SupportedLanguage) => {
    set({ language: lang });
    try {
      await setSetting('language', lang);
    } catch (e) {
      console.error('[LanguageStore] Failed to persist language to IndexedDB:', e);
    }
  },

  t: (key: string) => {
    const lang = get().language;
    return getTranslation(lang, key);
  },
}));
