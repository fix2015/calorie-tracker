import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { reports } from '../services/api';
import MealDetailModal from '../components/MealDetailModal';
import { photoSrc } from '../services/photoUrl';
import { useTranslation } from '../i18n';

export default function ReportsPage() {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState(null);

  const fetchDaily = async (d) => {
    try {
      const res = await reports.daily(d);
      setDaily(res);
    } catch (err) {
      console.error('Failed to load daily report:', err);
      setDaily(null);
    }
  };

  const fetchWeeklyAndSuggestion = async () => {
    try {
      const [w, s] = await Promise.all([
        reports.weekly(),
        reports.suggestion(),
      ]);
      setWeekly(w.days || []);
      setSuggestion(s.suggestion || '');
    } catch (err) {
      console.error('Failed to load weekly/suggestion:', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchDaily(date), fetchWeeklyAndSuggestion()]).finally(() => setLoading(false));
  }, []);

  const handleDateChange = (e) => {
    const d = e.target.value;
    setDate(d);
    fetchDaily(d);
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;

  const totals = daily?.totals || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const dayMeals = daily?.meals || [];

  return (
    <div className="page">
      {/* Daily summary */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <h2>{t('reports.dailySummary')}</h2>
          <input
            type="date"
            value={date}
            onChange={handleDateChange}
            style={{
              padding: 'var(--space-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
            }}
          />
        </div>

        <div className="macro-bar" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="macro-item">
            <span className="macro-value">{totals.calories}</span>
            <span className="macro-label">{t('common.calories')}</span>
          </div>
          <div className="macro-item">
            <span className="macro-value">{Math.round(totals.proteinG)}g</span>
            <span className="macro-label">{t('common.protein')}</span>
          </div>
          <div className="macro-item">
            <span className="macro-value">{Math.round(totals.carbsG)}g</span>
            <span className="macro-label">{t('common.carbs')}</span>
          </div>
          <div className="macro-item">
            <span className="macro-value">{Math.round(totals.fatG)}g</span>
            <span className="macro-label">{t('common.fat')}</span>
          </div>
        </div>

        {daily?.target && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            {t('reports.targetLabel')} {daily.target} {t('common.kcal')} — {totals.calories > daily.target ? t('reports.overBy', totals.calories - daily.target) : t('reports.remaining', daily.target - totals.calories)}
          </p>
        )}

        {/* Meals for selected day */}
        {dayMeals.length > 0 && (
          <div>
            <h3 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-sm)' }}>{t('reports.mealsLabel')}</h3>
            {dayMeals.map((m) => (
              <div className="meal-item" key={m.id} onClick={() => setSelectedMeal(m)} style={{ cursor: 'pointer' }}>
                {m.photoUrl && (
                  <img
                    src={photoSrc(m.photoUrl)}
                    alt={m.name}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div className="meal-info">
                  <div className="meal-name">{m.name}</div>
                  <div className="meal-meta">
                    P {Math.round(m.proteinG)}g · C {Math.round(m.carbsG)}g · F {Math.round(m.fatG)}g
                    {' · '}
                    {new Date(m.consumedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span className="meal-cals">{m.calories}</span>
              </div>
            ))}
          </div>
        )}

        {dayMeals.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)' }}>{t('reports.noMealsForDate')}</p>
        )}
      </div>

      {/* Weekly bar chart */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <h2 style={{ marginBottom: 'var(--space-md)' }}>{t('reports.weeklyOverview')}</h2>
        {weekly.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekly}>
              <XAxis
                dataKey="date"
                tickFormatter={(d) => {
                  const dt = new Date(d + 'T00:00:00');
                  return dt.toLocaleDateString('en-US', { weekday: 'short' });
                }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString()}
                formatter={(value) => [`${value} ${t('common.kcal')}`, t('common.calories')]}
              />
              <Bar dataKey="calories" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)' }}>{t('reports.noWeeklyData')}</p>
        )}
      </div>

      {/* AI suggestion */}
      {suggestion && (
        <div className="suggestion-card">
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>💡 {t('reports.aiSuggestion')}</h3>
          <p className="suggestion-text">{suggestion}</p>
        </div>
      )}

      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          onClose={() => setSelectedMeal(null)}
          onUpdated={() => { setSelectedMeal(null); fetchDaily(date); }}
        />
      )}
    </div>
  );
}
