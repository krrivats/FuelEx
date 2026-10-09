import { useState, useMemo } from 'react';
import {
  getCustomerPaymentsByDate, createCustomerPayment, deleteCustomerPayment,
  getCustomerOutstanding, dailyEntryNeedsReason, addAuditLog,
} from '../../data/repository.js';
import { useReasonGate } from '../../components/ui/ReasonGate.jsx';
import { useToast } from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MODES = ['Cash', 'UPI', 'Card', 'Bank'];
const QUICK = [500, 1000, 5000, 10000];

/**
 * Money received from customers (clears Udhaar). Saves at once.
 * Cash adds to cash in hand. UPI / Card / Bank go to the bank.
 */
export default function ReceiptsPanel({ date, customers, entryId, onChange }) {
  const toast = useToast();
  const { requestReason, reasonDialog } = useReasonGate();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [custId, setCustId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [note, setNote] = useState('');

  const list = useMemo(() => getCustomerPaymentsByDate(date), [date, tick]);
  const total = list.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter(c => !q || (c.name || '').toLowerCase().includes(q) || String(c.mobile || '').includes(q))
      .map(c => ({ c, due: getCustomerOutstanding(c.id).outstanding }))
      .sort((a, b) => b.due - a.due);
  }, [customers, search, tick]);

  const selected = customers.find(c => c.id === custId);
  const selDue = selected ? getCustomerOutstanding(selected.id).outstanding : 0;
  const amt = Number(amount);
  const overpay = selected && amt > selDue + 0.009;

  const done = () => { setTick(t => t + 1); onChange && onChange(); };

  const save = async () => {
    if (!selected) return toast.error('Pick a customer first.');
    if (!(amt > 0)) return toast.error('Enter an amount more than 0.');
    let reason = '';
    if (dailyEntryNeedsReason(date)) {
      reason = await requestReason({ title: 'Add payment to a past day', date, detail: `${selected.name} paid ${INR(amt)}`, confirmLabel: 'Save payment' });
      if (!reason) return;
    }
    createCustomerPayment({
      date, customerId: selected.id, amount: amt, paymentMode: mode,
      remarks: note, source: 'daily-entry', dailyEntryId: entryId || null,
    });
    if (reason) addAuditLog({ date, module: 'Customer payment', action: 'Added', reason, summary: `${selected.name} ${INR(amt)} (${mode})` });
    toast.success(`${INR(amt)} received from ${selected.name}`);
    setAmount(''); setNote(''); setCustId('');
    done();
  };

  const remove = async (p) => {
    let reason = '';
    if (dailyEntryNeedsReason(date)) {
      reason = await requestReason({ title: 'Delete payment from a past day', date, detail: `${p.customerName} ${INR(p.amount)}`, confirmLabel: 'Delete payment' });
      if (!reason) return;
    }
    deleteCustomerPayment(p.id);
    if (reason) addAuditLog({ date, module: 'Customer payment', action: 'Deleted', reason, summary: `${p.customerName} ${INR(p.amount)} (${p.paymentMode})` });
    toast.success('Payment removed');
    done();
  };

  return (
    <div className="rcpt">
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
        Money received from customers. It reduces their Udhaar. <strong>Cash adds to cash in hand.</strong> UPI / Card / Bank go to the bank.
      </div>

      <div className="cust-picker">
        <input className="input-field" placeholder="🔍 Search customer…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search customer" />
        <div className="cust-list" role="listbox" aria-label="Customers">
          {rows.length === 0 && <div className="cust-empty">No customer found</div>}
          {rows.map(({ c, due }) => (
            <button type="button" key={c.id} role="option" aria-selected={c.id === custId}
              className={`cust-row ${c.id === custId ? 'is-on' : ''}`} onClick={() => setCustId(c.id)}>
              <span className="cust-name">{c.name}</span>
              <span className={`cust-due ${due > 0 ? 'has' : ''}`}>{due > 0 ? `Due ${INR(due)}` : 'No dues'}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="rcpt-form">
          <div className="rcpt-sel"><strong>{selected.name}</strong> · Due {INR(selDue)}</div>
          <div className="rcpt-amt-row">
            <input className="input-field" type="text" inputMode="decimal" placeholder="₹ Amount" value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Amount received" />
            {selDue > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAmount(String(selDue))}>Full due</button>}
          </div>
          <div className="chip-row">
            {QUICK.map(q => <button type="button" key={q} className="chip" onClick={() => setAmount(String(q))}>₹{q.toLocaleString('en-IN')}</button>)}
          </div>
          <div className="seg" role="group" aria-label="Payment mode">
            {MODES.map(m => <button type="button" key={m} className={`seg-btn ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>{m}</button>)}
          </div>
          <input className="input-field" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
          {overpay && <div className="rcpt-warn">⚠️ This is more than the due ({INR(selDue)}). The extra will show as advance (negative due).</div>}
          <button type="button" className="btn btn-primary" onClick={save}><Icon name="plus" /> Save payment received</button>
        </div>
      )}

      <div className="rcpt-list">
        <div className="rcpt-head">Received today: <strong>{INR(total)}</strong> ({list.length})</div>
        {list.length === 0 ? <div className="cust-empty">No payments received on this day.</div> : (
          <table className="table" style={{ margin: 0, fontSize: 13 }}>
            <thead><tr><th>Customer</th><th>Amount</th><th>Mode</th><th>Note</th><th style={{ width: 50 }}></th></tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id}>
                  <td data-label="Customer" style={{ fontWeight: 600 }}>{p.customerName || '—'}</td>
                  <td data-label="Amount" style={{ fontWeight: 700, color: 'var(--color-success)' }}>{INR(p.amount)}</td>
                  <td data-label="Mode"><span className={`badge ${p.paymentMode === 'Cash' ? 'badge-warning' : 'badge-neutral'}`}>{p.paymentMode}</span></td>
                  <td data-label="Note">{p.remarks || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => remove(p)} aria-label="Delete payment"><Icon name="trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {reasonDialog}
    </div>
  );
}
