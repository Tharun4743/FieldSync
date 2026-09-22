import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import {
  translations,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type TranslationDictionary,
  type LanguageOption,
} from './translations';
import { getSetting, setSetting } from '../db/repositories/settings';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: TranslationDictionary;
  supportedLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: translations.en,
  supportedLanguages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  // Load language from IndexedDB on startup
  useEffect(() => {
    let mounted = true;
    void getSetting('language', 'en').then((savedLang) => {
      if (mounted && savedLang && (savedLang in translations)) {
        setLanguageState(savedLang as SupportedLanguage);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const changeLanguage = async (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    await setSetting('language', newLang);
  };

  const t = useMemo(() => {
    return translations[language] || translations.en;
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: changeLanguage,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  return useContext(LanguageContext);
}
