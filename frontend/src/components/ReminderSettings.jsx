import { useState } from 'react';
import { useTranslation } from '../i18n';
import {
  applyReminderSettings, ensureReminderPermission, loadReminderSettings, remindersSupported,
} from '../services/reminders';

// Plugin weekday numbering: 1 = Sunday … 7 = Saturday
const WEEKDAYS = [2, 3, 4, 5, 6, 7, 1];

function weekdayName(weekday, language) {
  // 2024-01-07 was a Sunday → offset by plugin weekday
  const d = new Date(2024, 0, 6 + weekday);
  return d.toLocaleDateString(language, { weekday: 'long' });
}

/** Profile card: optional lunch / dinner / weekly weigh-in reminders. All off by default. */
export default function ReminderSettings({ userId }) {
  const { t, language } = useTranslation();
  const [settings, setSettings] = useState(() => loadReminderSettings(userId));
  const [message, setMessage] = useState('');
  const supported = remindersSupported();

  const texts = () => ({
    title: 'Calorize',
    lunch: t('reminders.lunchBody'),
    dinner: t('reminders.dinnerBody'),
    weighIn: t('reminders.weighInBody'),
  });

  const commit = async (next) => {
    setSettings(next);
    try {
      await applyReminderSettings(userId, next, texts());
    } catch {
      setMessage(t('reminders.scheduleFailed'));
    }
  };

  const toggle = async (name) => {
    setMessage('');
    const turningOn = !settings[name].enabled;
    if (turningOn) {
      const granted = await ensureReminderPermission().catch(() => false);
      if (!granted) {
        setMessage(t('reminders.permissionDenied'));
        return;
      }
    }
    commit({ ...settings, [name]: { ...settings[name], enabled: turningOn } });
  };

  const change = (name, field) => (e) => commit({ ...settings, [name]: { ...settings[name], [field]: e.target.value } });

  const row = (name, label) => (
    <div className="reminder-row">
      <label className="reminder-switch">
        <input
          type="checkbox"
          role="switch"
          checked={settings[name].enabled}
          onChange={() => toggle(name)}
          disabled={!supported}
          aria-checked={settings[name].enabled}
        />
        <span>{label}</span>
      </label>
      <div className="reminder-when">
        {name === 'weighIn' && (
          <select
            value={settings.weighIn.weekday}
            onChange={change('weighIn', 'weekday')}
            disabled={!supported || !settings.weighIn.enabled}
            aria-label={t('reminders.weekday')}
          >
            {WEEKDAYS.map((d) => <option key={d} value={d}>{weekdayName(d, language)}</option>)}
          </select>
        )}
        <input
          type="time"
          value={settings[name].time}
          onChange={change(name, 'time')}
          disabled={!supported || !settings[name].enabled}
          aria-label={`${label} — ${t('reminders.time')}`}
        />
      </div>
    </div>
  );

  return (
    <section className="reminder-settings" aria-labelledby="reminders-title">
      <h3 id="reminders-title">{t('reminders.title')}</h3>
      <p className="reminder-hint">{supported ? t('reminders.hint') : t('reminders.appOnly')}</p>
      {row('lunch', t('reminders.lunch'))}
      {row('dinner', t('reminders.dinner'))}
      {row('weighIn', t('reminders.weighIn'))}
      {message && <p className="report-sheet-error" role="alert">{message}</p>}
    </section>
  );
}
