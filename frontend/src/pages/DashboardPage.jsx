import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { reports, users } from '../services/api';
import { calcMacroTargets, MOTIVATION_QUOTES } from '../services/macroCalc';
import { buildDailySummaryShareText, shareText } from '../services/share';
import AddMealModal from '../components/AddMealModal';
import MealDetailModal from '../components/MealDetailModal';

const UPLOAD_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showWeighIn, setShowWeighIn] = useState(false);
  const [weighInValue, setWeighInValue] = useState('');
  const [weighInLoading, setWeighInLoading] = useState(false);
  const [motivation, setMotivation] = useState(
    () => MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)]
  );

  const target = user?.dailyCalorieTarget || 2000;
  const macroTargets = calcMacroTargets(user);

  // Motivation banner — auto-dismiss after 10s
  useEffect(() => {
    const timer = setTimeout(() => setMotivation(null), 10000);
    return () => clearTimeout(timer);
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const report = await reports.daily(today);
      setDaily(report);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleMealUpdated = () => {
    setSelectedMeal(null);
    fetchData();
  };

  // Check if weigh-in is needed (>7 days since last update)
  const needsWeighIn = user?.weightUpdatedAt
    ? (Date.now() - new Date(user.weightUpdatedAt).getTime()) > 7 * 24 * 60 * 60 * 1000
    : true;

  const handleWeighIn = async (e) => {
    e.preventDefault();
    if (!weighInValue) return;
    setWeighInLoading(true);
    try {
      await users.updateProfile({ weightKg: Number(weighInValue) });
      await refreshUser();
      setShowWeighIn(false);
      setWeighInValue('');
    } catch (err) {
      console.error('Weigh-in failed:', err);
    } finally {
      setWeighInLoading(false);
    }
  };

  const totals = daily?.totals || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const todayMeals = daily?.meals || [];
  const consumed = totals.calories;

  const ratio = target > 0 ? consumed / target : 0;
  const ringColor = ratio > 1 ? 'var(--color-danger)' : ratio > 0.9 ? 'var(--color-warning)' : 'var(--color-success)';
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.min(ratio, 1) * circumference;

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      {/* Motivation banner */}
      {motivation && (
        <div className="motivation-banner">
          <span className="motivation-text">{motivation}</span>
          <button className="motivation-close" onClick={() => setMotivation(null)} aria-label="Close">
            &times;
          </button>
        </div>
      )}

      <h1 className="page-title">Dashboard</h1>

      {/* Weigh-in prompt */}
      {needsWeighIn && !showWeighIn && (
        <div style={{
          background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
        }}>
          <span style={{ fontSize: 24 }}>⚖️</span>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 'var(--font-size-sm)' }}>Time for a weigh-in!</strong>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Update your weight to keep your calorie target accurate.
            </p>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 'var(--font-size-sm)', padding: '6px 12px', minHeight: 36 }} onClick={() => { setShowWeighIn(true); setWeighInValue(user?.weightKg?.toString() || ''); }}>
            Update
          </button>
        </div>
      )}

      {showWeighIn && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>⚖️ Weekly Weigh-in</h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            {user?.targetWeightKg && user?.goal !== 'maintain'
              ? `Current: ${user.weightKg} kg → Target: ${user.targetWeightKg} kg`
              : `Last recorded: ${user?.weightKg || '—'} kg`
            }
          </p>
          <form onSubmit={handleWeighIn} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="weigh-in">New weight (kg)</label>
              <input id="weigh-in" type="number" step="0.1" min="20" max="500" value={weighInValue} onChange={e => setWeighInValue(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={weighInLoading} style={{ marginBottom: 1 }}>
              {weighInLoading ? '...' : 'Save'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowWeighIn(false)} style={{ marginBottom: 1 }}>
              Skip
            </button>
          </form>
        </div>
      )}

      {/* Calorie ring */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
        <div className="calorie-ring">
          <svg viewBox="0 0 160 160">
            <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="12" />
            <circle cx="80" cy="80" r={radius} fill="none" stroke={ringColor} strokeWidth="12"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            />
          </svg>
          <div className="calorie-ring-center">
            <div className="amount">{consumed}</div>
            <div className="label">/ {target} kcal</div>
          </div>
        </div>

      </div>

      {/* Macro target cards */}
      <div className="macro-cards">
        {[
          { label: 'Protein', eaten: Math.round(totals.proteinG), target: macroTargets?.proteinG, color: '#8B5CF6', unit: 'g' },
          { label: 'Carbs', eaten: Math.round(totals.carbsG), target: macroTargets?.carbsG, color: '#F59E0B', unit: 'g' },
          { label: 'Fat', eaten: Math.round(totals.fatG), target: macroTargets?.fatG, color: '#10B981', unit: 'g' },
        ].map(({ label, eaten, target: t, color, unit }) => {
          const goal = t || 0;
          const remaining = Math.max(0, goal - eaten);
          const ratio = goal > 0 ? Math.min(eaten / goal, 1) : 0;
          const r = 28;
          const circ = 2 * Math.PI * r;
          const off = circ - ratio * circ;
          return (
            <div className="macro-card" key={label}>
              <div className="macro-card-ring">
                <svg viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
                  <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
                    strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                </svg>
                <span className="macro-card-pct">{goal > 0 ? Math.round((eaten / goal) * 100) : 0}%</span>
              </div>
              <div className="macro-card-info">
                <span className="macro-card-label">{label}</span>
                <span className="macro-card-value">{eaten}{unit} <span className="macro-card-sep">/</span> {goal}{unit}</span>
                <span className="macro-card-remaining">{remaining}{unit} left</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAddMeal(true)}>
          + Add Meal
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/scan')}>
          📷 Scan Photo
        </button>
        <button className="btn btn-secondary" style={{ minWidth: 44 }} onClick={async () => {
          const text = buildDailySummaryShareText(totals, todayMeals, target);
          const result = await shareText(text, "Today's Nutrition");
          if (result === 'copied') alert('Copied to clipboard!');
        }} aria-label="Share today's summary" title="Share today's summary">
          ↗
        </button>
      </div>

      {/* Today's meals */}
      <div className="card">
        <h2 style={{ marginBottom: 'var(--space-sm)' }}>Today's Meals</h2>
        {todayMeals.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-md) 0' }}>
            No meals logged today.
          </p>
        )}
        {todayMeals.map((m) => (
          <div className="meal-item" key={m.id} onClick={() => setSelectedMeal(m)} style={{ cursor: 'pointer' }}>
            {m.photoUrl && (
              <img
                src={`${UPLOAD_BASE}${m.photoUrl}`}
                alt={m.name}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            )}
            <div className="meal-info">
              <div className="meal-name">
                {m.name}
                {m.source === 'photo_ai' && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-light)', marginLeft: 4 }}>AI</span>
                )}
              </div>
              <div className="meal-meta">
                P {Math.round(m.proteinG)}g · C {Math.round(m.carbsG)}g · F {Math.round(m.fatG)}g
                {' · '}
                {new Date(m.consumedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <span className="meal-cals">{m.calories} kcal</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginLeft: 4 }}>›</span>
          </div>
        ))}
      </div>

      {showAddMeal && (
        <AddMealModal
          onClose={() => setShowAddMeal(false)}
          onSaved={() => { setShowAddMeal(false); fetchData(); }}
        />
      )}

      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          onClose={() => setSelectedMeal(null)}
          onUpdated={handleMealUpdated}
        />
      )}
    </div>
  );
}
