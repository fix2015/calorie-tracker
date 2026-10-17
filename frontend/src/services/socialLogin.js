// Sign in with Apple / Google through @capgo/capacitor-social-login (native on iOS / Android,
// Apple JS + Google OAuth popup on the web). The ID token is verified by our backend (/auth/social).
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || '';
const APPLE_SERVICE_ID = import.meta.env.VITE_APPLE_SERVICE_ID || '';
const IOS_BUNDLE_ID = 'app.probooking.calorize';

export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/** Whether this build has the client ids a provider needs on the current platform. */
export const clientConfigured = {
  // iOS uses the native Sign in with Apple sheet (client id = bundle id); web / Android need the Services ID
  apple: platform === 'ios' || !!APPLE_SERVICE_ID,
  google: platform === 'ios' ? !!GOOGLE_IOS_CLIENT_ID : !!GOOGLE_WEB_CLIENT_ID,
};

// Apple's return URL (form_post on Android; must also be registered for the web popup)
const appleRedirectUrl = () => new URL(`${API}/auth/apple/callback`, window.location.origin).href;

let initPromise = null;

/** Initialises the plugin once. Called at app start so the web Google popup can finish its redirect. */
export function initSocialLogin() {
  if (!initPromise) {
    const options = {};
    if (clientConfigured.apple) {
      options.apple = {
        clientId: platform === 'ios' ? IOS_BUNDLE_ID : APPLE_SERVICE_ID,
        redirectUrl: platform === 'ios' ? '' : appleRedirectUrl(),
        useProperTokenExchange: true,
      };
    }
    if (clientConfigured.google) {
      options.google = {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iOSClientId: GOOGLE_IOS_CLIENT_ID,
        iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
        mode: 'online',
        ...(platform === 'web' ? { redirectUrl: `${window.location.origin}/login` } : {}),
      };
    }
    initPromise = Object.keys(options).length
      ? SocialLogin.initialize(options).catch((err) => {
        initPromise = null;
        throw err;
      })
      : Promise.resolve();
  }
  return initPromise;
}

/**
 * Runs the provider's sign-in UI and returns what /auth/social needs:
 * { provider, token, name?, authorizationCode? }. Apple only shares the name on the first sign-in.
 */
export async function signInWithProvider(provider) {
  await initSocialLogin();
  if (provider === 'apple') {
    const { result } = await SocialLogin.login({ provider: 'apple', options: { scopes: ['email', 'name'] } });
    const name = [result.profile?.givenName, result.profile?.familyName].filter(Boolean).join(' ');
    return {
      provider,
      token: result.idToken,
      name: name || undefined,
      authorizationCode: result.authorizationCode || undefined,
    };
  }
  const { result } = await SocialLogin.login({ provider: 'google', options: {} });
  return { provider, token: result.idToken };
}

/** True when the user closed the sign-in sheet / popup themselves (no error message needed). */
export function isCancelled(err) {
  const msg = String(err?.message || err?.code || err || '').toLowerCase();
  return /cancel|closed|1001|dismiss/.test(msg);
}
