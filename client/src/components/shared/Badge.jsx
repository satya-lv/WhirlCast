/**
 * Badge — status pill component.
 *
 * All color mappings are now sourced from statusConfig.js.
 * Existing callers using type='success'/'warning'/'danger'/'info'/'purple'/'grey'/'navy'
 * continue to work unchanged — those keys are all in STATUS_CONFIG.
 *
 * New modules can also pass inventory/branch status keys directly:
 *   <Badge type="healthy" text="Healthy" />
 *   <Badge type="below-rop" text="Below ROP" />
 *   <Badge type="submitted_clean" text="Submitted" />
 */
import React from 'react';
import { getStatusConfig } from '../../utils/statusConfig';

export const Badge = ({ type = 'grey', text, style = {} }) => {
  const { bg, color } = getStatusConfig(type);
  return (
    <span style={{
      background: bg,
      color,
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 9px',
      borderRadius: 'var(--radius-xl)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      ...style,
    }}>
      {text}
    </span>
  );
};
