const UPLOAD_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export function photoSrc(url) {
  if (!url) return '';
  // S3 URLs are absolute
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Local uploads need the base prefix
  return `${UPLOAD_BASE}${url}`;
}
