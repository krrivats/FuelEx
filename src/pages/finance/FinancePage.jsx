import { localDate } from '../../utils/dates.js';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getBusinessPosition,
  getDailyEntries,
  getSuppliers,
  getSalesmen,
  saveDailyEntry,
} from '../../data/repository.js';
import {
  Modal,
  FormGroup,
  EmptyState,
  useToast,
  Breadcrumbs,
} from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INR_ROUND = (v) => '₹' + Math.round(Number(v || 0)).toLocaleString('en-IN');

const MOVEMENT_TYPES = [
  'Employee Advance',
  'Salary Advance',
  'Owner Withdrawal',
  'Supplier Payment',
  'Owner Investment',
  'Other Advance',
  'Other Payment',
];

const PAYMENT_SOURCES = ['Cash', 'UPI', 'Bank', 'Card', 'Other'];

export default function FinancePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('position'); // 'position' | 'movements'
  const [position, setPosition] = useState(null);
  const [dailyEntries, setDailyEntries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);

  // Modal
  const [movementModal, setMovementModal] = useState(false);
  const [movementForm, setMovementForm] = useState({
    date: localDate(),
    type: 'Employee Advance',
    payeeName: '',
    amount: '',
    paymentSource: 'Cash',
    remarks: '',
  });

  const loadData = useCallback(() => {
    setPosition(getBusinessPosition());
    setDailyEntries(getDailyEntries());
    setSuppliers(getSuppliers());
    setSalesmen(getSalesmen());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate all money movements across entries
  const allMovements = useMemo(() => {
    const list = [];
    dailyEntries.forEach(entry => {
      (entry.moneyMovements || []).forEach(m => {
        list.push({
          ...m,
          date: entry.date,
          entryId: entry.id,
        });
      });
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyEntries]);

  const handleOpenAddMovement = () => {
    setMovementForm({
      date: localDate(),
      type: 'Employee Advance',
      payeeName: salesmen[0]?.name || '',
      amount: '',
      paymentSource: 'Cash',
      remarks: '',
    });
    setMovementModal(true);
  };

  const handleSaveMovement = () => {
    const amt = Number(movementForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    if (!movementForm.payeeName.trim()) {
      toast.error('Please enter the payee or counterparty name.');
      return;
    }

    // Find or create daily entry for this date
    let targetEntry = dailyEntries.find(e => e.date === movementForm.date);
    let updatedMovements = [];
    if (targetEntry) {
      updatedMovements = [
        ...(targetEntry.moneyMovements || []),
        {
          id: `mov-${Date.now()}`,
          type: movementForm.type,
          payeeName: movementForm.payeeName.trim(),
          amount: amt,
          paymentSource: movementForm.paymentSource,
          remarks: movementForm.remarks.trim(),
        },
      ];
    } else {
      updatedMovements = [
        {
          id: `mov-${Date.now()}`,
          type: movementForm.type,
          payeeName: movementForm.payeeName.trim(),
          amount: amt,
          paymentSource: movementForm.paymentSource,
          remarks: movementForm.remarks.trim(),
        },
      ];
    }

    try {
      saveDailyEntry({
        id: targetEntry?.id || null,
        date: movementForm.date,
        status: targetEntry?.status || 'draft',
        moneyMovements: updatedMovements,
      });

      toast.success(`${movementForm.type} of ${INR(amt)} recorded.`);
      setMovementModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save movement: ' + err.message);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Finance & Business Position' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Finance &amp; Net Business Position</h1>
          <p>
            Real-time financial status, asset valuation, payables, receivables, and capital / non-operating money movements.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAddMovement}
          >
            + Record Money Movement
          </button>
        </div>
      </div>

      {/* Business Position Banner */}
      {position && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 10, marginBottom: 12 }}>
          <div className="section-block" style={{ borderLeft: '4px solid var(--color-success)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', }}>
              Total Assets
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-success)', marginTop: 4 }}>
              {INR_ROUND(position.assets.total)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Cash, Bank, Digital, Stocks &amp; Receivables
            </div>
          </div>

          <div className="section-block" style={{ borderLeft: '4px solid var(--color-danger)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', }}>
              Total Liabilities
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-danger)', marginTop: 4 }}>
              {INR_ROUND(position.liabilities.total)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Supplier Payables &amp; Short-term Dues
            </div>
          </div>

          <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)', background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', }}>
              Net Business Position
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: position.netPosition >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', marginTop: 4 }}>
              {INR_ROUND(position.netPosition)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Net Station Worth (Assets - Liabilities)
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', overflowX: 'auto', overflowY: 'hidden', marginBottom: 12, gap: 10 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'position' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('position')}
        >
          <Icon name="trending" /> Statement of Business Position
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('movements')}
        >
          Money Movements &amp; Advances ({allMovements.length})
        </button>
      </div>

      {/* TAB 1: BUSINESS POSITION */}
      {activeTab === 'position' && position && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 12 }}>
          {/* Assets Breakdown */}
          <div className="section-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-success)' }}><Icon name="trending" /> Station assets</h3>
              <span className="badge badge-success" style={{ fontWeight: 700 }}>
                {INR(position.assets.total)}
              </span>
            </div>

            <div className="table-wrapper">
            <table className="table" style={{ margin: 0, fontSize: 13 }}>
              <tbody>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="cash" /> Physical Cash in Hand</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Collections less bank drops, cash expenses &amp; cash advances</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', fontSize: 13.5 }}>
                    {INR(position.assets.cashInHand)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="bank" /> Bank Vault / Deposits</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Accumulated physical cash deposited to bank accounts</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {INR(position.assets.bankAccounts)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="card" /> UPI / QR Receivables</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Digital QR payments settled to merchant account</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {INR(position.assets.upiReceivable)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="card" /> Card / Paytm Receivables</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>POS swipe settlements and wallet collections</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {INR(position.assets.cardReceivable + position.assets.paytmReceivable)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="users" /> Customer Receivables (Udhaar)</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total outstanding balance owed by registered credit customers</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)' }}>
                    {INR(position.assets.customerReceivables)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="fuel" /> Fuel Stock Valuation</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current underground tank volume valued at effective retail price</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {INR(position.assets.fuelInventory)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="fuel" /> Lubricants Stock Valuation</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Packaged engine oils &amp; fluids valued at cost price</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {INR(position.assets.lubricantInventory)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                  <td>TOTAL ASSETS:</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-success)', fontSize: 14 }}>
                    {INR(position.assets.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          {/* Liabilities Breakdown */}
          <div className="section-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-danger)' }}><Icon name="trending" /> Station liabilities</h3>
              <span className="badge badge-danger" style={{ fontWeight: 700 }}>
                {INR(position.liabilities.total)}
              </span>
            </div>

            <div className="table-wrapper">
            <table className="table" style={{ margin: 0, fontSize: 13 }}>
              <tbody>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="fuel" /> Fuel / Lube Supplier Payables</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dues to oil marketing company / lubricant distributors</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-danger)' }}>
                    {INR(position.liabilities.supplierPayables)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 600 }}><Icon name="file" /> Other Short-Term Liabilities</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Accrued electricity, security deposits or unpaid vouchers</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {INR(position.liabilities.otherLiabilities)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                  <td>TOTAL LIABILITIES:</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-danger)', fontSize: 14 }}>
                    {INR(position.liabilities.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>

            {/* Financial Notes */}
            <div style={{ marginTop: 12, padding: 14, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Business Principles:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                <li>Digital sales (UPI, Card, Paytm) do not increase physical cash in hand.</li>
                <li>Customer Udhaar is tracked as a receivable asset, not as physical cash.</li>
                <li>Owner withdrawals are equity drawings, not operating expenses.</li>
                <li>Owner investments are capital additions, not operating revenue.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONEY MOVEMENTS & ADVANCES */}
      {activeTab === 'movements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Capital &amp; Non-Operating Money Movements</h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Salary advances, owner withdrawals, supplier settlements, and capital investments. Only cash transactions affect cash in hand.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenAddMovement}
            >
              + Record Money Movement
            </button>
          </div>

          {allMovements.length === 0 ? (
            <EmptyState
              icon="cash"
              title="No money movements recorded"
              message="Click '+ Record Money Movement' to log employee advances, owner drawings, or vendor payments."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Payee / Counterparty</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Payment Source</th>
                    <th>Cash Impact</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {allMovements.map((m, idx) => {
                    const isCash = (m.paymentSource || 'Cash') === 'Cash';
                    return (
                      <tr key={m.id || idx}>
                        <td style={{ fontWeight: 600 }}>{m.date}</td>
                        <td>
                          <span className="badge badge-info" style={{ fontWeight: 600 }}>
                            {m.type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{m.payeeName || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)', fontSize: 13.5 }}>
                          {INR(m.amount)}
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                            {m.paymentSource || 'Cash'}
                          </span>
                        </td>
                        <td>
                          {isCash ? (
                            <span className="badge badge-warning" style={{ fontSize: 11 }}>
                              Deducts Physical Cash
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                              Non-cash Movement
                            </span>
                          )}
                        </td>
                        <td>{m.remarks || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: RECORD MONEY MOVEMENT */}
      <Modal
        open={movementModal}
        onClose={() => setMovementModal(false)}
        title="Record Non-Operating Money Movement"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setMovementModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveMovement}>
              Save Movement
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Transaction Date" required>
              <input
                type="date"
                className="input-field"
                value={movementForm.date}
                onChange={e => setMovementForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Movement Type" required>
              <select
                className="input-field"
                value={movementForm.type}
                onChange={e => {
                  const newType = e.target.value;
                  let defaultPayee = movementForm.payeeName;
                  if (newType.includes('Advance')) defaultPayee = salesmen[0]?.name || '';
                  if (newType.includes('Supplier')) defaultPayee = suppliers[0]?.name || '';
                  setMovementForm(prev => ({ ...prev, type: newType, payeeName: defaultPayee }));
                }}
              >
                {MOVEMENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormGroup>
          </div>

          {movementForm.type.includes('Advance') ? (
            <FormGroup label="Employee / Salesman" required>
              <select
                className="input-field"
                value={movementForm.payeeName}
                onChange={e => setMovementForm(prev => ({ ...prev, payeeName: e.target.value }))}
              >
                <option value="">-- Select Salesman / Staff --</option>
                {salesmen.map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.mobile})</option>
                ))}
              </select>
            </FormGroup>
          ) : movementForm.type === 'Supplier Payment' ? (
            <FormGroup label="Supplier" required>
              <select
                className="input-field"
                value={movementForm.payeeName}
                onChange={e => setMovementForm(prev => ({ ...prev, payeeName: e.target.value }))}
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.category})</option>
                ))}
              </select>
            </FormGroup>
          ) : (
            <FormGroup label="Payee / Counterparty Name" required>
              <input
                type="text"
                placeholder="e.g. Pump Owner / Partner"
                className="input-field"
                value={movementForm.payeeName}
                onChange={e => setMovementForm(prev => ({ ...prev, payeeName: e.target.value }))}
              />
            </FormGroup>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Amount (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 5000"
                className="input-field"
                value={movementForm.amount}
                onChange={e => setMovementForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Payment Source" required>
              <select
                className="input-field"
                value={movementForm.paymentSource}
                onChange={e => setMovementForm(prev => ({ ...prev, paymentSource: e.target.value }))}
              >
                {PAYMENT_SOURCES.map(s => (
                  <option key={s} value={s}>{s} {s === 'Cash' ? '(Reduces physical cash)' : '(Non-cash)'}</option>
                ))}
              </select>
            </FormGroup>
          </div>

          <FormGroup label="Remarks / Voucher Description">
            <input
              type="text"
              placeholder="e.g. Festival advance / Personal withdrawal / Oil supplier settlement"
              className="input-field"
              value={movementForm.remarks}
              onChange={e => setMovementForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </FormGroup>
        </div>
      </Modal>
    </div>
  );
}
