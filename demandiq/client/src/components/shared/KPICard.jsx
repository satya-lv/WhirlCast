import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export const KPICard = ({ label, value, badge, badgeType, spark, accentColor, icon, animClass, subtitle,
  /* legacy props for backward compat */ title, trend, trendDirection, sparklineData, borderColor, sub }) => {
  const displayLabel = label || title;
  const displayBadge = badge || trend;
  const displayBadgeType = badgeType || (trendDirection === 'up' ? 'up' : trendDirection === 'down' ? 'down' : undefined);
  const displaySpark = spark || sparklineData;
  const displayAccent = accentColor || borderColor || 'var(--navy-accent)';

  return (
    <div className={animClass || 'fade-up'}
      style={{
        background: 'var(--card)', borderRadius: 'var(--radius-lg)',
        border: '0.5px solid var(--border)', boxShadow: 'var(--shadow-sm)',
        padding: '18px 20px', position: 'relative', overflow: 'hidden',
        borderTop: `3px solid ${displayAccent}`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
        color: 'var(--text-2)', marginBottom: 2 }}>{displayLabel}</div>
      {(subtitle || sub) && <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>{subtitle || sub}</div>}
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      {displayBadge && (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
          background: displayBadgeType === 'up' ? '#DCFCE7' : displayBadgeType === 'down' ? '#FEE2E2' : '#FEF3C7',
          color: displayBadgeType === 'up' ? '#16A34A' : displayBadgeType === 'down' ? '#DC2626' : '#D97706',
        }}>{displayBadge}</span>
      )}
      {icon && (
        <div style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32,
          background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 15 }}>{icon}</div>
      )}
      {displaySpark?.length > 0 && (
        <div style={{ height: 44, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displaySpark.map((item, i) => typeof item === 'object' ? item : { v: item, i })}
              margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line type="monotone" dataKey="v"
                stroke={displayAccent || '#1B3A6B'}
                strokeWidth={2.5} dot={false}
                isAnimationActive animationDuration={1200}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default KPICard;
