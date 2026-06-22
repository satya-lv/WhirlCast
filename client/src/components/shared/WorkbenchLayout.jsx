/**
 * WorkbenchLayout — list+detail shell per IBP_SOP_SPEC.md §7.3.
 *
 * NOT YET USED BY EXISTING PAGES. This layout is ready for new modules
 * (Inventory, Replenishment, Raw Material, RCCP). Do not refactor
 * ForecastWorkbench.jsx — it predates this component and works as-is.
 *
 * Structure:
 *   ┌─── FilterBar ──────────────────────────────────────────────────┐
 *   │ [Branch ▼] [Category ▼] [Price Tier ▼] [ABC-XYZ ▼] [Search…] │
 *   └────────────────────────────────────────────────────────────────┘
 *   ┌─── ItemList (240–320px) ──┬─── DetailPanel (remaining) ───────┐
 *   │ N items                   │ [4-col KPI strip]                 │
 *   │ > ItemRow (selected)      │ [primary chart / table]           │
 *   │   ItemRow                 │ [action bar]                      │
 *   └───────────────────────────┴───────────────────────────────────┘
 *
 * Usage:
 *   <WorkbenchLayout
 *     filterBar={<FilterBar ... />}
 *     list={items.map(i => (
 *       <WorkbenchLayout.ItemRow key={i.id} selected={i === active} onClick={() => setActive(i)}
 *         primary={i.name} secondary={i.location} badge={i.abcXyz} status={i.status} />
 *     ))}
 *     listCount={items.length}
 *     detail={active && <InventoryDetail item={active} />}
 *     emptyDetail="Select a SKU to view details"
 *   />
 *
 * KPI Strip:
 *   <WorkbenchLayout.KpiStrip kpis={[
 *     { label: 'On Hand', value: '1,240 u', accent: 'var(--green)' },
 *     { label: 'Safety Stock', value: '320 u' },
 *     { label: 'Days of Cover', value: '38d', accent: '#D97706' },
 *     { label: 'ROP', value: '180 u' },
 *   ]} />
 */
import React from 'react';
import { getStatusConfig } from '../../utils/statusConfig';

// ── WorkbenchLayout root ──────────────────────────────────────────────────────

export function WorkbenchLayout({
  filterBar,
  list,
  listCount,
  listWidth = 280,
  detail,
  emptyDetail = 'Select an item to view details',
  style,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', ...style }}>

      {/* Filter bar */}
      {filterBar && (
        <div style={{
          padding: 'var(--sp-12) var(--sp-16)',
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {filterBar}
        </div>
      )}

      {/* Two-panel body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Left: item list */}
        <div style={{
          width: listWidth,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          background: 'var(--card)',
        }}>
          {listCount != null && (
            <div style={{
              padding: 'var(--sp-10) var(--sp-16) var(--sp-8)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-3)',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
              position: 'sticky',
              top: 0,
              background: 'var(--card)',
              zIndex: 1,
            }}>
              {listCount} items
            </div>
          )}
          {list}
        </div>

        {/* Right: detail panel */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          {detail ?? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 240,
              color: 'var(--text-3)',
              fontSize: 13,
            }}>
              {emptyDetail}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── ItemRow ───────────────────────────────────────────────────────────────────

/**
 * Standard list item row for the left panel.
 *
 * Props:
 *   primary    {string}  — main label (SKU name)
 *   secondary  {string}  — sub-label (branch / location)
 *   badge      {string}  — classification chip (e.g. "AX", "BY")
 *   status     {string}  — statusConfig key (e.g. 'healthy', 'watch', 'below-rop')
 *   selected   {boolean}
 *   onClick    {fn}
 */
WorkbenchLayout.ItemRow = function ItemRow({
  primary,
  secondary,
  badge,
  status,
  selected = false,
  onClick,
  style,
}) {
  const sc = status ? getStatusConfig(status) : null;

  return (
    <div
      onClick={onClick}
      style={{
        padding: 'var(--sp-10) var(--sp-16)',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: selected ? 'var(--blue-bg)' : 'transparent',
        borderLeft: selected ? '3px solid var(--navy-accent)' : '3px solid transparent',
        transition: 'background 0.12s',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-10)',
        ...style,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#F9FAFB'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {primary}
        </div>
        {secondary && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{secondary}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px',
            borderRadius: 'var(--radius-xl)', background: 'var(--navy-accent)',
            color: 'white', letterSpacing: '0.3px',
          }}>{badge}</span>
        )}
        {sc && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px',
            borderRadius: 'var(--radius-xl)', background: sc.bg, color: sc.color,
          }}>{sc.label}</span>
        )}
      </div>
    </div>
  );
};

// ── KpiStrip ─────────────────────────────────────────────────────────────────

/**
 * 4-column KPI strip shown at the top of the detail panel.
 *
 * Props:
 *   kpis  {Array<{ label: string, value: string, accent?: string }>}
 */
WorkbenchLayout.KpiStrip = function KpiStrip({ kpis = [] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${kpis.length}, 1fr)`,
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
    }}>
      {kpis.map((kpi, i) => (
        <div key={i} style={{
          padding: 'var(--sp-12) var(--sp-16)',
          borderRight: i < kpis.length - 1 ? '1px solid var(--border)' : undefined,
          borderTop: kpi.accent ? `2px solid ${kpi.accent}` : '2px solid transparent',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
            {kpi.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: kpi.accent ?? 'var(--text-1)', lineHeight: 1 }}>
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── DetailHeader ─────────────────────────────────────────────────────────────

/**
 * Detail panel header row with breadcrumb, badge, and optional actions.
 *
 * Props:
 *   breadcrumb  {string}  — e.g. "India / Mumbai"
 *   title       {string}  — SKU name
 *   badge       {string}  — statusConfig key (e.g. 'healthy')
 *   classification {string} — e.g. "AX · Leader"
 *   actions     {ReactNode}
 */
WorkbenchLayout.DetailHeader = function DetailHeader({ breadcrumb, title, badge, classification, actions }) {
  const sc = badge ? getStatusConfig(badge) : null;

  return (
    <div style={{
      padding: 'var(--sp-16) var(--sp-20)',
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--sp-16)',
    }}>
      <div>
        {breadcrumb && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{breadcrumb}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{title}</span>
          {sc && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-xl)', background: sc.bg, color: sc.color }}>
              {sc.label}
            </span>
          )}
          {classification && (
            <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{classification}</span>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 'var(--sp-8)', flexShrink: 0 }}>{actions}</div>
      )}
    </div>
  );
};

export default WorkbenchLayout;
