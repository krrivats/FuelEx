import { localDate } from '../../utils/dates.js';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getDailyEntries, getAllMeterReadings, getAllCollections,
  getAllCashDeposits, getAllExpenses, getActiveNozzles,
} from '../../data/repository.js';
import { Breadcrumbs } from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function OperationsLandingPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({
    totalLitres: 0,
    totalSalesValue: 0,
    totalCollections: 0,
    totalDeposits: 0,
    totalExpenses: 0,
    activeNozzlesCount: 0,
  });

  const today = localDate();

  useEffect(() => {
    const allEntries = getDailyEntries();
    setEntries(allEntries);

    const totalLitres = allEntries.reduce((s, e) => s + (e.totalFuelLitres || 0), 0);
    const totalSalesValue = allEntries.reduce((s, e) => s + (e.totalSalesValue || 0), 0);
    const totalCollections = allEntries.reduce((s, e) => s + (e.totalCollections || 0), 0);
    const totalDeposits = allEntries.reduce((s, e) => s + (e.totalCashDeposited || 0), 0);
    const totalExpenses = allEntries.reduce((s, e) => s + (e.totalExpenses || 0), 0);
    const activeNozzles = getActiveNozzles().length;

    setStats({
      totalLitres,
      totalSalesValue,
      totalCollections,
      totalDeposits,
      totalExpenses,
      activeNozzlesCount: activeNozzles,
    });
  }, []);

  const todayEntry = entries.find(e => e.date === today);

  const modules = [
    {
      to: '/operations/daily-entry',
      icon: 'edit',
      title: 'Daily Entry',
      badge: 'Primary Workflow',
      badgeClass: 'badge-active',
      description: 'Single screen for meter readings, sales valuation, payment collections, cash deposits, and expenses.',
      cta: "Open Daily Entry →",
      highlight: true,
    },
    {
      to: '/operations/entries',
      icon: 'list',
      title: 'Daily Entries Log',
      badge: `${entries.length} Days`,
      badgeClass: 'badge-default',
      description: 'Browse all recorded operational days, reconciliation statuses, and open any day for editing.',
      cta: 'View All Days →',
    },
    {
      to: '/operations/meter-readings',
      icon: 'bolt',
      title: 'Meter Readings',
      badge: `${stats.activeNozzlesCount} Nozzles`,
      badgeClass: 'badge-default',
      description: 'Audit nozzle totalizers, opening/closing meters, and fuel volume dispensed per nozzle.',
      cta: 'View Meter Readings →',
    },
    {
      to: '/operations/collections',
      icon: 'card',
      title: 'Collections',
      badge: INR(stats.totalCollections),
      badgeClass: 'badge-default',
      description: 'Cash, UPI, Card, Paytm, and customer Udhaar payment receipts.',
      cta: 'View Collections →',
    },
    {
      to: '/operations/cash-deposits',
      icon: 'bank',
      title: 'Cash Deposits',
      badge: INR(stats.totalDeposits),
      badgeClass: 'badge-default',
      description: 'Track mid-day cash drops, attendant shift handovers, and bank locker deposits.',
      cta: 'View Cash Deposits →',
    },
    {
      to: '/operations/expenses',
      icon: 'inbox',
      title: 'Daily Expenses',
      badge: INR(stats.totalExpenses),
      badgeClass: 'badge-default',
      description: 'Review operational petty cash expenses, generator fuel, tea, and maintenance vouchers.',
      cta: 'View Expenses →',
    },
    {
      to: '/operations/cash-count',
      icon: 'cash',
      title: 'Cash Count & Reconciliation',
      badge: 'Physical Drawer',
      badgeClass: 'badge-default',
      description: 'Denomination-level physical currency counter. Reconcile forecourt drawer cash against expected cash in real-time.',
      cta: 'Count Cash →',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Operations' },
            ]}
          />
          <h1>Operations</h1>
          <p>
            Daily pump operations hub. Record meter readings, track collections, manage cash handovers, and reconcile daily business.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/operations/daily-entry?date=${today}`)}
          >
            {todayEntry ? "Edit today's entry" : "Start today's entry"}
          </button>
        </div>
      </div>

      {/* Featured primary action */}
      <div className="panel" style={{
        marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        background: 'linear-gradient(120deg, var(--color-primary-subtle), transparent 70%), var(--bg-surface)',
        borderColor: 'color-mix(in srgb, var(--color-primary) 35%, var(--border-default))',
      }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 650, fontSize: 14 }}>Daily entry workflow</span>
            <span className="badge badge-active">Recommended</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, maxWidth: 680 }}>
            Enter closing meters, collections, cash deposits and expenses on one screen. FuelEx creates the underlying transactions and checks reconciliation for you.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/operations/daily-entry')}>
          <Icon name="edit" /> Open daily entry
        </button>
      </div>

      {/* Module tiles */}
      <div className="master-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
        {modules.map(mod => (
          <Link
            key={mod.to}
            to={mod.to}
            className="dashboard-nav-card"
            style={{
              flexDirection: 'column', alignItems: 'stretch', gap: 6,
              borderColor: mod.highlight ? 'color-mix(in srgb, var(--color-primary) 45%, var(--border-default))' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span className="master-card-icon" style={{ width: 28, height: 28 }}><Icon name={mod.icon} /></span>
                <span style={{ fontWeight: 650, fontSize: 13.5 }} className="truncate">{mod.title}</span>
              </div>
              <span className={`badge ${mod.badgeClass}`}>{mod.badge}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, flexGrow: 1, margin: 0 }}>
              {mod.description}
            </p>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', marginTop: 2 }}>
              {mod.cta}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
