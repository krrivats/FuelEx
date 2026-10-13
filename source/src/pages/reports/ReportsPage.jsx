import { localDate } from '../../utils/dates.js';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getDSRData,
  getDailyEntries,
  getCustomers,
  getFuelStockSummary,
  getCashCountTotalByDate,
} from '../../data/repository.js';
import {
  Breadcrumbs,
  EmptyState,
} from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FMT_QTY = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('dsr'); // 'dsr' | 'audit' | 'udhaar' | 'inventory'
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [dsrData, setDsrData] = useState(null);
  const [dailyEntries, setDailyEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cashCountTotal, setCashCountTotal] = useState(0);

  // Date range for audit tab
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return localDate(d);
  });
  const [endDate, setEndDate] = useState(localDate());

  const loadData = useCallback(() => {
    setDsrData(getDSRData(selectedDate));
    setDailyEntries(getDailyEntries());
    setCustomers(getCustomers());
    setCashCountTotal(getCashCountTotalByDate(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered audit entries
  const auditEntries = useMemo(() => {
    return dailyEntries
      .filter(e => e.date >= startDate && e.date <= endDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyEntries, startDate, endDate]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Reports & DSR' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Reports &amp; Daily Sales Register (DSR)</h1>
          <p>
            Complete operational and financial audits. Automated DSR, tank stock dip variations, collections, and credit registers.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
          >
            <Icon name="file" /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', overflowX: 'auto', overflowY: 'hidden', marginBottom: 12, gap: 10 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'dsr' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('dsr')}
        >
          <Icon name="file" /> Daily Sales Report (DSR)
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('audit')}
        >
          Sales &amp; Reconciliation Audit
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'udhaar' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('udhaar')}
        >
          <Icon name="users" /> Udhaar Credit Sales Log
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('inventory')}
        >
          ⛽ Fuel Stock &amp; Dip Variations
        </button>
      </div>

      {/* TAB 1: DSR */}
      {activeTab === 'dsr' && (
        <div>
          {/* Date Selector Ribbon */}
          <div className="section-block" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                Select DSR Date:
              </label>
              <input
                type="date"
                className="input-field"
                style={{ width: 170 }}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
            {dsrData && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`badge ${dsrData.reconciliation.reconciled ? 'badge-success' : 'badge-warning'}`} style={{ fontWeight: 700, fontSize: 12 }}>
                  {dsrData.reconciliation.status}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: 12 }}>
                  Entry Status: {dsrData.entryStatus.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {dsrData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Top DSR Summary Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
                <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Fuel Sales Volume</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{FMT_QTY(dsrData.reconciliation.totalLitres)}</div>
                </div>
                <div className="section-block" style={{ borderLeft: '4px solid var(--color-success)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Total Meter Sales</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-success)', marginTop: 4 }}>{INR(dsrData.reconciliation.meterSales)}</div>
                </div>
                <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Total Collected</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{INR(dsrData.collections.totalCollected)}</div>
                </div>
                <div className="section-block" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Udhaar (Credit Sales)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-warning)', marginTop: 4 }}>{INR(dsrData.reconciliation.totalUdhaar)}</div>
                </div>
                <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Cash in Hand Remaining</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>{INR(dsrData.cashPosition.cashRemaining)}</div>
                </div>
              </div>

              {/* SECTION 1: TANK STOCK RECONCILIATION */}
              <div className="section-block">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span><Icon name="fuel" /> 1. Underground tank fuel stock reconciliation</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supplier: Bharat Petroleum Corporation Ltd (BPCL)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ margin: 0, fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Product Tank</th>
                        <th style={{ textAlign: 'right' }}>Tank Capacity</th>
                        <th style={{ textAlign: 'right' }}>Opening Stock</th>
                        <th style={{ textAlign: 'right' }}>Fuel Top-Ups (+)</th>
                        <th style={{ textAlign: 'right' }}>Meter Sales (-)</th>
                        <th style={{ textAlign: 'right' }}>Closing Book Stock</th>
                        <th style={{ textAlign: 'right' }}>Physical Dip</th>
                        <th style={{ textAlign: 'right' }}>Dip Variation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dsrData.fuelStock.map(p => (
                        <tr key={p.productId}>
                          <td style={{ fontWeight: 700 }}>
                            {p.productName}
                            {p.isOverCapacity && (
                              <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 10 }}>
                                OVER CAPACITY ({p.overCapacityPercent}%)
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {p.capacityKL ? `${p.capacityKL} KL` : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700 }}>{FMT_QTY(p.openingStock)}</div>
                            {p.isManualOverride ? (
                              <div style={{ fontSize: 10, color: 'var(--color-warning)', fontWeight: 700 }} title={p.openingStockReason ? `Reason: ${p.openingStockReason}` : 'Manual override'}>
                                <Icon name="alert" /> Manual Override {p.openingStockReason ? `(${p.openingStockReason})` : ''}
                              </div>
                            ) : (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                Auto (Previous Day Closing)
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', color: p.receipts > 0 ? 'var(--color-primary)' : 'inherit' }}>
                            {p.receipts > 0 ? `+ ${FMT_QTY(p.receipts)}` : '0.00 L'}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                            - {FMT_QTY(p.sales)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {p.closingBookStockKL ? `${p.closingBookStockKL} KL (${FMT_QTY(p.closingBookStock)})` : FMT_QTY(p.closingBookStock)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {p.physicalDip !== null ? FMT_QTY(p.physicalDip) : <span style={{ color: 'var(--text-muted)' }}>Optional</span>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: p.variation === null ? 'inherit' : p.variation >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {p.variation !== null ? (p.variation >= 0 ? `+ ${FMT_QTY(p.variation)}` : `- ${FMT_QTY(Math.abs(p.variation))}`) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: MACHINE TOTALS */}
              <div className="section-block">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                  <span><Icon name="gauge" /> 2. Machine-wise dispensing breakdown</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                  {dsrData.machineSales.map(m => (
                    <div key={m.machineId} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12, border: '1px solid var(--border-default)' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
                        <Icon name="fuel" /> {m.machineName}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>Total Volume:</span>
                        <strong>{FMT_QTY(m.litres)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700 }}>
                        <span>Sales Value:</span>
                        <strong style={{ color: 'var(--color-success)' }}>{INR(m.salesValue)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {dsrData.testing.total > 0 && (
                <div className="section-block">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                    <span><Icon name="flask" /> Nozzle testing (not sold)</span>
                  </div>
                  <div className="table-wrapper">
                    <table className="table" style={{ margin: 0, fontSize: 13 }}>
                      <thead>
                        <tr><th>Nozzle</th><th style={{ textAlign: 'right' }}>Returned</th><th style={{ textAlign: 'right' }}>Sample/Loss</th><th>Remarks</th></tr>
                      </thead>
                      <tbody>
                        {dsrData.testing.rows.map(r => (
                          <tr key={r.id}>
                            <td>{r.nozzleName || r.nozzleId}{r.productName && <span className="text-muted"> ({r.productName})</span>}</td>
                            <td style={{ textAlign: 'right' }}>{FMT_QTY(r.testReturnedLitres)}</td>
                            <td style={{ textAlign: 'right' }}>{FMT_QTY(r.testLossLitres)}</td>
                            <td className="text-muted">{(r.tests || []).map(t => t.remarks).filter(Boolean).join('; ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>

                    </table>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
                    Total {FMT_QTY(dsrData.testing.total)} · Returned {FMT_QTY(dsrData.testing.returned)} ·{' '}
                    <span style={{ color: 'var(--color-warning)' }}>Sample/Loss {FMT_QTY(dsrData.testing.sampleLoss)}</span>
                  </div>
                </div>
              )}

              {/* SECTION 3 & 4: COLLECTIONS & RECONCILIATION */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 10 }}>
                {/* Collections Breakdown */}
                <div className="section-block">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                    <span><Icon name="cash" /> 3. Collections received</span>
                  </div>
                  <div className="table-wrapper">
                  <table className="table" style={{ margin: 0, fontSize: 13 }}>
                    <tbody>
                      <tr>
                        <td><Icon name="cash" /> Cash Received:</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{INR(dsrData.collections.Cash)}</td>
                      </tr>
                      <tr>
                        <td><Icon name="card" /> UPI / QR Code:</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{INR(dsrData.collections.UPI)}</td>
                      </tr>
                      <tr>
                        <td><Icon name="card" /> Card Swipe:</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{INR(dsrData.collections.Card)}</td>
                      </tr>
                      <tr>
                        <td><Icon name="cash" /> Paytm / Wallet:</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{INR(dsrData.collections.Paytm)}</td>
                      </tr>
                      {dsrData.collections.Other > 0 && (
                        <tr>
                          <td>Other:</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{INR(dsrData.collections.Other)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                        <td>TOTAL COLLECTED:</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-primary)', fontSize: 14 }}>
                          {INR(dsrData.collections.totalCollected)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>

                {/* Core Reconciliation */}
                <div className="section-block">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                    <span><Icon name="gauge" /> 4. Shift reconciliation</span>
                  </div>
                  <div className="table-wrapper">
                  <table className="table" style={{ margin: 0, fontSize: 13 }}>
                    <tbody>
                      <tr>
                        <td>Total Meter Sales:</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(dsrData.reconciliation.meterSales)}</td>
                      </tr>
                      <tr>
                        <td>Total Collected:</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{INR(dsrData.reconciliation.totalCollected)}</td>
                      </tr>
                      <tr>
                        <td>Udhaar Credit Sales:</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-warning)' }}>
                          + {INR(dsrData.reconciliation.totalUdhaar)}
                        </td>
                      </tr>
                      <tr style={{ borderTop: '1px solid var(--border-default)', fontWeight: 700 }}>
                        <td>Reconciled Sales (Col + Udh):</td>
                        <td style={{ textAlign: 'right' }}>{INR(dsrData.reconciliation.reconciledSales)}</td>
                      </tr>
                      <tr style={{ fontWeight: 700 }}>
                        <td>Difference / Variance:</td>
                        <td style={{ textAlign: 'right', color: dsrData.reconciliation.reconciled ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 14 }}>
                          {INR(dsrData.reconciliation.difference)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-surface)' }}>
                        <td colSpan={2} style={{ textAlign: 'center' }}>
                          <span className={`badge ${dsrData.reconciliation.reconciled ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700, fontSize: 12 }}>
                            {dsrData.reconciliation.status}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              </div>

              {/* SECTION 5: CASH POSITION AUDIT & PHYSICAL CASH RECONCILIATION */}
              <div className="section-block">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                  <span>💰 5. PHYSICAL CASH BALANCE AUDIT &amp; Cash count reconciliation</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 12, marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Cash Collected</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{INR(dsrData.cashPosition.cashCollected)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>- Bank Cash Deposits</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>- {INR(dsrData.cashPosition.cashDeposited)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>- Cash Expenses</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-danger)', marginTop: 4 }}>- {INR(dsrData.cashPosition.cashExpenses)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>- Cash Advances / Payments</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-warning)', marginTop: 4 }}>- {INR(dsrData.cashPosition.otherCashPayments)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '2px solid var(--color-primary)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-primary)' }}>= Expected cash in hand</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>{INR(dsrData.cashPosition.cashRemaining)}</div>
                  </div>
                </div>

                {/* Section 28 & 29: Physical Cash Reconciliation */}
                <div style={{
                  padding: '9px 12px',
                  background: 'var(--bg-surface)',
                  borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Forecourt Expected: </span>
                      <strong style={{ fontSize: 14 }}>{INR(dsrData.cashPosition.cashRemaining)}</strong>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Physical Counted (Cash Count): </span>
                      <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                        {cashCountTotal > 0 ? INR(cashCountTotal) : 'No physical count entered'}
                      </strong>
                    </div>
                  </div>
                  {cashCountTotal > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Physical Variance:</span>
                      {Math.abs(cashCountTotal - dsrData.cashPosition.cashRemaining) < 0.01 ? (
                        <span className="badge badge-success" style={{ fontWeight: 700 }}><Icon name="check" /> Exact count match</span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontWeight: 700 }}>
                          <Icon name="alert" /> {cashCountTotal - dsrData.cashPosition.cashRemaining > 0 ? '+' : ''}{INR(cashCountTotal - dsrData.cashPosition.cashRemaining)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                      Pending Physical Cash Count
                    </span>
                  )}
                </div>
              </div>

              {/* SECTION 6: UDHAAR TRANSACTIONS FOR THIS DAY */}
              {dsrData.udhaarSales.length > 0 && (
                <div className="section-block">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span><Icon name="users" /> 6. UDHAAR / Credit sales for {selectedDate}</span>
                    <span className="badge badge-warning" style={{ fontWeight: 700 }}>Total: {INR(dsrData.reconciliation.totalUdhaar)}</span>
                  </div>
                  <div className="table-wrapper">
                  <table className="table" style={{ margin: 0, fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Rate</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th>Remarks / Slip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dsrData.udhaarSales.map((u, i) => (
                        <tr key={u.id || i}>
                          <td style={{ fontWeight: 600 }}>{u.customerName}</td>
                          <td>{u.productName}</td>
                          <td style={{ textAlign: 'right' }}>{u.quantity ? `${u.quantity} L` : '—'}</td>
                          <td style={{ textAlign: 'right' }}>{u.rate ? `₹${u.rate}` : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)' }}>{INR(u.amount)}</td>
                          <td>{u.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div>
          {/* Date range filter */}
          <div className="section-block" style={{ marginBottom: 16, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>From:</label>
              <input
                type="date"
                className="input-field"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>To:</label>
              <input
                type="date"
                className="input-field"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Showing {auditEntries.length} operational days
            </div>
          </div>

          {auditEntries.length === 0 ? (
            <EmptyState
              icon="list"
              title="No entries in date range"
              message="Select another date range or record a daily entry."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Fuel Sales</th>
                    <th style={{ textAlign: 'right' }}>Total Collected</th>
                    <th style={{ textAlign: 'right' }}>Udhaar Sales</th>
                    <th style={{ textAlign: 'right' }}>Reconciled Sales</th>
                    <th style={{ textAlign: 'right' }}>Variance</th>
                    <th style={{ textAlign: 'right' }}>Cash In Hand</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map(e => {
                    const diff = Number(e.reconciliationDifference || 0);
                    const isRec = Math.abs(diff) < 0.01;
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 700 }}>{e.date}</td>
                        <td>
                          <span className={`badge ${e.status === 'completed' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                            {e.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{INR(e.totalSalesValue)}</td>
                        <td style={{ textAlign: 'right' }}>{INR(e.totalCollections)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-warning)' }}>{INR(e.totalUdhaar)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{INR(e.reconciledSales)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isRec ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {INR(diff)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {INR(e.cashRemaining)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setSelectedDate(e.date);
                              setActiveTab('dsr');
                            }}
                          >
                            View DSR →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UDHAAR LOG */}
      {activeTab === 'udhaar' && (
        <div>
          <div className="section-block" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>All Udhaar / Credit Fuel Sales Log</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Master transaction log of all fuel dispensed on credit.
            </div>
          </div>

          <div className="section-block" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Effective Rate</th>
                  <th style={{ textAlign: 'right' }}>Udhaar Amount</th>
                  <th>Salesman / Attendant</th>
                  <th>Remarks / Slip</th>
                </tr>
              </thead>
              <tbody>
                {dailyEntries.flatMap(e => (e.udhaarSales || []).map(u => ({ ...u, entryDate: e.date }))).map((u, idx) => (
                  <tr key={u.id || idx}>
                    <td style={{ fontWeight: 600 }}>{u.date || u.entryDate}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.customerName}</td>
                    <td>{u.productName}</td>
                    <td style={{ textAlign: 'right' }}>{u.quantity ? `${u.quantity} L` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{u.rate ? `₹${u.rate}` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)' }}>{INR(u.amount)}</td>
                    <td>{u.salesmanName || '—'}</td>
                    <td>{u.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FUEL STOCK & DIP VARIATION */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="section-block">
            <h3 style={{ margin: 0, fontSize: 16 }}>Underground Tank Fuel Stock &amp; Capacity Audit</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Formula: Closing Book Stock = Opening Stock + Fuel Top-Ups - Meter Sales - Testing Sample/Loss (returned test fuel stays in the tank). Physical Dip Variation = Dip - Book Stock.
            </div>
          </div>

          {['prod-1', 'prod-2', 'prod-3'].map(pId => {
            const sum = getFuelStockSummary(pId);
            return (
              <div key={pId} className="section-block" style={{ borderTop: `4px solid ${sum.isOverCapacity ? 'var(--color-danger)' : 'var(--color-primary)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                      <Icon name="fuel" /> {sum.productName.toUpperCase()} Storage tank
                    </span>
                    <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                      Configured Capacity: <strong>{sum.capacityKL} KL</strong> ({FMT_QTY(sum.capacityLitres)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {sum.isOverCapacity && (
                      <span className="badge badge-danger" style={{ fontWeight: 700, fontSize: 11 }}>
                        <Icon name="alert" /> {sum.overCapacityPercent}% Over capacity
                      </span>
                    )}
                    <span className="badge badge-info" style={{ fontWeight: 700 }}>
                      Book Stock: {sum.closingBookStockKL} KL ({FMT_QTY(sum.closingBookStock)})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 12 }}>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Initial / Base Stock</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{FMT_QTY(sum.openingStock)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>+ BPCL Fuel Top-Ups</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>+ {FMT_QTY(sum.receipts)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>- Total Meter Sales</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-success)', marginTop: 4 }}>- {FMT_QTY(sum.sales)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Tank Utilization</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: sum.isOverCapacity ? 'var(--color-danger)' : 'var(--text-primary)', marginTop: 4 }}>
                      {sum.utilizationPercent}%
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Physical Dip Level</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                      {sum.physicalDip !== null ? FMT_QTY(sum.physicalDip) : 'Optional / No dip'}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Dip Variation</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: sum.variation !== null ? (sum.variation >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'inherit', marginTop: 4 }}>
                      {sum.variation !== null ? (sum.variation >= 0 ? `+ ${FMT_QTY(sum.variation)}` : `- ${FMT_QTY(Math.abs(sum.variation))}`) : '—'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
