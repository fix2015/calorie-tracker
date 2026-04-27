import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { reports } from '../services/api';

export default function ReportsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(true);

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
      setWeekly(w.days || w);
      setSuggestion(s.suggestion || s.text || '');
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

  if (loading) {
    return <div className="page"><div className="spinner" /></div>;
  }

  return (
    <div className="page">
      <h1 className="page-title">Reports</h1>

      {/* Daily report */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <h2>Daily Summary</h2>
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

        {daily ? (
          <div className="macro-bar">
            <div className="macro-item">
              <span className="macro-value">{daily.totalCalories || 0}</span>
              <span className="macro-label">Calories</span>
            </div>
            <div className="macro-item">
              <span className="macro-value">{daily.totalProtein || 0}g</span>
              <span className="macro-label">Protein</span>
            </div>
            <div className="macro-item">
              <span className="macro-value">{daily.totalCarbs || 0}g</span>
              <span className="macro-label">Carbs</span>
            </div>
            <div className="macro-item">
              <span className="macro-value">{daily.totalFat || 0}g</span>
              <span className="macro-label">Fat</span>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)' }}>No data for this date.</p>
        )}
      </div>

      {/* Weekly bar chart */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <h2 style={{ marginBottom: 'var(--space-md)' }}>Weekly Overview</h2>
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
                formatter={(value) => [`${value} kcal`, 'Calories']}
              />
              <Bar dataKey="calories" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)' }}>No weekly data yet.</p>
        )}
      </div>

      {/* AI suggestion */}
      {suggestion && (
        <div className="suggestion-card">
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>AI Suggestion</h3>
          <p className="suggestion-text">{suggestion}</p>
        </div>
      )}
    </div>
  );
}
