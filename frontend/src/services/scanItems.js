// Pure helpers for the editable photo-scan item rows (see components/ScanItemsEditor.jsx).
export const STEP = 0.25;
const round1 = (n) => Math.round(n * 10) / 10;

/** Build editable rows from the API's `items` (each keeps its original values as the 1× base). */
export function toEditableItems(items) {
  return (items || []).map((it, i) => ({
    key: `${i}-${it.name}`,
    name: it.name,
    portion: 1,
    base: { grams: it.grams || 0, calories: it.calories || 0, proteinG: it.proteinG || 0, carbsG: it.carbsG || 0, fatG: it.fatG || 0 },
  }));
}

export function itemValues(item) {
  const p = item.portion;
  return {
    grams: Math.round(item.base.grams * p),
    calories: Math.round(item.base.calories * p),
    proteinG: round1(item.base.proteinG * p),
    carbsG: round1(item.base.carbsG * p),
    fatG: round1(item.base.fatG * p),
  };
}

export function totalsOf(items) {
  return items.reduce((acc, it) => {
    const v = itemValues(it);
    return {
      calories: acc.calories + v.calories,
      proteinG: round1(acc.proteinG + v.proteinG),
      carbsG: round1(acc.carbsG + v.carbsG),
      fatG: round1(acc.fatG + v.fatG),
    };
  }, { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
}
