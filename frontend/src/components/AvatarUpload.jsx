import { useRef, useState } from 'react';
import { photoSrc } from '../services/photoUrl';

export default function AvatarUpload({ currentUrl, name, onUpload, size = 96 }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const displayUrl = preview || (currentUrl ? photoSrc(currentUrl) : null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const url = URL.createObjectURL(file);
    setPreview(url);

    // Resize client-side before uploading
    const resized = await resizeAvatar(file);
    setUploading(true);
    try {
      await onUpload(resized);
    } catch {
      setPreview(null);
    }
    setUploading(false);
  };

  return (
    <div className="avatar-upload" style={{ width: size, margin: '0 auto' }}>
      <div
        className="avatar-upload-area"
        style={{ width: size, height: size }}
        onClick={() => fileRef.current?.click()}
      >
        {displayUrl ? (
          <img src={displayUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="public-avatar-placeholder" style={{ width: size, height: size, margin: 0 }}>
            {initial}
          </div>
        )}
        <div className="avatar-upload-overlay" style={{ width: size, height: size }}>
          {uploading ? (
            <div className="spinner" style={{ width: 24, height: 24, margin: 0, borderWidth: 2 }}></div>
          ) : (
            <span style={{ fontSize: 20 }}>📷</span>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <p style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
        Tap to change
      </p>
    </div>
  );
}

function resizeAvatar(file, maxSize = 512) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = Math.min(img.width, img.height);
      // Crop to square from center, then resize
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      const outSize = Math.min(size, maxSize);
      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      canvas.getContext('2d').drawImage(img, sx, sy, size, size, 0, 0, outSize, outSize);
      canvas.toBlob((blob) => {
        resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.85);
    };
    img.src = url;
  });
}
