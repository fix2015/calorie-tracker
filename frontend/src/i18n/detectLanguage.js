const SUPPORTED = ['en', 'uk', 'es', 'fr', 'de', 'pl'];

export function detectBrowserLanguage() {
  const candidates = navigator.languages || [navigator.language];
  for (const lang of candidates) {
    const code = lang.split('-')[0].toLowerCase();
    if (SUPPORTED.includes(code)) return code;
  }
  return 'en';
}
