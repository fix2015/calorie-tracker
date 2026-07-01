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

// Pixel-level filter functions (works on all browsers)
function clamp(v) { return Math.max(0, Math.min(255, v)); }

function applyBrightness(pixels, amount) {
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = clamp(pixels[i] * amount);
    pixels[i + 1] = clamp(pixels[i + 1] * amount);
    pixels[i + 2] = clamp(pixels[i + 2] * amount);
  }
}

function applyContrast(pixels, amount) {
  const factor = (259 * (amount * 255 + 255)) / (255 * (259 - amount * 255));
  const intercept = 128 * (1 - factor);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = clamp(factor * pixels[i] + intercept);
    pixels[i + 1] = clamp(factor * pixels[i + 1] + intercept);
    pixels[i + 2] = clamp(factor * pixels[i + 2] + intercept);
  }
}

function applySaturate(pixels, amount) {
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    pixels[i] = clamp(gray + (pixels[i] - gray) * amount);
    pixels[i + 1] = clamp(gray + (pixels[i + 1] - gray) * amount);
    pixels[i + 2] = clamp(gray + (pixels[i + 2] - gray) * amount);
  }
}

function applySepia(pixels, amount) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const sr = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
    const sg = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
    const sb = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    pixels[i] = clamp(r + (sr - r) * amount);
    pixels[i + 1] = clamp(g + (sg - g) * amount);
    pixels[i + 2] = clamp(b + (sb - b) * amount);
  }
}

function applyGrayscale(pixels) {
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
  }
}

function applyHueRotate(pixels, degrees) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    pixels[i] = clamp(r * (0.213 + cos * 0.787 - sin * 0.213) + g * (0.715 - cos * 0.715 - sin * 0.715) + b * (0.072 - cos * 0.072 + sin * 0.928));
    pixels[i + 1] = clamp(r * (0.213 - cos * 0.213 + sin * 0.143) + g * (0.715 + cos * 0.285 + sin * 0.140) + b * (0.072 - cos * 0.072 - sin * 0.283));
    pixels[i + 2] = clamp(r * (0.213 - cos * 0.213 - sin * 0.787) + g * (0.715 - cos * 0.715 + sin * 0.715) + b * (0.072 + cos * 0.928 + sin * 0.072));
  }
}

// Parse CSS filter string and apply via pixel manipulation
function applyFilterToImageData(imageData, cssFilter) {
  if (!cssFilter) return;
  const d = imageData.data;
  const parts = cssFilter.match(/[\w-]+\([^)]+\)/g) || [];
  for (const part of parts) {
    const [fn, rawVal] = part.split('(');
    const val = parseFloat(rawVal);
    switch (fn) {
      case 'brightness': applyBrightness(d, val); break;
      case 'contrast': applyContrast(d, val - 1); break;
      case 'saturate': applySaturate(d, val); break;
      case 'sepia': applySepia(d, val); break;
      case 'grayscale': if (val >= 1) applyGrayscale(d); break;
      case 'hue-rotate': applyHueRotate(d, val); break;
    }
  }
}

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

      // Draw original image
      ctx.drawImage(img, 0, 0, w, h);

      // Apply filter via pixel manipulation (cross-browser)
      if (currentFilter.css) {
        const imageData = ctx.getImageData(0, 0, w, h);
        applyFilterToImageData(imageData, currentFilter.css);
        ctx.putImageData(imageData, 0, 0);
      }

      // Draw caption text
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
        const radius = fontSize * 0.4;
        const bgW = maxWidth + padding * 2;
        const bgH = blockHeight + padding * 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bgX, y, bgW, bgH, radius);
        } else {
          ctx.rect(bgX, y, bgW, bgH);
        }
        ctx.fill();

        // Text
        ctx.fillStyle = '#FFFFFF';
        lines.forEach((l, i) => {
          ctx.fillText(l, w / 2, y + padding + (i + 0.8) * lineHeight);
        });
      }

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Canvas export failed');
      onApply(blob, activeFilter, caption.trim());
    } catch (err) {
      console.error('Filter export failed:', err);
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
