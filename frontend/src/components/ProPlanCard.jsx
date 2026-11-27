import { useEffect, useState } from 'react';
import { billing } from '../services/api';
import { openPaywall, subscribePaywall } from '../services/paywall';
import { manageSubscription, storeAvailable } from '../services/purchases';
import { useTranslation } from '../i18n';

/**
 * Profile section for Calorize Pro: current plan, Upgrade (opens the paywall) or Manage subscription.
 * Shown in the native app whenever the store is configured (App Review must be able to find the
 * subscriptions), and on the web once the paywall is switched on.
 */
export default function ProPlanCard({ userId }) {
  const { t, language } = useTranslation();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const load = () => billing.status().then(setStatus).catch(() => {});
    load();
    // Re-read after the paywall closes (a purchase may have happened).
    return subscribePaywall(() => setTimeout(load, 1500));
  }, []);

  if (!status || (!storeAvailable && !status.paywall)) return null;

  const until = status.proUntil ? new Date(status.proUntil) : null;
  const untilText = until && until.getUTCFullYear() < 9999
    ? until.toLocaleDateString(language || undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="pro-plan-card">
      <div>
        <h3>{t('pro.title')}</h3>
        <p>
          {status.isPro
            ? (untilText ? t('pro.profileActiveUntil', untilText) : t('pro.active'))
            : t('pro.profileFree', 1)}
        </p>
      </div>
      {status.isPro
        ? storeAvailable && <button type="button" className="btn btn-secondary" onClick={() => manageSubscription(userId)}>{t('pro.profileManage')}</button>
        : <button type="button" className="btn btn-primary" onClick={() => openPaywall('profile')}>{t('pro.profileUpgrade')}</button>}
    </div>
  );
}
