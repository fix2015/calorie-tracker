import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary (little or no exercise)' },
  { value: 'light', label: 'Lightly active (1-3 days/week)' },
  { value: 'moderate', label: 'Moderately active (3-5 days/week)' },
  { value: 'active', label: 'Very active (6-7 days/week)' },
  { value: 'extra', label: 'Extra active (physical job + exercise)' },
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

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    age: '',
    gender: 'male',
    height: '',
    weight: '',
    activityLevel: 'moderate',
    goal: 'maintain',
  });

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const next = () => {
    setError('');
    if (step === 1) {
      if (!form.name || !form.email || !form.password) {
        setError('All fields are required');
        return;
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }
    if (step === 2) {
      if (!form.age || !form.height || !form.weight) {
        setError('All fields are required');
        return;
      }
    }
    setStep(step + 1);
  };

  const back = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        ...form,
        age: Number(form.age),
        height: Number(form.height),
        weight: Number(form.weight),
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <h1 className="page-title" style={{ textAlign: 'center' }}>Create Account</h1>

        <div className="steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`} />
          <div className={`step ${step >= 2 ? 'active' : ''}`} />
          <div className={`step ${step >= 3 ? 'active' : ''}`} />
        </div>

        {error && <p className="error-text" style={{ marginBottom: 'var(--space-md)' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {step === 1 && (
            <>
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
                <input id="reg-password" type="password" value={form.password} onChange={set('password')} required placeholder="Min 6 characters" />
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
                <label htmlFor="height">Height (cm)</label>
                <input id="height" type="number" value={form.height} onChange={set('height')} required min="100" max="250" />
              </div>
              <div className="form-group">
                <label htmlFor="weight">Weight (kg)</label>
                <input id="weight" type="number" value={form.weight} onChange={set('weight')} required min="30" max="300" />
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
                <label htmlFor="activityLevel">Activity Level</label>
                <select id="activityLevel" value={form.activityLevel} onChange={set('activityLevel')}>
                  {ACTIVITY_LEVELS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="goal">Goal</label>
                <select id="goal" value={form.goal} onChange={set('goal')}>
                  {GOALS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={back}>Back</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </>
          )}
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
