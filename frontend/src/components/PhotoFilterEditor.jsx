import { useState, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';

const FILTERS = [
  { id: 'original', label: 'Original', css: '' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.4) contrast(1.1)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.3) saturate(1.2) brightness(1.05)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(15deg) brightness(1.05) saturate(0.9)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.45) contrast(1.15) brightness(0.9)' },
  { id: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.2)' },
  { id: 'bright', label: 'Bright', css: 'brightness(1.25) contrast(1.05)' },
  { id: 'dramatic', label: 'Drama', css: 'contrast(1.35) brightness(0.85) saturate(1.3)' },
  { id: 'fade', label: 'Fade', css: 'contrast(0.85) brightness(1.1) saturate(0.8)' },
];

export default function PhotoFilterEditor({ photoUrl, onApply, onCancel }) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('original');
  const [caption, setCaption] = useState('');
  const [applying, setApplying] = useState(false);
  const canvasRef = useRef(null);

  const currentFilter = FILTERS.find(f => f.id === activeFilter) || FILTERS[0];

  const exportImage = useCallback(async () => {
    setApplying(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = photoUrl;
      });

      const canvas = canvasRef.current || document.createElement('canvas');
      const maxSize = 1200;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxSize || h > maxSize) {
        const ratio = Math.min(maxSize / w, maxSize / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.filter = currentFilter.css || 'none';
      ctx.drawImage(img, 0, 0, w, h);

      // Reset filter for text
      ctx.filter = 'none';

      if (caption.trim()) {
        const fontSize = Math.max(16, Math.round(w * 0.045));
        ctx.font = `bold ${fontSize}px -apple-system, "SF Pro Display", "Inter", system-ui, sans-serif`;
        ctx.textAlign = 'center';

        const maxWidth = w * 0.85;
        const text = caption.trim();
        const lines = [];
        const words = text.split(' ');
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);

        const lineHeight = fontSize * 1.3;
        const blockHeight = lines.length * lineHeight;
        const padding = fontSize * 0.6;
        const y = h - blockHeight - padding * 2 - fontSize * 0.5;

        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        const bgX = (w - maxWidth) / 2 - padding;
        ctx.beginPath();
        const radius = fontSize * 0.4;
        const bgW = maxWidth + padding * 2;
        const bgH = blockHeight + padding * 2;
        ctx.roundRect(bgX, y, bgW, bgH, radius);
        ctx.fill();

        // Text
        ctx.fillStyle = '#FFFFFF';
        lines.forEach((l, i) => {
          ctx.fillText(l, w / 2, y + padding + (i + 0.8) * lineHeight);
        });
      }

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      onApply(blob, activeFilter, caption.trim());
    } catch {
      // If canvas export fails (CORS), apply without filter
      onApply(null, activeFilter, caption.trim());
    } finally {
      setApplying(false);
    }
  }, [photoUrl, currentFilter, caption, activeFilter, onApply]);

  return (
    <div>
      {/* Photo with filter applied */}
      <div className="photo-preview" style={{ marginBottom: 'var(--space-sm)', position: 'relative' }}>
        <img
          src={photoUrl}
          alt=""
          style={{ filter: currentFilter.css || 'none', transition: 'filter 0.2s' }}
        />
        {caption && (
          <div style={{
            position: 'absolute', bottom: 'var(--space-md)', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.45)', color: '#fff', padding: '6px 14px',
            borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600,
            maxWidth: '85%', textAlign: 'center', wordBreak: 'break-word',
          }}>
            {caption}
          </div>
        )}
      </div>

      {/* Filter strip */}
      <div style={{
        display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto', padding: 'var(--space-xs) 0 var(--space-md)',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
              border: activeFilter === f.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}>
              <img
                src={photoUrl}
                alt={f.label}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  filter: f.css || 'none',
                }}
              />
            </div>
            <span style={{
              fontSize: 'var(--font-size-2xs)', fontWeight: activeFilter === f.id ? 700 : 400,
              color: activeFilter === f.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}>
              {f.label}
            </span>
          </button>
        ))}
      </div>

      {/* Caption input */}
      <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t('photoFilter.captionPlaceholder')}
          maxLength={120}
          style={{ fontSize: 'var(--font-size-input)' }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel} disabled={applying}>
          {t('photoFilter.skip')}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={exportImage} disabled={applying}>
          {applying ? t('photoFilter.applying') : t('photoFilter.apply')}
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
