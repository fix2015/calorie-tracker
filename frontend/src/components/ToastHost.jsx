import { useEffect, useState } from 'react';
import { subscribeToasts } from '../services/toast';

export default function ToastHost() {
  const [toast, setToast] = useState(null);

  useEffect(() => subscribeToasts(setToast), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.duration);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className={`app-toast app-toast-${toast.type}`} role="status" aria-live="polite" key={toast.id}>
      {toast.message}
    </div>
  );
}
