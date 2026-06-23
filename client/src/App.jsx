import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/layout/Navbar';      // mobile-only (guards itself with isMobile)
import Sidebar from './components/layout/Sidebar';    // desktop-only
import { KPIBar } from './components/shared/KPIBar';  // fixed top, all authenticated pages
import { useIsMobile } from './utils/useIsMobile';
import './index.css';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ForecastWorkbench from './pages/ForecastWorkbench';
import ForecastSelection from './pages/ForecastSelection';
import CollaborationSuite from './pages/CollaborationSuite';
import OverrideConflicts from './pages/OverrideConflicts';
import DemandSensing from './pages/DemandSensing';
import NPIForecasting from './pages/NPIForecasting';
import ForecastingReport from './pages/ForecastingReport';
import AdminConsole from './pages/AdminConsole';
import SupplyPlanning from './pages/SupplyPlanning';

// ── Route protection ───────────────────────────────────────────────────────
// Unchanged from original — same role checks, same redirect logic.

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'branch_sales')  return <Navigate to="/collaboration" replace />;
    if (user.role === 'category_team') return <Navigate to="/conflicts" replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RoleHome() {
  const { user } = useAuth();
  const homes = {
    demand_planning: '/dashboard',
    branch_sales:    '/collaboration',
    category_team:   '/conflicts',
    admin:           '/admin',
  };
  return <Navigate to={homes[user?.role] || '/dashboard'} replace />;
}

// ── Route table ────────────────────────────────────────────────────────────
// Defined outside AppLayout so the JSX is not re-created on every render.

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"         element={<Login />} />
      <Route path="/"              element={<AuthGate><RoleHome /></AuthGate>} />
      <Route path="/dashboard"     element={<ProtectedRoute allowedRoles={['demand_planning']}><Dashboard /></ProtectedRoute>} />
      <Route path="/workbench"     element={<ProtectedRoute allowedRoles={['demand_planning']}><ForecastWorkbench /></ProtectedRoute>} />
      <Route path="/scenarios"     element={<ProtectedRoute allowedRoles={['demand_planning']}><ForecastSelection /></ProtectedRoute>} />
      <Route path="/collaboration" element={<ProtectedRoute allowedRoles={['demand_planning','branch_sales']}><CollaborationSuite /></ProtectedRoute>} />
      <Route path="/conflicts"     element={<ProtectedRoute allowedRoles={['demand_planning','category_team']}><OverrideConflicts /></ProtectedRoute>} />
      <Route path="/demand-sensing" element={<ProtectedRoute allowedRoles={['demand_planning']}><DemandSensing /></ProtectedRoute>} />
      <Route path="/npi"           element={<ProtectedRoute allowedRoles={['demand_planning']}><NPIForecasting /></ProtectedRoute>} />
      <Route path="/report"        element={<ProtectedRoute><ForecastingReport /></ProtectedRoute>} />
      <Route path="/admin"         element={<ProtectedRoute allowedRoles={['admin']}><AdminConsole /></ProtectedRoute>} />
      <Route path="/supply"        element={<ProtectedRoute allowedRoles={['demand_planning']}><SupplyPlanning /></ProtectedRoute>} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Small helper used only for the "/" redirect — avoids calling useAuth in RoleHome
// before isAuthenticated is confirmed.
function AuthGate({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ── App shell ──────────────────────────────────────────────────────────────
// Layout:
//
//  Desktop (≥768px)                    Mobile (<768px)
//  ┌───────────────────────────────┐   ┌──────────────────────────┐
//  │  KPIBar (full width)          │   │  KPIBar (full width)     │
//  ├──────────┬────────────────────┤   ├──────────────────────────┤
//  │ Sidebar  │  <main> (scroll)   │   │  Navbar (sticky header)  │
//  │ (220px)  │                    │   │                          │
//  │          │  <Routes />        │   │  <Routes />              │
//  │          │                    │   │                          │
//  └──────────┴────────────────────┘   │  bottom tabs (fixed)     │
//                                      └──────────────────────────┘
//
// ProtectedRoute logic is identical to the original — this file only changes
// how content is framed, not what is shown or who can see it.

function AppLayout() {
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>

      {/* KPIBar — always visible at top when authenticated.
          KPIs requiring supply-chain data (inventory, supplier, production) show "--"
          until those modules are built. Forecast Accuracy is available today. */}
      {isAuthenticated && (
        <KPIBar kpis={{}} />
      )}

      {/* Body — sidebar (desktop) + scrollable content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Desktop sidebar */}
        {isAuthenticated && !isMobile && <Sidebar />}

        {/* Content area */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          // Mobile: extra bottom padding so content isn't hidden behind fixed bottom tabs
          paddingBottom: isMobile ? 64 : 0,
        }}>
          {/* Mobile top bar (Navbar guards itself with isMobile; returns null on desktop) */}
          {isAuthenticated && <Navbar />}

          <AppRoutes />

          {isAuthenticated && (
            <footer style={{
              textAlign: 'center',
              padding: '12px',
              fontSize: 11,
              color: 'var(--text-3)',
            }}>
              Powered by DecisionPoint Analytics
            </footer>
          )}
        </main>

      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppLayout />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
