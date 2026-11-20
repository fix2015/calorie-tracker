import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useTranslation } from '../i18n';

const LINK_HOST = 'calories.probooking.app';
const APP_STORE_URL = 'https://apps.apple.com/app/id6819706002';
// Android is still on the internal test track; set this once it is public on Google Play.
const PLAY_URL = null;
const DISMISS_KEY = 'appPromptDismissedAt';
const DISMISS_DAYS = 7;

/** Native app: a shared https://calories.probooking.app/… link (universal / app link) opens that page in the app. */
export function DeepLinkListener() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const open = (raw) => {
      try {
        const url = new URL(raw);
        if (url.host !== LINK_HOST) return;
        navigate(url.pathname + url.search, { replace: false });
      } catch { /* not a URL we handle */ }
    };
    CapApp.getLaunchUrl().then((r) => { if (r?.url) open(r.url); }).catch(() => {});
    const sub = CapApp.addListener('appUrlOpen', (e) => open(e.url));
    return () => { sub.then((s) => s.remove()); };
  }, [navigate]);
  return null;
}

function storeUrl() {
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && window.innerWidth < 768);
  if (iOS) return APP_STORE_URL;
  if (/Android/.test(ua)) return PLAY_URL;
  return null;
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

const HIDDEN_ON = ['/login', '/register', '/terms', '/privacy', '/admin'];

/** Mobile browser: a bottom sheet suggesting the app, at most once a week. Never inside the app itself. */
export function AppDownloadPrompt() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const url = Capacitor.isNativePlatform() ? null : storeUrl();
  const hiddenHere = HIDDEN_ON.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!url || hiddenHere || recentlyDismissed()) return undefined;
    if (window.matchMedia?.('(display-mode: standalone)').matches) return undefined;
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [url, hiddenHere]);

  if (!open || hiddenHere) return null;

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setOpen(false);
  };

  return (
    <div className="app-prompt-overlay" onClick={close}>
      <div className="app-prompt" role="dialog" aria-modal="true" aria-labelledby="app-prompt-title" onClick={(e) => e.stopPropagation()}>
        <div className="app-prompt-handle" aria-hidden="true" />
        <img src="/icons/icon-192.png" alt="" className="app-prompt-icon" />
        <h2 id="app-prompt-title">{t('appPrompt.title')}</h2>
        <p className="app-prompt-body">{t('appPrompt.body')}</p>
        <ul className="app-prompt-points">
          <li><span aria-hidden="true">📷</span>{t('appPrompt.pointScan')}</li>
          <li><span aria-hidden="true">⏰</span>{t('appPrompt.pointReminders')}</li>
          <li><span aria-hidden="true">⚡</span>{t('appPrompt.pointFast')}</li>
        </ul>
        <a className="btn btn-primary app-prompt-get" href={url} target="_blank" rel="noopener noreferrer" onClick={close}>
          {t('appPrompt.get')}
        </a>
        <button type="button" className="app-prompt-later" onClick={close}>{t('appPrompt.notNow')}</button>
      </div>
    </div>
  );
}
