import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePersona } from '../context/PersonaContext';

function deriveName(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { displayName: 'User', initial: 'U' };
  const first = trimmed.split(/[._\s@]/)[0];
  const capitalized = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return { displayName: capitalized, initial: capitalized.charAt(0).toUpperCase() };
}

const inputStyle = {
  background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.2)',
  borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 13,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export default function PersonaLogin() {
  useEffect(() => { document.title = 'WhirlCast — Sign In'; }, []);
  const { setPersona } = usePersona();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const { displayName, initial } = deriveName(username || 'User');
    // auth login happens at role-select time so the app shell doesn't render
    // over the landing/role-select screens
    setPersona({ displayName, initial, role: null, module: null });
    navigate('/landing');
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
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 40 }}>
        Whirlpool India · Intelligent Business Planning
      </p>

      <form onSubmit={handleSubmit} style={{
        background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)',
        borderRadius: 16, padding: '32px 36px', width: '100%', maxWidth: 380,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 4 }}>
          Sign in
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.4px' }}>
            USERNAME
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            autoFocus
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.4px' }}>
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            style={inputStyle}
          />
        </div>

        <button type="submit" style={{
          marginTop: 4, background: '#E31837', color: 'white', border: 'none',
          borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', width: '100%',
        }}>
          Continue →
        </button>

      </form>

      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 32 }}>
        Powered by DecisionPoint Analytics
      </p>
    </div>
  );
}
