import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../services/AuthContext';
import { auth } from '../services/api';
import { useTranslation } from '../i18n';

const TermsPage = lazy(() => import('../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));

/** Terms / Privacy opened over the current screen, so a half-filled form keeps its state. */
function LegalOverlay({ page, onClose }) {
  const Page = page === 'privacy' ? PrivacyPage : TermsPage;
  return createPortal(
    <div className="legal-overlay" role="dialog" aria-modal="true">
      <Suspense fallback={<div className="page"><div className="spinner" /></div>}>
        <Page onClose={onClose} />
      </Suspense>
    </div>,
    document.body,
  );
}

/** A translated sentence whose {terms} / {privacy} placeholders become in-app links. */
function LegalText({ text }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(null);
  return (
    <>
      {text.split(/(\{terms\}|\{privacy\})/).map((part, i) => {
        if (part !== '{terms}' && part !== '{privacy}') return part;
        const page = part.slice(1, -1);
        return (
          <button
            key={i}
            type="button"
            className="terms-link"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(page); }}
          >
            {t(page === 'terms' ? 'agreement.termsOfUse' : 'agreement.privacyPolicy')}
          </button>
        );
      })}
      {open && <LegalOverlay page={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Required "I agree to the Terms of Use and Privacy Policy…" checkbox (App Store guideline 1.2). */
export function TermsCheckbox({ checked, onChange, invalid }) {
  const { t } = useTranslation();
  return (
    <label className={`terms-checkbox${invalid ? ' invalid' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
      />
      <span><LegalText text={t('agreement.checkbox')} /></span>
    </label>
  );
}

/** One-line "By signing in you agree to our Terms of Use…" under the Login buttons. */
export function TermsNote() {
  const { t } = useTranslation();
  return <p className="terms-note"><LegalText text={t('agreement.signInNote')} /></p>;
}

/**
 * Bottom sheet with the same checkbox: before a first social sign-in creates the account, and once for
 * accounts that never accepted the current Terms. `onAgree` may throw; its message is shown in the sheet.
 */
export function TermsSheet({ body, onAgree, onCancel, cancelLabel }) {
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!agreed) {
      setError(t('agreement.mustAgree'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onAgree();
    } catch (err) {
      setError(err.message || t('agreement.failed'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-overlay report-sheet-overlay">
      <form
        className="report-sheet terms-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-sheet-title"
        onSubmit={handleSubmit}
      >
        <div className="report-sheet-handle" aria-hidden="true" />
        <h2 id="terms-sheet-title">{t('agreement.sheetTitle')}</h2>
        <p className="report-sheet-subtitle">{body}</p>
        <TermsCheckbox checked={agreed} onChange={(v) => { setAgreed(v); if (v) setError(''); }} invalid={!!error && !agreed} />
        {error && <p className="report-sheet-error" role="alert">{error}</p>}
        <div className="report-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="submit" className="btn btn-primary" aria-disabled={!agreed || undefined} disabled={busy}>
            {t('agreement.agreeContinue')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** Signed-in accounts that never accepted (or accepted an older TERMS_VERSION) agree once before going on. */
export function TermsGate() {
  const { t } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  if (!user?.needsTerms) return null;
  return (
    <TermsSheet
      body={t('agreement.sheetBodyUpdated')}
      onAgree={async () => { await auth.acceptTerms(); await refreshUser(); }}
      onCancel={logout}
      cancelLabel={t('common.logout')}
    />
  );
}
