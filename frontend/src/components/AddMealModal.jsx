import { useState } from 'react';
import { meals } from '../services/api';

export default function AddMealModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.calories) {
      setError('Name and calories are required');
      return;
    }

    setLoading(true);
    try {
      await meals.manual({
        name: form.name,
        calories: Number(form.calories),
        proteinG: Number(form.proteinG) || 0,
        carbsG: Number(form.carbsG) || 0,
        fatG: Number(form.fatG) || 0,
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to add meal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add Meal</h2>

        <p className={`error-text${error ? ' visible' : ''}`} style={{ marginBottom: error ? 'var(--space-md)' : 0 }}><span>{error}</span></p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label htmlFor="meal-name">Meal Name</label>
            <input
              id="meal-name"
              type="text"
              value={form.name}
              onChange={set('name')}
              required
              placeholder="e.g. Grilled chicken salad"
            />
          </div>

          <div className="form-group">
            <label htmlFor="meal-cal">Calories</label>
            <input
              id="meal-cal"
              type="number"
              value={form.calories}
              onChange={set('calories')}
              required
              min="0"
              placeholder="kcal"
            />
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label htmlFor="meal-protein">Protein (g)</label>
              <input id="meal-protein" type="number" value={form.proteinG} onChange={set('proteinG')} min="0" />
            </div>
            <div className="form-group">
              <label htmlFor="meal-carbs">Carbs (g)</label>
              <input id="meal-carbs" type="number" value={form.carbsG} onChange={set('carbsG')} min="0" />
            </div>
            <div className="form-group">
              <label htmlFor="meal-fat">Fat (g)</label>
              <input id="meal-fat" type="number" value={form.fatG} onChange={set('fatG')} min="0" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Adding...' : 'Add Meal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
