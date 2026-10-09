import { localDate } from '../../utils/dates.js';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  getAllCashCounts,
  getCashCountsByDate,
  saveCashCountEntry,
  deleteCashCountEntry,
  getActiveSalesmen,
  getDailyEntryByDate,
  getCustomerReceiptTotals,
  isPastDateLocked, addAuditLog,
} from '../../data/repository.js';
import { useReasonGate } from '../../components/ui/ReasonGate.jsx';
import { Breadcrumbs, useToast, Modal, ConfirmDialog } from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

const NOTES = [
  { key: 'n500', value: 500, label: '₹500' },
  { key: 'n200', value: 200, label: '₹200' },
  { key: 'n100', value: 100, label: '₹100' },
  { key: 'n50',  value: 50,  label: '₹50'  },
  { key: 'n20',  value: 20,  label: '₹20'  },
  { key: 'n10',  value: 10,  label: '₹10'  },
];

const COINS = [
  { key: 'c5', value: 5, label: '₹5' },
  { key: 'c2', value: 2, label: '₹2' },
  { key: 'c1', value: 1, label: '₹1' },
];

export default function CashCountPage() {
  const toast = useToast();
  const { requestReason, reasonDialog } = useReasonGate();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialDate = searchParams.get('date') || localDate();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [activeTab, setActiveTab] = useState('counter'); // 'counter' | 'history'

  const [attendants, setAttendants] = useState([]);
  const [person, setPerson] = useState('');
  const [showOtherName, setShowOtherName] = useState(false);
  const [historyPerson, setHistoryPerson] = useState('');
  const [note, setNote] = useState('');

  // Denominations state
  const [counts, setCounts] = useState({
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
    c5: 0,
    c2: 0,
    c1: 0,
  });
  const [looseChange, setLooseChange] = useState('');

  // Saved counts for selected date & all counts
  const [dateCounts, setDateCounts] = useState([]);
  const [allCounts, setAllCounts] = useState([]);

  // Detail view modal
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Daily Entry operational data for selected date (for expected cash reconciliation)
  const [dailyEntry, setDailyEntry] = useState(null);

  const loadData = () => {
    const listAll = getAllCashCounts();
    setAllCounts(listAll);
    const listDate = listAll.filter(c => c.date === selectedDate);
    setDateCounts(listDate);

    const activeStaff = getActiveSalesmen();
    setAttendants(activeStaff);

    const entry = getDailyEntryByDate(selectedDate);
    setDailyEntry(entry);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Handle URL param sync
  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    setSearchParams({ date: newDate });
  };

  // Calculations
  const calculatedTotal = useMemo(() => {
    let sum = 0;
    NOTES.forEach(n => {
      sum += (Number(counts[n.key]) || 0) * n.value;
    });
    COINS.forEach(c => {
      sum += (Number(counts[c.key]) || 0) * c.value;
    });
    sum += Number(looseChange) || 0;
    return sum;
  }, [counts, looseChange]);

  const totalNotesCount = useMemo(() => {
    return NOTES.reduce((s, n) => s + (Number(counts[n.key]) || 0), 0);
  }, [counts]);

  const totalCoinsCount = useMemo(() => {
    return COINS.reduce((s, c) => s + (Number(counts[c.key]) || 0), 0);
  }, [counts]);

  // Expected cash from Daily Entry (Cash Collections - Cash Deposits - Cash Expenses - Other Cash Payments)
  const expectedCash = useMemo(() => {
    if (!dailyEntry) return null;
    const collections = (dailyEntry.collections || [])
      .filter(c => c.paymentMode === 'Cash')
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const deposits = (dailyEntry.cashDeposits || [])
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const cashExpenses = (dailyEntry.expenses || [])
      .filter(e => !e.paymentSource || e.paymentSource === 'Cash')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const cashMovements = (dailyEntry.moneyMovements || [])
      .filter(m => !m.paymentSource || m.paymentSource === 'Cash')
      .reduce((s, m) => s + (Number(m.amount) || 0), 0);

    return Number((collections - deposits - cashExpenses - cashMovements + getCustomerReceiptTotals(dailyEntry.date).cash).toFixed(2));
  }, [dailyEntry]);

  // Combined physical cash counted for the selected date
  const totalPhysicalCountedOnDate = useMemo(() => {
    return dateCounts.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  }, [dateCounts]);

  // Stepper handlers
  const handleStep = (key, delta) => {
    setCounts(prev => {
      const current = Number(prev[key]) || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [key]: next };
    });
  };

  const handleInputChange = (key, val) => {
    const clean = val.replace(/[^0-9]/g, '');
    const num = clean === '' ? 0 : parseInt(clean, 10);
    setCounts(prev => ({ ...prev, [key]: num }));
  };

  // Names to pick from: active staff, then people who submitted cash before (newest first)
  const nameOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    const add = (n) => {
      const name = String(n || '').trim();
      if (!name || ['Others', 'Attendant', 'Forecourt Attendant'].includes(name)) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key); out.push(name);
    };
    attendants.forEach(a => add(a.name));
    [...allCounts].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(c => add(c.person));
    return out;
  }, [attendants, allCounts]);

  // Who already handed in cash on the selected date (name -> { n, total })
  const doneToday = useMemo(() => {
    const m = {};
    dateCounts.forEach(c => {
      const k = String(c.person || '').trim().toLowerCase();
      if (!m[k]) m[k] = { n: 0, total: 0 };
      m[k].n += 1; m[k].total += Number(c.amount) || 0;
    });
    return m;
  }, [dateCounts]);

  const handleClear = () => {
    setCounts({
      n500: 0,
      n200: 0,
      n100: 0,
      n50: 0,
      n20: 0,
      n10: 0,
      c5: 0,
      c2: 0,
      c1: 0,
    });
    setLooseChange('');
    setNote('');
    setPerson('');
    setShowOtherName(false);
  };

  const handleSave = async () => {
    if (calculatedTotal <= 0) {
      toast.error('Cannot save empty cash count of ₹0. Please enter denominations.');
      return;
    }

    if (!String(person || '').trim()) {
      toast.error('Please choose or type who is submitting this cash.');
      return;
    }

    let reasonGiven = '';
    if (isPastDateLocked(selectedDate)) {
      reasonGiven = await requestReason({ title: 'Save a cash count on a past date', date: selectedDate, detail: 'This changes that day\'s physical cash and difference.' });
      if (!reasonGiven) return;
    }

    try {
      saveCashCountEntry({
        date: selectedDate,
        person: person.trim(),
        note,
        denominations: counts,
        looseChange: Number(looseChange) || 0,
        amount: calculatedTotal,
      });

      if (reasonGiven) addAuditLog({ date: selectedDate, module: 'Cash Count', action: 'Added late', reason: reasonGiven, summary: `Counted ${INR(calculatedTotal)}` });
      toast.success(`Saved physical cash count of ${INR(calculatedTotal)} for ${selectedDate}!`);
      loadData();
      handleClear();
    } catch (err) {
      toast.error('Failed to save cash count: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const rec = getAllCashCounts().find(r => String(r.id) === String(id));
      if (rec && isPastDateLocked(rec.date)) {
        const why = await requestReason({ title: 'Delete a past cash count', date: rec.date, detail: 'This changes that day\'s physical cash.', confirmLabel: 'Delete count', danger: true });
        if (!why) { setDeleteConfirmId(null); return; }
        addAuditLog({ date: rec.date, module: 'Cash Count', action: 'Deleted', reason: why, summary: `Count of ${INR(rec.amount)}` });
      }
      deleteCashCountEntry(id);
      toast.success('Cash count entry deleted.');
      if (selectedEntry?.id === id) setSelectedEntry(null);
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const handleLoadEntryIntoCounter = (entry) => {
    setSelectedDate(entry.date);
    setPerson(entry.person || '');
    setNote(entry.note || '');
    setCounts({
      n500: entry.denominations?.n500 || 0,
      n200: entry.denominations?.n200 || 0,
      n100: entry.denominations?.n100 || 0,
      n50:  entry.denominations?.n50  || 0,
      n20:  entry.denominations?.n20  || 0,
      n10:  entry.denominations?.n10  || 0,
      c5:   entry.denominations?.c5   || 0,
      c2:   entry.denominations?.c2   || 0,
      c1:   entry.denominations?.c1   || 0,
    });
    setLooseChange(entry.looseChange !== undefined ? String(entry.looseChange) : '');
    setSelectedEntry(null);
    setActiveTab('counter');
    toast.info('Loaded entry into counter.');
  };

  // Group history by date
  const historyByDate = useMemo(() => {
    const map = new Map();
    allCounts.filter(c => !historyPerson || String(c.person || '').trim().toLowerCase() === historyPerson.toLowerCase()).forEach(c => {
      const d = c.date || 'Unknown';
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(c);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allCounts, historyPerson]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1000, margin: '0 auto' }}>
      {reasonDialog}
      <Breadcrumbs
        items={[
          { label: 'Operations', path: '/operations' },
          { label: 'Cash Count' },
        ]}
      />

      {/* Top Header */}
      <div className="cc-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span><Icon name="cash" /></span> Cash Count
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Physical cash denomination counter &amp; daily shift reconciliation
          </p>
        </div>

        {/* Date Selector & Tab Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            className="input-field"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{ fontWeight: 700, padding: '6px 12px', fontSize: 13, width: 'auto' }}
          />

          <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: 3, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <button
              className={`btn btn-sm ${activeTab === 'counter' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('counter')}
              style={{ fontWeight: 700, fontSize: 12 }}
            >
              Calculator
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('history')}
              style={{ fontWeight: 700, fontSize: 12 }}
            >
              History ({allCounts.length})
            </button>
          </div>
        </div>
      </div>

      {/* Reconciliation Comparison Banner */}
      {/* Expected / Physical / Difference */}
      {(() => {
        const physical = totalPhysicalCountedOnDate > 0 ? totalPhysicalCountedOnDate : calculatedTotal;
        const hasExpected = expectedCash !== null;
        const diff = hasExpected ? Number((physical - expectedCash).toFixed(2)) : 0;
        const isMatch = hasExpected && Math.abs(diff) < 1;
        const state = !hasExpected ? '' : isMatch ? 'is-ok' : 'is-bad';
        return (
          <div className="kpi-board cc-kpi" style={{ marginBottom: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }} aria-label={`Shift cash position for ${selectedDate}`}>
            <div className="kpi-cell" style={{ cursor: 'default' }}>
              <span className="kpi-label">Expected in forecourt</span>
              <span className="kpi-value">{hasExpected ? INR(expectedCash) : '—'}</span>
              <span className="kpi-sub">{hasExpected ? `From the daily entry of ${selectedDate}` : 'No daily entry for this date yet'}</span>
            </div>
            <div className="kpi-cell" style={{ cursor: 'default' }}>
              <span className="kpi-label">Physical counted</span>
              <span className="kpi-value" style={{ color: 'var(--color-accent)' }}>{INR(physical)}</span>
              <span className="kpi-sub">{totalPhysicalCountedOnDate > 0 ? 'Saved counts for this date' : 'Current calculator total'}</span>
            </div>
            <div className={`kpi-cell ${state}`} style={{ cursor: 'default' }}>
              <span className="kpi-label">Difference</span>
              <span className="kpi-value" style={{ color: !hasExpected ? 'var(--text-muted)' : isMatch ? 'var(--color-success)' : diff < 0 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                {!hasExpected ? '—' : isMatch ? '₹0.00' : (diff > 0 ? `+${INR(diff)}` : `-${INR(Math.abs(diff))}`)}
              </span>
              <span className="kpi-sub">{!hasExpected ? 'Needs a daily entry' : isMatch ? 'Matched' : diff > 0 ? 'Surplus' : 'Shortage'}</span>
            </div>
            {dailyEntry && (
              <button type="button" className="kpi-cell" onClick={() => navigate(`/operations/daily-entry?date=${selectedDate}`)}>
                <span className="kpi-label">Daily entry</span>
                <span className="kpi-value" style={{ fontSize: 14 }}>Open entry →</span>
                <span className="kpi-sub">{selectedDate}</span>
              </button>
            )}
          </div>
        );
      })()}

      {activeTab === 'counter' ? (
        <>
          {/* Total Display Banner */}
          <div
            className="section-block cc-banner"
            style={{
              background: 'linear-gradient(120deg, var(--color-success-subtle), transparent 70%), var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--color-success) 35%, var(--border-default))',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: 16,
              
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>
                Total cash counted
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-success)', lineHeight: 1.1, marginTop: 2 }}>
                {INR(calculatedTotal)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, fontSize: 13, fontWeight: 700 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '4px 10px', borderRadius: 6 }}>
                Notes: {totalNotesCount}
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '4px 10px', borderRadius: 6 }}>
                Coins: {totalCoinsCount}
              </div>
            </div>
          </div>

          {/* Meta Fields (Person & Note) */}
          <div className="section-block cc-meta" style={{ marginBottom: 16, padding: '9px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 10 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Who is submitting this cash? <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div className="who-chips" role="radiogroup" aria-label="Who is submitting the cash">
                  {nameOptions.map(n => {
                    const d = doneToday[n.toLowerCase()];
                    return (
                      <button type="button" key={n} role="radio" aria-checked={person === n}
                        className={`who-chip ${person === n ? 'on' : ''}`}
                        onClick={() => { setPerson(n); setShowOtherName(false); }}>
                        {d ? '✓ ' : ''}{n}
                        {d && <small>{INR(d.total)}</small>}
                      </button>
                    );
                  })}
                  <button type="button" className={`who-chip ${showOtherName ? 'on' : ''}`}
                    onClick={() => { setShowOtherName(true); setPerson(''); }}>
                    + New name
                  </button>
                </div>
                {showOtherName && (
                  <input type="text" className="input-field" autoFocus placeholder="Type name (e.g. Owner, Ramesh)"
                    value={person} onChange={(e) => setPerson(e.target.value)} style={{ fontSize: 13, marginTop: 6 }} />
                )}
                {person && doneToday[person.trim().toLowerCase()] && (
                  <div style={{ fontSize: 11.5, color: 'var(--color-warning)', marginTop: 6 }}>
                    {person.trim()} already gave {INR(doneToday[person.trim().toLowerCase()].total)} today ({doneToday[person.trim().toLowerCase()].n} entry). This will be another entry.
                  </div>
                )}
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                  Shift Remarks / Note (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Afternoon shift bag count, safe drop #101"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          {/* Denominations Tables */}
          <div className="cc-denoms" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 10, marginBottom: 16 }}>
            {/* Notes Section */}
            <div className="section-block cc-col" style={{ padding: '12px 14px' }}>
              <h3 className="cc-h" style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', }}>
                Currency Notes
              </h3>

              <div className="cc-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {NOTES.map(n => {
                  const qty = Number(counts[n.key]) || 0;
                  const rowTotal = qty * n.value;

                  return (
                    <div
                      key={n.key}
                      className="cc-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(44px, 60px) 40px minmax(0, 1fr) 40px minmax(60px, 90px)',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: qty > 0 ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                        border: qty > 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        {n.label}
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Decrease ${n.label}`}
                        onClick={() => handleStep(n.key, -1)}
                        style={{ height: 34, width: 34, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontWeight: 700, fontSize: 16 }}
                      >
                        -
                      </button>

                      <input
                        type="text"
                        inputMode="numeric"
                        className="input-field"
                        value={qty === 0 ? '' : qty}
                        placeholder="0"
                        aria-label={`${n.label} count`}
                        onChange={(e) => handleInputChange(n.key, e.target.value)}
                        style={{ textAlign: 'center', height: 34, fontSize: 16, fontWeight: 700 }}
                      />

                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Increase ${n.label}`}
                        onClick={() => handleStep(n.key, 1)}
                        style={{ height: 34, width: 34, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontWeight: 700, fontSize: 16 }}
                      >
                        +
                      </button>

                      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: qty > 0 ? 'var(--color-accent)' : 'var(--text-muted)' }}>
                        {INR(rowTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coins & Loose Change Section */}
            <div className="section-block cc-col" style={{ padding: '12px 14px' }}>
              <h3 className="cc-h" style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', }}>
                Coins &amp; Loose Cash
              </h3>

              <div className="cc-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {COINS.map(c => {
                  const qty = Number(counts[c.key]) || 0;
                  const rowTotal = qty * c.value;

                  return (
                    <div
                      key={c.key}
                      className="cc-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(44px, 60px) 40px minmax(0, 1fr) 40px minmax(60px, 90px)',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: qty > 0 ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                        border: qty > 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        {c.label}
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Decrease ${c.label}`}
                        onClick={() => handleStep(c.key, -1)}
                        style={{ height: 34, width: 34, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontWeight: 700, fontSize: 16 }}
                      >
                        -
                      </button>

                      <input
                        type="text"
                        inputMode="numeric"
                        className="input-field"
                        value={qty === 0 ? '' : qty}
                        placeholder="0"
                        aria-label={`${c.label} count`}
                        onChange={(e) => handleInputChange(c.key, e.target.value)}
                        style={{ textAlign: 'center', height: 34, fontSize: 16, fontWeight: 700 }}
                      />

                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Increase ${c.label}`}
                        onClick={() => handleStep(c.key, 1)}
                        style={{ height: 34, width: 34, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontWeight: 700, fontSize: 16 }}
                      >
                        +
                      </button>

                      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: qty > 0 ? 'var(--color-accent)' : 'var(--text-muted)' }}>
                        {INR(rowTotal)}
                      </div>
                    </div>
                  );
                })}

                {/* Loose Change Row */}
                <div
                  className="cc-loose"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 8px',
                    marginTop: 8,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Loose Change (₹)</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Uncounted pouch coins / petty change</div>
                  </div>

                  <div style={{ width: 120 }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input-field"
                      placeholder="₹ 0"
                      value={looseChange}
                      onChange={(e) => setLooseChange(e.target.value.replace(/[^0-9.]/g, ''))}
                      style={{ textAlign: 'right', fontWeight: 700, fontSize: 15 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="cc-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClear}
              style={{ fontWeight: 600 }}
            >
              Reset Counter
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              style={{ padding: '10px 24px', fontWeight: 700, fontSize: 14 }}
            >
              <Icon name="file" /> Save Cash Count ({INR(calculatedTotal)})
            </button>
          </div>

          {/* Counts saved on selected date */}
          {dateCounts.length > 0 && (
            <div className="section-block" style={{ marginTop: 14, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                  Saved Counts on {selectedDate} ({dateCounts.length})
                </h3>
                <div style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                  Total: {INR(totalPhysicalCountedOnDate)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dateCounts.map(entry => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{entry.person || 'Attendant'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {entry.note ? `${entry.note} • ` : ''}
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-accent)' }}>
                        {INR(entry.amount)}
                      </span>

                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setSelectedEntry(entry)}
                        style={{ fontSize: 12 }}
                      >
                        Breakdown
                      </button>

                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleLoadEntryIntoCounter(entry)}
                        title="Edit in counter"
                        style={{ fontSize: 12 }}
                      >
                        Edit
                      </button>

                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setDeleteConfirmId(entry.id)}
                        style={{ color: 'var(--color-danger)', fontSize: 12 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* History Tab */
        <div className="section-block" style={{ padding: '16px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
            Cash Count History by Date
          </h2>

          <div className="who-chips" style={{ marginBottom: 10 }} role="group" aria-label="Filter history by person">
            <button type="button" className={`who-chip ${!historyPerson ? 'on' : ''}`} onClick={() => setHistoryPerson('')}>Everyone</button>
            {nameOptions.map(n => (
              <button type="button" key={n} className={`who-chip ${historyPerson.toLowerCase() === n.toLowerCase() ? 'on' : ''}`} onClick={() => setHistoryPerson(n)}>{n}</button>
            ))}
          </div>
          {historyPerson && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Total from {historyPerson}: <strong>{INR(allCounts.filter(c => String(c.person || '').trim().toLowerCase() === historyPerson.toLowerCase()).reduce((t, c) => t + (Number(c.amount) || 0), 0))}</strong>
            </div>
          )}
          {historyByDate.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><Icon name="inbox" /></div>
              <div style={{ fontWeight: 700 }}>No cash count records yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Saved physical counts will appear here grouped by date.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {historyByDate.map(([dateKey, entriesList]) => {
                const daySum = entriesList.reduce((s, e) => s + (Number(e.amount) || 0), 0);

                return (
                  <div
                    key={dateKey}
                    style={{
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,0.02)',
                        borderBottom: '1px solid var(--border-default)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 15 }}>{dateKey}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                          ({entriesList.length} count{entriesList.length === 1 ? '' : 's'})
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-accent)' }}>
                          {INR(daySum)}
                        </span>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            setSelectedDate(dateKey);
                            setActiveTab('counter');
                          }}
                          style={{ fontSize: 12 }}
                        >
                          Open Date →
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {entriesList.map(item => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: 'rgba(0,0,0,0.15)',
                            fontSize: 13,
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600 }}>{item.person || 'Attendant'}</span>
                            {item.note && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>• {item.note}</span>}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 700 }}>{INR(item.amount)}</span>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => setSelectedEntry(item)}
                              style={{ padding: '2px 6px', fontSize: 11 }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Entry Detail Breakdown Modal */}
      {selectedEntry && (
        <Modal
          open={true}
          onClose={() => setSelectedEntry(null)}
          title={`Cash Breakdown • ${selectedEntry.date}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedEntry.person || 'Attendant'}</div>
                {selectedEntry.note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedEntry.note}</div>}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-accent)' }}>
                {INR(selectedEntry.amount)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 6, }}>
                Currency Notes
              </div>
              <div className="table-wrapper">
              <table className="table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Denomination</th>
                    <th>Count</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {NOTES.map(n => {
                    const cnt = selectedEntry.denominations?.[n.key] || 0;
                    if (cnt === 0) return null;
                    return (
                      <tr key={n.key}>
                        <td><strong>{n.label}</strong></td>
                        <td>{cnt}</td>
                        <td style={{ textAlign: 'right' }}>{INR(cnt * n.value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 6, }}>
                Coins &amp; Loose Cash
              </div>
              <div className="table-wrapper">
              <table className="table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Count / Amount</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {COINS.map(c => {
                    const cnt = selectedEntry.denominations?.[c.key] || 0;
                    if (cnt === 0) return null;
                    return (
                      <tr key={c.key}>
                        <td><strong>{c.label}</strong></td>
                        <td>{cnt}</td>
                        <td style={{ textAlign: 'right' }}>{INR(cnt * c.value)}</td>
                      </tr>
                    );
                  })}
                  {(Number(selectedEntry.looseChange) || 0) > 0 && (
                    <tr>
                      <td><strong>Loose Change</strong></td>
                      <td>—</td>
                      <td style={{ textAlign: 'right' }}>{INR(selectedEntry.looseChange)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button
                className="btn btn-ghost"
                onClick={() => handleLoadEntryIntoCounter(selectedEntry)}
              >
                <Icon name="edit" /> Load into Calculator
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setSelectedEntry(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <ConfirmDialog
          open={true}
          title="Delete Cash Count Record"
          message="Are you sure you want to delete this physical cash count entry? This cannot be undone."
          onConfirm={() => handleDelete(deleteConfirmId)}
          onClose={() => setDeleteConfirmId(null)}
          confirmLabel="Delete Count"
          confirmVariant="danger"
        />
      )}
    </div>
  );
}
