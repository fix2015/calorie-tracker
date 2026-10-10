import { useState } from 'react';
import { createPortal } from 'react-dom';
import { reportsApi } from '../services/api';
import { showToast } from '../services/toast';
import { useTranslation } from '../i18n';

const REASONS = ['SPAM', 'INAPPROPRIATE', 'HARASSMENT', 'OTHER'];

export function FlagIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

/**
 * Bottom sheet for reporting a meal, comment, user or conversation.
 * targetType: 'MEAL' | 'COMMENT' | 'USER' | 'MESSAGE'
 */
export default function ReportSheet({ targetType, targetId, onClose, onReported }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await reportsApi.create({ targetType, targetId, reason, note: note.trim() || undefined });
      showToast(t('report.thanks'));
      onReported?.(res);
      onClose();
    } catch (err) {
      if (/already reported/i.test(err.message)) {
        showToast(t('report.already'), { type: 'info' });
        onClose();
        return;
      }
      setError(t('report.failed'));
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="modal-overlay report-sheet-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <form
        className="report-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="report-sheet-handle" aria-hidden="true" />
        <h2 id="report-sheet-title">{t(`report.title.${targetType}`)}</h2>
        <p className="report-sheet-subtitle">{t('report.subtitle')}</p>
        <div className="report-reasons" role="radiogroup" aria-label={t('report.subtitle')}>
          {REASONS.map((r) => (
            <label key={r} className={`report-reason${reason === r ? ' selected' : ''}`}>
              <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
              <span>{t(`report.reasons.${r}`)}</span>
            </label>
          ))}
        </div>
        <textarea
          className="report-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('report.notePlaceholder')}
          aria-label={t('report.notePlaceholder')}
          maxLength={500}
          rows={3}
        />
        {targetType === 'MESSAGE' && <p className="report-sheet-hint">{t('report.blocksSender')}</p>}
        {error && <p className="report-sheet-error" role="alert">{error}</p>}
        <div className="report-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={!reason || submitting}>
            {submitting ? t('report.submitting') : t('report.submit')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** Flag button that opens the ReportSheet. `variant="icon"` renders an icon-only button. */
export function ReportButton({ targetType, targetId, variant = 'label', className = '', onReported }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`report-btn report-btn-${variant} ${className}`.trim()}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={t('report.action')}
        title={t('report.action')}
      >
        <FlagIcon size={variant === 'icon' ? 18 : 14} />
        {variant !== 'icon' && <span>{t('report.action')}</span>}
      </button>
      {open && (
        <ReportSheet targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} onReported={onReported} />
      )}
    </>
  );
}
