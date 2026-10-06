import { useTranslation } from '../i18n';

export default function SampleBadge({ user }) {
  const { t } = useTranslation();
  if (!user?.isDemo) return null;

  return (
    <span className="sample-badge" title={t('sample.tooltip')}>
      {t('sample.badge')}
    </span>
  );
}
