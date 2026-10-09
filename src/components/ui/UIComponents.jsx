import { createContext, useContext, useState, useCallback, useEffect, useRef, useId, Component, Children, isValidElement, cloneElement } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { ICON_NAMES } from './Icon.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info:    (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ message, type, onClose }) {
  const iconName = { success: 'check', error: 'x', warning: 'alert', info: 'info' }[type] || 'info';
  return (
    <div className={`toast toast-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={iconName} className="toast-icon" />
      <span className="toast-message">{message}</span>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Dismiss notification">
        <Icon name="x" className="icon-sm" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, size = '', footer }) {
  if (!open) return null;
  return <ModalInner onClose={onClose} title={title} size={size} footer={footer}>{children}</ModalInner>;
}

function ModalInner({ onClose, title, children, size, footer }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = dialogRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog without stealing it from an autofocused field
    if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
      const firstField = dialogRef.current.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
      (firstField || dialogRef.current).focus();
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdrop}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`modal ${size ? `modal-${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        style={{ outline: 'none' }}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BREADCRUMBS
// ─────────────────────────────────────────────────────────────────────────────

export function Breadcrumbs({ items = [] }) {
  const navigate = useNavigate();

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="breadcrumb-item">
            {idx > 0 && <span className="breadcrumb-separator">›</span>}
            {isLast ? (
              <span className="breadcrumb-current">{item.label}</span>
            ) : (
              <button
                type="button"
                className="breadcrumb-btn"
                onClick={() => {
                  if (item.onClick) item.onClick();
                  else if (item.path) navigate(item.path);
                }}
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────────────────────

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmVariant = 'danger', icon = 'alert' }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="" size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn btn-${confirmVariant}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </>
      }
    >
      <div className="confirm-dialog">
        <div className={`confirm-dialog-icon ${confirmVariant === 'danger' ? 'danger' : 'warning'}`}>
          <Icon name={ICON_NAMES.includes(icon) ? icon : 'alert'} />
        </div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE DELETE CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

export function DeleteConfirmModal({
  open,
  onClose,
  onDelete,
  onDeactivate,
  title,
  recordName = 'this record',
  canDeleteResult = { canDelete: true },
}) {
  if (!open) return null;

  const isBlocked = canDeleteResult && canDeleteResult.canDelete === false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="sm"
      footer={
        isBlocked ? (
          <>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            {onDeactivate && (
              <button
                className="btn btn-warning"
                onClick={() => {
                  onDeactivate();
                  onClose();
                }}
              >
                Deactivate Instead
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              Delete Permanently
            </button>
          </>
        )
      }
    >
      <div className="confirm-dialog">
        <div className={`confirm-dialog-icon ${isBlocked ? 'warning' : 'danger'}`}>
          <Icon name={isBlocked ? 'alert' : 'trash'} />
        </div>
        <h3>{isBlocked ? 'Cannot Delete Record' : (title || `Delete ${recordName}?`)}</h3>
        {isBlocked ? (
          <p>
            {canDeleteResult.reason || 'This record is already used in existing transactions/configuration and cannot be permanently deleted. You can deactivate it instead.'}
          </p>
        ) : (
          <div>
            <p>Are you sure you want to permanently delete <strong>{recordName}</strong>?</p>
            <p className="text-danger" style={{ marginTop: 6, fontSize: 12 }}>This action cannot be undone.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE
// ─────────────────────────────────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const isActive = status === 'active';
  return (
    <span className={`badge badge-dot ${isActive ? 'badge-active' : 'badge-inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export function CreditStatusBadge({ creditStatus }) {
  const map = {
    ok:       { cls: 'badge-active',  label: 'Within Limit' },
    near:     { cls: 'badge-warning', label: 'Near Limit'   },
    over:     { cls: 'badge-danger',  label: 'Over Limit'   },
    'no-limit': { cls: 'badge-info',  label: 'No Limit Set' },
  };
  const info = map[creditStatus] ?? map['ok'];
  return <span className={`badge badge-dot ${info.cls}`}>{info.label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export function FormGroup({ label, required, error, hint, children }) {
  // Connects the label to its single input so screen readers and tapping the label work
  const autoId = useId();
  const single = Children.count(children) === 1 && isValidElement(children) && typeof children.type === 'string';
  const fieldId = single ? (children.props.id || autoId) : undefined;
  const msgId = `${autoId}-msg`;
  const field = single
    ? cloneElement(children, {
        id: fieldId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? msgId : undefined,
      })
    : children;
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={fieldId}>
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      {field}
      {error && <p className="form-error" id={msgId} role="alert">{error}</p>}
      {hint && !error && <p className="form-hint" id={msgId}>{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyState({ icon = 'inbox', title, description, action }) {
  // Icon names render from the shared icon set; legacy emoji values fall back to a neutral icon
  const iconName = ICON_NAMES.includes(icon) ? icon : 'inbox';
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon name={iconName} /></div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH INPUT
// ─────────────────────────────────────────────────────────────────────────────

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="search-wrapper">
      <Icon name="search" className="search-icon" />
      <input
        type="search"
        aria-label={placeholder}
        className="search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMING SOON PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function ComingSoonPage({ title, description, icon = 'tool' }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <div className="coming-soon-card">
        <div className="empty-state-icon" style={{ margin: '0 auto 8px' }}><Icon name={ICON_NAMES.includes(icon) ? icon : 'tool'} /></div>
        <div className="coming-soon-badge">Coming Soon</div>
        <h3>This module is under development</h3>
        <p>This section will be built in a future stage. Master data, architecture, and service layers are already in place.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FRIENDLY ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('FuelEx Uncaught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-panel" role="alert">
          <div className="error-panel-head">
            <Icon name="alert" />
            <div>
              <h2>This section couldn't be displayed</h2>
              <p className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                Your saved data is untouched. Reload the page, or go back to the dashboard.
              </p>
            </div>
          </div>
          <code>{this.state.error?.message || 'Unknown render error'}</code>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload page
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                window.location.hash = '#/dashboard';
                this.setState({ hasError: false, error: null });
              }}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

