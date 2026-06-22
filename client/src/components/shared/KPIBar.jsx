/**
 * KPIBar — global 10-KPI fixed top bar per IBP_SOP_SPEC.md §7.1–7.2.
 *
 * NOT YET MOUNTED. This component is built and ready; it will be wired into
 * the app shell during the navigation restructuring phase (Phase 1 — shell).
 * Do not import it in App.jsx or any existing page yet.
 *
 * Layout: 2 rows of 5 KPIs each, always visible above the module content area.
 * Each KPI shows: label, formatted value, and a colour-coded status band.
 *
 * Thresholds (per spec §7.2):
 *   Forecast Accuracy  — >85% green | 75–85% amber | <75% red
 *   Forecast Bias      — |bias|<5% green | 5–12% amber | >12% red
 *   Service Level      — >90% green | 80–90% amber | <80% red
 *   Inventory Turns    — >7x green | 4–7x amber | <4x red
 *   Stockout Risk      — 0 green | 1–3 amber | >3 red
 *   Supplier OTIF      — >95% green | 90–95% amber | <90% red
 *   Production Adherence — >95% green | 85–95% amber | <85% red
 *   Revenue at Risk    — any value red (per spec: "Any value → critical")
 *   Excess Inventory   — neutral (informational)
 *   Inventory Value    — neutral (informational)
 *
 * Props:
 *   kpis {object} — shape defined by KPI_DEFS below. Pass null/undefined keys
 *                   to show "--" for KPIs whose backend data isn't ready yet.
 *   onKpiClick {(key: string) => void} — optional; navigates to the source module
 *
 * Backend endpoint (to be built): GET /api/kpis/global
 * Returns the kpis object shape matching KPI_DEFS keys.
 */
import React from 'react';

const GREEN  = { bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A' };
const AMBER  = { bg: '#FEF3C7', color: '#D97706', dot: '#D97706' };
const RED    = { bg: '#FEE2E2', color: '#DC2626', dot: '#DC2626' };
const NEUT   = { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' };

const KPI_DEFS = [
  // Row 1
  {
    key: 'revenueAtRisk',
    label: 'Revenue at Risk',
    format: v => v == null ? '--' : `₹${(v / 1e7).toFixed(1)} Cr`,
    band: () => RED,                                        // always critical
    sourceModule: '/inventory',
  },
  {
    key: 'forecastAccuracy',
    label: 'Forecast Accuracy',
    format: v => v == null ? '--' : `${v.toFixed(1)}%`,
    band: v => v == null ? NEUT : v > 85 ? GREEN : v >= 75 ? AMBER : RED,
    sourceModule: '/workbench',
  },
  {
    key: 'forecastBias',
    label: 'Forecast Bias',
    format: v => v == null ? '--' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
    band: v => v == null ? NEUT : Math.abs(v) < 5 ? GREEN : Math.abs(v) <= 12 ? AMBER : RED,
    sourceModule: '/workbench',
  },
  {
    key: 'serviceLevel',
    label: 'Service Level',
    format: v => v == null ? '--' : `${v.toFixed(1)}%`,
    band: v => v == null ? NEUT : v > 90 ? GREEN : v >= 80 ? AMBER : RED,
    sourceModule: '/inventory',
  },
  {
    key: 'inventoryValue',
    label: 'Inventory Value',
    format: v => v == null ? '--' : `₹${(v / 1e7).toFixed(0)} Cr`,
    band: () => NEUT,                                       // informational only
    sourceModule: '/inventory',
  },
  // Row 2
  {
    key: 'inventoryTurns',
    label: 'Inventory Turns',
    format: v => v == null ? '--' : `${v.toFixed(1)}x`,
    band: v => v == null ? NEUT : v > 7 ? GREEN : v >= 4 ? AMBER : RED,
    sourceModule: '/inventory',
  },
  {
    key: 'stockoutRisk',
    label: 'Stockout Risk',
    format: v => v == null ? '--' : `${v} SKU-loc`,
    band: v => v == null ? NEUT : v === 0 ? GREEN : v <= 3 ? AMBER : RED,
    sourceModule: '/inventory',
  },
  {
    key: 'excessInventory',
    label: 'Excess Inventory',
    format: v => v == null ? '--' : `₹${(v / 1e7).toFixed(1)} Cr`,
    band: () => NEUT,                                       // informational only
    sourceModule: '/inventory',
  },
  {
    key: 'supplierOtif',
    label: 'Supplier OTIF',
    format: v => v == null ? '--' : `${(v * 100).toFixed(1)}%`,
    band: v => v == null ? NEUT : v > 0.95 ? GREEN : v >= 0.90 ? AMBER : RED,
    sourceModule: '/supplier-collaboration',
  },
  {
    key: 'productionAdherence',
    label: 'Prod. Adherence',
    format: v => v == null ? '--' : `${(v * 100).toFixed(1)}%`,
    band: v => v == null ? NEUT : v > 0.95 ? GREEN : v >= 0.85 ? AMBER : RED,
    sourceModule: '/production',
  },
];

function KPICell({ def, value, onClick }) {
  const band = def.band(value);
  const label = def.format(value);

  return (
    <button
      onClick={onClick}
      title={`Go to ${def.label} detail`}
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: 'var(--sp-8) var(--sp-12)',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
        {def.label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: band.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '-0.2px' }}>
          {label}
        </span>
      </span>
    </button>
  );
}

/**
 * @param {{ kpis?: object, onKpiClick?: (key: string) => void }} props
 *
 * kpis shape — all keys optional; null/undefined shows "--":
 * {
 *   revenueAtRisk:        number,  // INR
 *   forecastAccuracy:     number,  // % e.g. 87.3
 *   forecastBias:         number,  // % e.g. -3.1
 *   serviceLevel:         number,  // % e.g. 91.2
 *   inventoryValue:       number,  // INR
 *   inventoryTurns:       number,  // e.g. 6.2
 *   stockoutRisk:         number,  // count of SKU-branches below ROP
 *   excessInventory:      number,  // INR
 *   supplierOtif:         number,  // 0–1 e.g. 0.923
 *   productionAdherence:  number,  // 0–1 e.g. 0.91
 * }
 */
export function KPIBar({ kpis = {}, onKpiClick }) {
  const row1 = KPI_DEFS.slice(0, 5);
  const row2 = KPI_DEFS.slice(5);

  const renderRow = (defs) => (
    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {defs.map(def => (
        <KPICell
          key={def.key}
          def={def}
          value={kpis[def.key] ?? null}
          onClick={onKpiClick ? () => onKpiClick(def.key) : null}
        />
      ))}
    </div>
  );

  return (
    <div style={{
      background: 'var(--navy)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      userSelect: 'none',
    }}>
      {renderRow(row1)}
      {renderRow(row2)}
    </div>
  );
}

export default KPIBar;
