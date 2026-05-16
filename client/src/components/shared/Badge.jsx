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
