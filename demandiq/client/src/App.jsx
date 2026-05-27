import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/layout/Navbar';
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

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'branch_sales') return <Navigate to="/collaboration" replace />;
    if (user.role === 'category_team') return <Navigate to="/conflicts" replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RoleHome() {
  const { user } = useAuth();
  const homes = { demand_planning: '/dashboard', branch_sales: '/collaboration', category_team: '/conflicts', admin: '/admin' };
  return <Navigate to={homes[user?.role] || '/dashboard'} replace />;
}

function AppLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {isAuthenticated && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={isAuthenticated ? <RoleHome /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['demand_planning']}><Dashboard /></ProtectedRoute>} />
        <Route path="/workbench" element={<ProtectedRoute allowedRoles={['demand_planning']}><ForecastWorkbench /></ProtectedRoute>} />
        <Route path="/scenarios" element={<ProtectedRoute allowedRoles={['demand_planning']}><ForecastSelection /></ProtectedRoute>} />
        <Route path="/collaboration" element={<ProtectedRoute allowedRoles={['demand_planning','branch_sales']}><CollaborationSuite /></ProtectedRoute>} />
        <Route path="/conflicts" element={<ProtectedRoute allowedRoles={['demand_planning','category_team']}><OverrideConflicts /></ProtectedRoute>} />
        <Route path="/demand-sensing" element={<ProtectedRoute allowedRoles={['demand_planning']}><DemandSensing /></ProtectedRoute>} />
        <Route path="/npi" element={<ProtectedRoute allowedRoles={['demand_planning']}><NPIForecasting /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute><ForecastingReport /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminConsole /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isAuthenticated && (
        <footer style={{ textAlign: 'center', padding: '12px', fontSize: 11, color: 'var(--text-3)' }}>
          Powered by DecisionPoint Analytics
        </footer>
      )}
    </div>
  );
}

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
