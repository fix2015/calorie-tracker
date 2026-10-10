// Optional local reminders (lunch, dinner, weekly weigh-in) via @capacitor/local-notifications.
// Native (iOS/Android) only. Everything is off by default, and notification permission is
// requested only when the user switches a reminder on.
import { Capacitor } from '@capacitor/core';

export const REMINDER_IDS = { lunch: 101, dinner: 102, weighIn: 103 };

export const DEFAULT_REMINDERS = {
  lunch: { enabled: false, time: '12:30' },
  dinner: { enabled: false, time: '19:00' },
  // weekday uses the plugin's numbering: 1 = Sunday … 7 = Saturday
  weighIn: { enabled: false, time: '08:00', weekday: 2 },
};

const key = (userId) => `reminders:${userId}`;

export const remindersSupported = () => Capacitor.isNativePlatform();

const plugin = () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications);

export function loadReminderSettings(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(key(userId)) || 'null');
    if (!saved) return DEFAULT_REMINDERS;
    return {
      lunch: { ...DEFAULT_REMINDERS.lunch, ...saved.lunch },
      dinner: { ...DEFAULT_REMINDERS.dinner, ...saved.dinner },
      weighIn: { ...DEFAULT_REMINDERS.weighIn, ...saved.weighIn },
    };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

function saveReminderSettings(userId, settings) {
  try { localStorage.setItem(key(userId), JSON.stringify(settings)); } catch { /* storage unavailable */ }
}

/** Ask for permission (only call this from a user action). Resolves true when granted. */
export async function ensureReminderPermission() {
  const ln = await plugin();
  let { display } = await ln.checkPermissions();
  if (display === 'prompt' || display === 'prompt-with-rationale') {
    ({ display } = await ln.requestPermissions());
  }
  return display === 'granted';
}

const hm = (time) => {
  const [h, m] = String(time).split(':').map((n) => parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h : 12, minute: Number.isFinite(m) ? m : 0 };
};

/**
 * Persist settings and (re)schedule the OS notifications to match them.
 * `texts` = { title, lunch, dinner, weighIn } already translated.
 */
export async function applyReminderSettings(userId, settings, texts) {
  saveReminderSettings(userId, settings);
  if (!remindersSupported()) return;
  const ln = await plugin();
  await ln.cancel({ notifications: Object.values(REMINDER_IDS).map((id) => ({ id })) }).catch(() => {});

  const notifications = [];
  if (settings.lunch.enabled) {
    notifications.push({ id: REMINDER_IDS.lunch, title: texts.title, body: texts.lunch, schedule: { on: hm(settings.lunch.time), allowWhileIdle: true } });
  }
  if (settings.dinner.enabled) {
    notifications.push({ id: REMINDER_IDS.dinner, title: texts.title, body: texts.dinner, schedule: { on: hm(settings.dinner.time), allowWhileIdle: true } });
  }
  if (settings.weighIn.enabled) {
    notifications.push({
      id: REMINDER_IDS.weighIn,
      title: texts.title,
      body: texts.weighIn,
      schedule: { on: { weekday: Number(settings.weighIn.weekday) || 2, ...hm(settings.weighIn.time) }, allowWhileIdle: true },
    });
  }
  if (notifications.length) await ln.schedule({ notifications });
}
