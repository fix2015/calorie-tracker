import { Capacitor } from '@capacitor/core';
import { LOG_LEVEL, PURCHASES_ERROR_CODE, Purchases } from '@revenuecat/purchases-capacitor';
import { billing } from './api';

/**
 * Calorize Pro subscriptions through RevenueCat (App Store / Google Play).
 * The RevenueCat app_user_id is our own user id, so the server can look the subscriber up
 * (backend/src/routes/billing.js). After every purchase or restore we ask the server to re-sync,
 * and the server's answer (not the SDK's) decides what the user can do.
 *
 * Keys are the PUBLIC SDK keys (appl_… / goog_…) from .env.capacitor. The web build sells nothing:
 * the paywall tells web users to subscribe in the app.
 */
const platform = Capacitor.getPlatform();
const KEY = platform === 'ios'
  ? import.meta.env.VITE_REVENUECAT_IOS_API_KEY
  : platform === 'android' ? import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY : '';

export const storeAvailable = Capacitor.isNativePlatform() && !!KEY;

let configuredFor = null;
async function configure(userId) {
  if (!storeAvailable) throw new Error('Store not available');
  if (configuredFor === userId) return;
  if (configuredFor === null) {
    await Purchases.setLogLevel({ level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN });
    await Purchases.configure({ apiKey: KEY, appUserID: userId });
  } else {
    await Purchases.logIn({ appUserID: userId });
  }
  configuredFor = userId;
}

/** Monthly and yearly packages of the current offering, with the store's localised prices and trial. */
export async function loadPlans(userId) {
  await configure(userId);
  const { current } = await Purchases.getOfferings();
  if (!current) return [];
  return current.availablePackages
    .filter((p) => p.packageType === 'MONTHLY' || p.packageType === 'ANNUAL')
    .map((p) => ({
      id: p.identifier,
      period: p.packageType === 'ANNUAL' ? 'yearly' : 'monthly',
      priceString: p.product.priceString,
      price: p.product.price,
      currencyCode: p.product.currencyCode,
      // Free trial = an introductory offer priced at 0.
      trialDays: p.product.introPrice && p.product.introPrice.price === 0
        ? p.product.introPrice.periodNumberOfUnits * ({ DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[p.product.introPrice.periodUnit] || 0)
        : 0,
      pkg: p,
    }))
    .sort((a) => (a.period === 'yearly' ? -1 : 1));
}

function asResult(e) {
  const cancelled = e && (e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || e.userCancelled === true);
  return { ok: false, cancelled, message: (e && e.message) || 'Purchase failed' };
}

export async function subscribe(userId, plan) {
  try {
    await configure(userId);
    await Purchases.purchasePackage({ aPackage: plan.pkg });
    return { ok: true, status: await billing.sync() };
  } catch (e) {
    return asResult(e);
  }
}

export async function restore(userId) {
  try {
    await configure(userId);
    await Purchases.restorePurchases();
    return { ok: true, status: await billing.sync() };
  } catch (e) {
    return asResult(e);
  }
}

/** Opens the store's own subscription management page (cancel, change plan). */
export async function manageSubscription(userId) {
  await configure(userId);
  const { customerInfo } = await Purchases.getCustomerInfo();
  if (customerInfo.managementURL) window.open(customerInfo.managementURL, '_system');
}
