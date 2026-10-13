import { localDate } from '../utils/dates.js';
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getDailyEntries,
  getFuelStockSummary,
  getCustomers,
  getCustomerOutstanding,
  getAllCustomerPayments,
  getCustomerReceiptTotals,
  getAllFuelReceipts,
  getCashCountTotalByDate,
  getEmployees,
  getEmployeeFinancialSummary,
} from '../data/repository.js';
import Icon from '../components/ui/Icon.jsx';
import { getLastBackupAt, describeAge, summarizeThisDevice } from '../utils/backup.js';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INR_ROUND = (v) => '₹' + Math.round(Number(v || 0)).toLocaleString('en-IN');
const FMT_QTY = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';

export default function DashboardPage() {
  const navigate = useNavigate();
  const todayDate = localDate();

  const [dailyEntries, setDailyEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [cashCountTotal, setCashCountTotal] = useState(0);

  useEffect(() => {
    setDailyEntries(getDailyEntries());
    setCustomers(getCustomers());
    setEmployees(getEmployees());
    setPayments(getAllCustomerPayments());
    setReceipts(getAllFuelReceipts());
  }, []);

  // Find today's entry or latest available entry
  const activeEntry = useMemo(() => {
    const todayEntry = dailyEntries.find(e => e.date === todayDate);
    if (todayEntry) return { ...todayEntry, isToday: true };
    if (dailyEntries.length > 0) {
      const sorted = [...dailyEntries].sort((a, b) => b.date.localeCompare(a.date));
      return { ...sorted[0], isToday: false };
    }
    return null;
  }, [dailyEntries, todayDate]);

  const activeDate = activeEntry ? activeEntry.date : todayDate;

  // Retrieve physical cash count total for active date
  useEffect(() => {
    setCashCountTotal(getCashCountTotalByDate(activeDate));
  }, [activeDate, dailyEntries]);

  // Real-time stock summaries with capacity and utilization
  const stockSummaries = useMemo(() => {
    const list = getFuelStockSummary(activeDate);
    return Array.isArray(list) ? list : [list];
  }, [activeDate, receipts, dailyEntries]);

  // Total station fuel capacity and current stock
  const fuelTotals = useMemo(() => {
    let totalStockKL = 0;
    let totalCapacityKL = 0;
    stockSummaries.forEach(t => {
      totalStockKL += Number(t.closingBookStockKL || 0);
      totalCapacityKL += Number(t.capacityKL || 0);
    });
    const avgUtil = totalCapacityKL > 0 ? Math.round((totalStockKL / totalCapacityKL) * 100) : 0;
    return {
      totalStockKL: Number(totalStockKL.toFixed(2)),
      totalCapacityKL: Number(totalCapacityKL.toFixed(2)),
      avgUtil,
    };
  }, [stockSummaries]);

  // Over-capacity tanks
  const overCapacityTanks = useMemo(() => {
    return stockSummaries.filter(t => t.isOverCapacity);
  }, [stockSummaries]);

  // Low stock tanks
  const lowStockTanks = useMemo(() => {
    return stockSummaries.filter(t => t.isLowStock);
  }, [stockSummaries]);

  // Customer outstanding totals & over-limit count
  const customerStats = useMemo(() => {
    let totalOutstanding = 0;
    let overLimitCount = 0;
    let overLimitAmount = 0;
    customers.forEach(c => {
      const out = getCustomerOutstanding(c.id);
      if (out.outstanding > 0) totalOutstanding += out.outstanding;
      if (out.creditLimit > 0 && out.outstanding > out.creditLimit) {
        overLimitCount++;
        overLimitAmount += (out.outstanding - out.creditLimit);
      }
    });
    return { totalOutstanding, overLimitCount, overLimitAmount };
  }, [customers, payments, dailyEntries]);

  // Employee CRM summary
  const employeeStats = useMemo(() => {
    const currentMonthStr = activeDate.slice(0, 7);
    const active = employees.filter(e => e.status === 'active');
    let totalSalaryDue = 0;
    let totalAdvancesOutstanding = 0;
    employees.forEach(emp => {
      const summary = getEmployeeFinancialSummary(emp.id, currentMonthStr);
      totalSalaryDue += (summary.salaryDue || 0);
      totalAdvancesOutstanding += (summary.advanceOutstanding || 0);
    });
    return {
      totalEmployees: employees.length,
      activeEmployees: active.length,
      totalSalaryDue,
      totalAdvancesOutstanding,
    };
  }, [employees, activeDate]);

  // Calculations for active day
  const activeStats = useMemo(() => {
    if (!activeEntry) {
      return {
        salesValue: 0,
        litres: 0,
        collected: 0,
        udhaar: 0,
        cashRemaining: 0,
        expenses: 0,
        reconciled: true,
        difference: 0,
      };
    }
    const salesValue = Number(activeEntry.totalSalesValue || 0);
    const litres = Number(activeEntry.totalFuelLitres ?? activeEntry.totalLitres ?? 0);
    const collected = Number(activeEntry.totalCollections || 0);
    const udhaar = Number(activeEntry.totalUdhaar || 0);
    const cashRemaining = Number((Number(activeEntry.cashRemaining || 0) + getCustomerReceiptTotals(activeEntry.date).cash).toFixed(2));
    const expenses = Number(activeEntry.totalExpenses || 0);
    const difference = Number(activeEntry.reconciliationDifference || 0);
    const reconciled = Math.abs(difference) < 0.01;

    return {
      salesValue,
      litres,
      collected,
      udhaar,
      cashRemaining,
      expenses,
      reconciled,
      difference,
    };
  }, [activeEntry, payments]);

  // Physical Cash Reconciliation
  const cashRecon = useMemo(() => {
    const expected = activeStats.cashRemaining;
    const counted = cashCountTotal;
    const hasCount = counted > 0;
    const diff = Number((counted - expected).toFixed(2));
    const isMatched = Math.abs(diff) < 0.01;
    return {
      expected,
      counted,
      hasCount,
      diff,
      isMatched,
    };
  }, [activeStats.cashRemaining, cashCountTotal]);

  // Compute operational alerts list for hierarchy
  const activeAlerts = useMemo(() => {
    const list = [];
    if (overCapacityTanks.length > 0) {
      list.push({
        type: 'danger',
        title: 'Tank Over Capacity',
        message: overCapacityTanks.map(t => `${t.productName}: ${t.closingBookStockKL} KL in ${t.capacityKL} KL tank (${t.overCapacityPercent}%)`).join(', '),
        action: '/inventory',
        actionLabel: 'Inspect Tanks',
      });
    }
    if (lowStockTanks.length > 0) {
      list.push({
        type: 'warning',
        title: 'Low Fuel Stock Alert',
        message: lowStockTanks.map(t => `${t.productName}: ${t.closingBookStockKL} KL remaining`).join(', '),
        action: '/inventory',
        actionLabel: 'Top-Up Tank',
      });
    }
    if (customerStats.overLimitCount > 0) {
      list.push({
        type: 'warning',
        title: `${customerStats.overLimitCount} Customer${customerStats.overLimitCount > 1 ? 's' : ''} Over Credit Limit`,
        message: `Total excess credit: ${INR_ROUND(customerStats.overLimitAmount)} above authorized limits`,
        action: '/crm',
        actionLabel: 'Review CRM',
      });
    }
    if (cashRecon.hasCount && !cashRecon.isMatched) {
      list.push({
        type: 'danger',
        title: 'Physical Cash Discrepancy',
        message: `Audit variance of ${cashRecon.diff > 0 ? '+' : ''}${INR(cashRecon.diff)} between physical notes and expected register`,
        action: '/cash-count',
        actionLabel: 'Audit Denominations',
      });
    }
    if (!activeStats.reconciled) {
      list.push({
        type: 'warning',
        title: 'Forecourt Shift Sales Variance',
        message: `Shift reconciliation variance: ${INR(activeStats.difference)}`,
        action: activeEntry ? `/operations/daily-entry/${activeEntry.date}` : '/operations/daily-entry',
        actionLabel: 'Check Readings',
      });
    }
    return list;
  }, [overCapacityTanks, lowStockTanks, customerStats, cashRecon, activeStats, activeEntry]);

  // Daily backup reminder (UI only): shown once there is data and no backup in the last 20 hours
  const lastBackupAt = getLastBackupAt();
  const needsBackup = summarizeThisDevice().entries > 0 && (!lastBackupAt || Date.now() - lastBackupAt > 20 * 3600 * 1000);
  const allAlerts = needsBackup
    ? [...activeAlerts, {
        type: 'warning',
        title: 'Backup due.',
        message: lastBackupAt ? `Last backup ${describeAge(lastBackupAt)}.` : 'No backup taken on this device yet.',
        action: '/settings',
        actionLabel: 'Share backup',
      }]
    : activeAlerts;

  const entryPath = activeEntry ? `/operations/daily-entry/${activeEntry.date}` : '/operations/daily-entry';
  const signed = (n) => `${n > 0 ? '+' : ''}${INR(n)}`;
  const hasToday = Boolean(activeEntry?.isToday);
  const testLitres = Number(activeEntry?.totalTestLitres || 0);

  // Product colour: petrol cyan, diesel blue, speed green, others muted
  const toneOf = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('speed') || n.includes('power')) return 'var(--color-success)';
    if (n.includes('diesel') || n.includes('hsd')) return 'var(--color-primary)';
    if (n.includes('petrol') || n.includes('ms')) return 'var(--color-accent)';
    return 'var(--text-muted)';
  };
  const dispensed = stockSummaries.map(t => ({ id: t.productId, name: t.productName, litres: Number(t.salesToday || 0), tone: toneOf(t.productName) }));
  const dispensedTotal = dispensed.reduce((sum, d) => sum + d.litres, 0);

  // Day status banner
  const dayOk = activeEntry && activeStats.reconciled && (!cashRecon.hasCount || cashRecon.isMatched);
  const bannerTone = !activeEntry ? 'var(--color-primary)' : dayOk ? 'var(--color-success)' : 'var(--color-warning)';
  const bannerTitle = !activeEntry ? 'No day entered yet' : dayOk ? 'Day balanced' : 'Needs a check';
  const bannerText = !activeEntry
    ? 'Start today’s entry: meters, collections and cash.'
    : `${activeStats.reconciled ? 'Meter sales match collections + udhaar' : `Sales diff ${INR(activeStats.difference)}`} · ${cashRecon.hasCount ? (cashRecon.isMatched ? 'cash count matched' : `cash diff ${signed(cashRecon.diff)}`) : 'cash not counted yet'}`;
  const variancePct = activeStats.salesValue > 0 ? Math.abs(activeStats.difference / activeStats.salesValue) * 100 : 0;
  const dayLabel = new Date(`${activeDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const alertTone = (type) => (type === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)');

  return (
    <div className="dx">
      {/* Context bar: day + quick lock */}
      <div className="dx-card dx-context">
        <div style={{ minWidth: 0 }}>
          <div className="dx-context-title"><span className="dot" /><span className="truncate">{hasToday ? 'Today' : activeEntry ? 'Latest recorded day' : 'Today'}</span></div>
          <div className="dx-context-sub">{activeEntry ? `${activeEntry.status === 'completed' ? 'Completed' : 'Draft'} · ${activeDate}` : `No entry · ${activeDate}`}</div>
        </div>
        <div className="dx-context-actions">
          <button type="button" className="dx-icon-btn" onClick={() => navigate('/operations/entries')} aria-label="All daily entries">
            <Icon name="list" /> {dayLabel}
          </button>
          <button type="button" className="dx-icon-btn" onClick={() => navigate('/reports')} aria-label="DSR report">
            <Icon name="file" />
          </button>
        </div>
      </div>

      {/* Day status banner */}
      <div className="dx-banner" style={{ '--tone': bannerTone }}>
        <span className="dx-tile"><Icon name={dayOk ? 'check' : activeEntry ? 'alert' : 'info'} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="dx-banner-title">
            {bannerTitle}
            {activeEntry && <span className="dx-pill">{variancePct.toFixed(2)}% VAR</span>}
          </div>
          <p>{bannerText}</p>
        </div>
      </div>

      {/* Main action */}
      <button type="button" className="dx-cta" onClick={() => navigate(`/operations/daily-entry/${todayDate}`)}>
        <Icon name={hasToday ? 'edit' : 'plus'} />
        <span>{hasToday ? 'Continue today’s entry' : 'Start today’s daily entry'}</span>
        <Icon name="chevron" />
      </button>

      {/* KPI 2×2 (4 across on desktop) */}
      <div className="dx-kpis">
        <button type="button" className="dx-card dx-kpi" onClick={() => navigate(entryPath)}>
          <span className="dx-kpi-head">Total sales <Icon name="fuel" className="text-primary" /></span>
          <span className="dx-kpi-value">{INR_ROUND(activeStats.salesValue)}</span>
          <span className="dx-kpi-sub">{Number(activeStats.litres).toLocaleString('en-IN', { maximumFractionDigits: 0 })} L sold{testLitres > 0 && <> · {Number(testLitres).toLocaleString('en-IN', { maximumFractionDigits: 1 })} L test</>}</span>
        </button>
        <button type="button" className="dx-card dx-kpi" onClick={() => navigate('/operations/collections')}>
          <span className="dx-kpi-head">Collected <Icon name="card" className="text-success" /></span>
          <span className="dx-kpi-value text-success">{INR_ROUND(activeStats.collected)}</span>
          <span className="dx-kpi-sub">Cash, UPI &amp; card</span>
        </button>
        <button type="button" className="dx-card dx-kpi" onClick={() => navigate('/cash-count')}>
          <span className="dx-kpi-head">Physical cash <Icon name="cash" className="text-accent" /></span>
          <span className="dx-kpi-value">{cashRecon.hasCount ? INR_ROUND(cashRecon.counted) : '—'}</span>
          <span className="dx-kpi-sub">
            {cashRecon.hasCount
              ? <strong className={cashRecon.isMatched ? 'text-success' : 'text-danger'}>{cashRecon.isMatched ? 'Exact match' : `Diff ${signed(cashRecon.diff)}`}</strong>
              : <>Expected {INR_ROUND(activeStats.cashRemaining)}</>}
          </span>
        </button>
        <button type="button" className="dx-card dx-kpi" onClick={() => navigate('/crm')}>
          <span className="dx-kpi-head">Udhaar / credit <Icon name="users" className="text-danger" /></span>
          <span className="dx-kpi-value text-danger">{INR_ROUND(activeStats.udhaar)}</span>
          <span className="dx-kpi-sub">Total due {INR_ROUND(customerStats.totalOutstanding)}</span>
        </button>
      </div>

      <div className="dx-cols">
        <div className="dx-stack">
          {/* Alerts */}
          <section aria-label="Alerts">
            <div className="dx-head" style={{ padding: '0 4px' }}>
              <h2>Active alerts {allAlerts.length > 0 && <span className="dx-count">{allAlerts.length}</span>}</h2>
            </div>
            {allAlerts.length > 0 ? (
              <div className="dx-alerts" role="list">
                {allAlerts.map((alert, idx) => (
                  <button type="button" role="listitem" key={idx} className="dx-alert" style={{ '--tone': alertTone(alert.type) }} onClick={() => navigate(alert.action)}>
                    <span className="dx-tile"><Icon name="alert" /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="dx-alert-title" style={{ display: 'block' }}>{alert.title}</span>
                      <span className="dx-alert-msg" style={{ display: 'block' }}>{alert.message}</span>
                    </span>
                    <span className="dx-alert-go">{alert.actionLabel}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="dx-clear"><Icon name="check" /><span><b>All clear.</b> Tanks fine, sales balanced, credit limits respected.</span></div>
            )}
          </section>

          {/* Tanks */}
          <section className="dx-card" aria-label="Underground tanks" style={{ padding: 14 }}>
            <div className="dx-head">
              <div>
                <h2>Underground tanks</h2>
                <p>Book stock · {fuelTotals.totalStockKL} of {fuelTotals.totalCapacityKL} KL</p>
              </div>
              <Link to="/inventory" className="dx-link">Manage</Link>
            </div>
            <div className="dx-tanks">
              {stockSummaries.map((tank, idx) => {
                const tone = tank.isOverCapacity || tank.isLowStock ? 'var(--color-danger)' : toneOf(tank.productName);
                return (
                  <button type="button" key={tank.productId || `tank-${idx}`} className="dx-tank" style={{ '--tone': tone }} onClick={() => navigate('/inventory')}>
                    <span className="dx-tank-top">
                      <span className="dx-tank-name">
                        <span className="truncate">{tank.productName}</span>
                        <span className={`dx-pill ${tank.isLowStock || tank.isOverCapacity ? 'text-danger' : ''}`}>
                          {tank.utilizationPercent}%{tank.isLowStock ? ' LOW' : tank.isOverCapacity ? ' OVER' : ''}
                        </span>
                      </span>
                      <span className="dx-tank-vol" style={{ color: tank.isLowStock || tank.isOverCapacity ? 'var(--color-danger)' : undefined }}>
                        {Math.round(tank.closingBookStock).toLocaleString('en-IN')} / {Math.round(tank.capacityLitres).toLocaleString('en-IN')} L
                      </span>
                    </span>
                    <span className="dx-bar"><i style={{ width: `${Math.min(100, Math.max(0, tank.utilizationPercent))}%` }} /></span>
                    <span className="dx-tank-foot">
                      <span>{tank.topUpsTodayKL > 0 ? `Top-up +${tank.topUpsTodayKL} KL` : `Sold ${FMT_QTY(tank.salesToday)}`}</span>
                      <span>
                        {tank.hasDip
                          ? <>Dip {tank.variation >= 0 ? '+' : ''}{tank.variation} L</>
                          : `Ullage ${Math.max(0, Math.round(tank.capacityLitres - tank.closingBookStock)).toLocaleString('en-IN')} L`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="dx-stack">
          {/* Fuel dispensed */}
          <section className="dx-card" aria-label="Fuel sold" style={{ padding: 14 }}>
            <div className="dx-head">
              <h2>Fuel sold</h2>
              <span className="dx-kpi-sub">{FMT_QTY(dispensedTotal)} total</span>
            </div>
            <div className="dx-seg" aria-hidden="true">
              {dispensedTotal > 0
                ? dispensed.filter(d => d.litres > 0).map(d => <i key={d.id} style={{ width: `${(d.litres / dispensedTotal) * 100}%`, background: d.tone }} />)
                : <i style={{ width: '100%', background: 'transparent' }} />}
            </div>
            <div className="dx-mix">
              {dispensed.map(d => (
                <div key={d.id}>
                  <div className="dx-mix-k"><i style={{ background: d.tone }} /> <span className="truncate">{d.name}</span></div>
                  <div className="dx-mix-v">{FMT_QTY(d.litres)}</div>
                  <div className="dx-mix-s" style={{ color: d.tone }}>{dispensedTotal > 0 ? Math.round((d.litres / dispensedTotal) * 100) : 0}% share</div>
                </div>
              ))}
              {testLitres > 0 && (
                <div>
                  <div className="dx-mix-k"><Icon name="flask" className="icon-sm" /> Testing</div>
                  <div className="dx-mix-v">{FMT_QTY(testLitres)}</div>
                  <div className="dx-mix-s text-muted">Not sold</div>
                </div>
              )}
            </div>
          </section>

          {/* Customer credit */}
          <section className="dx-card" aria-label="Customer credit" style={{ padding: 14 }}>
            <div className="dx-head">
              <h2><Icon name="users" className="text-primary" /> Customer credit</h2>
              <button type="button" className="dx-link" onClick={() => navigate('/crm')}>View ledger</button>
            </div>
            <div className="dx-big">
              <div>
                <div className="dx-big-k">Total receivables</div>
                <div className="dx-big-v">{INR_ROUND(customerStats.totalOutstanding)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="dx-big-k" style={{ color: customerStats.overLimitCount > 0 ? 'var(--color-danger)' : undefined }}>Over limit</div>
                <div className="dx-big-v" style={{ fontSize: 18, color: customerStats.overLimitCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {customerStats.overLimitCount} <span style={{ fontSize: 12 }}>of {customers.length}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Staff */}
          <section className="dx-card" aria-label="Staff and payroll" style={{ padding: 14 }}>
            <div className="dx-head">
              <h2><Icon name="users" className="text-accent" /> Staff &amp; payroll</h2>
              <button type="button" className="dx-link" onClick={() => navigate('/crm')}>Manage</button>
            </div>
            <div className="dx-trio">
              <div><div className="k">Active</div><div className="v text-success">{employeeStats.activeEmployees}</div></div>
              <div><div className="k">Salary due</div><div className="v">{INR_ROUND(employeeStats.totalSalaryDue)}</div></div>
              <div><div className="k">Advances</div><div className="v text-accent">{INR_ROUND(employeeStats.totalAdvancesOutstanding)}</div></div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer status */}
      <div className="dx-foot">
        <span><span className="dx-live" />Saved on this device</span>
        <button type="button" className="dx-link" onClick={() => navigate('/settings')}>
          {lastBackupAt ? `Backup ${describeAge(lastBackupAt)}` : 'No backup yet'}
        </button>
      </div>
    </div>
  );
}
