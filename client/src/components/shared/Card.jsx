/**
 * Card / CardHeader / CardSection — standard card container primitives.
 *
 * Card        — white surface with standard border, shadow, radius.
 * CardHeader  — title row with optional right slot; draws a bottom border.
 * CardSection — padded interior section; adds a top border when not first child.
 *
 * All existing inline styles of the form:
 *   background: 'var(--card)', borderRadius: 'var(--radius-lg)',
 *   border: '0.5px solid var(--border)', boxShadow: 'var(--shadow-sm)',
 *   padding: '18px 20px'
 * are replaced by <Card> for new modules. Existing pages are not changed.
 *
 * Examples:
 *   <Card>...</Card>
 *   <Card noPad accentTop="var(--navy-accent)">
 *     <CardHeader title="Branch Inventory" right={<button>…</button>} />
 *     <CardSection>…chart…</CardSection>
 *   </Card>
 */
import React from 'react';

export function Card({
  children,
  padding = 'var(--sp-18) var(--sp-20)',
  noPad = false,
  accentTop,       // coloured 3px top border (e.g. KPI cards)
  hover = false,   // lift-on-hover effect
  style,
  ...rest
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius-lg)',
        border: '0.5px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        padding: noPad ? 0 : padding,
        borderTop: accentTop ? `3px solid ${accentTop}` : undefined,
        transition: hover ? 'transform 0.15s ease, box-shadow 0.15s ease' : undefined,
        ...style,
      }}
      onMouseEnter={hover ? e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      } : undefined}
      onMouseLeave={hover ? e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, right, style, children, ...rest }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--sp-16) var(--sp-20)',
        borderBottom: '1px solid var(--border)',
        ...style,
      }}
      {...rest}
    >
      {title ? (
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{title}</span>
      ) : children}
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)' }}>{right}</div>}
    </div>
  );
}

export function CardSection({ children, padding = 'var(--sp-16) var(--sp-20)', style, ...rest }) {
  return (
    <div style={{ padding, ...style }} {...rest}>
      {children}
    </div>
  );
}
