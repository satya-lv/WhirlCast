import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePersona } from '../context/PersonaContext';

const MODULES = [
  {
    id: 'executive',
    title: 'Executive Cockpit',
    desc: 'Consolidated S&OP overview for senior leadership — key KPIs, exception summaries, and recommended actions.',
    icon: '📊',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.3)',
  },
  {
    id: 'demand',
    title: 'Demand Planning',
    desc: 'AI-driven forecasts, scenario comparison, demand sensing, NPI forecasting, and override management.',
    icon: '📈',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.3)',
  },
  {
    id: 'supply',
    title: 'Supply Planning',
    desc: 'Production scheduling, inventory optimisation, supplier plans, and exception management.',
    icon: '🏭',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.3)',
  },
  {
    id: 'admin',
    title: 'Admin Console',
    desc: 'Manage product masters, LFL mappings, user roles and system configuration.',
    icon: '⚙️',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.15)',
    border: 'rgba(239,68,68,0.3)',
  },
];

export default function PersonaLanding() {
  useEffect(() => { document.title = 'WhirlCast — Select Module'; }, []);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { persona, setPersona } = usePersona();
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!persona?.displayName) {
      navigate('/login', { replace: true });
    }
  }, [persona, navigate]);

  if (!persona?.displayName) return null;

  const handleSelect = (mod) => {
    if (mod.id === 'executive') {
      login({ role: 'demand_planning', name: persona.displayName });
      navigate('/executive-cockpit');
      return;
    }
    if (mod.id === 'admin') {
      login({ role: 'admin', name: persona.displayName });
      navigate('/admin');
      return;
    }
    if (mod.id === 'supply') {
      login({ role: 'demand_planning', name: persona.displayName });
      setPersona({ role: 'planner', module: 'supply' });
      navigate('/supply');
      return;
    }
    navigate(`/role-select?module=${mod.id}`);
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
        <svg width="40" height="40" viewBox="0 0 48 48">
          <rect width="48" height="48" rx="12" fill="#E31837"/>
          <polyline points="8,34 16,18 22,26 29,14 36,30 44,22"
            fill="none" stroke="white" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
          WhirlCast
        </div>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 40 }}>
        Welcome, <span style={{ color: 'white', fontWeight: 600 }}>{persona.displayName}</span>
        {' '}· Select a module to continue
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16, width: '100%', maxWidth: 720,
      }}>
        {MODULES.map(mod => (
          <div
            key={mod.id}
            onMouseEnter={() => setHovered(mod.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleSelect(mod)}
            style={{
              background: hovered === mod.id ? mod.bg : 'rgba(255,255,255,0.05)',
              border: `0.5px solid ${hovered === mod.id ? mod.border : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 16, padding: '24px 22px',
              display: 'flex', flexDirection: 'column', gap: 12,
              transition: 'all 0.2s ease',
              transform: hovered === mod.id ? 'translateY(-4px)' : 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div style={{ fontSize: 30 }}>{mod.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>
              {mod.title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55, flex: 1 }}>
              {mod.desc}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
