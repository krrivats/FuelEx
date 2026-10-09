import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllCollections } from '../../data/repository.js';
import { Breadcrumbs, EmptyState, SearchInput } from '../../components/ui/UIComponents.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Paytm', 'Udhaar', 'Other'];

export default function CollectionsPage() {
  const [collections, setCollections] = useState([]);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('');

  useEffect(() => {
    const list = getAllCollections();
    setCollections([...list].sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  const filtered = collections.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.date.includes(q) && !c.paymentMode.toLowerCase().includes(q) && !c.customerName?.toLowerCase().includes(q) && !c.remarks?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterMode && c.paymentMode !== filterMode) return false;
    return true;
  });

  const totalCollected = filtered.reduce((s, c) => s + (c.amount || 0), 0);
  const totalCash = filtered.filter(c => c.paymentMode === 'Cash').reduce((s, c) => s + (c.amount || 0), 0);
  const totalDigital = filtered.filter(c => ['UPI', 'Card', 'Paytm'].includes(c.paymentMode)).reduce((s, c) => s + (c.amount || 0), 0);
  const totalUdhaar = filtered.filter(c => c.paymentMode === 'Udhaar').reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Operations', path: '/operations' },
              { label: 'Collections' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Collections Register</h1>
          <p>Historical audit of money received across all payment channels — Cash, UPI, Card, Paytm, and customer credit.</p>
        </div>
        <div className="page-header-actions">
          <Link to="/operations/daily-entry" className="btn btn-primary">
            + New Daily Entry
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filtered Collections</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', marginTop: 4 }}>
            {INR(totalCollected)}
          </div>
        </div>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Cash</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {INR(totalCash)}
          </div>
        </div>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Digital (UPI/Card/Paytm)</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--info)', marginTop: 4 }}>
            {INR(totalDigital)}
          </div>
        </div>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Credit (Udhaar)</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--warning)', marginTop: 4 }}>
            {INR(totalUdhaar)}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by date, customer, or remarks…"
        />
        <select
          className="filter-select"
          value={filterMode}
          onChange={e => setFilterMode(e.target.value)}
        >
          <option value="">All Payment Modes</option>
          {PAYMENT_MODES.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState
            icon="card"
            title="No collections found"
            description="Collections will appear here once saved in Daily Entry."
          />
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payment Mode</th>
                  <th>Customer Account</th>
                  <th>Amount</th>
                  <th>Remarks / Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        to={`/operations/daily-entry?date=${c.date}`}
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {c.date}
                      </Link>
                      {c.isDemo && (
                        <span className="badge badge-danger" style={{ fontSize: 9, marginLeft: 4 }}>
                          DEMO
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${c.paymentMode === 'Cash' ? 'badge-success' : c.paymentMode === 'Udhaar' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 11 }}>
                        {c.paymentMode}
                      </span>
                    </td>
                    <td>
                      {c.customerName ? (
                        <span style={{ fontWeight: 600 }}>{c.customerName}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {INR(c.amount)}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Showing {filtered.length} of {collections.length} collection records
      </div>
    </div>
  );
}
