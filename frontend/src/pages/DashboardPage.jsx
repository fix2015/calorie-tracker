import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { reports, users } from '../services/api';
import { calcMacroTargets } from '../services/macroCalc';
import { photoSrc } from '../services/photoUrl';
import { requestNotificationPermission, startNotificationScheduler } from '../services/notifications';
import AddMealModal from '../components/AddMealModal';
import MealDetailModal from '../components/MealDetailModal';

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
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [weeklyData, setWeeklyData] = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [dashTab, setDashTab] = useState('meals');

  const target = user?.dailyCalorieTarget || 2000;
  const macroTargets = calcMacroTargets(user);

  useEffect(() => {
    requestNotificationPermission().then((granted) => {
      if (granted) startNotificationScheduler();
    });
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

  useEffect(() => {
    fetchData();
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/reports/backfill-stats`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
    }).catch(() => {}).finally(() => {
      reports.weekly().then((data) => setWeeklyData(data.days || [])).catch(() => {});
    });
    reports.weightHistory().then((data) => setWeightHistory(data.logs || [])).catch(() => {});
  }, []);

  const handleMealUpdated = () => {
    setSelectedMeal(null);
    fetchData();
  };

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
      reports.weightHistory().then((data) => setWeightHistory(data.logs || [])).catch(() => {});
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
  const ringColor = ratio > 1 ? 'var(--color-danger)' : ratio > 0.9 ? 'var(--color-warning)' : 'var(--color-primary)';
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.min(ratio, 1) * circumference;

  if (loading) return <div className="page"><div className="spinner" /></div>;

  const macros = [
    { label: 'Protein', eaten: Math.round(totals.proteinG), target: macroTargets?.proteinG || 0, color: 'var(--color-primary)' },
    { label: 'Carbs', eaten: Math.round(totals.carbsG), target: macroTargets?.carbsG || 0, color: 'var(--color-primary)' },
    { label: 'Fats', eaten: Math.round(totals.fatG), target: macroTargets?.fatG || 0, color: 'var(--color-primary)' },
  ];

  return (
    <div className="page dashboard-page">
      {/* Weigh-in prompt */}
      {needsWeighIn && !showWeighIn && (
        <div className="dash-weighin-prompt" onClick={() => { setShowWeighIn(true); setWeighInValue(user?.weightKg?.toString() || ''); }}>
          <span style={{ fontSize: 20 }}>⚖️</span>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 'var(--font-size-sm)' }}>Weekly weigh-in</strong>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>Tap to update your weight</p>
          </div>
          <span style={{ color: 'var(--color-text-secondary)' }}>›</span>
        </div>
      )}

      {showWeighIn && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>Update Weight</h3>
          <form onSubmit={handleWeighIn} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="weigh-in">Weight (kg)</label>
              <input id="weigh-in" type="number" step="0.1" min="20" max="500" value={weighInValue} onChange={e => setWeighInValue(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={weighInLoading}>{weighInLoading ? '...' : 'Save'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowWeighIn(false)}>Cancel</button>
          </form>
        </div>
      )}

      {/* Today card — ring + macros side by side */}
      <div className="card dash-today-card">
        <div className="dash-today-header">
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Today</h2>
          <button className="dash-edit-goal" onClick={() => navigate('/profile')}>Edit goal</button>
        </div>

        <div className="dash-today-content">
          <div className="dash-ring-wrap">
            <div className="calorie-ring" style={{ width: 130, height: 130 }}>
              <svg viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-bg)" strokeWidth="10" />
                <circle cx="80" cy="80" r={radius} fill="none" stroke={ringColor} strokeWidth="10"
                  strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                />
              </svg>
              <div className="calorie-ring-center">
                <div className="amount">{consumed}</div>
                <div className="label">/ {target} kcal</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>Consumed</div>
              </div>
            </div>
          </div>

          <div className="dash-macros">
            {macros.map(({ label, eaten, target: t, color }) => (
              <div key={label} className="dash-macro-row">
                <div className="dash-macro-top">
                  <span className="dash-macro-label">{label}</span>
                  <span className="dash-macro-value"><strong>{eaten}</strong> / {t}g</span>
                </div>
                <div className="dash-macro-bar-bg">
                  <div className="dash-macro-bar-fill" style={{ width: `${t > 0 ? Math.min((eaten / t) * 100, 100) : 0}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-quick-stats">
          <div className="dash-stat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
            <strong>{todayMeals.length}</strong>
            <span>Meals</span>
          </div>
          <div className="dash-stat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <strong>{Math.max(0, target - consumed)}</strong>
            <span>Remaining</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dash-tabs">
        <button className={`dash-tab${dashTab === 'meals' ? ' active' : ''}`} onClick={() => setDashTab('meals')}>Meals</button>
        <button className={`dash-tab${dashTab === 'reports' ? ' active' : ''}`} onClick={() => setDashTab('reports')}>Reports</button>
      </div>

      {/* Tab: Meals */}
      {dashTab === 'meals' && (
        <>
          <div className="dash-actions">
            <button className="action-btn action-btn-follow" style={{ flex: 1 }} onClick={() => setShowAddMeal(true)}>
              + Add Meal
            </button>
            <button className="action-btn action-btn-share" style={{ flex: 1 }} onClick={() => navigate('/scan')}>
              Scan Photo
            </button>
          </div>

          <button
            className="ai-analyze-btn"
            onClick={async () => {
              setAiLoading(true);
              setShowAnalysis(true);
              setAiAnalysis(null);
              try {
                const res = await reports.analyze();
                setAiAnalysis(res.analysis);
              } catch (err) {
                setAiAnalysis(err.message || 'Analysis failed.');
              } finally {
                setAiLoading(false);
              }
            }}
            disabled={aiLoading}
          >
            <span className="ai-analyze-icon">✦</span>
            <span>AI Nutrition Analysis</span>
          </button>

          <div className="card">
            <h2 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-lg)' }}>Recent meals</h2>
            {todayMeals.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-md) 0', textAlign: 'center' }}>No meals logged today</p>
            ) : todayMeals.map((m) => (
              <div className="dash-meal-item" key={m.id} onClick={() => setSelectedMeal(m)}>
                {m.photoUrl ? (
                  <img src={photoSrc(m.photoUrl)} alt={m.name} className="dash-meal-img" />
                ) : (
                  <div className="dash-meal-img-placeholder">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
                  </div>
                )}
                <div className="dash-meal-info">
                  <span className="dash-meal-name">{m.name}</span>
                  <span className="dash-meal-meta">
                    {m.source === 'photo_ai' && 'AI · '}
                    P {Math.round(m.proteinG)}g · C {Math.round(m.carbsG)}g · F {Math.round(m.fatG)}g
                  </span>
                </div>
                <div className="dash-meal-right">
                  <span className="dash-meal-cals">{m.calories} kcal</span>
                  <span className="dash-meal-time">{new Date(m.consumedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tab: Reports */}
      {dashTab === 'reports' && (
        <>
          {/* Calorie intake chart */}
          {weeklyData.length > 0 && (() => {
            const maxCal = Math.max(...weeklyData.map(d => d.totals?.calories || 0), target, 1);
            const today = new Date().toDateString();
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return (
              <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="dash-today-header">
                  <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Calorie intake</h2>
                  <button className="dash-edit-goal" onClick={() => navigate('/reports')}>View more</button>
                </div>
                <div className="dash-chart">
                  <div className="dash-chart-y">
                    <span>{Math.round(maxCal / 1000)}k</span>
                    <span>{Math.round(maxCal / 2000)}k</span>
                    <span>0</span>
                  </div>
                  <div className="dash-chart-bars">
                    <div className="dash-chart-target" style={{ bottom: `${(target / maxCal) * 100}%` }} />
                    {weeklyData.map((d) => {
                      const isToday = new Date(d.date).toDateString() === today;
                      const cal = d.totals?.calories || 0;
                      const height = maxCal > 0 ? (cal / maxCal) * 100 : 0;
                      const dayName = dayNames[new Date(d.date).getDay()];
                      return (
                        <div key={d.date} className="dash-chart-col">
                          <div className="dash-chart-bar-wrap">
                            <div
                              className={`dash-chart-bar${isToday ? ' today' : ''}`}
                              style={{ height: `${Math.max(height, 2)}%` }}
                            />
                          </div>
                          <span className={`dash-chart-label${isToday ? ' today' : ''}`}>{dayName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Weight progress */}
          {user?.weightKg && user?.targetWeightKg && (() => {
            const current = user.weightKg;
            const goalW = user.targetWeightKg;
            const startW = weightHistory.length > 0 ? weightHistory[0].weightKg : current;
            const totalDiff = Math.abs(startW - goalW);
            const remaining = Math.abs(current - goalW);
            const progress = totalDiff > 0 ? Math.min(((totalDiff - remaining) / totalDiff) * 100, 100) : 0;

            return (
              <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="dash-today-header">
                  <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Weight progress</h2>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', fontWeight: 600 }}>
                    {remaining.toFixed(1)} kg to go
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 'var(--space-md) 0 var(--space-sm)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Current</div>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{current} kg</div>
                  </div>
                  <div style={{ flex: 1, margin: '0 var(--space-md)', position: 'relative' }}>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--color-bg)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(progress, 2)}%`, background: 'var(--color-primary)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      {Math.round(progress)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Goal</div>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>{goalW} kg</div>
                  </div>
                </div>

                {weightHistory.length >= 2 && (() => {
                  const weights = weightHistory.map(l => l.weightKg);
                  const minW = Math.min(...weights, goalW) - 1;
                  const maxW = Math.max(...weights) + 1;
                  const range = maxW - minW || 1;
                  const chartW = 100;
                  const chartH = 60;
                  const points = weightHistory.map((l, i) => {
                    const x = weightHistory.length > 1 ? (i / (weightHistory.length - 1)) * chartW : chartW / 2;
                    const y = chartH - ((l.weightKg - minW) / range) * chartH;
                    return `${x},${y}`;
                  }).join(' ');
                  const goalY = chartH - ((goalW - minW) / range) * chartH;

                  return (
                    <div style={{ marginTop: 'var(--space-sm)' }}>
                      <svg viewBox={`-2 -2 ${chartW + 4} ${chartH + 4}`} style={{ width: '100%', height: 80 }} preserveAspectRatio="none">
                        <line x1="0" y1={goalY} x2={chartW} y2={goalY} stroke="var(--color-primary)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
                        <polyline points={points} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                        {weightHistory.map((l, i) => {
                          const x = weightHistory.length > 1 ? (i / (weightHistory.length - 1)) * chartW : chartW / 2;
                          const y = chartH - ((l.weightKg - minW) / range) * chartH;
                          return <circle key={i} cx={x} cy={y} r="1.5" fill="var(--color-primary)" />;
                        })}
                      </svg>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        <span>{new Date(weightHistory[0].createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <span>{new Date(weightHistory[weightHistory.length - 1].createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  );
                })()}

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 'var(--space-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xs)' }}
                  onClick={() => { setShowWeighIn(true); setWeighInValue(user?.weightKg?.toString() || ''); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Update weight
                </button>
              </div>
            );
          })()}
        </>
      )}

      {/* AI Analysis modal */}
      {showAnalysis && (
        <div className="modal-overlay" onClick={() => setShowAnalysis(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2 style={{ margin: 0 }}>AI Analysis</h2>
              <button onClick={() => setShowAnalysis(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>&times;</button>
            </div>
            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                <div className="spinner" />
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-md)' }}>Analyzing your nutrition...</p>
              </div>
            ) : (
              <div className="ai-analysis-content">
                {aiAnalysis && aiAnalysis.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddMeal && (
        <AddMealModal onClose={() => setShowAddMeal(false)} onSaved={() => { setShowAddMeal(false); fetchData(); }} />
      )}

      {selectedMeal && (
        <MealDetailModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} onUpdated={handleMealUpdated} />
      )}
    </div>
  );
}
