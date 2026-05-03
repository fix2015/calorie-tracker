import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { users } from '../services/api';
import AvatarUpload from '../components/AvatarUpload';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'active', label: 'Very active' },
  { value: 'very_active', label: 'Extra active' },
];

const GOALS = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
];

export default function ProfilePage() {
  const { user, refreshUser, logout, deleteAccount } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    if (!window.confirm('This will permanently delete all your data. Continue?')) return;
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      setError(err.message || 'Failed to delete account');
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
        username: form.username || null,
        bio: form.bio || null,
        linkUrl: form.linkUrl || null,
      });
      await refreshUser();
      setSuccess('Profile saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const weightDiff = form.weightKg && form.targetWeightKg
    ? (Number(form.weightKg) - Number(form.targetWeightKg)).toFixed(1)
    : null;

  return (
    <div className="page">
      <h1 className="page-title">Profile</h1>

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
              Daily Calorie Target
            </span>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {user.dailyCalorieTarget} kcal
            </div>
            {user.weightKg && user.targetWeightKg && user.goal !== 'maintain' && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
                {user.weightKg} kg → {user.targetWeightKg} kg ({Math.abs(user.weightKg - user.targetWeightKg).toFixed(1)} kg to {user.goal === 'lose' ? 'lose' : 'gain'})
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
              setSuccess('Avatar updated!');
              setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
              setError(err.message || 'Avatar upload failed');
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
            <label htmlFor="prof-name">Name</label>
            <input id="prof-name" type="text" value={form.name} onChange={set('name')} required />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="prof-age">Age</label>
              <input id="prof-age" type="number" value={form.age} onChange={set('age')} required min="10" max="120" />
            </div>
            <div className="form-group">
              <label htmlFor="prof-gender">Gender</label>
              <select id="prof-gender" value={form.gender} onChange={set('gender')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="prof-height">Height (cm)</label>
              <input id="prof-height" type="number" value={form.heightCm} onChange={set('heightCm')} required min="100" max="250" />
            </div>
            <div className="form-group">
              <label htmlFor="prof-weight">Current Weight (kg)</label>
              <input id="prof-weight" type="number" step="0.1" value={form.weightKg} onChange={set('weightKg')} required min="30" max="300" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="prof-goal">Goal</label>
            <select id="prof-goal" value={form.goal} onChange={set('goal')}>
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {form.goal !== 'maintain' && (
            <div className="form-group">
              <label htmlFor="prof-target-weight">Target Weight (kg)</label>
              <input id="prof-target-weight" type="number" step="0.1" value={form.targetWeightKg} onChange={set('targetWeightKg')} min="30" max="300" />
              {weightDiff && (
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {Math.abs(Number(weightDiff))} kg to {Number(weightDiff) > 0 ? 'lose' : 'gain'}
                </span>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="prof-activity">Activity Level</label>
            <select id="prof-activity" value={form.activityLevel} onChange={set('activityLevel')}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          <hr style={{ margin: 'var(--space-md) 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong>Public Profile</strong>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Share your meals publicly
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
              <div className="form-group">
                <label htmlFor="prof-username">Username</label>
                <input
                  id="prof-username"
                  type="text"
                  value={form.username}
                  onChange={set('username')}
                  placeholder="your_username"
                  minLength={3}
                  maxLength={30}
                  pattern="^[a-zA-Z0-9_]+$"
                  title="Letters, numbers and underscores only"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="prof-bio">Bio <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>({form.bio.length}/300)</span></label>
                <textarea
                  id="prof-bio"
                  value={form.bio}
                  onChange={(e) => { if (e.target.value.length <= 300) { setForm({ ...form, bio: e.target.value }); setSuccess(''); } }}
                  placeholder="Tell others about your nutrition journey..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="prof-link">Link</label>
                <input
                  id="prof-link"
                  type="url"
                  value={form.linkUrl}
                  onChange={set('linkUrl')}
                  placeholder="https://example.com"
                />
              </div>
              {form.username && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Your public profile: <a href={`/u/${form.username}`} target="_blank" rel="noopener noreferrer">{window.location.origin}/u/{form.username}</a>
                </p>
              )}
            </>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? 'Saving...' : 'Save & Recalculate'}
          </button>
        </form>

        <hr style={{ margin: 'var(--space-xl) 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary btn-block" onClick={logout}>
            Logout
          </button>
          <button
            className="btn btn-block"
            style={{ background: 'var(--color-danger, #EF4444)', color: '#fff' }}
            onClick={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>

        <p className="legal-links" style={{ marginTop: 'var(--space-lg)' }}>
          <Link to="/terms">Terms of Service</Link>
          <span className="legal-links-sep">&middot;</span>
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
