// App-wide paywall bus: openPaywall() from anywhere, <Paywall /> (mounted in App.jsx) renders it.
// `reason` is the daily limit that was hit ('photoScans' | 'voiceSeconds' | 'analyses') or 'profile'.
const listeners = new Set();

export function openPaywall(reason = 'profile') {
  listeners.forEach((fn) => fn(reason));
}

export function subscribePaywall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True when an API error is a daily AI limit (backend 429 with limit_reached). */
export const isLimitError = (err) => !!(err && err.status === 429 && err.data && err.data.limit_reached);
