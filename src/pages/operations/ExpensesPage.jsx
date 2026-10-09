import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllExpenses, getExpenseCategories } from '../../data/repository.js';
import { Breadcrumbs, EmptyState, SearchInput } from '../../components/ui/UIComponents.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    const list = getAllExpenses();
    setExpenses([...list].sort((a, b) => b.date.localeCompare(a.date)));
    setCategories(getExpenseCategories());
  }, []);

  const filtered = expenses.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.date.includes(q) && !e.categoryName?.toLowerCase().includes(q) && !e.remarks?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterCategory && e.categoryId !== filterCategory) return false;
    return true;
  });

  const totalSpent = filtered.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Operations', path: '/operations' },
              { label: 'Daily Expenses' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Daily Expenses Register</h1>
          <p>Petty cash vouchers, generator fuel, utility bills, and tea/cleaning expenses recorded during daily shifts.</p>
        </div>
        <div className="page-header-actions">
          <Link to="/operations/daily-entry" className="btn btn-primary">
            + New Daily Entry
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filtered Operational Expenses</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--danger)', marginTop: 4 }}>
            {INR(totalSpent)}
          </div>
        </div>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Vouchers Logged</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {filtered.length} Vouchers
          </div>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by date, category, or remarks…"
        />
        <select
          className="filter-select"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">All Expense Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No expense vouchers recorded"
            description="Expenses entered on the Daily Entry screen will appear here."
          />
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Payment Source</th>
                  <th>Amount</th>
                  <th>Remarks / Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        to={`/operations/daily-entry?date=${e.date}`}
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {e.date}
                      </Link>
                      {e.isDemo && (
                        <span className="badge badge-danger" style={{ fontSize: 9, marginLeft: 4 }}>
                          DEMO
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-default" style={{ fontSize: 11 }}>
                        {e.categoryName || 'General Expense'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${e.paymentSource === 'Cash' || !e.paymentSource ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 11 }}>
                        {e.paymentSource || 'Cash'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {INR(e.amount)}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{e.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Showing {filtered.length} of {expenses.length} expense vouchers
      </div>
    </div>
  );
}
