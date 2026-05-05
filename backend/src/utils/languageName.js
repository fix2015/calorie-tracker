const LANGUAGE_NAMES = {
  en: 'English',
  uk: 'Ukrainian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pl: 'Polish',
};

function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || 'English';
}

module.exports = { getLanguageName };
