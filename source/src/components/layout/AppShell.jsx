import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { hasDemoData } from '../../data/repository.js';
import Icon from '../ui/Icon.jsx';
import MadeBy from '../ui/MadeBy.jsx';
import { lockApp } from '../../auth/Gate.jsx';
import { watchTables } from '../../utils/responsiveTables.js';

const UI_SIDEBAR_KEY = 'fuelex-ui-sidebar';
const readCollapsed = () => {
  try { return localStorage.getItem(UI_SIDEBAR_KEY) === 'collapsed'; } catch { return false; }
};

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'grid' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { id: 'daily-entry', path: '/operations/daily-entry', label: 'Daily Entry', icon: 'edit' },
      { id: 'entries', path: '/operations/entries', label: 'Daily Entries', icon: 'list' },
      { id: 'meter-readings', path: '/operations/meter-readings', label: 'Meter Readings', icon: 'gauge' },
      { id: 'collections', path: '/operations/collections', label: 'Collections', icon: 'card' },
      { id: 'cash-deposits', path: '/operations/cash-deposits', label: 'Cash Deposits', icon: 'bank' },
      { id: 'expenses', path: '/operations/expenses', label: 'Expenses', icon: 'receipt' },
      { id: 'cash-count', path: '/cash-count', label: 'Cash Count', icon: 'cash' },
    ]
  },
  {
    label: 'Inventory',
    items: [
      { id: 'inventory', path: '/inventory', label: 'Fuel Stock', icon: 'fuel' },
      { id: 'masters-lubricants', path: '/masters/lubricants', label: 'Lubricants', icon: 'droplet' },
    ]
  },
  {
    label: 'CRM',
    items: [
      { id: 'crm', path: '/crm', label: 'Customers & Staff', icon: 'users' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { id: 'finance', path: '/finance', label: 'Business Position', icon: 'trending' },
    ]
  },
  {
    label: 'Reports',
    items: [
      { id: 'reports', path: '/reports', label: 'DSR & Reports', icon: 'file' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { id: 'masters', path: '/masters', label: 'Master Data', icon: 'database' },
      { id: 'settings', path: '/settings', label: 'Settings', icon: 'settings' },
    ]
  }
];

// Define bottom nav separately to only include main routes
const BOTTOM_NAV = [
  { id: 'dashboard', path: '/dashboard', label: 'Dash', icon: 'grid' },
  { id: 'daily-entry', path: '/operations/daily-entry', label: 'Ops', icon: 'edit' },
  { id: 'cash-count', path: '/cash-count', label: 'Cash', icon: 'cash' },
  { id: 'inventory', path: '/inventory', label: 'Stock', icon: 'fuel' },
  { id: 'more', path: '#', label: 'More', icon: 'menu' },
];

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const isDemo = hasDemoData();

  const closeSidebar = () => setSidebarOpen(false);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(UI_SIDEBAR_KEY, next ? 'collapsed' : 'expanded'); } catch { /* UI preference only */ }
      return next;
    });
  };

  // Label table cells so phones can show them as cards
  useEffect(() => watchTables(document.getElementById('main')), []);

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  const handleNav = (path) => {
    if (path === '#') {
      setSidebarOpen(true);
      return;
    }
    navigate(path);
    closeSidebar();
  };

  const pathname = location.pathname;

  const isItemActive = (item) => {
    if (item.id === 'dashboard') return pathname === '/' || pathname === '/dashboard';
    if (item.id === 'cash-count') return pathname === '/cash-count' || pathname === '/operations/cash-count';
    if (item.id === 'daily-entry') return pathname.startsWith('/operations/daily-entry');
    return pathname.startsWith(item.path);
  };

  const getPageTitle = () => {
    if (pathname === '/' || pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/cash-count' || pathname === '/operations/cash-count') return 'Cash Count';
    if (pathname.startsWith('/operations/daily-entry')) return 'Daily Operations';
    if (pathname === '/operations/entries') return 'Daily Entries Audit';
    if (pathname === '/operations/meter-readings') return 'Meter Readings';
    if (pathname === '/operations/collections') return 'Collections';
    if (pathname === '/operations/cash-deposits') return 'Cash Deposits';
    if (pathname === '/operations/expenses') return 'Expenses';
    if (pathname.startsWith('/inventory')) return 'Fuel Inventory';
    if (pathname.startsWith('/crm')) return 'CRM & Staff';
    if (pathname.startsWith('/finance')) return 'Finance';
    if (pathname.startsWith('/reports')) return 'Reports';
    if (pathname.startsWith('/masters')) return 'Masters';
    if (pathname.startsWith('/settings')) return 'Settings';
    return 'FuelEx';
  };

  // Close sidebar on window resize if crossing mobile threshold
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="modal-overlay" style={{ zIndex: 90, padding: 0 }} onClick={closeSidebar} aria-hidden="true" />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Main navigation">
        <button type="button" className="sidebar-header" onClick={() => handleNav('/dashboard')} aria-label="FuelEx dashboard">
          <span className="sidebar-logo"><Icon name="bolt" /></span>
          <span className="sidebar-brand-wrap">
            <span className="sidebar-brand" style={{ display: 'block' }}>FuelEx</span>
            <span className="sidebar-tag">Station operations</span>
          </span>
        </button>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-title">{group.label}</div>
              {group.items.map(item => {
                const active = isItemActive(item);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={() => handleNav(item.path)}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon name={item.icon} />
                    <span className="nav-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-credit">
          <button type="button" className="nav-item" onClick={lockApp} title="Lock the app">
            <Icon name="lock" /><span className="nav-label">Lock app</span>
          </button>
          <MadeBy />
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button type="button" className="menu-trigger mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Icon name="menu" className="icon-lg" />
            </button>
            <button type="button" className="menu-trigger desktop-only" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}>
              <Icon name="panel" />
            </button>
            <div className="breadcrumb">
              <span className="breadcrumb-muted">FuelEx</span>
              <Icon name="chevron" className="icon-sm" style={{ color: 'var(--border-strong)' }} />
              <span>{getPageTitle()}</span>
            </div>
          </div>

          <div className="topbar-right">
            {isDemo && <span className="badge badge-warning">Demo data</span>}
            <button type="button" className="menu-trigger" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Toggle theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <div className="avatar-chip" aria-hidden="true">AM</div>
          </div>
        </header>

        <main className="page-container" id="main">
          {children}
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        <div className="mobile-nav-items">
          {BOTTOM_NAV.map(item => {
            const active = item.id !== 'more' && isItemActive(item);
            return (
              <button
                type="button"
                key={item.id}
                className={`mobile-nav-item ${active ? 'active' : ''}`}
                onClick={() => handleNav(item.path)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
