import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { detectBrowserLanguage } from './detectLanguage';

import en from './locales/en.json';
import uk from './locales/uk.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pl from './locales/pl.json';

const translations = { en, uk, es, fr, de, pl };

export const LANGUAGES = {
  en: { label: 'English', nativeName: 'English', flag: '🇬🇧' },
  uk: { label: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  es: { label: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { label: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { label: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  pl: { label: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
};

function getInitialLanguage() {
  const stored = localStorage.getItem('appLanguage');
  if (stored && translations[stored]) return stored;
  const detected = detectBrowserLanguage();
  localStorage.setItem('appLanguage', detected);
  return detected;
}

function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLang] = useState(getInitialLanguage);

  const setLanguage = useCallback((code) => {
    if (translations[code]) {
      setLang(code);
      localStorage.setItem('appLanguage', code);
      document.documentElement.lang = code;
    }
  }, []);

  const t = useCallback((key, ...args) => {
    let str = resolve(translations[language], key) ?? resolve(translations.en, key) ?? key;
    args.forEach((val, i) => {
      str = str.replace(`{${i}}`, val);
    });
    return str;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
