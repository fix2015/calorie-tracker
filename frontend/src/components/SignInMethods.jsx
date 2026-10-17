import { useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { auth } from '../services/api';
import { useTranslation } from '../i18n';

/**
 * Profile section for accounts linked to Apple / Google: shows the providers and lets the user add an
 * email password so they are not locked to one provider. Renders nothing for password-only accounts.
 */
export default function SignInMethods() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const providers = user?.authProviders || [];
  if (!providers.length) return null;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 8) {
      setError(t('register.passwordMin'));
      return;
    }
    setSaving(true);
    try {
      await auth.setPassword({ password });
      setPassword('');
      setSuccess(t('auth.passwordSaved'));
      await refreshUser().catch(() => {});
    } catch (err) {
      setError(err.message || t('common.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="sign-in-methods-title">
      <h3 id="sign-in-methods-title">{t('auth.signInMethods')}</h3>
      {providers.map((p) => (
        <p key={p} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
          {p === 'apple' ? t('auth.signedInWithApple') : t('auth.signedInWithGoogle')}
        </p>
      ))}

      {user.hasPassword ? (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('auth.passwordSet', user.email)}</p>
      ) : (
        <form onSubmit={save} className="auth-form" style={{ marginTop: 'var(--space-sm)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('auth.addPasswordHint', user.email)}</p>
          <div className="form-group">
            <label htmlFor="set-password">{t('auth.addPassword')}</label>
            <input
              id="set-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('register.minChars')}
              minLength={8}
              required
            />
          </div>
          {error && <p className="error-text visible"><span>{error}</span></p>}
          {success && <p className="success-text visible"><span>{success}</span></p>}
          <button type="submit" className="btn btn-secondary btn-block" disabled={saving}>
            {saving ? t('common.saving') : t('auth.savePassword')}
          </button>
        </form>
      )}
    </section>
  );
}
