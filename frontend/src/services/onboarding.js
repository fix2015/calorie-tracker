// First-run onboarding is shown once, to newly registered accounts, per device.
const key = (userId) => `onboardingPending:${userId}`;

export function markOnboardingPending(userId) {
  if (!userId) return;
  try { localStorage.setItem(key(userId), '1'); } catch { /* storage unavailable */ }
}

export function isOnboardingPending(userId) {
  if (!userId) return false;
  try { return localStorage.getItem(key(userId)) === '1'; } catch { return false; }
}

export function completeOnboarding(userId) {
  try { localStorage.removeItem(key(userId)); } catch { /* storage unavailable */ }
}
