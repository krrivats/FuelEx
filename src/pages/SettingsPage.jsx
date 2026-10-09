import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useToast, Modal } from '../components/ui/UIComponents.jsx';
import {
  getSettings,
  exportFuelExDataJson,
  importFuelExDataJson,
  getAuditLog,
  hasDemoData,
  removeDemoData,
} from '../data/repository.js';
import Icon from '../components/ui/Icon.jsx';
import { shareBackup, downloadBackup, getLastBackupAt, describeAge, summarizeBackup, summarizeThisDevice } from '../utils/backup.js';

const PRE_RESTORE_KEY = 'fuelex-ui-prerestore'; // safety copy of the data replaced by the last restore
const CASH_COUNT_KEY = 'cash-count-entries';

export default function SettingsPage() {
  const { theme, toggleTheme, accent, setAccent } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [demoActive, setDemoActive] = useState(hasDemoData());
  const [lastBackup, setLastBackup] = useState(getLastBackupAt());
  const auditLog = getAuditLog();
  const [showAllLog, setShowAllLog] = useState(false);
  const [hasUndo, setHasUndo] = useState(() => { try { return !!localStorage.getItem(PRE_RESTORE_KEY); } catch { return false; } });

  // Restore Modal State
  const [restoreModal, setRestoreModal] = useState({
    open: false,
    rawJson: '',
    meta: null,
  });

  const handleExportData = () => {
    try {
      const name = downloadBackup();
      setLastBackup(getLastBackupAt());
      toast.success(`Backup saved: ${name}`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const handleShareBackup = async () => {
    try {
      const result = await shareBackup();
      setLastBackup(getLastBackupAt());
      if (result === 'shared') toast.success('Backup shared.');
      else if (result === 'downloaded') toast.info('Share is not available here, so the backup was downloaded. Attach that file in WhatsApp or email.');
    } catch (err) {
      toast.error('Share failed: ' + err.message);
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const parsed = JSON.parse(content);

        // Extract metadata for user verification
        const meta = {
          version: parsed.version || 'Unknown',
          machinesCount: (parsed.masters?.machines || []).length,
          productsCount: (parsed.masters?.products || []).length,
          customersCount: (parsed.masters?.customers || []).length,
          employeesCount: (parsed.masters?.employees || []).length,
          entriesCount: (parsed.operations?.dailyEntries || []).length,
          summary: summarizeBackup(parsed),
          device: summarizeThisDevice(),
        };

        setRestoreModal({
          open: true,
          rawJson: content,
          meta,
        });
      } catch (err) {
        toast.error('Invalid backup file: Could not parse JSON (' + err.message + ')');
      }
    };
    reader.readAsText(file);
    // Reset file input so user can pick same file again if desired
    e.target.value = '';
  };

  // Re-align the standalone cash-count list with restored data so deleted counts cannot reappear
  const alignCashCounts = (restored) => {
    try {
      localStorage.setItem(CASH_COUNT_KEY, JSON.stringify(restored?.operations?.cashCounts || []));
    } catch { /* ignore */ }
  };

  const handleConfirmRestore = () => {
    if (!restoreModal.rawJson) return;
    try {
      // Safety copy of what is about to be replaced
      try { localStorage.setItem(PRE_RESTORE_KEY, exportFuelExDataJson()); } catch { /* storage full: continue */ }
      const result = importFuelExDataJson(restoreModal.rawJson);
      alignCashCounts(result?.data);
      setRestoreModal({ open: false, rawJson: '', meta: null });
      toast.success('Backup restored. Reloading…');
      setTimeout(() => { window.location.reload(); }, 800);
    } catch (err) {
      toast.error('Restore failed: ' + err.message);
    }
  };

  const handleUndoRestore = () => {
    try {
      const prev = localStorage.getItem(PRE_RESTORE_KEY);
      if (!prev) return;
      const result = importFuelExDataJson(prev);
      alignCashCounts(result?.data);
      localStorage.removeItem(PRE_RESTORE_KEY);
      setHasUndo(false);
      toast.success('Previous data brought back. Reloading…');
      setTimeout(() => { window.location.reload(); }, 800);
    } catch (err) {
      toast.error('Undo failed: ' + err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Settings</h1>
          <p>Application preferences, configuration, and developer testing tools.</p>
        </div>
      </div>

      {/* App Info */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Application</div>
        <div className="detail-grid">
          <div className="detail-field">
            <div className="detail-field-label">Application Name</div>
            <div className="detail-field-value">FuelEx</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Version</div>
            <div className="detail-field-value">FuelEx v2.4.0 · Production Ready</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Storage Type</div>
            <div className="detail-field-value">Local Browser (localStorage)</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Current Theme</div>
            <div className="detail-field-value" style={{ textTransform: 'capitalize' }}>{theme}</div>
          </div>
        </div>
      </div>

      {/* Old test data (only shown if this device still has some) */}
      {demoActive && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Old test data found</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>This device still has test records from the demo. Remove them. Your real entries are not touched.</div>
          <button className="btn btn-danger" onClick={() => { if (window.confirm('Remove all test data from this device? Real data stays.')) { removeDemoData(); setDemoActive(false); toast.success('Test data removed.'); } }}>
            <Icon name="trash" /> Remove test data
          </button>
        </div>
      )}

      {/* Theme */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Appearance</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Theme</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Currently: <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => theme !== 'dark' && toggleTheme()}
            >
               Dark
            </button>
            <button
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => theme !== 'light' && toggleTheme()}
            >
               Light
            </button>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Colour</div>
          <div className="theme-picker" role="radiogroup" aria-label="Colour theme">
            {[['blue', 'Blue'], ['emerald', 'Emerald'], ['amber', 'Amber']].map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={accent === k}
                className={`theme-chip ${accent === k ? 'on' : ''}`} onClick={() => setAccent(k)}>
                <i className={`theme-dot ${k}`} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Backup, share & restore */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Backup &amp; sync between devices</div>
          <span className={`chip ${lastBackup && Date.now() - lastBackup < 24 * 3600 * 1000 ? 'ok' : 'warn'}`}>
            Last backup: {describeAge(lastBackup)}
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
          One file holds everything: masters, daily entries, collections, udhaar, inventory, expenses and cash counts.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" className="btn btn-primary" onClick={handleShareBackup}>
            <Icon name="share" /> Share backup (WhatsApp, email…)
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportData}>
            <Icon name="download" /> Download file
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <span><Icon name="upload" /> Restore from file</span>
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileSelected} />
          </label>
          {hasUndo && (
            <button type="button" className="btn btn-ghost" onClick={handleUndoRestore}>Undo last restore</button>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>To use the same data on two devices:</strong>
          <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            <li>On the device with the latest data, tap <b>Share backup</b> and send it to yourself.</li>
            <li>On the other device, open the file, save it, then tap <b>Restore from file</b>.</li>
            <li>Restore <b>replaces</b> that device&apos;s data. Always work on one device at a time, then share the latest file.</li>
          </ol>
        </div>
      </div>

      {/* Change log: every edit made to past dates, with the reason */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Change log</div>
          <span className="chip">{auditLog.length} change{auditLog.length === 1 ? '' : 's'}</span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
          Changes to completed days or days older than yesterday must have a reason. They are listed here and travel with your backups.
        </p>
        {auditLog.length === 0 ? (
          <div className="form-hint">No past-date changes yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Changed on</th><th>Record date</th><th>Where</th><th>What</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {(showAllLog ? auditLog : auditLog.slice(0, 10)).map(a => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{a.date}</td>
                    <td>{a.module}</td>
                    <td><span className={`badge ${a.action === 'Deleted' ? 'badge-danger' : 'badge-warning'}`}>{a.action}</span><div className="form-hint">{a.summary}</div></td>
                    <td style={{ minWidth: 180 }}>{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {auditLog.length > 10 && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setShowAllLog(v => !v)}>
            {showAllLog ? 'Show latest 10' : `Show all ${auditLog.length}`}
          </button>
        )}
      </div>

      {/* Storage Architecture */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Data Storage &amp; Safety</div>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <div style={{ fontSize: 24 }}><Icon name="check" /></div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Storage: Local Browser (FuelExData)</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              All FuelEx records are stored locally with zero cloud latency.
              Data persists across browser restarts and device reboots. Regular JSON backups are recommended.
            </div>
          </div>
        </div>
      </div>

      {/* RESTORE CONFIRMATION MODAL */}
      <Modal
        open={restoreModal.open}
        onClose={() => setRestoreModal({ open: false, pendingData: null, rawJson: '', meta: null })}
        title="Confirm Data Restore"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRestoreModal({ open: false, pendingData: null, rawJson: '', meta: null })}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmRestore}
            >
              Replace data with this backup
            </button>
          </>
        }
      >
        {restoreModal.meta && (
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            <div style={{ padding: '10px 14px', background: 'var(--warning-bg, rgba(245,158,11,0.1))', border: '1px solid var(--color-warning)', borderRadius: 8, marginBottom: 14, color: 'var(--text-primary)' }}>
              <strong><Icon name="alert" /> Warning:</strong> Restoring this backup will replace current operational data with the contents of the uploaded backup file.
            </div>

            {(() => {
              const b = restoreModal.meta.summary; const d = restoreModal.meta.device;
              if (!b || !d) return null;
              const olderDate = d.latestDate && (!b.latestDate || b.latestDate < d.latestDate);
              const fewer = b.entries < d.entries;
              return (
                <div style={{ marginBottom: 12 }}>
                  <div className="stat-trio" style={{ border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                    <div><div className="stat-k">&nbsp;</div><div style={{ fontSize: 12, fontWeight: 600 }}>Entries</div><div style={{ fontSize: 12, fontWeight: 600 }}>Latest day</div></div>
                    <div><div className="stat-k">This device now</div><div style={{ fontSize: 12 }}>{d.entries}</div><div style={{ fontSize: 12 }}>{d.latestDate || '—'}</div></div>
                    <div><div className="stat-k">Backup file</div><div style={{ fontSize: 12 }}>{b.entries}</div><div style={{ fontSize: 12 }}>{b.latestDate || '—'}</div></div>
                  </div>
                  {(olderDate || fewer) && (
                    <div className="chip bad" style={{ height: 'auto', padding: '6px 8px', whiteSpace: 'normal' }}>
                      <Icon name="alert" /> This backup looks older than the data on this device. Restoring may lose recent entries.
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ fontWeight: 700, marginBottom: 6 }}>Backup File Analysis:</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)' }}>
              <li><strong>Schema Version:</strong> {restoreModal.meta.version || 'Legacy'}</li>
              <li><strong>Fuel Dispensing Machines:</strong> {restoreModal.meta.machinesCount} machines</li>
              <li><strong>Fuel Products:</strong> {restoreModal.meta.productsCount} products</li>
              <li><strong>Registered Customers:</strong> {restoreModal.meta.customersCount} customer accounts</li>
              <li><strong>Registered Employees:</strong> {restoreModal.meta.employeesCount || 0} employees</li>
              <li><strong>Daily Operations Entries:</strong> {restoreModal.meta.entriesCount} recorded shift days</li>
            </ul>

            <div style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 12 }}>
              Are you sure you wish to proceed with this data restoration?
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
