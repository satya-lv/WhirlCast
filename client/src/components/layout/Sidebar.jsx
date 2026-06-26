import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePersona } from '../../context/PersonaContext';
import {
  LayoutDashboard, BarChart2, GitBranch, Zap, Plus,
  Layers, TrendingUp, FlaskConical, Activity, Package, ArrowLeftRight,
  Users, AlertTriangle, Truck,
  Shield, CheckSquare,
  FileBarChart, Settings, LogOut, Sun, Moon, RotateCcw, UserX,
} from 'lucide-react';

// ── Navigation structure ───────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    group: 'Overview',
    roles: ['demand_planning'],
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['demand_planning'] },
    ],
  },
  {
    group: 'Plan',
    roles: ['demand_planning'],
    items: [
      { label: 'Demand Planning',  path: '/demand-planning', icon: BarChart2,  roles: ['demand_planning'] },
      { label: 'Scenarios',        path: '/scenarios',       icon: GitBranch,  roles: ['demand_planning'] },
      { label: 'Demand Sensing',   path: '/demand-sensing',  icon: Zap,        roles: ['demand_planning'] },
      { label: 'NPI Forecasting',  path: '/npi',             icon: Plus,       roles: ['demand_planning'] },
      { label: 'Supply Planning',  path: '/supply',          icon: Layers,     roles: ['demand_planning'] },
    ],
  },
  {
    group: 'Collaborate',
    roles: ['demand_planning', 'branch_sales', 'category_team'],
    items: [
      { label: 'Branch Overrides',       path: '/collaboration', icon: Users,         roles: ['demand_planning', 'branch_sales'] },
      { label: 'Override Conflicts',     path: '/conflicts',     icon: AlertTriangle, roles: ['demand_planning', 'category_team'] },
      { label: 'Supplier Collaboration', comingSoon: true,       icon: Truck,         roles: ['demand_planning'] },
    ],
  },
  {
    group: 'Monitor',
    roles: ['demand_planning'],
    items: [
      { label: 'Risk Management', comingSoon: true, icon: Shield, roles: ['demand_planning'] },
    ],
  },
  {
    group: 'Decide',
    roles: ['demand_planning'],
    items: [
      { label: 'S&OP Decision Review', comingSoon: true, icon: CheckSquare, roles: ['demand_planning'] },
    ],
  },
];

const UTILITY_NAV = [
  { label: 'Report',        path: '/report', icon: FileBarChart, roles: ['demand_planning', 'branch_sales', 'category_team', 'admin'] },
  { label: 'Admin Console', path: '/admin',  icon: Settings,     roles: ['admin', 'demand_planning'] },
];

const MODULE_TABS = {
  demand: [
    { id: 'grid',       label: 'Forecast Grid',   icon: BarChart2     },
    { id: 'patterns',   label: 'Patterns',         icon: TrendingUp    },
    { id: 'whatif',     label: 'What-If',          icon: FlaskConical  },
    { id: 'exceptions', label: 'Exceptions',       icon: AlertTriangle },
    { id: 'npi',        label: 'NPI Forecasting',  icon: Plus          },
    { id: 'sensing',    label: 'Demand Sensing',   icon: Zap           },
  ],
  supply: [
    { id: 'grid',            label: 'Planning Grid',   icon: Layers       },
    { id: 'constraints',     label: 'Constraints',     icon: Activity     },
    { id: 'recommendations', label: 'Recommendations', icon: BarChart2    },
    { id: 'whatif',          label: 'What-If',         icon: FlaskConical },
  ],
  admin: [
    { id: 'products', label: 'Product Master',  icon: Package         },
    { id: 'lfl',      label: 'LFL Master',      icon: ArrowLeftRight  },
    { id: 'users',    label: 'User Management', icon: Users           },
  ],
};

const MODULE_TITLE = {
  demand: 'Demand Planning',
  supply: 'Supply Planning',
  admin:  'Admin Console',
};

const PERSONA_ROLE_LABEL = {
  planner:          (module) => module === 'supply' ? 'Supply Planner' : 'Demand Planner',
  branch_manager:   () => 'Branch Manager · Mumbai',
  category_manager: () => 'Category Mgr · AC',
};

const PERSONA_ROLE_COLOR = {
  planner:          '#3B82F6',
  branch_manager:   '#22C55E',
  category_manager: '#A855F7',
};

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
  const { persona, clearPersona, activeView, setActiveView } = usePersona();
  const navigate = useNavigate();
  const location = useLocation();
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

  const handleSwitchPersona = () => {
    clearPersona();
    logout();
    navigate('/login');
  };

  if (!user) return null;

  // Persona takes priority over raw auth user for display
  const isPersonaActive = !!persona?.role;
  const displayName = isPersonaActive ? persona.displayName : user.name;
  const initial = isPersonaActive
    ? persona.initial
    : (user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?');
  const avatarColor = isPersonaActive
    ? (PERSONA_ROLE_COLOR[persona.role] || '#6B7280')
    : (ROLE_COLOR[user.role] || '#6B7280');
  const roleLabel = isPersonaActive
    ? (PERSONA_ROLE_LABEL[persona.role]?.(persona.module) || persona.role)
    : (user.role === 'branch_sales'
        ? ROLE_LABEL.branch_sales(user.branch)
        : (ROLE_LABEL[user.role] || user.role));

  const role = user.role;
  const visibleGroups = NAV_GROUPS
    .filter(g => g.roles.includes(role))
    .map(g => ({
      ...g,
      items: g.items.filter(i => i.roles.includes(role)),
    }))
    .filter(g => g.items.length > 0);

  const visibleUtils = UTILITY_NAV.filter(i => i.roles.includes(role));

  let moduleKey = null;
  if (persona) {
    if (location.pathname.startsWith('/demand-planning')) moduleKey = 'demand';
    else if (location.pathname.startsWith('/supply'))      moduleKey = 'supply';
    else if (location.pathname.startsWith('/admin'))       moduleKey = 'admin';
  }

  return (
    <>
      <aside style={{
        width: 220, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: 'var(--navy)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>

        {/* ── Logo — click to return to login ── */}
        <div
          onClick={handleSwitchPersona}
          title="Return to login"
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
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

        {/* ── Nav section: module-scoped inside a module, global otherwise ── */}
        {moduleKey ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 4px' }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
              padding: '10px 8px 4px',
            }}>
              {MODULE_TITLE[moduleKey]}
            </div>
            {MODULE_TABS[moduleKey].map(tab => {
              const isActive = activeView === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '11px 14px', borderRadius: 8, marginBottom: 2,
                    fontSize: 12, fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                    background: isActive ? 'rgba(255,255,255,0.13)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderLeft: isActive ? '3px solid rgba(255,255,255,0.65)' : '3px solid transparent',
                    boxSizing: 'border-box',
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.88)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                    }
                  }}
                >
                  {Icon && <Icon size={14} strokeWidth={1.8} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : (
          <>
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
          </>
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
              background: avatarColor,
              fontSize: 11, fontWeight: 700, color: 'white',
            }}>{initial}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'white', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
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
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.55)', borderRadius: 7,
                padding: '6px', fontSize: 11, cursor: 'pointer',
              }}>
              {dark ? <Sun size={12} /> : <Moon size={12} />}
            </button>
            <button onClick={() => setShowResetModal(true)} disabled={resetting}
              title="Reset demo data"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.55)', borderRadius: 7,
                padding: '6px', fontSize: 11, cursor: 'pointer',
              }}>
              <RotateCcw size={12} />
            </button>
            {/* Switch persona / Logout — persona flow uses clearPersona; fallback is plain logout */}
            <button
              onClick={handleSwitchPersona}
              title={isPersonaActive ? 'Switch persona' : 'Logout'}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.55)', borderRadius: 7,
                padding: '6px', fontSize: 11, cursor: 'pointer',
              }}>
              {isPersonaActive ? <UserX size={12} /> : <LogOut size={12} />}
            </button>
          </div>

          {/* Persona switch label — only when persona is active */}
          {isPersonaActive && (
            <div
              onClick={handleSwitchPersona}
              style={{
                marginTop: 8, textAlign: 'center', fontSize: 10,
                color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                textDecoration: 'underline', letterSpacing: '0.2px',
              }}
            >
              Switch persona
            </div>
          )}
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
