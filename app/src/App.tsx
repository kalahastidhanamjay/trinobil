import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { useAuth } from './lib/auth';
import { ActivityPage } from './pages/ActivityPage';
import { BillingPage } from './pages/BillingPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ItemsPage } from './pages/ItemsPage';
import { BusinessDetailPage, BusinessesPage, OnboardPage, PlatformHomePage } from './pages/PlatformPages';
import { LoginPage } from './pages/LoginPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SalesPage } from './pages/SalesPage';
import { SettingsPage } from './pages/SettingsPage';
import { StaffPage } from './pages/StaffPage';
import { StockPage } from './pages/StockPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { SuppliersPage } from './pages/SuppliersPage';

function Guard({ allow, children }: { allow: boolean; children: ReactNode }) {
  return allow ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  const auth = useAuth();
  if (!auth.user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }
  // The platform admin manages businesses; shop screens are not theirs.
  if (auth.hasRole('PLATFORM_ADMIN')) {
    return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<PlatformHomePage />} />
          <Route path="businesses" element={<BusinessesPage />} />
          <Route path="businesses/new" element={<OnboardPage />} />
          <Route path="businesses/:tenantId" element={<BusinessDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="billing" element={<Guard allow={auth.hasRole('OWNER', 'MANAGER', 'CASHIER')}><BillingPage /></Guard>} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="purchases" element={<Guard allow={auth.isBackOffice}><PurchasesPage /></Guard>} />
        <Route path="suppliers" element={<Guard allow={auth.isBackOffice}><SuppliersPage /></Guard>} />
        <Route path="stock" element={<Guard allow={auth.canManage}><StockPage /></Guard>} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="expenses" element={<Guard allow={auth.isBackOffice}><ExpensesPage /></Guard>} />
        <Route path="reports" element={<Guard allow={auth.isBackOffice}><ReportsPage /></Guard>} />
        <Route path="staff" element={<Guard allow={auth.canManage}><StaffPage /></Guard>} />
        <Route path="settings" element={<Guard allow={auth.canManage}><SettingsPage /></Guard>} />
        <Route path="activity" element={<Guard allow={auth.canManage}><ActivityPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
