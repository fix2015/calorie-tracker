import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { users } from '../services/api';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary (little or no exercise)' },
  { value: 'light', label: 'Lightly active (1-3 days/week)' },
  { value: 'moderate', label: 'Moderately active (3-5 days/week)' },
  { value: 'active', label: 'Very active (6-7 days/week)' },
  { value: 'very_active', label: 'Extra active (physical job + exercise)' },
];

const GOALS = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

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
        setError('All fields are required');
        return;
      }
      if (form.password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    }
    if (step === 2) {
      if (!form.age || !form.heightCm || !form.weightKg) {
        setError('All fields are required');
        return;
      }
    }
    if (step === 3) {
      if (!form.goal) {
        setError('Please select a goal');
        return;
      }
      if (form.goal !== 'maintain' && !form.targetWeightKg) {
        setError('Please enter your target weight');
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
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const weightDiff = form.weightKg && form.targetWeightKg
    ? Math.abs(Number(form.weightKg) - Number(form.targetWeightKg)).toFixed(1)
    : null;

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <h1 className="page-title" style={{ textAlign: 'center' }}>Create Account</h1>

        <div className="steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`} />
          <div className={`step ${step >= 2 ? 'active' : ''}`} />
          <div className={`step ${step >= 3 ? 'active' : ''}`} />
          <div className={`step ${step >= 4 ? 'active' : ''}`} />
        </div>

        <p className={`error-text${error ? ' visible' : ''}`} style={{ marginBottom: error ? 'var(--space-md)' : 0 }}><span>{error}</span></p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>Add photo (optional)</p>
              </div>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input id="name" type="text" value={form.name} onChange={set('name')} required placeholder="Your name" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-email">Email</label>
                <input id="reg-email" type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" />
              </div>
              <div className="form-group">
                <label htmlFor="reg-password">Password</label>
                <input id="reg-password" type="password" value={form.password} onChange={set('password')} required placeholder="Min 8 characters" />
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={next}>Next</button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-group">
                <label htmlFor="age">Age</label>
                <input id="age" type="number" value={form.age} onChange={set('age')} required min="10" max="120" />
              </div>
              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select id="gender" value={form.gender} onChange={set('gender')}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="heightCm">Height (cm)</label>
                <input id="heightCm" type="number" value={form.heightCm} onChange={set('heightCm')} required min="100" max="250" />
              </div>
              <div className="form-group">
                <label htmlFor="weightKg">Current Weight (kg)</label>
                <input id="weightKg" type="number" step="0.1" value={form.weightKg} onChange={set('weightKg')} required min="30" max="300" />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={back}>Back</button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={next}>Next</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-group">
                <label htmlFor="goal">What's your goal?</label>
                <select id="goal" value={form.goal} onChange={set('goal')}>
                  {GOALS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              {form.goal !== 'maintain' && (
                <div className="form-group">
                  <label htmlFor="targetWeightKg">Target Weight (kg)</label>
                  <input id="targetWeightKg" type="number" step="0.1" value={form.targetWeightKg} onChange={set('targetWeightKg')} required min="30" max="300" placeholder={form.goal === 'lose' ? 'Your goal weight' : 'Your goal weight'} />
                  {weightDiff && (
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {form.goal === 'lose' ? `${weightDiff} kg to lose` : `${weightDiff} kg to gain`}
                    </span>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="activityLevel">Activity Level</label>
                <select id="activityLevel" value={form.activityLevel} onChange={set('activityLevel')}>
                  {ACTIVITY_LEVELS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={back}>Back</button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={next}>Next</button>
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
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>Your daily calorie target will be</p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>calculated based on your profile.</p>
                <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                  <p>📊 Current: <strong>{form.weightKg} kg</strong></p>
                  {form.goal !== 'maintain' && <p>🎯 Target: <strong>{form.targetWeightKg} kg</strong></p>}
                  <p>🏃 Activity: <strong>{ACTIVITY_LEVELS.find(a => a.value === form.activityLevel)?.label}</strong></p>
                  <p>📎 Goal: <strong>{GOALS.find(g => g.value === form.goal)?.label}</strong></p>
                </div>
                <p style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  We'll ask you to weigh in periodically to keep your calories on track.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={back}>Back</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Creating...' : 'Start Tracking'}
                </button>
              </div>
            </>
          )}
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

        <p className="legal-links">
          By signing up, you agree to our{' '}
          <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>
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
