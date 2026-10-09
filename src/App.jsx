import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';
import { ToastProvider, ComingSoonPage, ErrorBoundary } from './components/ui/UIComponents.jsx';
import Gate from './auth/Gate.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { initializeData } from './data/storage.js';
import { getDailyEntries } from './data/repository.js';

// Pages
import DashboardPage from './pages/DashboardPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

// Master Pages
import MastersLandingPage from './pages/masters/MastersLandingPage.jsx';
import MachinesPage from './pages/masters/MachinesPage.jsx';
import ProductsPage from './pages/masters/ProductsPage.jsx';
import LubricantsPage from './pages/masters/LubricantsPage.jsx';
import SalesmenPage from './pages/masters/SalesmenPage.jsx';
import CustomersPage from './pages/masters/CustomersPage.jsx';
import SuppliersPage from './pages/masters/SuppliersPage.jsx';
import PricesPage from './pages/masters/PricesPage.jsx';
import ExpenseCategoriesPage from './pages/masters/ExpenseCategoriesPage.jsx';

// Operations Pages (Stage 2)
import OperationsLandingPage from './pages/operations/OperationsLandingPage.jsx';
import DailyEntryPage from './pages/operations/DailyEntryPage.jsx';
import DailyEntriesListPage from './pages/operations/DailyEntriesListPage.jsx';
import MeterReadingsPage from './pages/operations/MeterReadingsPage.jsx';
import CollectionsPage from './pages/operations/CollectionsPage.jsx';
import CashDepositsPage from './pages/operations/CashDepositsPage.jsx';
import ExpensesPage from './pages/operations/ExpensesPage.jsx';
import CashCountPage from './pages/operations/CashCountPage.jsx';
import CRMPage from './pages/crm/CRMPage.jsx';
import FinancePage from './pages/finance/FinancePage.jsx';
import ReportsPage from './pages/reports/ReportsPage.jsx';

import './index.css';

/**
 * FuelEx - Main Application Root
 *
 * Routing: HashRouter (100% reliable for GitHub Pages & static hosting without 404s on refresh)
 * Architecture: UI (React Components) → Service Layer (repository.js) → Storage Layer (storage.js) → localStorage
 */

export default function App() {
  useEffect(() => {
    // Run initial data seeding and migration check
    initializeData();
  }, []);

  return (
    <Gate>
    <AppProvider>
      <ToastProvider>
        <HashRouter>
          <AppShell>
            <ErrorBoundary>
              <Routes>
              {/* Core / Dashboard */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Operations Module (Stage 2) */}
              <Route path="/operations" element={<OperationsLandingPage />} />
              <Route path="/operations/daily-entry" element={<DailyEntryPage />} />
              <Route path="/operations/daily-entry/:date" element={<DailyEntryPage />} />
              <Route path="/operations/entries" element={<DailyEntriesListPage />} />
              <Route path="/operations/meter-readings" element={<MeterReadingsPage />} />
              <Route path="/operations/collections" element={<CollectionsPage />} />
              <Route path="/operations/cash-deposits" element={<CashDepositsPage />} />
              <Route path="/operations/expenses" element={<ExpensesPage />} />
              <Route path="/operations/cash-count" element={<CashCountPage />} />
              <Route path="/cash-count" element={<CashCountPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/crm" element={<CRMPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/reports" element={<ReportsPage />} />

              {/* Master Data Section & Sub-pages */}
              <Route path="/masters" element={<MastersLandingPage />} />
              <Route path="/masters/machines" element={<MachinesPage />} />
              <Route path="/masters/products" element={<ProductsPage />} />
              <Route path="/masters/lubricants" element={<LubricantsPage />} />
              <Route path="/masters/salesmen" element={<SalesmenPage />} />
              <Route path="/masters/customers" element={<CustomersPage />} />
              <Route path="/masters/suppliers" element={<SuppliersPage />} />
              <Route path="/masters/prices" element={<PricesPage />} />
              <Route path="/masters/expense-categories" element={<ExpenseCategoriesPage />} />

              {/* Settings */}
              <Route path="/settings" element={<SettingsPage />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </ErrorBoundary>
          </AppShell>
        </HashRouter>
      </ToastProvider>
    </AppProvider>
    </Gate>
  );
}
