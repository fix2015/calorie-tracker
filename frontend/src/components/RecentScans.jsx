import { useState } from 'react';
import { meals } from '../services/api';
import { getRecentScans } from '../services/recentScans';
import { showToast } from '../services/toast';
import { photoSrc } from '../services/photoUrl';
import { useTranslation } from '../i18n';

/** "Recent" — one-tap re-logging of the last 20 scanned foods. */
export default function RecentScans({ userId, onLogged }) {
  const { t } = useTranslation();
  const [recent] = useState(() => getRecentScans(userId));
  const [busy, setBusy] = useState(null);

  if (recent.length === 0) return null;

  const relog = async (food) => {
    if (busy) return;
    setBusy(food.name);
    try {
      await meals.manual({
        name: food.name,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
      });
      showToast(t('scan.relogged', food.name));
      onLogged?.(food);
    } catch (err) {
      showToast(err.message || t('scan.relogFailed'), { type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="recent-scans" aria-labelledby="recent-scans-title">
      <h3 id="recent-scans-title">{t('scan.recent')}</h3>
      <div className="recent-scans-list">
        {recent.map((food) => (
          <button
            key={food.name}
            type="button"
            className="recent-scan-chip"
            onClick={() => relog(food)}
            disabled={!!busy}
            aria-label={t('scan.relogAria', food.name, food.calories)}
          >
            {food.photoUrl ? <img src={photoSrc(food.photoUrl)} alt="" /> : <span className="recent-scan-dot" aria-hidden="true">+</span>}
            <span className="recent-scan-text">
              <span className="recent-scan-name">{food.name}</span>
              <span className="recent-scan-kcal">{busy === food.name ? t('common.saving') : `${food.calories} ${t('common.kcal')}`}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
