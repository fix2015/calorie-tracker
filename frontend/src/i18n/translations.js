// English ships in the main bundle (it is also the fallback); other locales are
// fetched on demand so first load only downloads the language actually in use.
import en from './locales/en.json';
import { detectBrowserLanguage } from './detectLanguage';

const loaders = {
  uk: () => import('./locales/uk.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  de: () => import('./locales/de.json'),
  pl: () => import('./locales/pl.json'),
};

export const translations = { en };

export const isSupported = (code) => code === 'en' || code in loaders;

export async function loadLanguage(code) {
  if (translations[code] || !loaders[code]) return;
  const mod = await loaders[code]();
  translations[code] = mod.default || mod;
}

export function getInitialLanguage() {
  try {
    const stored = localStorage.getItem('appLanguage');
    if (stored && isSupported(stored)) return stored;
    const detected = detectBrowserLanguage();
    localStorage.setItem('appLanguage', detected);
    return detected;
  } catch {
    return 'en';
  }
}

/** Load the user's language before the first render (falls back to English on failure). */
export const preloadInitialLanguage = () => loadLanguage(getInitialLanguage()).catch(() => {});
