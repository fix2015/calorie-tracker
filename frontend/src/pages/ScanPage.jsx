import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { meals } from '../services/api';
import { resizeImage } from '../services/imageResize';
import { photoSrc } from '../services/photoUrl';
import { useTranslation } from '../i18n';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ScanPage() {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openedRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const initialMode = searchParams.get('mode') === 'voice' ? 'voice' : 'photo';
  const [mode, setMode] = useState(initialMode);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [context, setContext] = useState('');
  const [showContextTip, setShowContextTip] = useState(false);
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weight, setWeight] = useState('');
  const [pendingBlob, setPendingBlob] = useState(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  // Result screen
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(false);

  // Open file picker on mount for photo mode
  useEffect(() => {
    if (initialMode === 'photo' && !openedRef.current) {
      openedRef.current = true;
      setTimeout(() => fileRef.current?.click(), 100);
    }
  }, []);

  // Fetch voice limit when switching to voice mode
  useEffect(() => {
    if (mode === 'voice') {
      meals.voiceLimit().then((data) => setRemainingSeconds(data.remainingSeconds)).catch(() => {});
    }
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  // --- Voice (MediaRecorder + Whisper) ---
  const maxRecordingTime = remainingSeconds !== null ? Math.min(remainingSeconds, 60) : 60;

  const startRecording = useCallback(async () => {
    setError('');
    setAudioBlob(null);
    setTranscript('');
    setRecordingTime(0);

    if (remainingSeconds !== null && remainingSeconds <= 0) {
      setError(t('scan.voiceLimitReached'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);

      // Timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsed);
        if (elapsed >= maxRecordingTime) {
          mediaRecorder.stop();
          setIsRecording(false);
          clearInterval(timerRef.current);
        }
      }, 500);
    } catch {
      setError(t('scan.voiceError'));
    }
  }, [remainingSeconds, maxRecordingTime, t]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const submitVoice = async () => {
    if (!audioBlob) return;
    setLoading(true);
    setError('');
    try {
      const ext = audioBlob.type.includes('webm') ? 'webm' : audioBlob.type.includes('mp4') ? 'mp4' : 'ogg';
      const formData = new FormData();
      formData.append('audio', audioBlob, `voice.${ext}`);
      formData.append('duration', String(recordingTime));

      const res = await meals.voice(formData);
      setTranscript(res.transcript || '');
      if (res.remainingSeconds !== undefined) setRemainingSeconds(res.remainingSeconds);

      const m = res.meal;
      setResult({
        id: m.id,
        name: m.name,
        calories: m.calories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
        confidence: m.aiConfidence,
        lowConfidence: res.low_confidence,
      });
      if (res.low_confidence) setEditing(true);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Shared ---
  const handleSaveEdited = async () => {
    setLoading(true);
    setError('');
    try {
      await meals.update(result.id, {
        name: result.name,
        calories: Number(result.calories),
        proteinG: Number(result.proteinG),
        carbsG: Number(result.carbsG),
        fatG: Number(result.fatG),
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field) => (e) => setResult({ ...result, [field]: e.target.value });

  const switchMode = (newMode) => {
    setMode(newMode);
    setResult(null);
    setEditing(false);
    setError('');
    setTranscript('');
    setAudioBlob(null);
    setRecordingTime(0);
    setPreview(null);
    setFile(null);
    if (isRecording) stopRecording();
  };

  return (
    <div className="page">
      {/* Mode toggle */}
      {!result && (
        <div className="scan-mode-toggle">
          <button
            className={`scan-mode-btn${mode === 'photo' ? ' active' : ''}`}
            onClick={() => switchMode('photo')}
          >
            📷 {t('scan.photoTab')}
          </button>
          <button
            className={`scan-mode-btn${mode === 'voice' ? ' active' : ''}`}
            onClick={() => switchMode('voice')}
          >
            🎤 {t('scan.voiceTab')}
          </button>
        </div>
      )}

      {/* Photo mode */}
      {!result && mode === 'photo' && (
        <div className="card">
          <div className="scan-area">
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {preview ? (
              <>
                <div className="photo-preview">
                  <img src={preview} alt="Food preview" />
                </div>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-xs)' }}
                  onClick={() => fileRef.current?.click()}
                >
                  {t('scan.chooseDifferentPhoto')}
                </button>
                <div className="form-group" style={{ width: '100%', marginTop: 'var(--space-md)' }}>
                  <label htmlFor="meal-context" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    {t('scan.additionalInfo')}
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
                      {t('scan.contextHelpTip')}
                    </p>
                  )}
                  <input
                    id="meal-context"
                    type="text"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder={t('scan.contextPlaceholder')}
                  />
                </div>
                <button
                  className="ai-analyze-btn"
                  onClick={handleScan}
                  disabled={loading}
                >
                  {loading ? (
                    <>{t('scan.analyzing')}</>
                  ) : (
                    <><span className="ai-analyze-icon">✨</span> {t('dashboard.aiNutritionAnalysis')}</>
                  )}
                </button>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                  {t('scan.selectPhoto')}
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => fileRef.current?.click()}
                  style={{ marginTop: 'var(--space-md)' }}
                >
                  {t('scan.choosePhoto')}
                </button>
              </>
            )}

            {loading && <div className="spinner" />}
            <p className={`error-text${error ? ' visible' : ''}`}><span>{error}</span></p>
          </div>
        </div>
      )}

      {/* Voice mode */}
      {!result && mode === 'voice' && (
        <div className="card">
          <div className="scan-area">
            <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 'var(--space-sm)' }}>
              {t('scan.voiceDescription')}
            </p>

            {remainingSeconds !== null && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                {t('scan.voiceRemaining', formatTime(remainingSeconds))}
              </p>
            )}

            <button
              className={`voice-record-btn${isRecording ? ' recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || (remainingSeconds !== null && remainingSeconds <= 0 && !isRecording)}
            >
              <span className="voice-record-icon">{isRecording ? '⬛' : '🎤'}</span>
              <span>{isRecording ? formatTime(recordingTime) : t('scan.startRecording')}</span>
            </button>

            {isRecording && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>
                {t('scan.maxDuration', formatTime(maxRecordingTime))}
              </p>
            )}

            {audioBlob && !isRecording && (
              <div className="voice-transcript" style={{ marginTop: 'var(--space-lg)' }}>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                  {t('scan.recordingReady', formatTime(recordingTime))}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', width: '100%' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setAudioBlob(null); setRecordingTime(0); }}
                  >
                    {t('scan.reRecord')}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={submitVoice}
                    disabled={loading}
                  >
                    {loading ? t('scan.analyzing') : `✨ ${t('scan.analyzeVoice')}`}
                  </button>
                </div>
              </div>
            )}

            {transcript && (
              <div style={{ marginTop: 'var(--space-md)', width: '100%' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('scan.youSaid')}</label>
                <p style={{ fontStyle: 'italic', marginTop: 'var(--space-xs)' }}>{transcript}</p>
              </div>
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
                  {t('scan.confidence', Math.round(result.confidence * 100))}
                </p>
              )}
              <div className="macro-bar" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="macro-item">
                  <span className="macro-value">{result.calories}</span>
                  <span className="macro-label">{t('common.kcal')}</span>
                </div>
                <div className="macro-item">
                  <span className="macro-value">{result.proteinG}g</span>
                  <span className="macro-label">{t('common.protein')}</span>
                </div>
                <div className="macro-item">
                  <span className="macro-value">{result.carbsG}g</span>
                  <span className="macro-label">{t('common.carbs')}</span>
                </div>
                <div className="macro-item">
                  <span className="macro-value">{result.fatG}g</span>
                  <span className="macro-label">{t('common.fat')}</span>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                <label>{t('scan.recipeNotes')}</label>
                <textarea
                  value={result.description || ''}
                  onChange={(e) => setResult({ ...result, description: e.target.value })}
                  placeholder={t('scan.recipeNotesPlaceholder')}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(true)}>
                  {t('common.edit')}
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => {
                  if (result.description && result.id) {
                    try { await meals.update(result.id, { name: result.name, calories: result.calories, proteinG: result.proteinG, carbsG: result.carbsG, fatG: result.fatG, description: result.description }); } catch {}
                  }
                  navigate('/dashboard');
                }}>
                  {t('common.done')} ✓
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ marginBottom: 'var(--space-md)' }}>{t('scan.reviewAndEdit')}</h2>
              {result.lowConfidence && (
                <p style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
                  {t('scan.lowConfidence')}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label>{t('common.name')}</label>
                  <input type="text" value={result.name} onChange={updateField('name')} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>{t('common.calories')}</label>
                    <input type="number" value={result.calories} onChange={updateField('calories')} />
                  </div>
                  <div className="form-group">
                    <label>{t('common.proteinG')}</label>
                    <input type="number" value={result.proteinG} onChange={updateField('proteinG')} />
                  </div>
                  <div className="form-group">
                    <label>{t('common.carbsG')}</label>
                    <input type="number" value={result.carbsG} onChange={updateField('carbsG')} />
                  </div>
                  <div className="form-group">
                    <label>{t('common.fatG')}</label>
                    <input type="number" value={result.fatG} onChange={updateField('fatG')} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(false)}>
                    {t('common.cancel')}
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEdited} disabled={loading}>
                    {loading ? t('scan.savingChanges') : t('scan.saveChanges')}
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
            <h2>{t('scan.updateYourWeight')}</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
              {t('scan.weightHelpText')}
            </p>
            <form onSubmit={handleWeightSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label htmlFor="weight-input">{t('scan.yourWeightKg')}</label>
                <input
                  id="weight-input"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                  min="20"
                  max="500"
                  placeholder={t('scan.weightPlaceholder')}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowWeightPrompt(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('common.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
