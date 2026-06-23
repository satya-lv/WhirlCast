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
    { path: '/collaboration',  label: 'My Forecast', icon: '💬' },
    { path: '/report',         label: 'Report',      icon: '📄' },
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
  const [showResetModal, setShowResetModal] = useState(false);

  const handleReset = async () => {
    setShowResetModal(false);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Demo reset to default state');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('whirlcast-theme') || 'light';
    setDark(saved === 'dark');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    const theme = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('whirlcast-theme', theme);
  };

  if (!user) return null;

  // Desktop navigation is now handled by Sidebar.jsx.
  // Navbar is mobile-only — it renders the slim top bar + hamburger overlay + bottom tabs.
  if (!isMobile) return null;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto', flexShrink: 0 }}>
          <svg width="26" height="26" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="10" fill="#E31837"/>
            <polyline points="8,34 16,18 22,26 29,14 36,30 44,22"
              fill="none" stroke="white" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'white', lineHeight: 1 }}>WhirlCast</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>Whirlpool India</div>
          </div>
        </div>

        {/* Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)',
              color: 'white', borderRadius: 8, padding: '6px 10px',
              fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
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
      {showResetModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowResetModal(false)}>
          <div style={{
            background: '#1a2235', border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: 14, padding: '28px 28px 24px', maxWidth: 380, width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 10 }}>Reset demo data?</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 22 }}>
              Reset all demo data? This will clear all overrides, conflicts and sign-offs and restore the demo to its starting state.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResetModal(false)}
                style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 18px',
                  fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReset}
                style={{ background: '#E31837', border: 'none',
                  color: 'white', borderRadius: 8, padding: '8px 18px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
