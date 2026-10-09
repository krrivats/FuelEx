import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllMeterReadings, getMachines, getProducts, getActiveNozzles } from '../../data/repository.js';
import { Breadcrumbs, EmptyState, SearchInput } from '../../components/ui/UIComponents.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FMT_QTY = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';

export default function MeterReadingsPage() {
  const [readings, setReadings] = useState([]);
  const [search, setSearch] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterProduct, setFilterProduct] = useState('');

  const [machines, setMachines] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const list = getAllMeterReadings();
    setReadings([...list].sort((a, b) => b.date.localeCompare(a.date)));
    setMachines(getMachines());
    setProducts(getProducts());
  }, []);

  const filtered = readings.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.date.includes(q) && !r.nozzleName.toLowerCase().includes(q) && !r.productName.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterMachine && r.machineId !== filterMachine) return false;
    if (filterProduct && r.productId !== filterProduct) return false;
    return true;
  });

  const totalLitres = filtered.reduce((s, r) => s + (r.salesLitres || 0), 0);
  const totalValue = filtered.reduce((s, r) => s + (r.salesValue || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Operations', path: '/operations' },
              { label: 'Meter Readings' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Historical Meter Readings</h1>
          <p>Audit trail of all recorded nozzle totalizers, fuel volume dispensed, and sales value by date.</p>
        </div>
        <div className="page-header-actions">
          <Link to="/operations/daily-entry" className="btn btn-primary">
            + New Daily Entry
          </Link>
        </div>
      </div>

      {/* Summary statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filtered Dispensed Volume</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', marginTop: 4 }}>
            {FMT_QTY(totalLitres)}
          </div>
        </div>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filtered Sales Value</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--success)', marginTop: 4 }}>
            {INR(totalValue)}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by date (YYYY-MM-DD), nozzle, or product…"
        />
        <select
          className="filter-select"
          value={filterMachine}
          onChange={e => setFilterMachine(e.target.value)}
        >
          <option value="">All Machines</option>
          {machines.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filterProduct}
          onChange={e => setFilterProduct(e.target.value)}
        >
          <option value="">All Products</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState
            icon="bolt"
            title="No meter readings recorded"
            description="Meter readings will appear here once saved in Daily Entry."
          />
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Machine</th>
                  <th>Nozzle</th>
                  <th>Product</th>
                  <th>Opening</th>
                  <th>Closing</th>
                  <th>Sales Volume</th>
                  <th>Price/L</th>
                  <th style={{ textAlign: 'right' }}>Sales Value</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        to={`/operations/daily-entry?date=${r.date}`}
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {r.date}
                      </Link>
                      {r.isDemo && (
                        <span className="badge badge-danger" style={{ fontSize: 9, marginLeft: 4 }}>
                          DEMO
                        </span>
                      )}
                    </td>
                    <td>{r.machineName || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{r.nozzleName || '—'}</td>
                    <td>
                      <span className="badge badge-default" style={{ fontSize: 11 }}>
                        {r.productName || '—'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {Number(r.openingReading).toFixed(2)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {Number(r.closingReading).toFixed(2)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {FMT_QTY(r.salesLitres)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {r.sellingPrice ? INR(r.sellingPrice) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {INR(r.salesValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Showing {filtered.length} of {readings.length} reading entries
      </div>
    </div>
  );
}
