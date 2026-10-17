import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { users } from '../services/api';
import { useTranslation } from '../i18n';
import GoalFields from './GoalFields';

const STEPS = 2;

/**
 * Shortened register wizard for accounts created with Apple / Google: body stats, then goal + activity.
 * Shown full-screen until the profile is complete (the backend sets profileComplete with the calorie target).
 */
function FinishProfile() {
  const { t } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    age: '',
    gender: 'male',
    heightCm: '',
    weightKg: '',
    activityLevel: 'moderate',
    goal: 'lose',
    targetWeightKg: '',
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const next = (e) => {
    e.preventDefault();
    if (!form.name || !form.age || !form.heightCm || !form.weightKg) {
      setError(t('register.allFieldsRequired'));
      return;
    }
    setError('');
    setStep(1);
  };

  const save = async (e) => {
    e.preventDefault();
    if (form.goal !== 'maintain' && !form.targetWeightKg) {
      setError(t('register.enterTargetWeight'));
      return;
    }
    if (!agreedToTerms) {
      setError(t('register.mustAgree'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await users.updateProfile({
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        targetWeightKg: form.targetWeightKg ? Number(form.targetWeightKg) : Number(form.weightKg),
        activityLevel: form.activityLevel,
        goal: form.goal,
      });
      await refreshUser();
    } catch (err) {
      setError(err.message || t('register.failed'));
      setSaving(false);
    }
  };

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="finish-profile-title">
      <div className="onboarding-top">
        <span className="onboarding-dots" aria-label={t('onboarding.stepOf', step + 1, STEPS)}>
          {Array.from({ length: STEPS }, (_, i) => <span key={i} className={i === step ? 'active' : ''} />)}
        </span>
        <button type="button" className="link-btn" onClick={logout}>{t('common.logout')}</button>
      </div>

      {step === 0 && (
        <form className="onboarding-body auth-form" onSubmit={next} id="finish-profile-form">
          <h1 id="finish-profile-title">{t('auth.finishProfileTitle')}</h1>
          <p>{t('auth.finishProfileBody')}</p>
          <div className="form-group">
            <label htmlFor="fp-name">{t('common.name')}</label>
            <input id="fp-name" type="text" value={form.name} onChange={set('name')} required maxLength={100} />
          </div>
          <div className="form-group">
            <label htmlFor="fp-age">{t('profile.age')}</label>
            <input id="fp-age" type="number" value={form.age} onChange={set('age')} required min="10" max="120" />
          </div>
          <div className="form-group">
            <label htmlFor="fp-gender">{t('profile.gender')}</label>
            <select id="fp-gender" value={form.gender} onChange={set('gender')}>
              <option value="male">{t('profile.male')}</option>
              <option value="female">{t('profile.female')}</option>
              <option value="other">{t('profile.other')}</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="fp-height">{t('profile.heightCm')}</label>
            <input id="fp-height" type="number" value={form.heightCm} onChange={set('heightCm')} required min="100" max="250" />
          </div>
          <div className="form-group">
            <label htmlFor="fp-weight">{t('profile.currentWeight')}</label>
            <input id="fp-weight" type="number" step="0.1" value={form.weightKg} onChange={set('weightKg')} required min="30" max="300" />
          </div>
        </form>
      )}

      {step === 1 && (
        <form className="onboarding-body auth-form" onSubmit={save} id="finish-profile-form">
          <h1 id="finish-profile-title">{t('onboarding.goalTitle')}</h1>
          <GoalFields form={form} set={set} idPrefix="fp-" />
          <label className="terms-checkbox">
            <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
            <span>
              {t('register.iAgree')}{' '}
              <Link to="/terms" target="_blank">{t('register.terms')}</Link> {t('register.and')}{' '}
              <Link to="/privacy" target="_blank">{t('register.privacyPolicy')}</Link>.{' '}
              {t('register.zeroTolerance')}
            </span>
          </label>
        </form>
      )}

      {error && <p className="report-sheet-error" role="alert">{error}</p>}

      <div className="onboarding-actions">
        {step > 0 && (
          <button type="button" className="btn btn-secondary" onClick={() => { setError(''); setStep(0); }}>{t('common.back')}</button>
        )}
        {step === 0 ? (
          <button type="submit" form="finish-profile-form" className="btn btn-primary">{t('common.next')}</button>
        ) : (
          <button type="submit" form="finish-profile-form" className="btn btn-primary" disabled={saving || !agreedToTerms}>
            {saving ? t('common.saving') : t('register.startTracking')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Blocks the app for accounts created with Apple / Google until body stats and a goal are entered. */
export default function FinishProfileGate() {
  const { user } = useAuth();
  if (!user || user.profileComplete !== false) return null;
  return <FinishProfile />;
}
