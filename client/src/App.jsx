import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PersonaProvider } from './context/PersonaContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/layout/Navbar';      // mobile-only (guards itself with isMobile)
import Sidebar from './components/layout/Sidebar';    // desktop-only
import { KPIBar } from './components/shared/KPIBar';  // fixed top, all authenticated pages
import { useIsMobile } from './utils/useIsMobile';
import './index.css';

import PersonaLogin from './pages/PersonaLogin';
import PersonaLanding from './pages/PersonaLanding';
import PersonaRoleSelect from './pages/PersonaRoleSelect';
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
import DemandPlanning from './pages/DemandPlanning';

// ── Route protection ───────────────────────────────────────────────────────

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

function AppRoutes() {
  return (
    <Routes>
      {/* Persona flow — no auth gate; persona state guards these via redirect inside component */}
      <Route path="/login"       element={<PersonaLogin />} />
      <Route path="/landing"     element={<PersonaLanding />} />
      <Route path="/role-select" element={<PersonaRoleSelect />} />

      <Route path="/"              element={<AuthGate><RoleHome /></AuthGate>} />
      <Route path="/dashboard"     element={<ProtectedRoute allowedRoles={['demand_planning']}><Dashboard /></ProtectedRoute>} />
      <Route path="/workbench"     element={<ProtectedRoute allowedRoles={['demand_planning']}><ForecastWorkbench /></ProtectedRoute>} />
      <Route path="/scenarios"     element={<ProtectedRoute allowedRoles={['demand_planning']}><ForecastSelection /></ProtectedRoute>} />
      <Route path="/collaboration" element={<ProtectedRoute allowedRoles={['demand_planning','branch_sales']}><CollaborationSuite /></ProtectedRoute>} />
      <Route path="/conflicts"     element={<ProtectedRoute allowedRoles={['demand_planning','category_team']}><OverrideConflicts /></ProtectedRoute>} />
      <Route path="/demand-sensing" element={<ProtectedRoute allowedRoles={['demand_planning']}><DemandSensing /></ProtectedRoute>} />
      <Route path="/npi"           element={<ProtectedRoute allowedRoles={['demand_planning']}><NPIForecasting /></ProtectedRoute>} />
      <Route path="/report"        element={<ProtectedRoute><ForecastingReport /></ProtectedRoute>} />
      {/* Admin: allow both 'admin' (existing auth flow) and 'demand_planning' (persona landing → Admin card) */}
      <Route path="/admin"         element={<ProtectedRoute allowedRoles={['admin', 'demand_planning']}><AdminConsole /></ProtectedRoute>} />
      <Route path="/supply"            element={<ProtectedRoute allowedRoles={['demand_planning']}><SupplyPlanning /></ProtectedRoute>} />
      <Route path="/demand-planning"   element={<ProtectedRoute allowedRoles={['demand_planning']}><DemandPlanning /></ProtectedRoute>} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthGate({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ── App shell ──────────────────────────────────────────────────────────────

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
      {isAuthenticated && (
        <KPIBar kpis={{}} />
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {isAuthenticated && !isMobile && <Sidebar />}

        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: isMobile ? 64 : 0,
        }}>
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
        <PersonaProvider>
          <ToastProvider>
            <AppLayout />
          </ToastProvider>
        </PersonaProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
