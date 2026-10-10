import { useTranslation } from '../i18n';
import { STEP, itemValues } from '../services/scanItems';

const round1 = (n) => Math.round(n * 10) / 10;

/** Editable rows (name, grams, kcal) with ± portion steppers for a photo scan. */
export default function ScanItemsEditor({ items, onChange }) {
  const { t } = useTranslation();

  const update = (idx, fn) => onChange(items.map((it, i) => (i === idx ? fn(it) : it)));

  const setPortion = (idx, portion) => update(idx, (it) => ({ ...it, portion: Math.max(STEP, round1(portion * 100) / 100) }));

  const setGrams = (idx, value) => update(idx, (it) => {
    const g = Math.max(0, Number(value) || 0);
    if (it.base.grams > 0) return { ...it, portion: Math.max(0.01, g / it.base.grams) };
    // No gram estimate from the model: treat the typed grams as the new 1× base
    return { ...it, portion: 1, base: { ...it.base, grams: g } };
  });

  // Editing kcal directly rescales this item's base so macros stay proportional
  const setCalories = (idx, value) => update(idx, (it) => {
    const kcal = Math.max(0, Number(value) || 0);
    const current = it.base.calories * it.portion;
    if (current > 0) {
      const f = kcal / current;
      return { ...it, base: { ...it.base, calories: it.base.calories * f, proteinG: it.base.proteinG * f, carbsG: it.base.carbsG * f, fatG: it.base.fatG * f } };
    }
    return { ...it, base: { ...it.base, calories: kcal / it.portion } };
  });

  return (
    <div className="scan-items">
      <div className="scan-items-head" aria-hidden="true">
        <span>{t('scan.itemName')}</span>
        <span>{t('scan.grams')}</span>
        <span>{t('common.kcal')}</span>
      </div>
      {items.map((it, idx) => {
        const v = itemValues(it);
        return (
          <div className="scan-item-row" key={it.key}>
            <div className="scan-item-fields">
              <input
                className="scan-item-name"
                type="text"
                value={it.name}
                aria-label={t('scan.itemName')}
                onChange={(e) => update(idx, (x) => ({ ...x, name: e.target.value }))}
              />
              <input
                className="scan-item-num"
                type="number"
                inputMode="numeric"
                min="0"
                value={v.grams}
                aria-label={`${it.name} — ${t('scan.grams')}`}
                onChange={(e) => setGrams(idx, e.target.value)}
              />
              <input
                className="scan-item-num"
                type="number"
                inputMode="numeric"
                min="0"
                value={v.calories}
                aria-label={`${it.name} — ${t('common.kcal')}`}
                onChange={(e) => setCalories(idx, e.target.value)}
              />
            </div>
            <div className="scan-item-controls">
              <button type="button" className="stepper-btn" aria-label={`${t('scan.decreasePortion')}: ${it.name}`} onClick={() => setPortion(idx, it.portion - STEP)} disabled={it.portion <= STEP}>−</button>
              <span className="scan-item-portion" aria-live="polite">{Math.round(it.portion * 100) / 100}×</span>
              <button type="button" className="stepper-btn" aria-label={`${t('scan.increasePortion')}: ${it.name}`} onClick={() => setPortion(idx, it.portion + STEP)}>+</button>
              <span className="scan-item-macros">P {v.proteinG} · C {v.carbsG} · F {v.fatG}</span>
              {items.length > 1 && (
                <button type="button" className="scan-item-remove" aria-label={`${t('scan.removeItem')}: ${it.name}`} onClick={() => onChange(items.filter((_, i) => i !== idx))}>×</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
