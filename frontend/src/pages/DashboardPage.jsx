import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { meals, reports } from '../services/api';
import AddMealModal from '../components/AddMealModal';
import MealDetailModal from '../components/MealDetailModal';

const UPLOAD_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);

  const target = user?.dailyCalorieTarget || 2000;

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
      <h1 className="page-title">Dashboard</h1>

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

        <div className="macro-bar" style={{ marginTop: 'var(--space-md)' }}>
          <div className="macro-item">
            <span className="macro-value">{Math.round(totals.proteinG)}g</span>
            <span className="macro-label">Protein</span>
          </div>
          <div className="macro-item">
            <span className="macro-value">{Math.round(totals.carbsG)}g</span>
            <span className="macro-label">Carbs</span>
          </div>
          <div className="macro-item">
            <span className="macro-value">{Math.round(totals.fatG)}g</span>
            <span className="macro-label">Fat</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAddMeal(true)}>
          + Add Meal
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/scan')}>
          📷 Scan Photo
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
