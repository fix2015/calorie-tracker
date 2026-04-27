import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { meals } from '../services/api';

export default function ScanPage() {
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Weight prompt modal state
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weight, setWeight] = useState('');
  const [pendingFormData, setPendingFormData] = useState(null);

  // AI result preview (edit-before-save) state
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError('');
  };

  const submitPhoto = async (formData) => {
    setLoading(true);
    setError('');
    try {
      const res = await meals.photo(formData);

      if (res.needs_weight) {
        setPendingFormData(formData);
        setShowWeightPrompt(true);
        setLoading(false);
        return;
      }

      if (res.low_confidence) {
        const m = res.meal;
        setResult({
          name: m.name || '',
          calories: m.calories || 0,
          proteinG: m.proteinG || 0,
          carbsG: m.carbsG || 0,
          fatG: m.fatG || 0,
          saved: false,
        });
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    submitPhoto(formData);
  };

  const handleWeightSubmit = (e) => {
    e.preventDefault();
    if (!pendingFormData || !weight) return;
    pendingFormData.append('weight', weight);
    setShowWeightPrompt(false);
    setWeight('');
    submitPhoto(pendingFormData);
  };

  const handleResultSave = async () => {
    setLoading(true);
    setError('');
    try {
      await meals.manual({
        name: result.name,
        calories: Number(result.calories),
        proteinG: Number(result.proteinG),
        carbsG: Number(result.carbsG),
        fatG: Number(result.fatG),
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const updateResult = (field) => (e) => setResult({ ...result, [field]: e.target.value });

  return (
    <div className="page">
      <h1 className="page-title">Scan Food Photo</h1>

      <div className="card">
        <div className="scan-area">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {preview ? (
            <div className="photo-preview">
              <img src={preview} alt="Food preview" />
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Take a photo or select an image of your meal
            </p>
          )}

          <button
            className="camera-btn"
            onClick={() => fileRef.current?.click()}
            title="Choose photo"
          >
            📷
          </button>

          {preview && !result && (
            <button
              className="btn btn-primary btn-block"
              onClick={handleScan}
              disabled={loading}
            >
              {loading ? 'Analyzing...' : 'Analyze Photo'}
            </button>
          )}

          {loading && <div className="spinner" />}
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>

      {/* AI result preview - edit before save */}
      {result && !result.saved && (
        <div className="card" style={{ marginTop: 'var(--space-md)' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Review Result</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Low confidence detection. Please review and edit before saving.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={result.name} onChange={updateResult('name')} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Calories</label>
                <input type="number" value={result.calories} onChange={updateResult('calories')} />
              </div>
              <div className="form-group">
                <label>Protein (g)</label>
                <input type="number" value={result.proteinG} onChange={updateResult('proteinG')} />
              </div>
              <div className="form-group">
                <label>Carbs (g)</label>
                <input type="number" value={result.carbsG} onChange={updateResult('carbsG')} />
              </div>
              <div className="form-group">
                <label>Fat (g)</label>
                <input type="number" value={result.fatG} onChange={updateResult('fatG')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setResult(null)}>
                Discard
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleResultSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Meal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weight prompt modal */}
      {showWeightPrompt && (
        <div className="modal-overlay" onClick={() => setShowWeightPrompt(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Update Your Weight</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
              Your body weight helps estimate portion sizes more accurately.
            </p>
            <form onSubmit={handleWeightSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label htmlFor="weight-input">Your weight (kg)</label>
                <input
                  id="weight-input"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                  min="20"
                  max="500"
                  placeholder="e.g. 75"
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowWeightPrompt(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
