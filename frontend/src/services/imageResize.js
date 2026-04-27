const MAX_SIZE = 1024;
const QUALITY = 0.8;

/**
 * Resize an image file to max MAX_SIZE px on longest side, return as Blob.
 * Converts to JPEG to reduce size for AI analysis.
 */
export function resizeImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width <= MAX_SIZE && height <= MAX_SIZE) {
        // Already small enough — still convert to JPEG for consistency
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', QUALITY);
        return;
      }

      const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', QUALITY);
    };

    img.src = url;
  });
}
