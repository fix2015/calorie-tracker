import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { users, reports } from '../services/api';
import AvatarUpload from '../components/AvatarUpload';
import { useTranslation, LANGUAGES } from '../i18n';

const ACTIVITY_LEVEL_KEYS = [
  { value: 'sedentary', key: 'activityLevel.sedentary' },
  { value: 'light', key: 'activityLevel.light' },
  { value: 'moderate', key: 'activityLevel.moderate' },
  { value: 'active', key: 'activityLevel.active' },
  { value: 'very_active', key: 'activityLevel.veryActive' },
];

const GOAL_KEYS = [
  { value: 'lose', key: 'goalType.lose' },
  { value: 'maintain', key: 'goalType.maintain' },
  { value: 'gain', key: 'goalType.gain' },
];

export default function ProfilePage() {
  const { user, refreshUser, logout, deleteAccount } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [weightHistory, setWeightHistory] = useState([]);

  useEffect(() => {
    reports.weightHistory().then((data) => setWeightHistory(data.logs || [])).catch(() => {});
  }, []);

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('profile.confirmDeleteAccount'))) return;
    if (!window.confirm(t('profile.confirmDeleteData'))) return;
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      setError(err.message || t('profile.failedDelete'));
      setDeleting(false);
    }
  };

  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'male',
    heightCm: '',
    weightKg: '',
    targetWeightKg: '',
    activityLevel: 'moderate',
    goal: 'maintain',
    username: '',
    bio: '',
    linkUrl: '',
    isPublic: false,
    followersOnly: false,
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        age: user.age || '',
        gender: user.gender || 'male',
        heightCm: user.heightCm || '',
        weightKg: user.weightKg || '',
        targetWeightKg: user.targetWeightKg || '',
        activityLevel: user.activityLevel || 'moderate',
        goal: user.goal || 'maintain',
        username: user.username || '',
        bio: user.bio || '',
        linkUrl: user.linkUrl || '',
        isPublic: user.isPublic || false,
        followersOnly: user.followersOnly || false,
      });
    }
  }, [user]);

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await users.updateProfile({
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        targetWeightKg: form.targetWeightKg ? Number(form.targetWeightKg) : undefined,
        activityLevel: form.activityLevel,
        goal: form.goal,
        isPublic: form.isPublic,
        followersOnly: form.followersOnly,
        username: form.username || null,
        bio: form.bio || null,
        linkUrl: form.linkUrl || null,
      });
      await refreshUser();
      setSuccess(t('profile.savedSuccessfully'));
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || t('common.failed'));
    } finally {
      setSaving(false);
    }
  };

  const weightDiff = form.weightKg && form.targetWeightKg
    ? (Number(form.weightKg) - Number(form.targetWeightKg)).toFixed(1)
    : null;

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 560 }}>
        {user?.dailyCalorieTarget && (
          <div style={{
            background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-lg)',
            marginBottom: 'var(--space-lg)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {t('profile.dailyCalorieTarget')}
            </span>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {user.dailyCalorieTarget} {t('common.kcal')}
            </div>
            {user.weightKg && user.targetWeightKg && user.goal !== 'maintain' && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
                {user.weightKg} kg → {user.targetWeightKg} kg ({Math.abs(user.weightKg - user.targetWeightKg).toFixed(1)} {t('profile.kgTo')} {user.goal === 'lose' ? t('profile.lose') : t('profile.gain')})
              </p>
            )}
          </div>
        )}

        <AvatarUpload
          currentUrl={user?.avatarUrl}
          name={user?.name}
          onUpload={async (file) => {
            try {
              await users.uploadAvatar(file);
              await refreshUser();
              setSuccess(t('profile.avatarUpdated'));
              setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
              setError(err.message || t('common.failed'));
            }
          }}
        />

        {error && (
          <div className="profile-toast profile-toast-error">
            <span>{error}</span>
            <button onClick={() => setError('')}>&times;</button>
          </div>
        )}
        {success && (
          <div className="profile-toast profile-toast-success">
            <span>{success}</span>
            <button onClick={() => setSuccess('')}>&times;</button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label>{t('profile.language')}</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, { nativeName }]) => (
                <option key={code} value={code}>{nativeName}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="prof-name">{t('common.name')}</label>
            <input id="prof-name" type="text" value={form.name} onChange={set('name')} required />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="prof-age">{t('profile.age')}</label>
              <input id="prof-age" type="number" value={form.age} onChange={set('age')} required min="10" max="120" />
            </div>
            <div className="form-group">
              <label htmlFor="prof-gender">{t('profile.gender')}</label>
              <select id="prof-gender" value={form.gender} onChange={set('gender')}>
                <option value="male">{t('profile.male')}</option>
                <option value="female">{t('profile.female')}</option>
                <option value="other">{t('profile.other')}</option>
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="prof-height">{t('profile.heightCm')}</label>
              <input id="prof-height" type="number" value={form.heightCm} onChange={set('heightCm')} required min="100" max="250" />
            </div>
            <div className="form-group">
              <label htmlFor="prof-weight">{t('profile.currentWeight')}</label>
              <input id="prof-weight" type="number" step="0.1" value={form.weightKg} onChange={set('weightKg')} required min="30" max="300" />
            </div>
          </div>

          {/* Weight progress mini */}
          {weightHistory.length >= 2 && form.targetWeightKg && (() => {
            const startW = weightHistory[0].weightKg;
            const currentW = Number(form.weightKg) || startW;
            const goalW = Number(form.targetWeightKg);
            const totalDiff = Math.abs(startW - goalW);
            const remaining = Math.abs(currentW - goalW);
            const progress = totalDiff > 0 ? Math.min(((totalDiff - remaining) / totalDiff) * 100, 100) : 0;
            return (
              <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  <span>{t('profile.start')} {startW} kg</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{t('profile.progress', Math.round(progress))}</span>
                  <span>{t('profile.goalLabel')} {goalW} kg</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(progress, 2)}%`, background: 'var(--color-primary)', borderRadius: 3 }} />
                </div>
              </div>
            );
          })()}

          <div className="form-group">
            <label htmlFor="prof-goal">{t('profile.goal')}</label>
            <select id="prof-goal" value={form.goal} onChange={set('goal')}>
              {GOAL_KEYS.map((g) => (
                <option key={g.value} value={g.value}>{t(g.key)}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="prof-target-weight">{t('profile.goalWeight')}</label>
            <input id="prof-target-weight" type="number" step="0.1" value={form.targetWeightKg} onChange={set('targetWeightKg')} min="30" max="300" />
            {weightDiff && (
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {Math.abs(Number(weightDiff))} {t('profile.kgTo')} {Number(weightDiff) > 0 ? t('profile.lose') : t('profile.gain')}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="prof-activity">{t('profile.activityLevel')}</label>
            <select id="prof-activity" value={form.activityLevel} onChange={set('activityLevel')}>
              {ACTIVITY_LEVEL_KEYS.map((a) => (
                <option key={a.value} value={a.value}>{t(a.key)}</option>
              ))}
            </select>
          </div>

          <hr style={{ margin: 'var(--space-md) 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong>{t('profile.publicProfile')}</strong>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {t('profile.shareMealsPublicly')}
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => { setForm({ ...form, isPublic: e.target.checked }); setSuccess(''); }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {form.isPublic && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: 'var(--font-size-sm)' }}>{t('profile.followersOnly')}</strong>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {t('profile.onlyFollowersCanSee')}
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.followersOnly}
                    onChange={(e) => { setForm({ ...form, followersOnly: e.target.checked }); setSuccess(''); }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="prof-username">{t('profile.username')}</label>
                <input
                  id="prof-username"
                  type="text"
                  value={form.username}
                  onChange={set('username')}
                  placeholder={t('profile.usernamePlaceholder')}
                  minLength={3}
                  maxLength={30}
                  pattern="^[a-zA-Z0-9_]+$"
                  title={t('profile.usernameHint')}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="prof-bio">{t('profile.bio')} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>({form.bio.length}/300)</span></label>
                <textarea
                  id="prof-bio"
                  value={form.bio}
                  onChange={(e) => { if (e.target.value.length <= 300) { setForm({ ...form, bio: e.target.value }); setSuccess(''); } }}
                  placeholder={t('profile.bioPlaceholder')}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="prof-link">{t('profile.link')}</label>
                <input
                  id="prof-link"
                  type="url"
                  value={form.linkUrl}
                  onChange={set('linkUrl')}
                  placeholder={t('profile.linkPlaceholder')}
                />
              </div>
              {form.username && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('profile.yourPublicProfile')} <a href={`/u/${form.username}`} target="_blank" rel="noopener noreferrer">{window.location.origin}/u/{form.username}</a>
                </p>
              )}
            </>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? t('profile.saving') : t('profile.saveAndRecalculate')}
          </button>
        </form>

        <hr style={{ margin: 'var(--space-xl) 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary btn-block" onClick={logout}>
            {t('common.logout')}
          </button>
          <button
            className="btn btn-block"
            style={{ background: 'var(--color-danger, #EF4444)', color: '#fff' }}
            onClick={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? t('common.deleting') : t('profile.deleteAccount')}
          </button>
        </div>

        <p className="legal-links" style={{ marginTop: 'var(--space-lg)' }}>
          <Link to="/terms">{t('terms.title')}</Link>
          <span className="legal-links-sep">&middot;</span>
          <Link to="/privacy">{t('privacy.title')}</Link>
        </p>
      </div>
    </div>
  );
}
