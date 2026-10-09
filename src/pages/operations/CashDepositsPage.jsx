import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllCashDeposits, getSalesmen } from '../../data/repository.js';
import { Breadcrumbs, EmptyState, SearchInput } from '../../components/ui/UIComponents.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CashDepositsPage() {
  const [deposits, setDeposits] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [search, setSearch] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');

  useEffect(() => {
    const list = getAllCashDeposits();
    setDeposits([...list].sort((a, b) => b.date.localeCompare(a.date)));
    setSalesmen(getSalesmen());
  }, []);

  const filtered = deposits.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.date.includes(q) && !d.salesmanName?.toLowerCase().includes(q) && !d.reference?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterSalesman && d.salesmanId !== filterSalesman) return false;
    return true;
  });

  const totalDeposited = filtered.reduce((s, d) => s + (d.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Operations', path: '/operations' },
              { label: 'Cash Deposits' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Cash Deposits Audit</h1>
          <p>Register of cash handovers, bank teller drops, and night vault deposits by attendant staff.</p>
        </div>
        <div className="page-header-actions">
          <Link to="/operations/daily-entry" className="btn btn-primary">
            + New Daily Entry
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filtered Cash Deposited</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', marginTop: 4 }}>
            {INR(totalDeposited)}
          </div>
        </div>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deposit Slips Logged</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {filtered.length} Drops
          </div>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by date, staff name, or reference…"
        />
        <select
          className="filter-select"
          value={filterSalesman}
          onChange={e => setFilterSalesman(e.target.value)}
        >
          <option value="">All Staff / Attendants</option>
          {salesmen.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState
            icon="bank"
            title="No cash deposits found"
            description="Deposits recorded in Daily Entry will be logged here."
          />
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Staff / Salesman</th>
                  <th>Time</th>
                  <th>Reference / Slip</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        to={`/operations/daily-entry?date=${d.date}`}
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {d.date}
                      </Link>
                      {d.isDemo && (
                        <span className="badge badge-danger" style={{ fontSize: 9, marginLeft: 4 }}>
                          DEMO
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {INR(d.amount)}
                    </td>
                    <td>
                      {d.salesmanName ? (
                        <span style={{ fontWeight: 600 }}>{d.salesmanName}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {d.time || '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{d.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Showing {filtered.length} of {deposits.length} deposit records
      </div>
    </div>
  );
}
