// Date of the current Terms of Use — keep in sync with TERMS_VERSION in backend/src/utils/terms.js.
// Bumping it makes everyone who accepted an older version see the agreement sheet once more.
export const TERMS_VERSION = '2026-10-29';

/** TERMS_VERSION as a long date in the app language ("29 October 2026"). */
export const termsDate = (language) =>
  new Date(`${TERMS_VERSION}T12:00:00Z`).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' });

/** True when the API refused to create an account because the Terms were not accepted. */
export const isTermsRequired = (err) => err?.data?.code === 'TERMS_REQUIRED';
