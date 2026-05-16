import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useIsMobile } from '../../utils/useIsMobile';

const navConfig = {
  demand_planning: [
    { path: '/dashboard',      label: 'Dashboard',   icon: '🏠' },
    { path: '/workbench',      label: 'Workbench',   icon: '📝' },
    { path: '/scenarios',      label: 'Scenarios',   icon: '📊' },
    { path: '/collaboration',  label: 'Collaborate', icon: '💬' },
    { path: '/conflicts',      label: 'Conflicts',   icon: '⚡' },
    { path: '/demand-sensing', label: '✦ Sensing',   icon: '✦'  },
    { path: '/npi',            label: 'NPI',         icon: '🆕' },
    { path: '/report',         label: 'Report',      icon: '📄' },
  ],
  branch_sales:  [
    { path: '/collaboration', label: 'My Forecast', icon: '💬' },
    { path: '/report',        label: 'Report',      icon: '📄' },
  ],
  category_team: [
    { path: '/conflicts',     label: 'Conflicts',     icon: '⚡' },
    { path: '/report',        label: 'Report',        icon: '📄' },
  ],
  admin: [
    { path: '/admin',         label: 'Admin Console', icon: '⚙️' },
    { path: '/report',        label: 'Report',        icon: '📄' },
  ],
};

const roleColors = {
  demand_planning: '#3B82F6',
  branch_sales:    '#22C55E',
  category_team:   '#A855F7',
  admin:           '#EF4444',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('demandiq-theme') || 'light';
    setDark(saved === 'dark');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    const theme = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('demandiq-theme', theme);
  };

  if (!user) return null;
  const tabs     = navConfig[user.role] || [];
  const initials = user.name?.split(' ').map(n => n[0]).join('').slice(0, 2);
  const bottomTabs = tabs.slice(0, 5);

  return (
    <>
      <nav style={{
        background: 'var(--navy)', height: 52, display: 'flex',
        alignItems: 'center', padding: '0 16px', gap: 0,
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: isMobile ? 'auto' : 32, flexShrink: 0 }}>
          <svg width="26" height="26" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="10" fill="#E31837"/>
            <polyline points="8,34 16,18 22,26 29,14 36,30 44,22"
              fill="none" stroke="white" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'white', lineHeight: 1 }}>DemandIQ</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>Whirlpool India</div>
          </div>
        </div>

        {/* Desktop tabs */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto' }}>
            {tabs.map(tab => (
              <NavLink key={tab.path} to={tab.path}
                style={({ isActive }) => ({
                  padding: '6px 14px', borderRadius: 8,
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                  background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                })}>
                {tab.label}
              </NavLink>
            ))}
          </div>
        )}

        {/* Right: dark toggle + user + logout (desktop) / hamburger (mobile) */}
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'white', borderRadius: 8, padding: '6px 10px',
                fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={toggleTheme}
              style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.55)', borderRadius: 8, padding: '5px 10px',
                fontSize: 12, cursor: 'pointer', marginRight: 8 }}>
              {dark ? '☀ Light' : '◑ Dark'}
            </button>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {user.role === 'branch_sales'    ? `Branch · ${user.branch}` :
                 user.role === 'demand_planning' ? 'Demand Planner' :
                 user.role === 'category_team'   ? 'Category Manager' : 'Administrator'}
              </div>
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: roleColors[user.role] || '#6B7280',
              fontSize: 12, fontWeight: 700, color: 'white',
            }}>{initials}</div>
            <button onClick={() => { logout(); navigate('/login'); }}
              title="Logout"
              style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '5px 10px',
                fontSize: 11, cursor: 'pointer' }}>
              ⏻
            </button>
          </div>
        )}
      </nav>

      {/* Mobile hamburger overlay menu */}
      {isMobile && menuOpen && (
        <div style={{
          position: 'fixed', top: 52, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 99,
        }} onClick={() => setMenuOpen(false)}>
          <div style={{
            background: 'var(--navy)', padding: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            {tabs.map(tab => (
              <NavLink key={tab.path} to={tab.path}
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10, marginBottom: 4,
                  fontSize: 14, fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  textDecoration: 'none',
                })}>
                <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{tab.icon}</span>
                {tab.label}
              </NavLink>
            ))}
            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', marginTop: 8, paddingTop: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: roleColors[user.role] || '#6B7280',
                  fontSize: 12, fontWeight: 700, color: 'white',
                }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{user.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {user.role === 'branch_sales' ? `Branch · ${user.branch}` : user.role.replace('_', ' ')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={toggleTheme}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.55)', borderRadius: 8, padding: '7px 12px',
                    fontSize: 12, cursor: 'pointer' }}>
                  {dark ? '☀' : '◑'}
                </button>
                <button onClick={() => { logout(); navigate('/login'); setMenuOpen(false); }}
                  style={{ background: 'rgba(239,68,68,0.15)', border: '0.5px solid rgba(239,68,68,0.3)',
                    color: '#EF4444', borderRadius: 8, padding: '7px 12px',
                    fontSize: 12, cursor: 'pointer' }}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--navy)', borderTop: '0.5px solid rgba(255,255,255,0.1)',
          display: 'flex', height: 64,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {bottomTabs.map(tab => (
            <NavLink key={tab.path} to={tab.path}
              style={({ isActive }) => ({
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                textDecoration: 'none',
                color: isActive ? 'white' : 'rgba(255,255,255,0.4)',
                borderTop: isActive ? '2px solid #E31837' : '2px solid transparent',
                fontSize: 9, fontWeight: isActive ? 600 : 400,
                transition: 'color 0.15s',
              })}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
              <span>{tab.label.replace('✦ ', '')}</span>
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}
