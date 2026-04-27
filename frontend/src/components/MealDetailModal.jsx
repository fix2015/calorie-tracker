import { useState } from 'react';
import { meals } from '../services/api';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export default function MealDetailModal({ meal, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: meal.name,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await meals.update(meal.id, {
        name: form.name,
        calories: Number(form.calories),
        proteinG: Number(form.proteinG),
        carbsG: Number(form.carbsG),
        fatG: Number(form.fatG),
      });
      onUpdated();
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this meal?')) return;
    setLoading(true);
    try {
      await meals.remove(meal.id);
      onUpdated();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const time = new Date(meal.consumedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date(meal.consumedAt).toLocaleDateString();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>

        {/* Photo */}
        {meal.photoUrl && (
          <div style={{
            margin: 'calc(-1 * var(--space-xl)) calc(-1 * var(--space-xl)) var(--space-md)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            overflow: 'hidden',
            maxHeight: 260,
          }}>
            <img
              src={`${API_BASE}${meal.photoUrl}`}
              alt={meal.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        {!editing ? (
          <>
            {/* Detail view */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
              <div>
                <h2 style={{ marginBottom: 2 }}>{meal.name}</h2>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {date} at {time}
                  {meal.source === 'photo_ai' && (
                    <span style={{ color: 'var(--color-primary)', marginLeft: 8 }}>📷 AI scanned</span>
                  )}
                </p>
              </div>
              <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
                {meal.calories} kcal
              </span>
            </div>

            {meal.aiConfidence != null && (
              <p style={{
                fontSize: 'var(--font-size-xs)',
                color: meal.aiConfidence > 0.7 ? 'var(--color-success)' : 'var(--color-warning)',
                marginBottom: 'var(--space-md)',
              }}>
                AI confidence: {Math.round(meal.aiConfidence * 100)}%
              </p>
            )}

            <div className="macro-bar" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="macro-item">
                <span className="macro-value">{Math.round(meal.proteinG)}g</span>
                <span className="macro-label">Protein</span>
              </div>
              <div className="macro-item">
                <span className="macro-value">{Math.round(meal.carbsG)}g</span>
                <span className="macro-label">Carbs</span>
              </div>
              <div className="macro-item">
                <span className="macro-value">{Math.round(meal.fatG)}g</span>
                <span className="macro-label">Fat</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(true)}>
                ✏️ Edit
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete} disabled={loading}>
                🗑️ Delete
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Edit form */}
            <h2 style={{ marginBottom: 'var(--space-md)' }}>Edit Meal</h2>
            {error && <p className="error-text" style={{ marginBottom: 'var(--space-sm)' }}>{error}</p>}
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={form.name} onChange={set('name')} required />
              </div>
              <div className="form-group">
                <label>Calories</label>
                <input type="number" value={form.calories} onChange={set('calories')} required min="0" />
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label>Protein (g)</label>
                  <input type="number" value={form.proteinG} onChange={set('proteinG')} min="0" />
                </div>
                <div className="form-group">
                  <label>Carbs (g)</label>
                  <input type="number" value={form.carbsG} onChange={set('carbsG')} min="0" />
                </div>
                <div className="form-group">
                  <label>Fat (g)</label>
                  <input type="number" value={form.fatG} onChange={set('fatG')} min="0" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Saving...' : '✓ Save'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
