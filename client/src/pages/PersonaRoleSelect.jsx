import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePersona } from '../context/PersonaContext';

const ROLE_DEFS = {
  demand: [
    {
      id: 'planner',
      title: 'Demand Planner',
      desc: 'Full access — generate forecasts, manage scenarios, run demand sensing, and review all branches and product groups.',
      icon: '📊',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.15)',
      border: 'rgba(59,130,246,0.3)',
    },
    {
      id: 'branch_manager',
      title: 'Branch Manager',
      badge: 'Mumbai',
      desc: 'View and adjust forecasts for the Mumbai branch only. The Branch filter is locked — other branches are hidden.',
      icon: '📍',
      color: '#22C55E',
      bg: 'rgba(34,197,94,0.15)',
      border: 'rgba(34,197,94,0.3)',
    },
    {
      id: 'category_manager',
      title: 'Category Manager',
      badge: 'Air Conditioner',
      desc: 'Manage the Air Conditioner category across all regions. The Product Group filter is locked — other groups are hidden.',
      icon: '📂',
      color: '#A855F7',
      bg: 'rgba(168,85,247,0.15)',
      border: 'rgba(168,85,247,0.3)',
    },
  ],
  supply: [
    {
      id: 'planner',
      title: 'Supply Planner',
      desc: 'Full access — manage production plans, inventory, supplier schedules, and exceptions across all regions and product families.',
      icon: '🏭',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.15)',
      border: 'rgba(59,130,246,0.3)',
    },
    {
      id: 'branch_manager',
      title: 'Branch Manager',
      badge: 'Mumbai · West Region',
      desc: 'View supply plans for the West region (containing Mumbai). The Region filter is locked — other regions are hidden.',
      icon: '📍',
      color: '#22C55E',
      bg: 'rgba(34,197,94,0.15)',
      border: 'rgba(34,197,94,0.3)',
    },
    {
      id: 'category_manager',
      title: 'Category Manager',
      badge: 'Air Conditioner',
      desc: 'Manage supply plans for Air Conditioner SKUs. The SKU Family filter is locked — other families are hidden.',
      icon: '📂',
      color: '#A855F7',
      bg: 'rgba(168,85,247,0.15)',
      border: 'rgba(168,85,247,0.3)',
    },
  ],
};

export default function PersonaRoleSelect() {
  const [params] = useSearchParams();
  const module = params.get('module') || 'demand';
  const navigate = useNavigate();
  const { login } = useAuth();
  const { persona, setPersona } = usePersona();
  const [hovered, setHovered] = useState(null);

  useEffect(() => { document.title = 'WhirlCast — Select Role'; }, []);

  useEffect(() => {
    if (!persona?.displayName) {
      navigate('/login', { replace: true });
    }
  }, [persona, navigate]);

  if (!persona?.displayName) return null;

  const roles = ROLE_DEFS[module] || ROLE_DEFS.demand;
  const moduleName = module === 'supply' ? 'Supply Planning' : 'Demand Planning';
  const moduleRoute = module === 'supply' ? '/supply' : '/demand-planning';

  const handleSelect = (role) => {
    // Auth login here so ProtectedRoute on the module page passes
    login({ role: 'demand_planning', name: persona.displayName });
    setPersona({ role: role.id, module });
    navigate(moduleRoute);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--navy)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      backgroundImage: `repeating-linear-gradient(
        45deg, transparent, transparent 40px,
        rgba(255,255,255,0.015) 40px, rgba(255,255,255,0.015) 80px)`,
    }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="32" height="32" viewBox="0 0 48 48">
          <rect width="48" height="48" rx="12" fill="#E31837"/>
          <polyline points="8,34 16,18 22,26 29,14 36,30 44,22"
            fill="none" stroke="white" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'white' }}>WhirlCast</div>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6 }}>
        {moduleName} · Select your role
      </p>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 36 }}>
        Signed in as <span style={{ color: 'white' }}>{persona.displayName}</span>
      </p>

      <div style={{
        display: 'flex', gap: 16, width: '100%', maxWidth: 860,
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {roles.map(role => (
          <div
            key={role.id}
            onMouseEnter={() => setHovered(role.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleSelect(role)}
            style={{
              background: hovered === role.id ? role.bg : 'rgba(255,255,255,0.05)',
              border: `0.5px solid ${hovered === role.id ? role.border : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 16, padding: '24px 22px',
              display: 'flex', flexDirection: 'column', gap: 12,
              transition: 'all 0.2s ease',
              transform: hovered === role.id ? 'translateY(-4px)' : 'none',
              cursor: 'pointer', flex: '1 1 240px', maxWidth: 270,
            }}
          >
            <div style={{ fontSize: 28 }}>{role.icon}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{role.title}</div>
              {role.badge && (
                <div style={{
                  display: 'inline-block', marginTop: 6,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
                  padding: '2px 9px', borderRadius: 20,
                  background: role.bg, border: `0.5px solid ${role.border}`,
                  color: role.color,
                }}>
                  {role.badge}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.55, flex: 1 }}>
              {role.desc}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
              textAlign: 'center', padding: '7px 0',
              borderTop: '0.5px solid rgba(255,255,255,0.1)',
              marginTop: 2,
            }}>
              Enter as {role.title} →
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/landing')}
        style={{
          marginTop: 32, background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer',
          textDecoration: 'underline', padding: 8,
        }}
      >
        ← Back to module selection
      </button>
    </div>
  );
}
