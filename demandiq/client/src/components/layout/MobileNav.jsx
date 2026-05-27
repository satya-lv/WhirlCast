import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Wrench, GitCompare, Users, AlertTriangle, FileBarChart, Settings } from 'lucide-react';

const ROLE_NAVS = {
  demand_planning: [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { path: '/workbench', label: 'Workbench', icon: Wrench },
    { path: '/scenarios', label: 'Scenarios', icon: GitCompare },
    { path: '/conflicts', label: 'Conflicts', icon: AlertTriangle },
    { path: '/report', label: 'Report', icon: FileBarChart },
  ],
  branch_sales: [
    { path: '/collaboration', label: 'Overrides', icon: Users },
    { path: '/report', label: 'Report', icon: FileBarChart },
  ],
  category_team: [
    { path: '/conflicts', label: 'Conflicts', icon: AlertTriangle },
    { path: '/report', label: 'Report', icon: FileBarChart },
  ],
  admin: [
    { path: '/admin', label: 'Admin', icon: Settings },
    { path: '/report', label: 'Report', icon: FileBarChart },
  ],
};

export default function MobileNav() {
  const { user } = useAuth();
  if (!user) return null;

  const navItems = ROLE_NAVS[user.role] || [];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: '#FFFFFF', borderTop: '1px solid #E5E7EB',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
      display: 'flex', height: 64,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {navItems.map(item => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            style={{ flex: 1, textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 3,
                position: 'relative',
              }}>
                <div style={{
                  background: isActive ? 'rgba(27,58,107,0.1)' : 'transparent',
                  borderRadius: 12, padding: '4px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  transition: 'background 0.2s ease',
                }}>
                  <Icon size={20} color={isActive ? '#1B3A6B' : '#9CA3AF'} strokeWidth={isActive ? 2.5 : 1.5} />
                  <span style={{
                    fontSize: 10, fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#1B3A6B' : '#9CA3AF',
                    transition: 'color 0.2s ease',
                  }}>
                    {item.label}
                  </span>
                </div>
              </div>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
