import { useState, useCallback, useRef } from 'react';
import { Modal } from './UIComponents.jsx';
import Icon from './Icon.jsx';

const QUICK_REASONS = [
  'Wrong meter reading',
  'Amount correction',
  'Missed entry',
  'Duplicate entry',
  'Owner instruction',
];

/**
 * Asks for a written reason before a past / completed record is changed.
 * Usage:
 *   const { requestReason, reasonDialog } = useReasonGate();
 *   const reason = await requestReason({ title, date, detail, confirmLabel });
 *   if (!reason) return;           // cancelled
 *   ...save with reason...
 *   return (<> ... {reasonDialog} </>);
 */
export function useReasonGate() {
  const [state, setState] = useState({ open: false });
  const resolver = useRef(null);

  const requestReason = useCallback((opts = {}) => new Promise((resolve) => {
    resolver.current = resolve;
    setState({ open: true, ...opts });
  }), []);

  const finish = (value) => {
    setState({ open: false });
    if (resolver.current) resolver.current(value);
    resolver.current = null;
  };

  const reasonDialog = state.open ? (
    <ReasonDialog
      title={state.title}
      date={state.date}
      detail={state.detail}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      onCancel={() => finish(null)}
      onConfirm={(r) => finish(r)}
    />
  ) : null;

  return { requestReason, reasonDialog };
}

function ReasonDialog({ title = 'Reason required', date, detail, confirmLabel = 'Save change', danger = false, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5;

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={!valid}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </button>
        </>
      )}
    >
      <div className="chip warn" style={{ height: 'auto', padding: '8px 10px', whiteSpace: 'normal', marginBottom: 12, alignItems: 'flex-start' }}>
        <Icon name="alert" />
        <span>
          {date ? <>You are changing a record dated <b>{date}</b>. </> : null}
          {detail || 'This changes history that reports and stock already use.'} The change will be marked as edited and saved in the change log.
        </span>
      </div>

      <label className="form-label" htmlFor="reason-text">Why is this change needed? <span className="required">*</span></label>
      <textarea
        id="reason-text"
        className="form-textarea"
        autoFocus
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Closing meter of Diesel 2 was typed wrong"
        maxLength={300}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {QUICK_REASONS.map(q => (
          <button key={q} type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => setReason(q)}>{q}</button>
        ))}
      </div>
      <div className="form-hint" style={{ marginTop: 6 }}>
        {valid ? 'Looks good.' : 'Write at least 5 characters.'}
      </div>
    </Modal>
  );
}
