import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { meals, reports } from '../services/api';
import AddMealModal from '../components/AddMealModal';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayMeals, setTodayMeals] = useState([]);
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddMeal, setShowAddMeal] = useState(false);

  const target = user?.dailyCalorieTarget || 2000;

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [mealList, report] = await Promise.all([
        meals.list(today, today),
        reports.daily(today),
      ]);
      setTodayMeals(mealList.meals || mealList);
      setDaily(report);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    try {
      await meals.remove(id);
      fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const consumed = daily?.totalCalories || 0;
  const protein = daily?.totalProtein || 0;
  const carbs = daily?.totalCarbs || 0;
  const fat = daily?.totalFat || 0;

  const ratio = target > 0 ? consumed / target : 0;
  const ringColor = ratio > 1 ? 'var(--color-danger)' : ratio > 0.9 ? 'var(--color-warning)' : 'var(--color-success)';

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.min(ratio, 1) * circumference;

  if (loading) {
    return <div className="page"><div className="spinner" /></div>;
  }

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      <div className="card" style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
        <div className="calorie-ring">
          <svg viewBox="0 0 160 160">
            <circle
              cx="80" cy="80" r={radius}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="12"
            />
            <circle
              cx="80" cy="80" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="calorie-ring-center">
            <div className="amount">{consumed}</div>
            <div className="label">/ {target} kcal</div>
          </div>
        </div>

        <div className="macro-bar" style={{ marginTop: 'var(--space-md)' }}>
          <div className="macro-item">
            <span className="macro-value">{protein}g</span>
            <span className="macro-label">Protein</span>
          </div>
          <div className="macro-item">
            <span className="macro-value">{carbs}g</span>
            <span className="macro-label">Carbs</span>
          </div>
          <div className="macro-item">
            <span className="macro-value">{fat}g</span>
            <span className="macro-label">Fat</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAddMeal(true)}>
          + Add Meal
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/scan')}>
          Scan Photo
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 'var(--space-sm)' }}>Today's Meals</h2>
        {todayMeals.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-md) 0' }}>
            No meals logged today.
          </p>
        )}
        {todayMeals.map((m) => (
          <div className="meal-item" key={m._id || m.id}>
            <div className="meal-info">
              <div className="meal-name">{m.name}</div>
              <div className="meal-meta">
                P {m.protein || 0}g &middot; C {m.carbs || 0}g &middot; F {m.fat || 0}g
              </div>
            </div>
            <span className="meal-cals">{m.calories} kcal</span>
            <button className="meal-delete" onClick={() => handleDelete(m._id || m.id)} title="Delete meal">
              &times;
            </button>
          </div>
        ))}
      </div>

      {showAddMeal && (
        <AddMealModal
          onClose={() => setShowAddMeal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
