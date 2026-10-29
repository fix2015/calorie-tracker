// Date of the current Terms of Use. Bump it when the Terms change materially: anyone who accepted an
// older version (or never accepted, termsAcceptedAt null) sees the agreement sheet once on next sign-in.
// Keep in sync with frontend/src/services/terms.js.
const TERMS_VERSION = '2026-10-29';

const TERMS_REQUIRED = 'You must accept the Terms of Use to create an account';

const needsTermsAcceptance = (termsAcceptedAt) =>
  !termsAcceptedAt || new Date(termsAcceptedAt) < new Date(`${TERMS_VERSION}T00:00:00Z`);

module.exports = { TERMS_VERSION, TERMS_REQUIRED, needsTermsAcceptance };
