# DemandIQ — Complete Redesign Prompt for Claude Code
# Whirlpool India Demand Planning Tool
# Apply every change in this file to the existing running application

---

## CONTEXT

The DemandIQ application is already built and running at localhost:3000 (frontend) and localhost:3001 (backend). You are NOT rebuilding from scratch. You are applying a comprehensive redesign to every screen. Read this entire file before making any changes. Apply changes in the exact order listed.

The goal: transform the current build from a functional prototype into a premium, enterprise-grade SaaS product that will impress Whirlpool India in a live demo. Every screen must feel intentional, connected, and polished.

Reference: the PR/PO reconciliation project we built previously is the quality bar. Match or exceed that.

---

## ORDER OF CHANGES

1. Install dependencies + setup design system
2. Login page
3. Top navigation bar
4. Dashboard (greeting + stepper + KPI cards + SVG India map)
5. Forecast Workbench
6. Forecast Selection / Scenarios
7. Collaboration Suite
8. Override Conflicts
9. Demand Sensing
10. NPI Forecasting (complete rebuild)
11. Forecasting Report (view toggle + chart improvements)
12. Admin Console
13. Dark mode implementation
14. Demo reset button
15. Flow connections and navigation fixes
16. Mobile responsive pass
17. Final audit

Do not skip steps. Do not move to the next step until the current one is complete.

---

## STEP 1 — INSTALL DEPENDENCIES

In the client directory, install:
```
npm install @fontsource/dm-sans recharts lucide-react
```

If recharts is already installed, skip it. Do not reinstall.

---

## STEP 2 — GLOBAL DESIGN SYSTEM

### 2a. Create client/src/styles/globals.css and import it in index.js:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy:        #0D1B35;
  --navy-2:      #1A2B4A;
  --navy-3:      #243558;
  --navy-accent: #1B3A6B;
  --red:         #E31837;
  --bg:          #F0F4F8;
  --card:        #FFFFFF;
  --border:      rgba(0,0,0,0.07);
  --text-1:      #1A1A2E;
  --text-2:      #6B7280;
  --text-3:      #9CA3AF;
  --green:       #16A34A;
  --amber:       #D97706;
  --danger:      #DC2626;
  --blue:        #3B82F6;
  --green-bg:    #DCFCE7;
  --amber-bg:    #FEF3C7;
  --danger-bg:   #FEE2E2;
  --blue-bg:     #EFF6FF;
  --shadow-sm:   0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06);
  --shadow-md:   0 4px 6px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.1);
  --radius-sm:   8px;
  --radius-md:   12px;
  --radius-lg:   16px;
}

[data-theme="dark"] {
  --bg:     #0A1628;
  --card:   #1A2B4A;
  --border: rgba(255,255,255,0.07);
  --text-1: #F9FAFB;
  --text-2: rgba(255,255,255,0.55);
  --text-3: rgba(255,255,255,0.30);
}

body {
  font-family: 'DM Sans', -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

/* Transitions */
* { transition: background-color 0.2s ease, border-color 0.2s ease; }

/* Animations */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-ring {
  0%   { transform: scale(1); opacity: 0.8; }
  70%  { transform: scale(2.2); opacity: 0; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.fade-up { animation: fadeUp 0.35s ease forwards; }
.fade-up-1 { animation: fadeUp 0.35s 0.05s ease both; }
.fade-up-2 { animation: fadeUp 0.35s 0.10s ease both; }
.fade-up-3 { animation: fadeUp 0.35s 0.15s ease both; }
.fade-up-4 { animation: fadeUp 0.35s 0.20s ease both; }

/* Indian number format helper — use in JS: toIndianNumber(n) */
```

### 2b. Create client/src/utils/helpers.js:

```js
export const toIndianNumber = (n) => {
  if (!n && n !== 0) return '—';
  const num = Math.round(Number(n));
  if (isNaN(num)) return '—';
  const s = num.toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
};

export const toCrore = (n) => {
  const val = Number(n);
  if (isNaN(val)) return '—';
  if (val >= 10000000) return '₹' + (val / 10000000).toFixed(1) + ' Cr';
  if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + ' L';
  return '₹' + toIndianNumber(val);
};

export const pctBadge = (val) => {
  const v = Number(val);
  if (isNaN(v)) return { text: '—', type: 'grey' };
  if (v > 0) return { text: `↑ ${Math.abs(v).toFixed(1)}%`, type: 'success' };
  if (v < 0) return { text: `↓ ${Math.abs(v).toFixed(1)}%`, type: 'danger' };
  return { text: '→ 0%', type: 'grey' };
};

export const accColor = (acc) => {
  if (acc >= 88) return '#16A34A';
  if (acc >= 80) return '#D97706';
  return '#DC2626';
};

export const biasColor = (bias) => {
  const b = Math.abs(bias);
  if (b < 5) return '#16A34A';
  if (b < 10) return '#D97706';
  return '#DC2626';
};
```

### 2c. Create client/src/components/shared/PageHeader.jsx:

```jsx
import React, { useState } from 'react';

export const PageHeader = ({ title, subtitle, helpText }) => {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: helpText ? 10 : 0 }}>
        <div style={{ width: 4, height: 28, background: 'var(--navy-accent)', borderRadius: 2, flexShrink: 0 }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: 0, lineHeight: 1.2 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      {helpText && (
        <div style={{ marginLeft: 14 }}>
          <button
            onClick={() => setHelpOpen(o => !o)}
            style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--navy-accent)',
              cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>ℹ</span>
            <span>{helpOpen ? 'Hide' : 'How this works'}</span>
            <span style={{ fontSize: 10 }}>{helpOpen ? '▲' : '▼'}</span>
          </button>
          {helpOpen && (
            <div style={{ marginTop: 8, background: 'var(--blue-bg)', border: '0.5px solid #BFDBFE',
              borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#1D4ED8', lineHeight: 1.6 }}>
              {helpText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### 2d. Create client/src/components/shared/Badge.jsx:

```jsx
import React from 'react';

const configs = {
  success: { bg: '#DCFCE7', color: '#16A34A' },
  warning: { bg: '#FEF3C7', color: '#D97706' },
  danger:  { bg: '#FEE2E2', color: '#DC2626' },
  info:    { bg: '#EFF6FF', color: '#1D4ED8' },
  purple:  { bg: '#F3E8FF', color: '#7C3AED' },
  grey:    { bg: '#F3F4F6', color: '#6B7280' },
  navy:    { bg: '#EFF3FF', color: '#1B3A6B' },
};

export const Badge = ({ type = 'grey', text, style = {} }) => {
  const c = configs[type] || configs.grey;
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 600,
      padding: '3px 9px', borderRadius: 20,
      display: 'inline-flex', alignItems: 'center', gap: 3,
      ...style
    }}>{text}</span>
  );
};
```

### 2e. Create client/src/components/shared/KPICard.jsx:

```jsx
import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export const KPICard = ({ label, value, badge, badgeType, spark, accentColor, icon, animClass }) => (
  <div className={animClass || 'fade-up'}
    style={{
      background: 'var(--card)', borderRadius: 'var(--radius-lg)',
      border: '0.5px solid var(--border)', boxShadow: 'var(--shadow-sm)',
      padding: '18px 20px', position: 'relative', overflow: 'hidden',
      borderTop: `3px solid ${accentColor || 'var(--navy-accent)'}`,
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      cursor: 'default',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
      color: 'var(--text-2)', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1, marginBottom: 8 }}>{value}</div>
    {badge && (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
        background: badgeType === 'up' ? '#DCFCE7' : badgeType === 'down' ? '#FEE2E2' : '#FEF3C7',
        color: badgeType === 'up' ? '#16A34A' : badgeType === 'down' ? '#DC2626' : '#D97706',
      }}>{badge}</span>
    )}
    {icon && (
      <div style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32,
        background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 15 }}>{icon}</div>
    )}
    {spark && spark.length > 0 && (
      <div style={{ height: 36, marginTop: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={spark.map((v, i) => ({ v, i }))}>
            <Line type="monotone" dataKey="v" stroke={accentColor || 'var(--navy-accent)'}
              strokeWidth={2} dot={false} isAnimationActive />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);
```

### 2f. Create client/src/components/shared/Toast.jsx (if not exists or replace):

```jsx
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';

const ToastCtx = createContext(null);
const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️', ai: '✦' };
const colors = {
  success: { border: '#16A34A', bg: '#F0FDF4' },
  warning: { border: '#D97706', bg: '#FFFBEB' },
  error:   { border: '#DC2626', bg: '#FEF2F2' },
  info:    { border: '#3B82F6', bg: '#EFF6FF' },
  ai:      { border: '#7C3AED', bg: '#F5F3FF' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} style={{
              background: 'white', borderLeft: `4px solid ${c.border}`,
              borderRadius: 10, padding: '12px 16px', boxShadow: 'var(--shadow-md)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              maxWidth: 340, fontSize: 13, animation: 'fadeUp 0.3s ease',
            }}>
              <span>{icons[t.type]}</span>
              <span style={{ color: 'var(--text-1)', lineHeight: 1.4 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
};

export const useToast = () => useContext(ToastCtx);
```

Wrap App.jsx with ToastProvider if not already done.

---

## STEP 3 — LOGIN PAGE

Replace the entire Login.jsx with this:

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    icon: '🗂',
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
      await fetch('http://localhost:3001/api/demo/reset', { method: 'POST' });
      setTimeout(() => setResetting(false), 1500);
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
          DemandIQ
        </div>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 48 }}>
        Whirlpool India · Intelligent Demand Planning
      </p>

      {/* 4 cards horizontal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16, width: '100%', maxWidth: 1000,
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
```

---

## STEP 4 — TOP NAVIGATION BAR

Replace the existing Navbar with this. It must be dark navy, full width, and show role-specific tabs:

```jsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navConfig = {
  demand_planning: [
    { path: '/dashboard',    label: 'Dashboard' },
    { path: '/workbench',    label: 'Workbench' },
    { path: '/scenarios',    label: 'Scenarios' },
    { path: '/collaboration',label: 'Collaborate' },
    { path: '/conflicts',    label: 'Conflicts' },
    { path: '/demand-sensing', label: '✦ Sensing' },
    { path: '/npi',          label: 'NPI' },
    { path: '/report',       label: 'Report' },
  ],
  branch_sales:    [{ path: '/collaboration', label: 'My Forecast' }, { path: '/report', label: 'Report' }],
  category_team:   [{ path: '/conflicts', label: 'Conflicts' }, { path: '/report', label: 'Report' }],
  admin:           [{ path: '/admin', label: 'Admin Console' }, { path: '/report', label: 'Report' }],
};

const roleColors = {
  demand_planning: '#3B82F6',
  branch_sales: '#22C55E',
  category_team: '#A855F7',
  admin: '#EF4444',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const tabs = navConfig[user.role] || [];
  const initials = user.name?.split(' ').map(n => n[0]).join('').slice(0,2);

  return (
    <nav style={{
      background: 'var(--navy)', height: 52, display: 'flex',
      alignItems: 'center', padding: '0 24px', gap: 0,
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 32, flexShrink: 0 }}>
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

      {/* Tabs */}
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

      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{user.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            {user.role === 'branch_sales' ? `Branch · ${user.branch}` :
             user.role === 'demand_planning' ? 'Demand Planner' :
             user.role === 'category_team' ? 'Category Manager' : 'Administrator'}
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
    </nav>
  );
}
```

---

## STEP 5 — DASHBOARD PAGE

Replace Dashboard.jsx with this complete implementation:

### SVG India Map Component (create as IndiaMap.jsx in components/shared/):

```jsx
import React, { useState } from 'react';

const CITIES = [
  { name: 'Mumbai',    x: 115, y: 272, status: 'conflict' },
  { name: 'New Delhi', x: 178, y: 138, status: 'pending' },
  { name: 'Kolkata',   x: 295, y: 208, status: 'pending' },
  { name: 'Chennai',   x: 212, y: 365, status: 'pending' },
  { name: 'Bangalore', x: 196, y: 348, status: 'clean' },
  { name: 'Hyderabad', x: 202, y: 308, status: 'exceeded' },
  { name: 'Pune',      x: 125, y: 285, status: 'clean' },
  { name: 'Ahmedabad', x: 108, y: 205, status: 'pending' },
];

const STATUS = {
  clean:    { color: '#22C55E', label: 'Submitted', bg: 'rgba(34,197,94,0.2)' },
  conflict: { color: '#F59E0B', label: 'Conflict',  bg: 'rgba(245,158,11,0.2)' },
  exceeded: { color: '#EF4444', label: 'Exceeded',  bg: 'rgba(239,68,68,0.2)' },
  pending:  { color: '#6B7280', label: 'Pending',   bg: 'rgba(107,114,128,0.2)' },
};

const METRICS = {
  Mumbai:    { units: '12,450', acc: '88%', override: 'Conflict flagged' },
  'New Delhi': { units: '14,200', acc: '85%', override: 'Not submitted' },
  Kolkata:   { units: '9,800',  acc: '81%', override: 'Not submitted' },
  Chennai:   { units: '11,200', acc: '79%', override: 'Not submitted' },
  Bangalore: { units: '10,600', acc: '89%', override: 'Submitted ✓' },
  Hyderabad: { units: '8,900',  acc: '83%', override: 'Exceeded tolerance' },
  Pune:      { units: '7,400',  acc: '88%', override: 'Submitted ✓' },
  Ahmedabad: { units: '6,800',  acc: '86%', override: 'Not submitted' },
};

export default function IndiaMap({ onBranchClick, branchData }) {
  const [hovered, setHovered] = useState(null);
  const cities = branchData || CITIES;

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { r: 10; opacity: 0.7; }
          100% { r: 20; opacity: 0; }
        }
        .pulse-anim { animation: pulse-ring 1.5s ease-out infinite; }
      `}</style>

      <svg viewBox="0 0 380 460" style={{ width: '100%', maxHeight: 340 }}>
        {/* India outline — clean simplified SVG path */}
        <path d="
          M178,18 L192,14 L210,16 L226,22 L238,30 L244,40 L250,52 L258,58
          L268,62 L278,68 L282,78 L278,88 L270,95 L268,106 L272,118 L268,128
          L260,135 L255,145 L258,155 L252,165 L248,178 L244,192 L242,206
          L238,218 L232,230 L225,242 L218,256 L214,270 L212,284 L210,296
          L206,308 L200,320 L196,332 L192,346 L188,360 L184,372 L180,382
          L176,372 L172,360 L168,348 L166,334 L164,320 L160,308 L156,296
          L152,282 L148,268 L145,254 L140,242 L133,228 L127,216 L122,204
          L118,192 L115,180 L112,168 L109,156 L108,144 L112,133 L118,124
          L122,114 L120,104 L116,95 L108,88 L104,78 L108,68 L116,60 L124,54
          L128,44 L134,36 L142,28 L152,22 L162,18 L170,16 Z
          M180,382 L184,372 L188,385 L192,400 L196,415 L192,428 L188,440
          L184,428 L180,415 L176,400 L178,388 Z
        " fill="#1A2B4A" stroke="#2D5BA3" strokeWidth="1.2"/>

        {/* State divider lines (subtle) */}
        <line x1="178" y1="18" x2="178" y2="440" stroke="rgba(45,91,163,0.2)" strokeWidth="0.5" strokeDasharray="4,4"/>

        {/* City markers */}
        {cities.map(city => {
          const s = STATUS[city.status] || STATUS.pending;
          const isHov = hovered === city.name;
          const m = METRICS[city.name] || {};
          return (
            <g key={city.name}
              style={{ cursor: 'pointer' }}
              onClick={() => onBranchClick && onBranchClick(city.name)}
              onMouseEnter={() => setHovered(city.name)}
              onMouseLeave={() => setHovered(null)}>
              {/* Pulse ring for non-pending */}
              {city.status !== 'pending' && (
                <circle cx={city.x} cy={city.y} r="8" fill="none"
                  stroke={s.color} strokeWidth="1.5" opacity="0" className="pulse-anim"/>
              )}
              {/* Outer glow */}
              <circle cx={city.x} cy={city.y} r="10" fill={s.bg}/>
              {/* Inner dot */}
              <circle cx={city.x} cy={city.y} r={isHov ? 6 : 5} fill={s.color}
                style={{ transition: 'r 0.15s' }}/>
              {/* City label */}
              <text x={city.x} y={city.y + 18} textAnchor="middle"
                fontSize="8" fill="rgba(255,255,255,0.65)" fontFamily="DM Sans">
                {city.name}
              </text>

              {/* Tooltip on hover */}
              {isHov && (
                <g>
                  <rect x={city.x < 200 ? city.x + 12 : city.x - 122}
                    y={city.y - 52} width="110" height="68" rx="6"
                    fill="white" filter="url(#shadow)"/>
                  <text x={city.x < 200 ? city.x + 18 : city.x - 116}
                    y={city.y - 35} fontSize="9" fontWeight="700" fill="#1A1A2E">
                    {city.name}
                  </text>
                  <text x={city.x < 200 ? city.x + 18 : city.x - 116}
                    y={city.y - 22} fontSize="8" fill="#6B7280">
                    Units: {m.units || '—'}
                  </text>
                  <text x={city.x < 200 ? city.x + 18 : city.x - 116}
                    y={city.y - 11} fontSize="8" fill="#6B7280">
                    Accuracy: {m.acc || '—'}
                  </text>
                  <text x={city.x < 200 ? city.x + 18 : city.x - 116}
                    y={city.y} fontSize="8" fill={s.color} fontWeight="600">
                    {m.override || s.label}
                  </text>
                  <text x={city.x < 200 ? city.x + 18 : city.x - 116}
                    y={city.y + 11} fontSize="7.5" fill="#3B82F6">
                    Click to view →
                  </text>
                </g>
              )}
            </g>
          );
        })}

        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
          </filter>
        </defs>
      </svg>
    </div>
  );
}
```

### Dashboard.jsx — complete rebuild:

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KPICard } from '../components/shared/KPICard';
import IndiaMap from '../components/shared/IndiaMap';
import { toIndianNumber, toCrore } from '../utils/helpers';

const STEPS = [
  { label: 'Forecast Generated', sub: '14 May', status: 'done' },
  { label: 'Scenarios Compared', sub: '14 May', status: 'done' },
  { label: 'Scenario Finalized', sub: 'Baseline SARIMAX', status: 'done' },
  { label: 'Branch Overrides',   sub: '3 of 8 submitted', status: 'current' },
  { label: 'Resolve Conflicts',  sub: 'Waiting', status: 'pending' },
  { label: 'Sign-off',           sub: 'Locked', status: 'pending' },
];

const SPARK_UP = [40,45,42,50,48,55,60,58,65,70,68,75];
const SPARK_DOWN = [90,88,92,87,85,86,87,85,84,86,87,87];
const SPARK_BIAS = [70,65,60,55,48,42,38,35,30,28,25,22];
const SPARK_REV = [50,55,60,62,65,70,75,78,80,85,90,95];

const ACTIVITY = [
  { icon: '🔴', text: 'Holly (Kolkata) submitted overrides — 2 conflicts flagged', time: '2h ago' },
  { icon: '✅', text: 'Scenario 1 finalized by Priya Sharma', time: '5h ago' },
  { icon: '🟡', text: '6 exceptions detected — 4 acknowledged', time: '1d ago' },
  { icon: '✦',  text: 'Demand Sensing applied: Q2_Promo_Brief.pdf', time: '1d ago' },
  { icon: '✅', text: 'Forecast generated for May 2026 cycle', time: '1d ago' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleBranchClick = (branch) => {
    navigate(`/collaboration?branch=${encodeURIComponent(branch)}`);
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: 'calc(100vh - 52px)', padding: '24px' }}>

      {/* Greeting banner */}
      <div className="fade-up" style={{
        background: 'var(--navy)', borderRadius: 16, padding: '20px 24px',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>
            Good morning, {user?.name?.split(' ')[0]} 👋
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            May 2026 Forecast Cycle · 5 branches haven't submitted overrides yet · Deadline in 5 days
          </p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 20px', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Your next action</div>
          <button onClick={() => navigate('/collaboration')}
            style={{ background: '#E31837', color: 'white', border: 'none', borderRadius: 8,
              padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            → Go to Collaboration Suite
          </button>
        </div>
      </div>

      {/* Cycle Stepper */}
      <div className="fade-up-1" style={{
        background: 'var(--card)', borderRadius: 16, padding: '18px 24px',
        marginBottom: 20, boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
          color: 'var(--text-2)', marginBottom: 16 }}>May 2026 Cycle Progress</div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {i < STEPS.length - 1 && (
                <div style={{
                  position: 'absolute', top: 14, left: '50%', width: '100%', height: 2,
                  background: step.status === 'done' ? '#16A34A' : '#E5E7EB', zIndex: 0,
                }}/>
              )}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: step.status === 'done' ? '#16A34A' :
                            step.status === 'current' ? 'var(--navy-accent)' : '#F0F4F8',
                color: step.status === 'pending' ? '#9CA3AF' : 'white',
                border: step.status === 'pending' ? '1.5px solid #D1D5DB' : 'none',
              }}>
                {step.status === 'done' ? '✓' : i + 1}
              </div>
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: step.status === 'current' ? 700 : 500,
                  color: step.status === 'pending' ? 'var(--text-3)' : 'var(--text-1)' }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 10, color: step.status === 'current' ? '#D97706' : 'var(--text-3)', marginTop: 2 }}>
                  {step.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard label="Forecasted Units" value="1,24,850" badge="↑ 8.2% vs last cycle"
          badgeType="up" spark={SPARK_UP} accentColor="var(--navy-accent)" icon="📦"/>
        <KPICard label="Avg Forecast Accuracy" value="87.3%" badge="↓ 1.2% · Target 90%"
          badgeType="down" spark={SPARK_DOWN} accentColor="#D97706" icon="🎯"/>
        <KPICard label="Pending Overrides" value="5 branches" badge="Due 20-May-2026"
          badgeType="warn" accentColor="#F59E0B" icon="⏳"/>
        <KPICard label="Predicted Revenue" value="₹148.2 Cr" badge="↑ 11.4% vs last cycle"
          badgeType="up" spark={SPARK_REV} accentColor="var(--red)" icon="₹"/>
      </div>

      {/* Map + Activity */}
      <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>

        {/* India Map Card */}
        <div style={{ background: 'var(--navy)', borderRadius: 16, padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 4 }}>Branch Status Map</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
            Click a branch to view or submit overrides
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1.2 }}>
              <IndiaMap onBranchClick={handleBranchClick}/>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Branches</div>
              {[
                ['Bangalore','clean'], ['Pune','clean'], ['Mumbai','conflict'],
                ['Hyderabad','exceeded'], ['New Delhi','pending'], ['Kolkata','pending'],
                ['Chennai','pending'], ['Ahmedabad','pending'],
              ].map(([name, status]) => {
                const s = { clean:'#22C55E', conflict:'#F59E0B', exceeded:'#EF4444', pending:'#6B7280' };
                const l = { clean:'Submitted', conflict:'Conflict', exceeded:'Exceeded', pending:'Pending' };
                return (
                  <div key={name} onClick={() => handleBranchClick(name)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'6px 0', borderBottom:'0.5px solid rgba(255,255,255,0.05)', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'rgba(255,255,255,0.7)' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:s[status] }}/>
                      {name}
                    </div>
                    <span style={{
                      fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600,
                      background: status === 'clean' ? 'rgba(34,197,94,0.15)' :
                                  status === 'conflict' ? 'rgba(245,158,11,0.15)' :
                                  status === 'exceeded' ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)',
                      color: s[status],
                    }}>{l[status]}</span>
                  </div>
                );
              })}
              <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                {[['3 submitted','#22C55E'],['4 pending','#6B7280'],['1 conflict','#F59E0B']].map(([t,c]) => (
                  <span key={t} style={{ fontSize:10, padding:'3px 9px', borderRadius:20,
                    background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)' }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed + Quick Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'var(--card)', borderRadius:16, padding:'18px 20px',
            boxShadow:'var(--shadow-sm)', flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text-1)' }}>Cycle Activity</span>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E',
                boxShadow:'0 0 6px #22C55E' }}/>
            </div>
            {ACTIVITY.map((a,i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'8px 0',
                borderBottom: i < ACTIVITY.length-1 ? '0.5px solid var(--border)' : 'none' }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{a.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'var(--text-1)', lineHeight:1.4 }}>{a.text}</div>
                  <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--card)', borderRadius:16, padding:'18px 20px',
            boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', marginBottom:12 }}>Quick Actions</div>
            {[
              { label:'→ Collaboration Suite', path:'/collaboration', color:'var(--navy-accent)' },
              { label:'↗ View Forecasting Report', path:'/report', color:'transparent', outline:true },
              { label:'✦ Run Demand Sensing', path:'/demand-sensing', color:'#7C3AED' },
            ].map(btn => (
              <button key={btn.label} onClick={() => navigate(btn.path)}
                style={{
                  display:'block', width:'100%', marginBottom:8,
                  background: btn.outline ? 'transparent' : btn.color,
                  color: btn.outline ? 'var(--text-1)' : 'white',
                  border: btn.outline ? '0.5px solid var(--border)' : 'none',
                  borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:600,
                  cursor:'pointer', textAlign:'left',
                  transition:'opacity 0.15s',
                }}
                onMouseEnter={e => e.target.style.opacity='0.85'}
                onMouseLeave={e => e.target.style.opacity='1'}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
```

---

## STEP 6 — NPI FORECASTING PAGE (Complete rebuild)

Replace the existing NPI page entirely. The concept: user fills in product details, clicks ONE button "Generate Forecast", and sees 3 result cards displayed with authority — Recommended (Look-alike Blend), Conservative (3-Month Trend), Optimistic (High Growth). No "Find lookalike" intermediate step — the system does that automatically.

```jsx
import React, { useState } from 'react';
import { PageHeader } from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CATEGORIES = ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];
const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov'];

const RESULTS = {
  recommended: {
    tag: 'Recommended',
    tagColor: '#E31837',
    method: 'Look-alike Blend Model',
    desc: 'Weighted average of 3 similar SKUs — REF_190L_DirectCool (50%), REF_185L_Legacy (30%), REF_200L_DC (20%)',
    totalUnits: 18240,
    confidence: 87,
    confColor: '#22C55E',
    monthly: [2100,2800,3200,3500,3300,3340],
    dark: true,
  },
  conservative: {
    tag: 'Conservative',
    tagColor: '#3B82F6',
    method: '3-Month SARIMAX Projection',
    desc: 'Short-horizon model using only 90-day trend data — lower risk, lower upside.',
    totalUnits: 14800,
    confidence: 74,
    confColor: '#3B82F6',
    monthly: [1800,2300,2600,2800,2700,2600],
    dark: false,
  },
  optimistic: {
    tag: 'Optimistic',
    tagColor: '#16A34A',
    method: 'High-Growth Scenario',
    desc: 'Best-case with planned Q3 trade promotion uplift (+22% AC category) applied.',
    totalUnits: 22600,
    confidence: 61,
    confColor: '#16A34A',
    monthly: [2600,3400,4000,4200,4200,4200],
    dark: false,
  },
};

export default function NPIForecasting() {
  const { toast } = useToast();
  const [form, setForm] = useState({ sku:'', category: CATEGORIES[0], segment:'', price:'', launch:'', branches: [...BRANCHES] });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState('recommended');

  const handleGenerate = async () => {
    if (!form.sku || !form.price) { toast('Please fill in SKU Code and Price Point', 'warning'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setResults(RESULTS);
    setSelected('recommended');
    setLoading(false);
    toast('✦ AI generated 3 forecast views using look-alike modelling', 'ai');
  };

  const handleSave = async () => {
    toast(`✅ Look-alike Blend forecast saved for ${form.sku} — added to May 2026 cycle`, 'success');
  };

  const chartData = results ? MONTHS.map((m,i) => ({
    month: m,
    Recommended: RESULTS.recommended.monthly[i],
    Conservative: RESULTS.conservative.monthly[i],
    Optimistic: RESULTS.optimistic.monthly[i],
  })) : [];

  return (
    <div style={{ padding: 24, background: 'var(--bg)', minHeight: 'calc(100vh - 52px)' }}>
      <PageHeader
        title="New Product Introduction"
        subtitle="Forecast demand for a new SKU — the system automatically finds look-alike products and generates 3 forecast views"
        helpText="Enter your new product's details and click Generate Forecast. The AI will identify the 3 most similar existing SKUs based on category, price, and segment, then produce a Recommended (blended), Conservative (trend-only), and Optimistic (promo-uplifted) forecast. Select the view that best matches your business assumptions."
      />

      {/* Step 1 — Product Details */}
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24,
        boxShadow: 'var(--shadow-sm)', marginBottom: 16, border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 28, height: 28, background: 'var(--navy-accent)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>1</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Register New Product</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
          {[
            { key:'sku', label:'New SKU Code', placeholder:'e.g. REF_225L_DC_2026' },
            { key:'segment', label:'Segment / Size', placeholder:'e.g. 225L' },
            { key:'price', label:'Price Point (₹)', placeholder:'e.g. 14500' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
                textTransform: 'uppercase', color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                {f.label}
              </label>
              <input value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]:e.target.value}))}
                placeholder={f.placeholder}
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)',
                  borderRadius: 10, fontSize: 13, background: 'var(--bg)', color: 'var(--text-1)',
                  outline: 'none' }}/>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Category
            </label>
            <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}
              style={{ width:'100%', padding:'10px 12px', border:'0.5px solid var(--border)',
                borderRadius:10, fontSize:13, background:'var(--bg)', color:'var(--text-1)' }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Expected Launch Date
            </label>
            <input type="date" value={form.launch} onChange={e => setForm(p=>({...p,launch:e.target.value}))}
              style={{ width:'100%', padding:'10px 12px', border:'0.5px solid var(--border)',
                borderRadius:10, fontSize:13, background:'var(--bg)', color:'var(--text-1)' }}/>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Target Branches
            </label>
            <div style={{ padding:'10px 12px', border:'0.5px solid var(--border)', borderRadius:10,
              fontSize:12, background:'var(--bg)', color:'var(--text-2)' }}>
              All 8 Branches selected
            </div>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={loading}
          style={{
            marginTop: 20, background: loading ? '#6B7280' : 'var(--navy-accent)',
            color: 'white', border: 'none', borderRadius: 12, padding: '13px 28px',
            fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            transition: 'opacity 0.15s',
          }}>
          {loading ? (
            <>
              <div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',
                borderTopColor:'white',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
              AI is analysing look-alike products...
            </>
          ) : (
            <> ⚡ Generate Forecast </>
          )}
        </button>
      </div>

      {/* Step 2 — Results */}
      {results && (
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24,
          boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)', animation: 'fadeUp 0.4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, background: 'var(--navy-accent)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>2</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>AI-Generated Forecast — 3 Views</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20, marginLeft: 40 }}>
            Based on <strong>{form.sku || 'your new SKU'}</strong>, the AI identified 3 look-alike products and generated 3 demand scenarios.
            The <strong>Recommended</strong> view uses a weighted blend of all 3. Select the view that best fits your planning assumptions.
          </p>

          {/* 3 Result Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            {Object.entries(results).map(([key, r]) => (
              <div key={key} onClick={() => setSelected(key)}
                style={{
                  borderRadius: 14, padding: 20, cursor: 'pointer',
                  background: r.dark ? 'var(--navy)' : selected === key ? '#EFF6FF' : 'var(--bg)',
                  border: selected === key
                    ? `2px solid ${r.dark ? '#3B82F6' : r.tagColor}`
                    : `0.5px solid ${r.dark ? 'rgba(255,255,255,0.08)' : 'var(--border)'}`,
                  transition: 'all 0.2s ease',
                  transform: selected === key ? 'translateY(-2px)' : 'none',
                  boxShadow: selected === key ? 'var(--shadow-md)' : 'none',
                }}>
                <span style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
                  padding: '4px 10px', borderRadius: 20, marginBottom: 10,
                  background: r.tagColor, color: 'white',
                }}>{r.tag}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: r.dark ? 'white' : 'var(--text-1)', marginBottom: 4 }}>
                  {r.method}
                </div>
                <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)',
                  lineHeight: 1.5, marginBottom: 14 }}>{r.desc}</div>

                <div style={{ fontSize: 30, fontWeight: 800,
                  color: r.dark ? 'white' : r.tagColor, marginBottom: 2 }}>
                  {r.totalUnits.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)',
                  marginBottom: 14 }}>projected units · 6 months</div>

                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <div style={{ flex:1, height:5, borderRadius:3,
                    background: r.dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }}>
                    <div style={{ height:'100%', borderRadius:3, background:r.confColor,
                      width:`${r.confidence}%`, transition:'width 0.8s ease' }}/>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600,
                    color: r.dark ? 'rgba(255,255,255,0.7)' : 'var(--text-2)' }}>{r.confidence}% conf.</span>
                </div>

                {/* Monthly mini bars */}
                <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:40, marginBottom:10 }}>
                  {r.monthly.map((v,i) => {
                    const maxV = Math.max(...r.monthly);
                    const h = (v/maxV)*100;
                    const opacity = 0.35 + (i/r.monthly.length)*0.65;
                    return (
                      <div key={i} style={{ flex:1, borderRadius:'2px 2px 0 0',
                        height:`${h}%`,
                        background: r.dark ? `rgba(255,255,255,${opacity})` : r.tagColor,
                        opacity: r.dark ? 1 : opacity,
                      }}/>
                    );
                  })}
                </div>
                <div style={{ fontSize:9, color: r.dark ? 'rgba(255,255,255,0.35)' : 'var(--text-3)',
                  lineHeight:1.4 }}>
                  {MONTHS.map((m,i) => `${m}: ${r.monthly[i].toLocaleString()}`).join(' · ')}
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Chart */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', marginBottom:14 }}>
              Ramp Trajectory — All 3 Views
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-2)' }}/>
                  <YAxis tick={{ fontSize:11, fill:'var(--text-2)' }}
                    tickFormatter={v => v.toLocaleString('en-IN')}/>
                  <Tooltip formatter={(v,n) => [v.toLocaleString('en-IN') + ' units', n]}
                    contentStyle={{ borderRadius:10, fontSize:12, border:'0.5px solid var(--border)' }}/>
                  <Legend wrapperStyle={{ fontSize:12 }}/>
                  <Line type="monotone" dataKey="Recommended" stroke="#E31837" strokeWidth={2.5} dot={false}/>
                  <Line type="monotone" dataKey="Conservative" stroke="#3B82F6" strokeWidth={2} dot={false} strokeDasharray="6 3"/>
                  <Line type="monotone" dataKey="Optimistic" stroke="#16A34A" strokeWidth={2} dot={false} strokeDasharray="3 3"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <button onClick={handleSave}
            style={{ background:'#16A34A', color:'white', border:'none', borderRadius:12,
              padding:'13px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
            ✓ Use {Object.entries(results).find(([k])=>k===selected)?.[1]?.tag} as Forecast → Save to Cycle
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## STEP 7 — FORECASTING REPORT VIEW TOGGLE

Add a view toggle at the top of the Forecasting Report that switches between 4 levels of granularity. The toggle should switch the data shown in the tables:

```
[🌍 India Total] [📦 By Category] [📍 By Branch] [🔖 Branch × SKU]
```

- India Total: one row per month showing all-India aggregate
- By Category: one row per category (AC, Refrigerator, WM, MW, Induction)
- By Branch: one row per branch (8 rows)
- Branch × SKU: the existing detailed table

The category and branch level views should show: Name | Feb'26 | Mar'26 | Apr'26 | May'26 | Jun'26 | Jul'26 | Total | Accuracy | BIAS

Add this toggle above the KPI cards on the Report page.

---

## STEP 8 — ALL OTHER SCREENS: APPLY DESIGN SYSTEM

For every remaining screen (Workbench, Scenarios, Collaboration, Conflicts, Demand Sensing, Admin), apply these changes:

1. Add PageHeader component at the top with helpText for each page:
   - Workbench: "Select which variables and algorithms to use, then click Generate. Review exceptions before they corrupt the forecast. Save your output as a named scenario."
   - Scenarios: "Compare up to 5 scenarios on accuracy, revenue, and bias. When you're satisfied, finalize one — this pushes the forecast to all 8 branch managers for review."
   - Collaboration: "Branch managers review the AI forecast here and submit overrides for their branch. The system enforces a ±30% tolerance. Changes are saved to the database immediately."
   - Conflicts: "The category team reviews all branch overrides nationally. Resolve conflicts by accepting, rejecting, or setting a custom value. All decisions are final."
   - Demand Sensing: "Upload any document — trade promotion brief, weather advisory, competitor report, or email. The AI extracts demand signals and shows you a before/after forecast adjustment. You decide what to apply."

2. Replace page background with var(--bg) on every page

3. All cards: add boxShadow var(--shadow-sm) and border 0.5px solid var(--border)

4. All primary buttons: background var(--navy-accent), borderRadius 10, padding 10px 20px, fontWeight 600

5. All tables: apply the table design from Step 2 (header bg #F8FAFC, hover #F5F8FF, alternating rows)

---

## STEP 9 — DARK MODE TOGGLE

Add a dark mode toggle button to the Navbar (top right, before user avatar):

```jsx
const [dark, setDark] = useState(false);
const toggleTheme = () => {
  setDark(d => !d);
  document.documentElement.setAttribute('data-theme', !dark ? 'dark' : 'light');
};

// Button in navbar:
<button onClick={toggleTheme}
  style={{ background:'rgba(255,255,255,0.08)', border:'0.5px solid rgba(255,255,255,0.12)',
    color:'rgba(255,255,255,0.55)', borderRadius:8, padding:'5px 10px',
    fontSize:12, cursor:'pointer', marginRight:8 }}>
  {dark ? '☀ Light' : '◑ Dark'}
</button>
```

Persist the preference in localStorage:
```js
useEffect(() => {
  const saved = localStorage.getItem('demandiq-theme') || 'light';
  setDark(saved === 'dark');
  document.documentElement.setAttribute('data-theme', saved);
}, []);
```

---

## STEP 10 — DEMO RESET BUTTON

Add a POST endpoint to the backend:

```js
// server/routes/demo.js
router.post('/reset', (req, res) => {
  try {
    // Reset branch_overrides to pending status
    db.prepare(`UPDATE branch_overrides SET override_value = NULL, reason = NULL,
      override_by = NULL, override_on = NULL, status = 'pending', final_override = NULL`).run();
    // Keep seeded overrides for Holly, James, Rahul
    db.prepare(`UPDATE branch_overrides SET override_value = 1800, reason = 'B: New Promo/Activity',
      override_by = 'James', status = 'submitted'
      WHERE branch = 'Chennai' AND sku = 'REF_190L_DirectCool'`).run();
    db.prepare(`UPDATE branch_overrides SET override_value = 580, reason = 'E: Seasonality effects',
      override_by = 'Holly', status = 'submitted'
      WHERE branch = 'Kolkata' AND sku = 'REF_240L_FrostFree'`).run();
    // Reset demand sensing log
    db.prepare(`UPDATE demand_sensing_log SET applied = 0 WHERE log_id > 1`).run();
    res.json({ success: true, message: 'Demo data reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Register this route in server/index.js:
```js
const demoRoutes = require('./routes/demo');
app.use('/api/demo', demoRoutes);
```

---

## STEP 11 — NAVIGATION FLOW FIXES

### Fix 1: Branch click from India Map → Collaboration Suite
In IndiaMap.jsx the onBranchClick prop calls navigate(`/collaboration?branch=${branch}`).
In CollaborationSuite.jsx read this on mount:
```js
const [params] = useSearchParams();
const preselected = params.get('branch');
const [activeBranch, setActiveBranch] = useState(preselected || 'Mumbai');
useEffect(() => { if (preselected) setActiveBranch(preselected); }, [preselected]);
```

### Fix 2: Every Submit/Save action updates the database
After any override submission:
- POST to /api/collaboration/submit/:branch
- Refetch /api/dashboard to update cycle status
- Update the branch status on the India map

### Fix 3: Stepper reflects actual DB state
Dashboard fetches /api/dashboard on mount and maps cycle status to stepper step:
- in_progress → step 1 current
- scenarios_ready → step 2 current
- overrides_pending → step 4 current
- conflicts_pending → step 5 current
- ready_for_signoff → step 6 current
- signed_off → all done

### Fix 4: Role-based greeting messages
Each role lands on their home screen with a personalised greeting card:

Branch Sales (Rahul, Mumbai):
"Good morning, Rahul 👋 · The May 2026 forecast has been finalized by Priya Sharma. Please review your Mumbai forecast and submit overrides by 20-May-2026."
CTA: "→ Review My Forecast"

Category Team (Anjali):
"Good morning, Anjali 👋 · 3 override conflicts require your attention. Review the national category rollup and resolve conflicts before sign-off."
CTA: "→ Resolve Conflicts"

---

## STEP 12 — MOBILE RESPONSIVE

At screens < 768px apply these rules:
- Login: cards stack 2x2 (not 4 horizontal)
- Dashboard: KPI cards 2x2, map full width, activity feed below map
- Workbench: config panel collapses above output panel
- All tables: horizontal scroll, first 2 columns sticky (position:sticky, left:0, background:var(--card), zIndex:1)
- All charts: height 200px
- Navbar: top nav collapses to hamburger → bottom tab bar (5 tabs max with icons)
- Bottom tab bar height: 64px + safe-area-inset-bottom
- All buttons minimum touch target: 44px height

---

## STEP 13 — FINAL AUDIT (Run this after everything else is done)

Go through every screen and verify:

1. DM Sans font is loading — open browser network tab, filter by font, confirm DM Sans is present
2. All currency shows ₹ Indian Rupees using toIndianNumber() — no $ symbols anywhere
3. All numbers use Indian number format (1,24,850 not 124,850)
4. India map shows pulsing animations on amber and red city dots
5. Every chart uses gradient area fills (linearGradient in Recharts defs)
6. Every card lifts on hover (transform: translateY(-2px))
7. Demand Sensing: upload a real PDF and confirm Claude API responds with insights
8. The "View Branch" click on dashboard map navigates to Collaboration Suite filtered to that branch
9. Submitting an override in Collaboration updates the branch dot color on the Dashboard map
10. Dark mode toggle works across ALL screens simultaneously
11. Demo reset button calls /api/demo/reset and resets the data
12. "Powered by DecisionPoint Analytics" appears in footer on every screen
13. Every page has a PageHeader with helpText
14. Login page shows 4 cards horizontally (not 2x2)
15. No Leaflet map anywhere in the app — if you find one, remove it completely

---

## DONE

After this redesign is applied, the app should:
- Look like a premium enterprise SaaS product
- Have a clear, guided flow from login through to sign-off
- Show all data in Indian number formats with ₹ currency
- Have a working dark mode
- Have a demo reset button
- Have the India SVG map on Dashboard, Collaboration, and Conflicts
- Have the NPI page showing 3 result cards with authority
- Have the Forecasting Report with 4 view levels
- Be fully mobile responsive

Run the app, walk through the complete demo flow (Login → Dashboard → Workbench → Scenarios → Collaboration → Conflicts → Demand Sensing → Report), and fix anything that breaks.
