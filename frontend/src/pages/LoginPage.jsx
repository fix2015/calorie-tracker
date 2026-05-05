import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { useTranslation } from '../i18n';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span className="auth-logo-text">{t('common.appName')}</span>
        </div>

        <h1 className="auth-title">{t('login.welcomeBack')}</h1>
        <p className="auth-subtitle">{t('login.subtitle')}</p>

        <p className={`error-text${error ? ' visible' : ''}`} style={{ marginBottom: error ? 'var(--space-md)' : 0 }}><span>{error}</span></p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">{t('common.email')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t('login.emailPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('common.password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={t('login.passwordPlaceholder')}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>

        <p className="auth-switch">
          {t('login.noAccount')} <Link to="/register">{t('login.signUp')}</Link>
        </p>

        <p className="legal-links">
          <Link to="/terms">{t('terms.title')}</Link>
          <span className="legal-links-sep">&middot;</span>
          <Link to="/privacy">{t('privacy.title')}</Link>
        </p>
      </div>
    </div>
  );
}
