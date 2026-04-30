import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { meals } from '../services/api';
import { resizeImage } from '../services/imageResize';
import { photoSrc } from '../services/photoUrl';

export default function ScanPage() {
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [context, setContext] = useState('');
  const [showContextTip, setShowContextTip] = useState(false);
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weight, setWeight] = useState('');
  const [pendingBlob, setPendingBlob] = useState(null);

  // Result screen — shown for both high and low confidence
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setEditing(false);
    setError('');
    setContext('');
  };

  const submitPhoto = async (blob, extraWeight) => {
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('photo', blob, 'meal.jpg');
      if (extraWeight) formData.append('weight', extraWeight);
      if (context.trim()) formData.append('context', context.trim());

      const res = await meals.photo(formData);

      if (res.needs_weight) {
        setPendingBlob(blob);
        setShowWeightPrompt(true);
        setLoading(false);
        return;
      }

      const m = res.meal;
      setResult({
        id: m.id,
        name: m.name,
        calories: m.calories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
        photoUrl: m.photoUrl,
        confidence: m.aiConfidence,
        lowConfidence: res.low_confidence,
      });
      if (res.low_confidence) setEditing(true);
    } catch (err) {
      setError(err.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setLoading(true);
    const blob = await resizeImage(file);
    submitPhoto(blob);
  };

  const handleWeightSubmit = (e) => {
    e.preventDefault();
    if (!pendingBlob || !weight) return;
    setShowWeightPrompt(false);
    submitPhoto(pendingBlob, weight);
    setWeight('');
  };

  const handleSaveEdited = async () => {
    setLoading(true);
    setError('');
    try {
      // Delete the AI-created meal and save the edited version
      if (result.id) await meals.remove(result.id);
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

  const updateField = (field) => (e) => setResult({ ...result, [field]: e.target.value });

  return (
    <div className="page">
      <h1 className="page-title">Scan Food Photo</h1>

      {/* Camera / file selection */}
      {!result && (
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

            {preview && (
              <>
                <div className="form-group" style={{ width: '100%' }}>
                  <label htmlFor="meal-context" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    Additional info
                    <span
                      className="context-help-icon"
                      onClick={() => setShowContextTip(!showContextTip)}
                      role="button"
                      tabIndex={0}
                    >
                      ?
                    </span>
                  </label>
                  {showContextTip && (
                    <p className="context-help-tip">
                      Help the AI be more accurate! Mention things like: portion size, cooking method, sauce/dressing, number of servings, or specific ingredients the photo can't show.
                    </p>
                  )}
                  <input
                    id="meal-context"
                    type="text"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g. 2 eggs, cooked in olive oil, with side salad"
                  />
                </div>
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleScan}
                  disabled={loading}
                >
                  {loading ? 'Analyzing...' : 'Analyze Photo'}
                </button>
              </>
            )}

            {loading && <div className="spinner" />}
            <p className={`error-text${error ? ' visible' : ''}`}><span>{error}</span></p>
          </div>
        </div>
      )}

      {/* Result screen */}
      {result && (
        <div className="card">
          {result.photoUrl && (
            <div className="photo-preview" style={{ marginBottom: 'var(--space-md)' }}>
              <img src={photoSrc(result.photoUrl)} alt={result.name} />
            </div>
          )}

          {!editing ? (
            <>
              <h2 style={{ marginBottom: 'var(--space-sm)' }}>{result.name}</h2>
              {result.confidence && (
                <p style={{
                  color: result.confidence > 0.7 ? 'var(--color-success)' : 'var(--color-warning)',
                  fontSize: 'var(--font-size-sm)',
                  marginBottom: 'var(--space-md)',
                }}>
                  Confidence: {Math.round(result.confidence * 100)}%
                </p>
              )}
              <div className="macro-bar" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="macro-item">
                  <span className="macro-value">{result.calories}</span>
                  <span className="macro-label">kcal</span>
                </div>
                <div className="macro-item">
                  <span className="macro-value">{result.proteinG}g</span>
                  <span className="macro-label">Protein</span>
                </div>
                <div className="macro-item">
                  <span className="macro-value">{result.carbsG}g</span>
                  <span className="macro-label">Carbs</span>
                </div>
                <div className="macro-item">
                  <span className="macro-value">{result.fatG}g</span>
                  <span className="macro-label">Fat</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/')}>
                  Done ✓
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ marginBottom: 'var(--space-md)' }}>Review & Edit</h2>
              {result.lowConfidence && (
                <p style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
                  Low confidence — please review before saving.
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" value={result.name} onChange={updateField('name')} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Calories</label>
                    <input type="number" value={result.calories} onChange={updateField('calories')} />
                  </div>
                  <div className="form-group">
                    <label>Protein (g)</label>
                    <input type="number" value={result.proteinG} onChange={updateField('proteinG')} />
                  </div>
                  <div className="form-group">
                    <label>Carbs (g)</label>
                    <input type="number" value={result.carbsG} onChange={updateField('carbsG')} />
                  </div>
                  <div className="form-group">
                    <label>Fat (g)</label>
                    <input type="number" value={result.fatG} onChange={updateField('fatG')} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEdited} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
              <p className={`error-text${error ? ' visible' : ''}`} style={{ marginTop: error ? 'var(--space-sm)' : 0 }}><span>{error}</span></p>
            </>
          )}
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
