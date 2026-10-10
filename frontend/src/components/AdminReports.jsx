import { useEffect, useState, useCallback } from 'react';

const TYPE_LABEL = { MEAL: 'Meal', COMMENT: 'Comment', USER: 'User', MESSAGE: 'Conversation' };
const REASON_LABEL = { SPAM: 'Spam', INAPPROPRIATE: 'Inappropriate', HARASSMENT: 'Harassment', OTHER: 'Other' };

function targetSummary(r) {
  const t = r.target;
  if (r.targetType === 'MEAL') return t ? `${t.name} — by @${t.user?.username || t.user?.name || '?'}` : `meal ${r.targetId} (deleted?)`;
  if (r.targetType === 'USER') return t ? `@${t.username || t.name}` : `user ${r.targetId}`;
  if (r.targetType === 'COMMENT') return t ? `"${t.text}" — by @${t.user?.username || t.user?.name || '?'}` : `comment ${r.targetId}`;
  return `conversation ${r.targetId}`;
}

/** Content-report moderation list for the admin dashboard. `adminFetch(path, opts)` is the AdminPage fetch helper. */
export default function AdminReports({ adminFetch, onCountChange }) {
  const [status, setStatus] = useState('OPEN');
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback((s) => {
    adminFetch(`/reports?status=${s}`)
      .then((d) => {
        setReports(d.reports);
        setError('');
        if (s === 'OPEN') onCountChange?.(d.reports.length);
      })
      .catch((e) => setError(e.message));
  }, [adminFetch, onCountChange]);

  useEffect(() => { load(status); }, [load, status]);

  const changeStatus = (s) => {
    if (s === status) return;
    setReports(null);
    setStatus(s);
  };

  const setReportStatus = async (id, next) => {
    setBusyId(id);
    try {
      await adminFetch(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      load(status);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={`btn ${status === 'OPEN' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => changeStatus('OPEN')}>Open</button>
        <button className={`btn ${status === 'RESOLVED' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => changeStatus('RESOLVED')}>Resolved</button>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Meals/comments with 3+ open reports are hidden from public feeds until resolved. Act within 24 hours.
        </span>
      </div>
      {error && <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {reports === null ? (
        <div className="spinner" />
      ) : reports.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-lg)' }}>No {status.toLowerCase()} reports</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {reports.map((r) => (
            <div key={r.id} className="admin-report-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                  <span className="admin-report-pill">{TYPE_LABEL[r.targetType]}</span>
                  <span className="admin-report-pill admin-report-pill-reason">{REASON_LABEL[r.reason]}</span>
                  {r.status === 'OPEN' && r.openReportsForTarget >= 3 && (r.targetType === 'MEAL' || r.targetType === 'COMMENT') && (
                    <span className="admin-report-pill admin-report-pill-hidden">Auto-hidden ({r.openReportsForTarget})</span>
                  )}
                </div>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{targetSummary(r)}</div>
                {r.note && <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 2 }}>Note: {r.note}</div>}
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Reported by {r.reporter?.username ? `@${r.reporter.username}` : r.reporter?.email} · {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
              {r.status === 'OPEN' ? (
                <button className="btn btn-primary" disabled={busyId === r.id} onClick={() => setReportStatus(r.id, 'RESOLVED')}>Resolve</button>
              ) : (
                <button className="btn btn-secondary" disabled={busyId === r.id} onClick={() => setReportStatus(r.id, 'OPEN')}>Reopen</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
