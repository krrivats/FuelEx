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

  return (
    <div>
      {/* Header: title, active shift, status, actions */}
      <div className="page-header">
        <div className="page-header-info">
          <h1>Business position</h1>
          <div className="status-line" style={{ marginTop: 4 }}>
            <span className="chip mono">{activeDate}</span>
            {activeEntry && !activeEntry.isToday && <span className="chip warn">Latest recorded day</span>}
            <span className={`chip ${activeStats.reconciled ? 'ok' : 'bad'}`}>
              <Icon name={activeStats.reconciled ? 'check' : 'alert'} />
              {activeStats.reconciled ? 'Sales balanced' : `Sales diff ${INR(activeStats.difference)}`}
            </span>
            {cashRecon.hasCount ? (
              <span className={`chip ${cashRecon.isMatched ? 'ok' : 'bad'}`}>
                <Icon name={cashRecon.isMatched ? 'check' : 'alert'} />
                {cashRecon.isMatched ? 'Cash matched' : `Cash diff ${signed(cashRecon.diff)}`}
              </span>
            ) : (
              <span className="chip">Cash not counted</span>
            )}
          </div>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/cash-count')}>
            <Icon name="cash" /> Cash count
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory')}>
            <Icon name="fuel" /> Tanks &amp; stock
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/reports')}>
            <Icon name="file" /> DSR report
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/operations/daily-entry/${todayDate}`)}>
            <Icon name="edit" /> Open today&apos;s entry
          </button>
        </div>
      </div>

      {/* 1. What needs attention */}
      {allAlerts.length > 0 ? (
        <div className="attention-list" role="list">
          {allAlerts.map((alert, idx) => (
            <div key={idx} role="listitem" className={`attention-item ${alert.type}`}>
              <div className="attention-body">
                <Icon name="alert" />
                <div className="attention-text">
                  <b>{alert.title}</b>
                  <span>{alert.message}</span>
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${alert.type === 'danger' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => navigate(alert.action)}
              >
                {alert.actionLabel}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="all-clear">
          <Icon name="check" />
          <span><b>All clear.</b> Tanks within capacity, sales balanced, credit limits respected.</span>
        </div>
      )}

      {/* 2. Today at a glance — primary metric first, then supporting figures */}
      <div className="kpi-board" style={{ marginBottom: 12 }}>
        <button type="button" className="kpi-cell primary" onClick={() => navigate(entryPath)}>
          <span className="kpi-label"><Icon name="fuel" /> Total sales</span>
          <span className="kpi-value" style={{ color: 'var(--color-primary)' }}>{INR(activeStats.salesValue)}</span>
          <span className="kpi-sub">Volume <strong>{FMT_QTY(activeStats.litres)}</strong></span>
        </button>
        <button type="button" className="kpi-cell" onClick={() => navigate('/operations/collections')}>
          <span className="kpi-label"><Icon name="card" /> Collected</span>
          <span className="kpi-value">{INR(activeStats.collected)}</span>
          <span className="kpi-sub">Cash, UPI QR &amp; cards</span>
        </button>
        <button type="button" className="kpi-cell" onClick={() => navigate('/finance')}>
          <span className="kpi-label"><Icon name="cash" /> Expected cash</span>
          <span className="kpi-value" style={{ color: 'var(--color-success)' }}>{INR(activeStats.cashRemaining)}</span>
          <span className="kpi-sub">After deposits &amp; expenses</span>
        </button>
        <button
          type="button"
          className={`kpi-cell ${cashRecon.hasCount ? (cashRecon.isMatched ? 'is-ok' : 'is-bad') : ''}`}
          onClick={() => navigate('/cash-count')}
        >
          <span className="kpi-label"><Icon name="cash" /> Physical cash</span>
          <span className="kpi-value">{cashRecon.hasCount ? INR(cashRecon.counted) : '₹0.00'}</span>
          <span className="kpi-sub">
            {cashRecon.hasCount ? (
              <strong className={cashRecon.isMatched ? 'text-success' : 'text-danger'}>
                {cashRecon.isMatched ? 'Exact match' : `Diff ${signed(cashRecon.diff)}`}
              </strong>
            ) : (
              <strong className="text-primary">Count notes</strong>
            )}
          </span>
        </button>
        <button type="button" className="kpi-cell" onClick={() => navigate('/crm')}>
          <span className="kpi-label"><Icon name="users" /> Today&apos;s udhaar</span>
          <span className="kpi-value" style={{ color: 'var(--color-warning)' }}>{INR(activeStats.udhaar)}</span>
          <span className="kpi-sub">Total balances <strong>{INR_ROUND(customerStats.totalOutstanding)}</strong></span>
        </button>
        <button type="button" className="kpi-cell" onClick={() => navigate('/inventory')}>
          <span className="kpi-label"><Icon name="fuel" /> Fuel in tanks</span>
          <span className="kpi-value" style={{ color: 'var(--color-accent)' }}>{fuelTotals.totalStockKL} KL</span>
          <span className="kpi-sub">of {fuelTotals.totalCapacityKL} KL · <strong>{fuelTotals.avgUtil}%</strong></span>
        </button>
      </div>

      {/* 3. Tanks + people */}
      <div className="cmd-layout" style={{ marginBottom: 12 }}>
        <section className="panel-flush" aria-label="Underground tanks">
          <div className="panel-head">
            <h2><Icon name="fuel" /> Underground tanks</h2>
            <Link to="/inventory" className="panel-link">Manage tanks &amp; top-ups</Link>
          </div>
          {stockSummaries.map((tank, idx) => {
            const isLow = tank.isLowStock;
            const isOver = tank.isOverCapacity;
            const barState = isOver ? 'bad' : isLow ? 'warn' : '';
            return (
              <button
                type="button"
                key={tank.productId || `tank-${idx}`}
                className="tank-row"
                onClick={() => navigate('/inventory')}
              >
                <div>
                  <div className="tank-name">{tank.productName}</div>
                  <div className="tank-sub">Capacity {tank.capacityKL} KL</div>
                </div>
                <div>
                  <div className="tank-stock">{tank.closingBookStockKL} KL</div>
                  <div className="tank-sub">{FMT_QTY(tank.closingBookStock)}</div>
                </div>
                <div>
                  <div className="tank-sub" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Utilization</span>
                    <strong style={{ color: isOver ? 'var(--color-danger)' : 'var(--text-primary)' }}>{tank.utilizationPercent}%</strong>
                  </div>
                  <div className={`tank-bar ${barState}`}><i style={{ width: `${Math.min(100, tank.utilizationPercent)}%` }} /></div>
                </div>
                <div className="tank-meta">
                  <span>Top-up <strong>{tank.topUpsTodayKL > 0 ? `+${tank.topUpsTodayKL} KL` : '0 KL'}</strong></span>
                  <span>Sales <strong style={{ color: 'var(--color-primary)' }}>{tank.salesTodayKL > 0 ? `-${tank.salesTodayKL} KL` : '0 KL'}</strong></span>
                  {tank.hasDip && (
                    <span>
                      Dip <strong>{FMT_QTY(tank.physicalDip)}</strong> ·{' '}
                      <strong style={{ color: tank.variation >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {tank.variation >= 0 ? `+${tank.variation}` : tank.variation} L
                      </strong>
                    </span>
                  )}
                </div>
                {isOver ? (
                  <span className="badge badge-danger"><Icon name="alert" className="icon-sm" /> {tank.overCapacityPercent}% over</span>
                ) : isLow ? (
                  <span className="badge badge-warning"><Icon name="alert" className="icon-sm" /> Low stock</span>
                ) : (
                  <span className="badge badge-success badge-dot">Healthy</span>
                )}
              </button>
            );
          })}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="panel-flush" aria-label="Customer credit">
            <div className="panel-head">
              <h2><Icon name="users" /> Customer credit</h2>
              <button type="button" className="panel-link" onClick={() => navigate('/crm')}>Open CRM</button>
            </div>
            <div className="stat-trio">
              <div><div className="stat-k">Registered</div><div className="stat-v">{customers.length}</div></div>
              <div><div className="stat-k">Receivables</div><div className="stat-v" style={{ color: 'var(--color-warning)' }}>{INR_ROUND(customerStats.totalOutstanding)}</div></div>
              <div><div className="stat-k">Over limit</div><div className="stat-v" style={{ color: customerStats.overLimitCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{customerStats.overLimitCount}</div></div>
            </div>
          </section>

          <section className="panel-flush" aria-label="Staff and payroll">
            <div className="panel-head">
              <h2><Icon name="users" /> Staff &amp; payroll</h2>
              <button type="button" className="panel-link" onClick={() => navigate('/crm')}>View payroll</button>
            </div>
            <div className="stat-trio">
              <div><div className="stat-k">Active staff</div><div className="stat-v">{employeeStats.activeEmployees}</div></div>
              <div><div className="stat-k">Salary due</div><div className="stat-v" style={{ color: employeeStats.totalSalaryDue > 0 ? 'var(--color-primary)' : 'var(--color-success)' }}>{INR_ROUND(employeeStats.totalSalaryDue)}</div></div>
              <div><div className="stat-k">Advances due</div><div className="stat-v" style={{ color: employeeStats.totalAdvancesOutstanding > 0 ? 'var(--color-warning)' : 'var(--text-secondary)' }}>{INR_ROUND(employeeStats.totalAdvancesOutstanding)}</div></div>
            </div>
          </section>
        </div>
      </div>

      {/* 4. Jump to */}
      <nav className="quick-links" aria-label="Quick links">
        <Link to="/operations/daily-entry" className="quick-link"><Icon name="edit" /> Daily entry &amp; meters</Link>
        <Link to="/cash-count" className="quick-link"><Icon name="cash" /> Cash count audit</Link>
        <Link to="/crm" className="quick-link"><Icon name="users" /> Customers &amp; staff</Link>
        <Link to="/inventory" className="quick-link"><Icon name="fuel" /> Tanks &amp; top-ups</Link>
        <Link to="/reports" className="quick-link"><Icon name="trending" /> Reports &amp; DSR</Link>
      </nav>
    </div>
  );
}
