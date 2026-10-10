// Tiny app-wide toast bus: showToast() from anywhere, <ToastHost /> renders it.
const listeners = new Set();

export function showToast(message, { type = 'success', duration = 3500 } = {}) {
  listeners.forEach((fn) => fn({ id: Date.now() + Math.random(), message, type, duration }));
}

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
