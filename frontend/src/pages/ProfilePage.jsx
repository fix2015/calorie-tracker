import { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import { users } from '../services/api';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'active', label: 'Very active' },
  { value: 'extra', label: 'Extra active' },
];

const GOALS = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'male',
    height: '',
    weight: '',
    activityLevel: 'moderate',
    goal: 'maintain',
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        age: user.age || '',
        gender: user.gender || 'male',
        height: user.height || '',
        weight: user.weight || '',
        activityLevel: user.activityLevel || 'moderate',
        goal: user.goal || 'maintain',
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
        ...form,
        age: Number(form.age),
        height: Number(form.height),
        weight: Number(form.weight),
      });
      await refreshUser();
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Profile</h1>

      <div className="card" style={{ maxWidth: 560 }}>
        {user?.dailyCalorieTarget && (
          <div style={{
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
            marginBottom: 'var(--space-lg)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Daily Calorie Target
            </span>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {user.dailyCalorieTarget} kcal
            </div>
          </div>
        )}

        {error && <p className="error-text" style={{ marginBottom: 'var(--space-md)' }}>{error}</p>}
        {success && <p style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>{success}</p>}

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
              <input id="prof-height" type="number" value={form.height} onChange={set('height')} required min="100" max="250" />
            </div>
            <div className="form-group">
              <label htmlFor="prof-weight">Weight (kg)</label>
              <input id="prof-weight" type="number" value={form.weight} onChange={set('weight')} required min="30" max="300" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="prof-activity">Activity Level</label>
            <select id="prof-activity" value={form.activityLevel} onChange={set('activityLevel')}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="prof-goal">Goal</label>
            <select id="prof-goal" value={form.goal} onChange={set('goal')}>
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
