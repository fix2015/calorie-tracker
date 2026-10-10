import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../services/useOnlineStatus';
import { flushScanQueue, getQueuedScans, subscribeScanQueue } from '../services/scanQueue';
import { addRecentScan } from '../services/recentScans';
import { showToast } from '../services/toast';
import { useTranslation } from '../i18n';

/** Offline banner + uploads scans queued while offline once the connection is back. */
export default function OfflineSync({ userId }) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    const refresh = () => getQueuedScans().then((list) => setQueued(list.length));
    refresh();
    return subscribeScanQueue(refresh);
  }, []);

  useEffect(() => {
    if (!online) return;
    flushScanQueue({
      onSynced: (meal) => {
        addRecentScan(userId, meal);
        showToast(t('offline.synced', meal.name));
      },
      onNeedsWeight: () => showToast(t('offline.needsWeight'), { type: 'info', duration: 6000 }),
      onFailed: (err) => showToast(err.data?.not_food ? t('scan.notFoodError') : t('offline.syncFailed'), { type: 'error' }),
    });
  }, [online, userId, t]);

  if (online) return null;
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      {t('offline.banner')}{queued > 0 ? ` · ${t('offline.queued', queued)}` : ''}
    </div>
  );
}
