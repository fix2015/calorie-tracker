import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../services/AuthContext';
import { billing } from '../services/api';
import { subscribePaywall } from '../services/paywall';
import { loadPlans, restore, storeAvailable, subscribe } from '../services/purchases';
import { showToast } from '../services/toast';
import { useTranslation } from '../i18n';

const store = Capacitor.getPlatform() === 'android' ? 'Google Play' : 'App Store';

/**
 * Calorize Pro paywall sheet. Opened through openPaywall() when a free user hits a daily AI limit,
 * or from Profile. Shows the store's own prices, the free trial, restore, and the auto-renew terms
 * Apple and Google require next to the buy button.
 */
export default function Paywall() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reason, setReason] = useState(null);
  const [plans, setPlans] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  // Once per app start in the native app, re-read the subscription from RevenueCat, so renewals,
  // cancellations and expiry are picked up even if a webhook delivery was missed.
  useEffect(() => {
    if (storeAvailable && user?.id) billing.sync().catch(() => {});
  }, [user?.id]);

  useEffect(() => subscribePaywall((r) => {
    if (!user) return;
    setReason(r);
    setError('');
    billing.status().then(setStatus).catch(() => {});
    if (!storeAvailable) { setPlans([]); return; }
    setPlans(null);
    loadPlans(user.id)
      .then((p) => { setPlans(p); setSelected(p.find((x) => x.period === 'yearly') || p[0] || null); })
      .catch(() => { setPlans([]); setError(t('pro.loadFailed')); });
  }), [user, t]);

  if (!reason || !user) return null;
  const close = () => { if (!busy) setReason(null); };

  const finish = async (fn) => {
    setBusy(true);
    setError('');
    const r = await fn();
    setBusy(false);
    if (r.ok && r.status?.isPro) {
      showToast(t('pro.welcome'));
      setReason(null);
    } else if (r.ok) {
      setError(t('pro.nothingToRestore'));
    } else if (!r.cancelled) {
      setError(r.message || t('pro.purchaseFailed'));
    }
  };

  const monthlyOfYearly = (p) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currencyCode }).format(Math.floor((p.price / 12) * 100) / 100);
    } catch { return null; }
  };

  const free = status?.limits && status.tier === 'free' ? status.limits : { photoScans: 1, voiceSeconds: 0, analyses: 1 };
  const isPro = status?.isPro;

  return createPortal(
    <div className="modal-overlay paywall-overlay" onClick={close}>
      <div className="paywall" role="dialog" aria-modal="true" aria-labelledby="paywall-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="paywall-close" onClick={close} aria-label={t('common.close')}>×</button>
        <div className="paywall-badge" aria-hidden="true">PRO</div>
        <h2 id="paywall-title">{t('pro.title')}</h2>
        {reason !== 'profile' && <p className="paywall-reason">{t(`pro.reason.${reason}`)}</p>}

        <ul className="paywall-benefits">
          <li><strong>{t('pro.benefitScans', 10)}</strong><span>{t('pro.freeHas', free.photoScans)}</span></li>
          <li><strong>{t('pro.benefitVoice')}</strong><span>{t('pro.proOnly')}</span></li>
          <li><strong>{t('pro.benefitAnalysis', 10)}</strong><span>{t('pro.freeHas', free.analyses)}</span></li>
        </ul>

        {isPro ? (
          <p className="paywall-active">{t('pro.active')}</p>
        ) : !storeAvailable ? (
          <p className="paywall-web">{t('pro.inAppOnly')}</p>
        ) : plans === null ? (
          <p className="paywall-loading">{t('common.loading')}</p>
        ) : (
          <>
            <div className="paywall-plans" role="radiogroup" aria-label={t('pro.choosePlan')}>
              {plans.map((p) => (
                <label key={p.id} className={`paywall-plan${selected?.id === p.id ? ' selected' : ''}`}>
                  <input type="radio" name="pro-plan" checked={selected?.id === p.id} onChange={() => setSelected(p)} />
                  <span className="paywall-plan-name">
                    {t(`pro.${p.period}`)}
                    {p.trialDays > 0 && <em>{t('pro.trialBadge', p.trialDays)}</em>}
                  </span>
                  <span className="paywall-plan-price">
                    {p.priceString}<small>{t(`pro.per.${p.period}`)}</small>
                    {p.period === 'yearly' && monthlyOfYearly(p) && <small className="paywall-plan-sub">{t('pro.perMonthEquiv', monthlyOfYearly(p))}</small>}
                  </span>
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-primary paywall-cta" disabled={!selected || busy} onClick={() => finish(() => subscribe(user.id, selected))}>
              {busy ? t('common.loading') : selected?.trialDays ? t('pro.startTrial', selected.trialDays) : t('pro.subscribe')}
            </button>
            {selected && (
              <p className="paywall-terms">
                {selected.trialDays
                  ? t('pro.termsTrial', selected.trialDays, selected.priceString, t(`pro.per.${selected.period}`), store)
                  : t('pro.terms', selected.priceString, t(`pro.per.${selected.period}`), store)}
              </p>
            )}
            <button type="button" className="paywall-restore" disabled={busy} onClick={() => finish(() => restore(user.id))}>{t('pro.restore')}</button>
          </>
        )}
        {error && <p className="paywall-error" role="alert">{error}</p>}
        <p className="paywall-links">
          <Link to="/terms" onClick={close}>{t('pro.termsLink')}</Link> · <Link to="/privacy" onClick={close}>{t('pro.privacyLink')}</Link>
        </p>
      </div>
    </div>,
    document.body,
  );
}
