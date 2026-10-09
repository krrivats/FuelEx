import { localDate } from '../../utils/dates.js';
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDailyEntries, deleteDailyEntry, dailyEntryNeedsReason } from '../../data/repository.js';
import { useReasonGate } from '../../components/ui/ReasonGate.jsx';
import {
  Breadcrumbs, EmptyState, SearchInput, StatusBadge,
  useToast, DeleteConfirmModal,
} from '../../components/ui/UIComponents.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FMT_QTY = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';

export default function DailyEntriesListPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, entry: null });
  const { requestReason, reasonDialog } = useReasonGate();

  const refresh = useCallback(() => {
    setEntries(getDailyEntries());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = entries.filter(e => {
    if (search && !e.date.includes(search)) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  const confirmDelete = async () => {
    const entry = deleteModal.entry;
    if (!entry) return;
    try {
      let reason = '';
      if (!entry.isDemo && dailyEntryNeedsReason(entry.date, entry.status)) {
        reason = await requestReason({
          title: 'Delete a saved day',
          date: entry.date,
          detail: 'Deleting removes this day\'s meters, collections, Udhaar, deposits and expenses, and changes stock and cash.',
          confirmLabel: 'Delete day',
          danger: true,
        });
        if (!reason) return;
      }
      deleteDailyEntry(entry.id, reason);
      toast.success(`Entry for ${entry.date} deleted`);
      refresh();
    } catch (e) {
      toast.error('Failed to delete entry: ' + e.message);
    }
  };

  const today = localDate();

  return (
    <div>
      {reasonDialog}
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Operations', path: '/operations' },
              { label: 'Daily Entries Log' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Daily Entries Log</h1>
          <p>Historical record of all daily pump operations, fuel volume, sales values, collections, and reconciliations.</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/operations/daily-entry?date=${today}`)}
          >
            + Start Today's Entry
          </button>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter by date (YYYY-MM-DD)…"
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState
            icon="list"
            title="No daily entries found"
            description="Start by creating today's operational entry."
            action={
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/operations/daily-entry?date=${today}`)}
                style={{ marginTop: 12 }}
              >
                Create Today's Entry
              </button>
            }
          />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fuel Litres</th>
                  <th>Sales Value</th>
                  <th>Collections</th>
                  <th>Expenses</th>
                  <th>Reconciliation</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => {
                  const isMatched = entry.reconciliationStatus === 'matched';
                  const diff = entry.reconciliationDifference || 0;
                  return (
                    <tr key={entry.id}>
                      <td>
                        <Link
                          to={`/operations/daily-entry?date=${entry.date}`}
                          style={{
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          {entry.date}
                        </Link>
                        {entry.isDemo && (
                          <span className="badge badge-danger" style={{ fontSize: 9, marginLeft: 6 }}>
                            DEMO
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {FMT_QTY(entry.totalFuelLitres)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {INR(entry.totalSalesValue)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {INR(entry.totalCollections)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {INR(entry.totalExpenses)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`badge ${isMatched ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                            {isMatched ? 'Matched' : 'Difference'}
                          </span>
                          {!isMatched && (
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
                              ({diff > 0 ? `+${INR(diff)}` : INR(diff)})
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${entry.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                          {entry.status === 'completed' ? 'Completed' : 'Draft'}
                        </span>
                        {entry.isEdited && (
                          <span className="badge badge-warning" style={{ marginLeft: 6 }} title={`${new Date(entry.lastEditedAt).toLocaleString('en-IN')} — ${entry.lastEditReason}`}>
                            Edited {new Date(entry.lastEditedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate(`/operations/daily-entry?date=${entry.date}`)}
                          >
                            Open Day
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => setDeleteModal({ open: true, entry })}
                            title="Delete operational entry"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Showing {filtered.length} of {entries.length} operational days
      </div>

      {deleteModal.open && (
        <DeleteConfirmModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, entry: null })}
          onDelete={confirmDelete}
          title={`Delete Entry for ${deleteModal.entry?.date}?`}
          recordName={`Daily Entry of ${deleteModal.entry?.date}`}
          canDeleteResult={{ canDelete: true }}
        />
      )}
    </div>
  );
}
