import { Component } from 'react';
import { useTranslation } from '../i18n';

function ChunkError({ onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="page" role="alert" style={{ textAlign: 'center', paddingTop: 'var(--space-xl)' }}>
      <p style={{ marginBottom: 'var(--space-md)' }}>{t('common.pageLoadFailed')}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>{t('common.retry')}</button>
    </div>
  );
}

/** Catches failures to load a lazy route chunk (e.g. offline on the web) instead of blanking the app. */
export default class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <ChunkError onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
