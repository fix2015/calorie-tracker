import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { users } from '../services/api';
import { useTranslation } from '../i18n';

const ACTIVITY_LEVEL_KEYS = [
  { value: 'sedentary', key: 'activityLevel.sedentaryDesc' },
  { value: 'light', key: 'activityLevel.lightDesc' },
  { value: 'moderate', key: 'activityLevel.moderateDesc' },
  { value: 'active', key: 'activityLevel.activeDesc' },
  { value: 'very_active', key: 'activityLevel.veryActiveDesc' },
];

const GOAL_KEYS = [
  { value: 'lose', key: 'goalType.lose' },
  { value: 'maintain', key: 'goalType.maintain' },
  { value: 'gain', key: 'goalType.gain' },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const avatarRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    age: '',
    gender: 'male',
    heightCm: '',
    weightKg: '',
    activityLevel: 'moderate',
    goal: 'lose',
    targetWeightKg: '',
  });

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const next = () => {
    setError('');
    if (step === 1) {
      if (!form.name || !form.email || !form.password) {
        setError(t('register.allFieldsRequired'));
        return;
      }
      if (form.password.length < 8) {
        setError(t('register.passwordMin'));
        return;
      }
    }
    if (step === 2) {
      if (!form.age || !form.heightCm || !form.weightKg) {
        setError(t('register.allFieldsRequired'));
        return;
      }
    }
    if (step === 3) {
      if (!form.goal) {
        setError(t('register.selectGoal'));
        return;
      }
      if (form.goal !== 'maintain' && !form.targetWeightKg) {
        setError(t('register.enterTargetWeight'));
        return;
      }
    }
    setStep(step + 1);
  };

  const back = () => {
    setError('');
    setStep(step - 1);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    // Resize to square before storing
    resizeAvatar(file).then(setAvatarFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        age: Number(form.age),
        gender: form.gender,
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        targetWeightKg: form.targetWeightKg ? Number(form.targetWeightKg) : Number(form.weightKg),
        activityLevel: form.activityLevel,
        goal: form.goal,
      });
      // Upload avatar after registration (now authenticated)
      if (avatarFile) {
        try { await users.uploadAvatar(avatarFile); } catch { /* non-blocking */ }
      }
      navigate('/');
    } catch (err) {
      setError(err.message || t('register.failed'));
    } finally {
      setLoading(false);
    }
  };

  const weightDiff = form.weightKg && form.targetWeightKg
    ? Math.abs(Number(form.weightKg) - Number(form.targetWeightKg)).toFixed(1)
    : null;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span className="auth-logo-text">{t('common.appName')}</span>
        </div>

        <h1 className="auth-title">{t('register.createAccount')}</h1>
        <p className="auth-subtitle">{t('register.subtitle')}</p>

        <div className="steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`} />
          <div className={`step ${step >= 2 ? 'active' : ''}`} />
          <div className={`step ${step >= 3 ? 'active' : ''}`} />
          <div className={`step ${step >= 4 ? 'active' : ''}`} />
        </div>

        <p className={`error-text${error ? ' visible' : ''}`} style={{ marginBottom: error ? 'var(--space-md)' : 0 }}><span>{error}</span></p>

        <form onSubmit={handleSubmit} className="auth-form">
          {step === 1 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-sm)' }}>
                <div
                  className="avatar-upload-area"
                  style={{ width: 80, height: 80 }}
                  onClick={() => avatarRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div className="public-avatar-placeholder" style={{ width: 80, height: 80, margin: 0, fontSize: 'var(--font-size-xl)' }}>
                      {form.name ? form.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  <div className="avatar-upload-overlay" style={{ width: 80, height: 80 }}>
                    <span style={{ fontSize: 18 }}>📷</span>
                  </div>
                </div>
                <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>{t('register.addPhoto')}</p>
              </div>
              <div className="form-group">
                <label htmlFor="name">{t('common.name')}</label>
                <input id="name" type="text" value={form.name} onChange={set('name')} required placeholder={t('register.yourName')} />
              </div>
              <div className="form-group">
                <label htmlFor="reg-email">{t('common.email')}</label>
                <input id="reg-email" type="email" value={form.email} onChange={set('email')} required placeholder={t('login.emailPlaceholder')} />
              </div>
              <div className="form-group">
                <label htmlFor="reg-password">{t('common.password')}</label>
                <input id="reg-password" type="password" value={form.password} onChange={set('password')} required placeholder={t('register.minChars')} />
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={next}>{t('common.next')}</button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-group">
                <label htmlFor="age">{t('profile.age')}</label>
                <input id="age" type="number" value={form.age} onChange={set('age')} required min="10" max="120" />
              </div>
              <div className="form-group">
                <label htmlFor="gender">{t('profile.gender')}</label>
                <select id="gender" value={form.gender} onChange={set('gender')}>
                  <option value="male">{t('profile.male')}</option>
                  <option value="female">{t('profile.female')}</option>
                  <option value="other">{t('profile.other')}</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="heightCm">{t('profile.heightCm')}</label>
                <input id="heightCm" type="number" value={form.heightCm} onChange={set('heightCm')} required min="100" max="250" />
              </div>
              <div className="form-group">
                <label htmlFor="weightKg">{t('profile.currentWeight')}</label>
                <input id="weightKg" type="number" step="0.1" value={form.weightKg} onChange={set('weightKg')} required min="30" max="300" />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={back}>{t('common.back')}</button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={next}>{t('common.next')}</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-group">
                <label htmlFor="goal">{t('register.whatsYourGoal')}</label>
                <select id="goal" value={form.goal} onChange={set('goal')}>
                  {GOAL_KEYS.map((g) => (
                    <option key={g.value} value={g.value}>{t(g.key)}</option>
                  ))}
                </select>
              </div>

              {form.goal !== 'maintain' && (
                <div className="form-group">
                  <label htmlFor="targetWeightKg">{t('register.targetWeight')}</label>
                  <input id="targetWeightKg" type="number" step="0.1" value={form.targetWeightKg} onChange={set('targetWeightKg')} required min="30" max="300" placeholder={t('register.yourGoalWeight')} />
                  {weightDiff && (
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {form.goal === 'lose' ? t('register.kgToLose', weightDiff) : t('register.kgToGain', weightDiff)}
                    </span>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="activityLevel">{t('register.activityLevel')}</label>
                <select id="activityLevel" value={form.activityLevel} onChange={set('activityLevel')}>
                  {ACTIVITY_LEVEL_KEYS.map((a) => (
                    <option key={a.value} value={a.value}>{t(a.key)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={back}>{t('common.back')}</button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={next}>{t('common.next')}</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div style={{
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>{t('register.calorieTargetWillBe')}</p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('register.calculatedBasedOnProfile')}</p>
                <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                  <p>📊 {t('register.current')} <strong>{form.weightKg} kg</strong></p>
                  {form.goal !== 'maintain' && <p>🎯 {t('register.target')} <strong>{form.targetWeightKg} kg</strong></p>}
                  <p>🏃 {t('register.activity')} <strong>{t(ACTIVITY_LEVEL_KEYS.find(a => a.value === form.activityLevel)?.key)}</strong></p>
                  <p>📎 {t('register.goal')} <strong>{t(GOAL_KEYS.find(g => g.value === form.goal)?.key)}</strong></p>
                </div>
                <p style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {t('register.weighInNote')}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={back}>{t('common.back')}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? t('register.creating') : t('register.startTracking')}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="auth-switch">
          {t('register.alreadyHaveAccount')} <Link to="/login">{t('register.signIn')}</Link>
        </p>

        <p className="legal-links">
          {t('register.agreeTerms')}{' '}
          <Link to="/terms">{t('register.terms')}</Link> and <Link to="/privacy">{t('register.privacyPolicy')}</Link>
        </p>
      </div>
    </div>
  );
}

function resizeAvatar(file, maxSize = 512) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      const outSize = Math.min(size, maxSize);
      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      canvas.getContext('2d').drawImage(img, sx, sy, size, size, 0, 0, outSize, outSize);
      canvas.toBlob((blob) => {
        resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.85);
    };
    img.src = url;
  });
}
