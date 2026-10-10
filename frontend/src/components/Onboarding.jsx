import { useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { users } from '../services/api';
import { completeOnboarding, isOnboardingPending } from '../services/onboarding';
import { useTranslation } from '../i18n';
import GoalFields from './GoalFields';

const STEPS = 3;

function Onboarding({ onDone }) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    goal: user?.goal || 'lose',
    targetWeightKg: user?.targetWeightKg || '',
    activityLevel: user?.activityLevel || 'moderate',
    weightKg: user?.weightKg || '',
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const finish = () => {
    completeOnboarding(user?.id);
    onDone();
  };

  const saveGoal = async (e) => {
    e.preventDefault();
    if (form.goal !== 'maintain' && !form.targetWeightKg) {
      setError(t('register.enterTargetWeight'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await users.updateProfile({
        goal: form.goal,
        activityLevel: form.activityLevel,
        ...(form.goal !== 'maintain' ? { targetWeightKg: Number(form.targetWeightKg) } : {}),
      });
      await refreshUser().catch(() => {});
      finish();
    } catch (err) {
      setError(err.message || t('onboarding.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-top">
        <span className="onboarding-dots" aria-label={t('onboarding.stepOf', step + 1, STEPS)}>
          {Array.from({ length: STEPS }, (_, i) => <span key={i} className={i === step ? 'active' : ''} />)}
        </span>
        <button type="button" className="link-btn" onClick={finish}>{t('onboarding.skip')}</button>
      </div>

      {step === 0 && (
        <div className="onboarding-body">
          <div className="onboarding-hero" aria-hidden="true">🥗</div>
          <h1 id="onboarding-title">{t('onboarding.welcomeTitle')}</h1>
          <p>{t('onboarding.welcomeBody')}</p>
          <ul className="onboarding-points">
            <li>📷 {t('onboarding.pointPhoto')}</li>
            <li>🎤 {t('onboarding.pointVoice')}</li>
            <li>📊 {t('onboarding.pointProgress')}</li>
          </ul>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-body">
          <div className="onboarding-hero" aria-hidden="true">📸</div>
          <h1 id="onboarding-title">{t('onboarding.scanTitle')}</h1>
          <ol className="onboarding-steps">
            <li>{t('onboarding.scanStep1')}</li>
            <li>{t('onboarding.scanStep2')}</li>
            <li>{t('onboarding.scanStep3')}</li>
          </ol>
          <p className="onboarding-note">{t('onboarding.scanNote')}</p>
        </div>
      )}

      {step === 2 && (
        <form className="onboarding-body" onSubmit={saveGoal} id="onboarding-goal-form">
          <div className="onboarding-hero" aria-hidden="true">🎯</div>
          <h1 id="onboarding-title">{t('onboarding.goalTitle')}</h1>
          <p>{t('onboarding.goalBody')}</p>
          <GoalFields form={form} set={set} idPrefix="onb-" />
          {error && <p className="report-sheet-error" role="alert">{error}</p>}
        </form>
      )}

      <div className="onboarding-actions">
        {step > 0 && (
          <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>{t('common.back')}</button>
        )}
        {step < STEPS - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>{t('common.next')}</button>
        ) : (
          <button type="submit" form="onboarding-goal-form" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('onboarding.start')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Renders the first-run onboarding once for a freshly registered account. */
export default function OnboardingGate({ userId }) {
  const [open, setOpen] = useState(() => isOnboardingPending(userId));
  if (!open) return null;
  return <Onboarding onDone={() => setOpen(false)} />;
}
