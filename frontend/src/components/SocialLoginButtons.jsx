import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { auth } from '../services/api';
import { useTranslation } from '../i18n';
import { clientConfigured, platform, signInWithProvider, isCancelled } from '../services/socialLogin';
import { isTermsRequired } from '../services/terms';
import { TermsSheet } from './TermsAgreement';

// Server-side availability (GET /auth/providers), fetched once per page load
let providersPromise = null;
const loadProviders = () => {
  if (!providersPromise) {
    providersPromise = auth.providers().catch(() => {
      providersPromise = null;
      return { apple: false, google: false };
    });
  }
  return providersPromise;
};

const AppleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
  </svg>
);

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/**
 * "Continue with Apple" / "Continue with Google" + "or" divider, shown above the email form on the
 * Login and Register screens. Renders nothing when neither provider is available.
 *
 * `terms` (Register): `{ accepted, onBlocked }` — the buttons stay inactive until the Terms checkbox above
 * them is ticked, and the sign-in carries acceptedTerms. Without it (Login, Explore) a sign-in that would
 * create an account is refused by the API and the "Agree to Terms" sheet opens before it is retried.
 */
export default function SocialLoginButtons({ onError, terms }) {
  const { t } = useTranslation();
  const { socialLogin } = useAuth();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [busy, setBusy] = useState(null);
  const [pending, setPending] = useState(null); // credential waiting for the Terms sheet

  useEffect(() => {
    let alive = true;
    loadProviders().then((p) => { if (alive) setServer(p); });
    return () => { alive = false; };
  }, []);

  if (!server) return null;
  const show = {
    apple: server.apple && clientConfigured.apple,
    google: server.google && clientConfigured.google,
  };
  if (!show.apple && !show.google) return null;

  const blocked = !!terms && !terms.accepted;

  const finish = async (credential) => {
    await socialLogin(credential);
    navigate('/');
  };

  const start = async (provider) => {
    if (blocked) {
      terms.onBlocked?.();
      return;
    }
    onError?.('');
    setBusy(provider);
    let credential = null;
    try {
      credential = await signInWithProvider(provider);
      if (!credential.token) throw new Error(t('auth.socialFailed'));
      await finish(terms ? { ...credential, acceptedTerms: true } : credential);
    } catch (err) {
      if (isTermsRequired(err) && credential) setPending(credential);
      else if (!isCancelled(err)) onError?.(err.message || t('auth.socialFailed'));
    } finally {
      setBusy(null);
    }
  };

  const apple = show.apple && (
    <button key="apple" type="button" className="btn btn-block btn-social btn-apple" onClick={() => start('apple')} disabled={!!busy} aria-disabled={blocked || undefined}>
      <AppleLogo />
      <span>{t('auth.continueWithApple')}</span>
    </button>
  );
  const google = show.google && (
    <button key="google" type="button" className="btn btn-block btn-social btn-google" onClick={() => start('google')} disabled={!!busy} aria-disabled={blocked || undefined}>
      <GoogleLogo />
      <span>{t('auth.continueWithGoogle')}</span>
    </button>
  );

  return (
    <div className="social-login">
      {/* Equal prominence (guideline 4.8); Apple leads everywhere except Android */}
      {platform === 'android' ? [google, apple] : [apple, google]}
      <div className="auth-divider" role="separator"><span>{t('auth.or')}</span></div>
      {pending && (
        <TermsSheet
          body={t('agreement.sheetBodyNew')}
          onAgree={() => finish({ ...pending, acceptedTerms: true })}
          onCancel={() => setPending(null)}
          cancelLabel={t('common.cancel')}
        />
      )}
    </div>
  );
}
