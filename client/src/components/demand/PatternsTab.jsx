/**
 * PatternsTab — Demand Planning Patterns tab content.
 *
 * Three separate sections per spec Section 5.2:
 * 1. Pattern Type Distribution bar chart  (Seasonal/Trend/Intermittent/Random)
 * 2. Volume × Variability scatter          (10 points, one per SKU)
 * 3. SKU-Location detail table             (80 rows, sortable)
 *
 * IMPORTANT — two distinct classification systems on this tab:
 * - ABC/XYZ class: volume/variability classification, per-SKU, stored on product_master
 * - Pattern Type: Seasonal/Trend/Intermittent/Random, a separate demand-shape classification
 * Labels are kept explicit to avoid confusion between these two systems.
 *
 * Uses Recharts (already the app's charting library — BarChart, ScatterChart).
 */
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell,
  ScatterChart, Scatter, Label, Legend,
} from 'recharts';

// ── Colour maps ───────────────────────────────────────────────────────────────

const PATTERN_COLORS = {
  Seasonal: '#2563EB',
  Trend:    '#D97706',
  Random:   '#DC2626',
  Intermittent: '#16A34A',
};

const ABC_FILL  = { A: '#16A34A', B: '#D97706', C: '#6B7280' };
const XYZ_BG   = { X: '#EFF6FF', Y: '#FFFBEB', Z: '#FFF1F2' };
const XYZ_FG   = { X: '#1D4ED8', Y: '#B45309', Z: '#B91C1C' };

// Fixed bar order so zero bars still appear honestly
const BAR_ORDER = ['Seasonal', 'Trend', 'Random', 'Intermittent'];

// ── Shared card wrapper ───────────────────────────────────────────────────────

function SectionCard({ title, note, children, style }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md, 10px)', overflow: 'hidden',
      ...style,
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{title}</div>
        {note && (
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.4 }}>
            {note}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

// ── Custom tooltips ───────────────────────────────────────────────────────────

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const count = payload[0].value;
  return (
    <div style={{
      background: 'white', border: '1px solid #E5E7EB',
      borderRadius: 8, padding: '8px 12px', fontSize: 11, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--text-2)' }}>
        {count} SKU{count !== 1 ? 's' : ''}
        {count === 0 && <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>(none currently)</span>}
      </div>
    </div>
  );
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'white', border: '1px solid #E5E7EB',
      borderRadius: 8, padding: '8px 12px', fontSize: 11,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: 160,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.sku.replace(/_/g, ' ')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 2 }}>
        <span style={{ color: 'var(--text-3)' }}>Group</span>
        <span>{d.category}</span>
        <span style={{ color: 'var(--text-3)' }}>ABC/XYZ</span>
        <span>{d.abcClass}/{d.xyzClass}</span>
        <span style={{ color: 'var(--text-3)' }}>Pattern</span>
        <span>{d.patternType}</span>
        <span style={{ color: 'var(--text-3)' }}>Volume</span>
        <span>{d.totalVolume.toLocaleString('en-IN')}</span>
        <span style={{ color: 'var(--text-3)' }}>CoV</span>
        <span>{d.cov.toFixed(3)}</span>
      </div>
    </div>
  );
}

// ── Badge components ──────────────────────────────────────────────────────────

function AbcXyzBadge({ abcClass, xyzClass }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{
        background: ABC_FILL[abcClass] || '#6B7280', color: 'white',
        fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
      }}>
        {abcClass}
      </span>
      <span style={{
        background: XYZ_BG[xyzClass] || '#F3F4F6',
        color:      XYZ_FG[xyzClass] || '#374151',
        fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
        border: `1px solid ${XYZ_FG[xyzClass] || '#9CA3AF'}40`,
      }}>
        {xyzClass}
      </span>
    </span>
  );
}

function PatternBadge({ patternType }) {
  const color = PATTERN_COLORS[patternType] || '#6B7280';
  return (
    <span style={{
      display: 'inline-block',
      background: `${color}18`, color,
      fontSize: 9, fontWeight: 700,
      padding: '2px 7px', borderRadius: 10,
      border: `1px solid ${color}40`,
      whiteSpace: 'nowrap',
    }}>
      {patternType}
    </span>
  );
}

// ── Table column definitions ──────────────────────────────────────────────────

const TABLE_COLS = [
  { key: 'sku',          sortKey: 'sku',          label: 'SKU',           fmt: v => v.replace(/_/g, ' ') },
  { key: 'locationName', sortKey: 'locationName',  label: 'Branch',        fmt: v => v },
  { key: 'region',       sortKey: 'region',        label: 'Region',        fmt: v => v },
  { key: 'category',     sortKey: 'category',      label: 'Product Group', fmt: v => v },
  { key: 'abcClass',     sortKey: 'abcClass',      label: 'ABC/XYZ Class', special: 'abcxyz' },
  { key: 'patternType',  sortKey: 'patternType',   label: 'Pattern Type',  special: 'pattern' },
  { key: 'cov',          sortKey: 'cov',           label: 'CoV',           fmt: v => v.toFixed(3), align: 'right' },
  { key: 'annualVolume', sortKey: 'annualVolume',  label: 'Annual Volume', fmt: v => v.toLocaleString('en-IN'), align: 'right' },
  { key: 'weeklyAvg',    sortKey: 'weeklyAvg',     label: 'Monthly Avg',   fmt: v => v.toFixed(0), align: 'right' },
];

// ── PatternsTab ───────────────────────────────────────────────────────────────

export default function PatternsTab({ data, loading, onRecalculate, recalculating }) {
  const [sortKey, setSortKey] = useState('abcClass');
  const [sortDir, setSortDir] = useState('asc');

  // Bar chart data — always render all 4 categories so zero bars show honestly
  const barData = useMemo(() => {
    const counts = data?.classificationDistribution?.counts || {};
    return BAR_ORDER.map(name => ({ name, count: counts[name] ?? 0 }));
  }, [data]);

  // Scatter data split by ABC class (separate <Scatter> series = clean legend + distinct colours)
  const { aData, bData, cData } = useMemo(() => {
    const pts = data?.scatter || [];
    return {
      aData: pts.filter(d => d.abcClass === 'A'),
      bData: pts.filter(d => d.abcClass === 'B'),
      cData: pts.filter(d => d.abcClass === 'C'),
    };
  }, [data]);

  // Sorted detail table
  const sortedTable = useMemo(() => {
    const rows = data?.table || [];
    return [...rows].sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = key => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Loading / empty states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--text-3)', fontSize: 13 }}>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        Loading patterns…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-3)', fontSize: 13 }}>
        No pattern data available.
      </div>
    );
  }

  const totalSkus = data.classificationDistribution?.total ?? 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top row: distribution bar + scatter side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* 1. Pattern Type Distribution */}
        <SectionCard
          title="Pattern Type Distribution"
          note="Seasonal/Trend/Random/Intermittent — a separate classification from ABC/XYZ. Computed from national weekly demand totals."
        >
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                domain={[0, Math.max(10, ...(barData.map(b => b.count)))]}
              />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {barData.map(entry => (
                  <Cell key={entry.name} fill={PATTERN_COLORS[entry.name] || '#6B7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              Full portfolio · {totalSkus} SKUs
            </span>
            <button
              onClick={onRecalculate}
              disabled={recalculating}
              style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text-2)', cursor: recalculating ? 'default' : 'pointer',
                opacity: recalculating ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
            >
              {recalculating ? '⟳ Recalculating…' : 'Recalculate Classifications'}
            </button>
          </div>
        </SectionCard>

        {/* 2. Volume × Variability Scatter */}
        <SectionCard
          title="Volume × Variability"
          note="One point per SKU (not per location) · Color = ABC class · Position = annual volume vs. demand CoV"
        >
          <ResponsiveContainer width="100%" height={230}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                type="number" dataKey="totalVolume" name="Annual Volume"
                tick={{ fontSize: 10 }}
                tickFormatter={v => `${Math.round(v / 1000)}K`}
              >
                <Label
                  value="Annual Volume (units)"
                  offset={-8} position="insideBottom"
                  style={{ fontSize: 10, fill: '#9CA3AF' }}
                />
              </XAxis>
              <YAxis
                type="number" dataKey="cov" name="CoV"
                tick={{ fontSize: 10 }} width={36}
              >
                <Label
                  value="CoV"
                  angle={-90} position="insideLeft"
                  style={{ fontSize: 10, fill: '#9CA3AF' }}
                />
              </YAxis>
              <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              {/* Legend at top keeps it clear of the x-axis label at the bottom */}
              <Legend
                verticalAlign="top"
                wrapperStyle={{ fontSize: 11, paddingBottom: 6 }}
                iconSize={8}
              />
              <Scatter name="A-class" data={aData} fill={ABC_FILL.A} fillOpacity={0.85} isAnimationActive={false} />
              <Scatter name="B-class" data={bData} fill={ABC_FILL.B} fillOpacity={0.85} isAnimationActive={false} />
              <Scatter name="C-class" data={cData} fill={ABC_FILL.C} fillOpacity={0.85} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* 3. SKU-Location Detail Table */}
      <SectionCard
        title="SKU-Location Detail"
        note={`${data.table?.length || 0} rows · ABC/XYZ Class and Pattern Type are per-SKU — identical across all of a SKU's location rows · Volume figures are per SKU-location`}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {TABLE_COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.sortKey)}
                    style={{
                      padding: '8px 10px',
                      textAlign: col.align || 'left',
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
                      textTransform: 'uppercase', color: 'var(--text-3)',
                      borderBottom: '2px solid var(--border)',
                      background: '#F8FAFC',
                      cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                    <span style={{ marginLeft: 3, opacity: sortKey === col.sortKey ? 1 : 0.25 }}>
                      {sortKey === col.sortKey
                        ? (sortDir === 'asc' ? '▲' : '▼')
                        : '↕'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTable.map((row, i) => (
                <tr
                  key={`${row.sku}|${row.locationId}`}
                  style={{
                    background: i % 2 === 0 ? 'white' : '#FAFAFA',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  {TABLE_COLS.map(col => (
                    <td
                      key={col.key}
                      style={{
                        padding: '6px 10px',
                        textAlign: col.align || 'left',
                        verticalAlign: 'middle',
                        fontSize: 11,
                        color: col.key === 'sku' ? 'var(--text-1)' : 'var(--text-2)',
                        fontWeight: col.key === 'sku' ? 600 : 400,
                      }}
                    >
                      {col.special === 'abcxyz' ? (
                        <AbcXyzBadge abcClass={row.abcClass} xyzClass={row.xyzClass} />
                      ) : col.special === 'pattern' ? (
                        <PatternBadge patternType={row.patternType} />
                      ) : (
                        col.fmt(row[col.key])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
