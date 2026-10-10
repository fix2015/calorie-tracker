import { useTranslation } from '../i18n';
import { ACTIVITY_LEVEL_KEYS, GOAL_KEYS } from '../services/goalOptions';

/**
 * Goal / target weight / activity fields — the "set your goal" step of the register wizard,
 * shared with the first-run onboarding. `form` needs goal, targetWeightKg, activityLevel and
 * (optionally) weightKg for the "kg to lose/gain" hint; `set(field)` returns an onChange handler.
 */
export default function GoalFields({ form, set, idPrefix = '' }) {
  const { t } = useTranslation();
  const weightDiff = form.weightKg && form.targetWeightKg
    ? Math.abs(Number(form.weightKg) - Number(form.targetWeightKg)).toFixed(1)
    : null;

  return (
    <>
      <div className="form-group">
        <label htmlFor={`${idPrefix}goal`}>{t('register.whatsYourGoal')}</label>
        <select id={`${idPrefix}goal`} value={form.goal} onChange={set('goal')}>
          {GOAL_KEYS.map((g) => (
            <option key={g.value} value={g.value}>{t(g.key)}</option>
          ))}
        </select>
      </div>

      {form.goal !== 'maintain' && (
        <div className="form-group">
          <label htmlFor={`${idPrefix}targetWeightKg`}>{t('register.targetWeight')}</label>
          <input id={`${idPrefix}targetWeightKg`} type="number" step="0.1" value={form.targetWeightKg} onChange={set('targetWeightKg')} required min="30" max="300" placeholder={t('register.yourGoalWeight')} />
          {weightDiff && (
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {form.goal === 'lose' ? t('register.kgToLose', weightDiff) : t('register.kgToGain', weightDiff)}
            </span>
          )}
        </div>
      )}

      <div className="form-group">
        <label htmlFor={`${idPrefix}activityLevel`}>{t('register.activityLevel')}</label>
        <select id={`${idPrefix}activityLevel`} value={form.activityLevel} onChange={set('activityLevel')}>
          {ACTIVITY_LEVEL_KEYS.map((a) => (
            <option key={a.value} value={a.value}>{t(a.key)}</option>
          ))}
        </select>
      </div>
    </>
  );
}
