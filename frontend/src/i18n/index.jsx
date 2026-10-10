import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { translations, loadLanguage, getInitialLanguage, isSupported } from './translations';

// eslint-disable-next-line react-refresh/only-export-components -- constant shared with the provider
export const LANGUAGES = {
  en: { label: 'English', nativeName: 'English', flag: '🇬🇧' },
  uk: { label: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  es: { label: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { label: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { label: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  pl: { label: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
};

function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLang] = useState(getInitialLanguage);

  const setLanguage = useCallback((code) => {
    if (!isSupported(code)) return;
    loadLanguage(code).then(() => {
      setLang(code);
      localStorage.setItem('appLanguage', code);
      document.documentElement.lang = code;
    }).catch(() => { /* offline and not cached yet — keep the current language */ });
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

// eslint-disable-next-line react-refresh/only-export-components -- hook lives next to its provider
export function useTranslation() {
  return useContext(LanguageContext);
}
