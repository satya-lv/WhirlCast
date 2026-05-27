import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../utils/useIsMobile';

const roles = [
  {
    id: 'demand_planning',
    title: 'Demand Planning',
    subtitle: 'Priya Sharma',
    desc: 'Generate forecasts, compare scenarios, run demand sensing and manage the full planning cycle.',
    icon: '📊',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.3)',
    btn: '#3B82F6',
  },
  {
    id: 'branch_sales',
    title: 'Branch Sales',
    subtitle: 'Rahul Mehta · Mumbai',
    desc: 'Review the AI forecast for your branch and submit overrides based on your local market knowledge.',
    icon: '📍',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.3)',
    btn: '#16A34A',
  },
  {
    id: 'category_team',
    title: 'Category Team',
    subtitle: 'Anjali Singh',
    desc: 'Review national category totals, resolve override conflicts and ensure the India-level plan is coherent.',
    icon: '📂',
    color: '#A855F7',
    bg: 'rgba(168,85,247,0.15)',
    border: 'rgba(168,85,247,0.3)',
    btn: '#7C3AED',
  },
  {
    id: 'admin',
    title: 'Admin',
    subtitle: 'System Admin',
    desc: 'Manage product masters, LFL mappings, user roles and system configuration.',
    icon: '⚙️',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.15)',
    border: 'rgba(239,68,68,0.3)',
    btn: '#DC2626',
  },
];

const users = {
  demand_planning: { name: 'Priya Sharma', role: 'demand_planning', branch: 'All' },
  branch_sales:    { name: 'Rahul Mehta',  role: 'branch_sales',    branch: 'Mumbai' },
  category_team:   { name: 'Anjali Singh', role: 'category_team',   branch: 'All' },
  admin:           { name: 'Admin User',   role: 'admin',           branch: 'All' },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [darkMode, setDarkMode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [hovered, setHovered] = useState(null);

  const handleLogin = (roleId) => {
    login(users[roleId]);
    const routes = {
      demand_planning: '/dashboard',
      branch_sales: '/collaboration',
      category_team: '/conflicts',
      admin: '/admin',
    };
    navigate(routes[roleId]);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('http://localhost:3001/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Demo reset — ready for walkthrough');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResetting(false);
      }
    } catch {
      setResetting(false);
    }
  };

  const toggleDark = () => {
    setDarkMode(d => !d);
    document.documentElement.setAttribute('data-theme', !darkMode ? 'dark' : 'light');
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--navy)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative',
      backgroundImage: `repeating-linear-gradient(
        45deg, transparent, transparent 40px,
        rgba(255,255,255,0.015) 40px, rgba(255,255,255,0.015) 80px)`,
    }}>

      {/* Top right controls */}
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 10 }}>
        <button onClick={handleReset} disabled={resetting}
          style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '7px 14px',
            fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {resetting ? '⟳ Resetting...' : '↺ Reset Demo Data'}
        </button>
        <button onClick={toggleDark}
          style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '7px 14px',
            fontSize: 12, cursor: 'pointer' }}>
          {darkMode ? '☀ Light' : '◑ Dark'}
        </button>
      </div>

      {/* Logo */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="48" height="48" viewBox="0 0 48 48">
          <rect width="48" height="48" rx="12" fill="#E31837"/>
          <polyline points="8,34 16,18 22,26 29,14 36,30 44,22"
            fill="none" stroke="white" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
          WhirlCast
        </div>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 48 }}>
        Whirlpool India · Intelligent Demand Planning
      </p>

      {/* 4 cards horizontal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 16, width: '100%', maxWidth: isMobile ? 480 : 1000,
      }}>
        {roles.map(r => (
          <div key={r.id}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === r.id ? r.bg : 'rgba(255,255,255,0.05)',
              border: `0.5px solid ${hovered === r.id ? r.border : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 16, padding: '24px 20px',
              display: 'flex', flexDirection: 'column', gap: 12,
              transition: 'all 0.2s ease',
              transform: hovered === r.id ? 'translateY(-4px)' : 'none',
              cursor: 'default',
            }}>
            <div style={{ fontSize: 28 }}>{r.icon}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{r.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{r.subtitle}</div>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, flex: 1 }}>
              {r.desc}
            </div>
            <button onClick={() => handleLogin(r.id)}
              style={{
                background: r.btn, color: 'white', border: 'none', borderRadius: 10,
                padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                width: '100%', transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.target.style.opacity = '0.88'}
              onMouseLeave={e => e.target.style.opacity = '1'}>
              Login as {r.title} →
            </button>
          </div>
        ))}
      </div>

      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 40 }}>
        Powered by DecisionPoint Analytics · Demo Mode
      </p>
    </div>
  );
}
