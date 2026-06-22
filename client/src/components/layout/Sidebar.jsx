/**
 * Sidebar — desktop left navigation for the IBP/S&OP platform.
 *
 * Rendered by AppLayout on screens ≥768px. On mobile, Navbar.jsx
 * handles navigation (hamburger overlay + bottom tabs).
 *
 * Structure:
 *   ┌─ Logo ──────────────────────────────────────────┐
 *   │ [nav groups — scrollable]                        │
 *   ├─────────────────────────────────────────────────┤
 *   │ Report · Admin (role-gated)                      │
 *   ├─────────────────────────────────────────────────┤
 *   │ User info · Dark mode · Reset · Logout           │
 *   └─────────────────────────────────────────────────┘
 *
 * Coming-soon items are non-clickable divs (not NavLink / not routed),
 * clearly marked with a lock icon and a "SOON" chip.
 */
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, BarChart2, GitBranch, Zap, Plus,
  Package, RefreshCw, Layers, Calendar,
  Users, AlertTriangle, Truck,
  Shield, CheckSquare,
  FileBarChart, Settings, Lock, LogOut, Sun, Moon, RotateCcw,
} from 'lucide-react';

// ── Navigation structure ───────────────────────────────────────────────────

/**
 * Each item is either a live NavLink (has `path`) or a coming-soon div (has `comingSoon: true`).
 * `roles` controls visibility per authenticated user role.
 */
const NAV_GROUPS = [
  {
    group: 'Overview',
    roles: ['demand_planning'],
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        roles: ['demand_planning'],
      },
    ],
  },
  {
    group: 'Plan',
    roles: ['demand_planning'],
    items: [
      { label: 'Demand Planning',         path: '/workbench',      icon: BarChart2,   roles: ['demand_planning'] },
      { label: 'Scenarios',               path: '/scenarios',      icon: GitBranch,   roles: ['demand_planning'] },
      { label: 'Demand Sensing',          path: '/demand-sensing', icon: Zap,         roles: ['demand_planning'] },
      { label: 'NPI Forecasting',         path: '/npi',            icon: Plus,        roles: ['demand_planning'] },
      { label: 'Inventory Optimization',  comingSoon: true,        icon: Package,     roles: ['demand_planning'] },
      { label: 'Replenishment Planning',  comingSoon: true,        icon: RefreshCw,   roles: ['demand_planning'] },
      { label: 'Raw Material Planning',   comingSoon: true,        icon: Layers,      roles: ['demand_planning'] },
      { label: 'Production Scheduling',   comingSoon: true,        icon: Calendar,    roles: ['demand_planning'] },
    ],
  },
  {
    group: 'Collaborate',
    roles: ['demand_planning', 'branch_sales', 'category_team'],
    items: [
      { label: 'Branch Overrides',        path: '/collaboration',  icon: Users,         roles: ['demand_planning', 'branch_sales'] },
      { label: 'Override Conflicts',      path: '/conflicts',      icon: AlertTriangle, roles: ['demand_planning', 'category_team'] },
      { label: 'Supplier Collaboration',  comingSoon: true,        icon: Truck,         roles: ['demand_planning'] },
    ],
  },
  {
    group: 'Monitor',
    roles: ['demand_planning'],
    items: [
      { label: 'Risk Management',         comingSoon: true,        icon: Shield,        roles: ['demand_planning'] },
    ],
  },
  {
    group: 'Decide',
    roles: ['demand_planning'],
    items: [
      { label: 'S&OP Decision Review',    comingSoon: true,        icon: CheckSquare,   roles: ['demand_planning'] },
    ],
  },
];

/** Always shown below the groups; role-gated individually. */
const UTILITY_NAV = [
  { label: 'Report',         path: '/report', icon: FileBarChart, roles: ['demand_planning', 'branch_sales', 'category_team', 'admin'] },
  { label: 'Admin Console',  path: '/admin',  icon: Settings,     roles: ['admin'] },
];

const ROLE_LABEL = {
  demand_planning: 'Demand Planner',
  branch_sales:    (branch) => `Branch · ${branch}`,
  category_team:   'Category Manager',
  admin:           'Administrator',
};

const ROLE_COLOR = {
  demand_planning: '#3B82F6',
  branch_sales:    '#22C55E',
  category_team:   '#A855F7',
  admin:           '#EF4444',
};

// ── Sub-components ─────────────────────────────────────────────────────────

function NavItem({ item, userRole }) {
  const Icon = item.icon;

  if (item.comingSoon) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 12px 7px 16px',
        color: 'rgba(255,255,255,0.22)',
        fontSize: 12, cursor: 'not-allowed', userSelect: 'none',
        borderRadius: 8,
      }}>
        <Icon size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.label}
        </span>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.4px',
          padding: '1px 5px', borderRadius: 8,
          background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)',
          flexShrink: 0,
        }}>
          SOON
        </span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 12px 7px 16px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
        background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 0.12s, color 0.12s',
        whiteSpace: 'nowrap',
      })}
      onMouseEnter={e => {
        if (!e.currentTarget.classList.contains('active')) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
        }
      }}
      onMouseLeave={e => {
        // NavLink inline style takes precedence; reset only non-active
        const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} />
      {item.label}
    </NavLink>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  const handleReset = async () => {
    setResetting(true);
    setShowResetModal(false);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Demo reset to default state');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch { /* ignore */ }
    setResetting(false);
  };

  if (!user) return null;

  const role = user.role;
  const initials = user.name?.split(' ').map(n => n[0]).join('').slice(0, 2);
  const roleLabel = role === 'branch_sales'
    ? ROLE_LABEL.branch_sales(user.branch)
    : (ROLE_LABEL[role] || role);

  // Filter groups and items the current role is allowed to see
  const visibleGroups = NAV_GROUPS
    .filter(g => g.roles.includes(role))
    .map(g => ({
      ...g,
      items: g.items.filter(i => i.roles.includes(role)),
    }))
    .filter(g => g.items.length > 0);

  const visibleUtils = UTILITY_NAV.filter(i => i.roles.includes(role));

  return (
    <>
      <aside style={{
        width: 220, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: 'var(--navy)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>

        {/* ── Logo ── */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="28" height="28" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <rect width="48" height="48" rx="10" fill="#E31837"/>
            <polyline points="8,34 16,18 22,26 29,14 36,30 44,22"
              fill="none" stroke="white" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'white', lineHeight: 1 }}>WhirlCast</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>Whirlpool India · IBP</div>
          </div>
        </div>

        {/* ── Nav groups (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 4px' }}>
          {visibleGroups.map(({ group, items }) => (
            <div key={group} style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.8px',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
                padding: '10px 8px 4px',
              }}>
                {group}
              </div>
              {items.map(item => (
                <NavItem key={item.label} item={item} userRole={role} />
              ))}
            </div>
          ))}
        </div>

        {/* ── Utility nav (Report, Admin) ── */}
        {visibleUtils.length > 0 && (
          <div style={{
            padding: '8px 8px 4px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            {visibleUtils.map(item => (
              <NavItem key={item.label} item={item} userRole={role} />
            ))}
          </div>
        )}

        {/* ── User + utilities ── */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {/* User row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: ROLE_COLOR[role] || '#6B7280',
              fontSize: 11, fontWeight: 700, color: 'white',
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'white', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {roleLabel}
              </div>
            </div>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={toggleTheme} title={dark ? 'Light mode' : 'Dark mode'}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.55)', borderRadius: 7,
                padding: '6px', fontSize: 11, cursor: 'pointer',
              }}>
              {dark ? <Sun size={12} /> : <Moon size={12} />}
            </button>
            <button onClick={() => setShowResetModal(true)} disabled={resetting}
              title="Reset demo data"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.55)', borderRadius: 7,
                padding: '6px', fontSize: 11, cursor: 'pointer',
              }}>
              <RotateCcw size={12} />
            </button>
            <button onClick={() => { logout(); navigate('/login'); }}
              title="Logout"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.55)', borderRadius: 7,
                padding: '6px', fontSize: 11, cursor: 'pointer',
              }}>
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </aside>

      {/* Reset modal */}
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 10 }}>
              Reset demo data?
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 22 }}>
              This will clear all overrides, conflicts and sign-offs and restore the demo to its starting state.
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
