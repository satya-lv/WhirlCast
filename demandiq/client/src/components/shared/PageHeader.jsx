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
