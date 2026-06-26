/**
 * DemandPlanning — unified demand planning workbench.
 *
 * Step A.3.2: Patterns tab added alongside Forecast Grid.
 * - Top KPI bar (8 KPIs from /api/demand-planning/kpis)
 * - Filter row (location / product group / SKU / ABC / XYZ)
 * - 5-tab navigation; Forecast Grid + Patterns tabs are live
 * - DemandGrid wired to /api/demand-planning/grid with PATCH on cell edit
 * - Tabs use display:none (not unmount) so Grid scroll/expand state is preserved
 */
import React, {
  useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo,
} from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { usePersona, getLockedFilter } from '../context/PersonaContext';
import DemandGrid from '../components/demand/DemandGrid';
import PatternsTab from '../components/demand/PatternsTab';
import ExceptionsTab from '../components/demand/ExceptionsTab';
import WhatIfTab from '../components/demand/WhatIfTab';
import DisaggregateTab from '../components/demand/DisaggregateTab';
import NPITab from '../components/demand/NPITab';
import DemandSensing from './DemandSensing';

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchFilterOptions() {
  const r = await fetch('/api/demand-planning/filters');
  if (!r.ok) throw new Error(`filters ${r.status}`);
  return r.json();
}

async function fetchKPIs(filters) {
  const p = new URLSearchParams();
  if (filters.locationId) p.set('locationId', filters.locationId);
  if (filters.skuFamily)  p.set('skuFamily',  filters.skuFamily);
  if (filters.sku)        p.set('sku',         filters.sku);
  if (filters.abcClass)   p.set('abcClass',    filters.abcClass);
  if (filters.xyzClass)   p.set('xyzClass',    filters.xyzClass);
  const r = await fetch(`/api/demand-planning/kpis?${p}`);
  if (!r.ok) throw new Error(`kpis ${r.status}`);
  return r.json();
}

async function fetchAllGridPages(filters, weekStart = 24) {
  const base = {
    weekStart, weekEnd: 52, pageSize: 50,
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.skuFamily  ? { skuFamily:  filters.skuFamily  } : {}),
    ...(filters.sku        ? { sku:        filters.sku        } : {}),
    ...(filters.abcClass   ? { abcClass:   filters.abcClass   } : {}),
    ...(filters.xyzClass   ? { xyzClass:   filters.xyzClass   } : {}),
  };

  const r1   = await fetch('/api/demand-planning/grid?' + new URLSearchParams({ ...base, page: 1 }));
  const d1   = await r1.json();
  const all  = [...d1.rows];
  const { totalPages } = d1.pagination;

  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetch('/api/demand-planning/grid?' + new URLSearchParams({ ...base, page: i + 2 })).then(r => r.json())
      )
    );
    for (const d of rest) all.push(...d.rows);
  }
  return { rows: all, weeks: d1.weeks, editableFrom: d1.weekRange?.editableFrom ?? 24 };
}

async function fetchExceptions(filters) {
  const p = new URLSearchParams({ acknowledged: 0 });
  if (filters?.locationId) p.set('locationId', filters.locationId);
  if (filters?.skuFamily)  p.set('skuFamily',  filters.skuFamily);
  const r = await fetch(`/api/demand-planning/exceptions?${p}`);
  if (!r.ok) throw new Error(`exceptions ${r.status}`);
  return r.json();
}

async function fetchPatterns(filters) {
  const p = new URLSearchParams();
  if (filters.locationId) p.set('locationId', filters.locationId);
  if (filters.skuFamily)  p.set('skuFamily',  filters.skuFamily);
  if (filters.sku)        p.set('sku',         filters.sku);
  if (filters.abcClass)   p.set('abcClass',    filters.abcClass);
  if (filters.xyzClass)   p.set('xyzClass',    filters.xyzClass);
  const r = await fetch(`/api/demand-planning/patterns?${p}`);
  if (!r.ok) throw new Error(`patterns ${r.status}`);
  return r.json();
}

// ── Grid export helpers ───────────────────────────────────────────────────────

function buildDemandExportData(rows, weeks) {
  const weekLabels = weeks.map(w => w < 24 ? `M${w}` : w === 24 ? 'Now' : `+${w - 24}M`);
  const headers = ['SKU', 'Location', ...weekLabels];
  const data = rows.map(r => [
    r.sku,
    r.locationName || `Loc${r.locationId}`,
    ...weeks.map(w => r.cells?.[w]?.finalConsensus ?? 0),
  ]);
  return { headers, data };
}

function downloadDemandCSV(rows, weeks) {
  const { headers, data } = buildDemandExportData(rows, weeks);
  const lines = [headers, ...data].map(row =>
    row.map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v).join(',')
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'demand_forecast.csv'; a.click();
  URL.revokeObjectURL(url);
}

function downloadDemandXLSX(rows, weeks) {
  const { headers, data } = buildDemandExportData(rows, weeks);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Demand Forecast');
  XLSX.writeFile(wb, 'demand_forecast.xlsx');
}

const FORECAST_MODELS = [
  'Auto Selected',
  'SARIMAX', 'Prophet', 'VAR/VARMAX', 'GARCH', 'LSTM', 'Encoder-Decoder',
  'Multi-Linear Regression', 'Decision Trees', 'Random Forest', 'Boosting-XGB', 'SVM', 'ANN',
];

async function fetchRecalculate(modelName, filters) {
  const r = await fetch('/api/demand-planning/model/recalculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelName, filters }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `recalculate ${r.status}`);
  }
  return r.json();
}

async function fetchFinalize(modelName, filters) {
  const r = await fetch('/api/demand-planning/model/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelName, filters }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `finalize ${r.status}`);
  }
  return r.json();
}

// ── KPI bar ───────────────────────────────────────────────────────────────────

const KPI_DEFS = [
  {
    key: 'totalForecastDemand', label: 'Total Demand',
    fmt: v => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${Math.round(v / 1000)}K`,
    color: () => '#2563EB',
  },
  {
    key: 'forecastAccuracyPct', label: 'Forecast Acc',
    fmt: v => `${v.toFixed(1)}%`,
    color: v => v >= 90 ? '#16A34A' : v >= 80 ? '#D97706' : '#DC2626',
  },
  {
    key: 'biasPct', label: 'Bias',
    fmt: v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
    color: v => Math.abs(v) < 5 ? '#16A34A' : Math.abs(v) < 15 ? '#D97706' : '#DC2626',
  },
  {
    key: 'openPlannerAdjustments', label: 'Open Adj',
    fmt: v => String(v),
    color: () => '#2563EB',
  },
  {
    key: 'revenueForecast', label: 'Revenue Fcst',
    fmt: v => `₹${(v / 10000000).toFixed(1)}Cr`,
    color: () => '#2563EB',
  },
  {
    key: 'inventoryDays', label: 'Inv Days',
    fmt: v => `${v.toFixed(1)}d`,
    color: v => v >= 14 ? '#16A34A' : v >= 7 ? '#D97706' : '#DC2626',
  },
  {
    key: 'aClassCoveragePct', label: 'A-Class Cov',
    fmt: v => `${v.toFixed(1)}%`,
    color: v => v >= 70 ? '#16A34A' : v >= 50 ? '#D97706' : '#DC2626',
  },
  {
    key: 'openExceptions', label: 'Exceptions',
    fmt: v => String(v),
    color: v => v === 0 ? '#16A34A' : '#DC2626',
  },
];

function DemandKPIStrip({ kpis, loading }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      overflowX: 'auto', flexShrink: 0,
    }}>
      {KPI_DEFS.map(def => {
        const raw  = kpis?.[def.key]?.value;
        const val  = raw != null ? raw : null;
        const fmtd = loading || val == null ? '—' : def.fmt(val);
        const clr  = !loading && val != null ? def.color(val) : 'var(--text-3)';
        return (
          <div key={def.key} style={{
            flex: '1 0 0', minWidth: 100,
            padding: '10px 14px',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--text-3)' }}>
              {def.label}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: clr, lineHeight: 1 }}>
              {fmtd}
            </span>
            {kpis?.[def.key]?.unit && (
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
                {kpis[def.key].unit}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FSelect({ label, value, onChange, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
        textTransform: 'uppercase', color: 'var(--text-3)',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--bg)',
          color: 'var(--text-1)', cursor: 'pointer',
        }}
      >
        {children}
      </select>
    </label>
  );
}

const lockedText = (label) => (
  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', flexShrink: 0 }}>
    {label}
  </span>
);

function DemandFilterBar({
  filters, onChange, options, lockedField, lockedLabel,
  personaRole, severityBucket, onSeverityChange,
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '10px 16px',
      background: 'var(--card)', borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {lockedField === 'locationId'
        ? lockedText(lockedLabel)
        : (
          <FSelect label="Branch" value={filters.locationId} onChange={v => onChange({ ...filters, locationId: v })}>
            <option value="">All Branches</option>
            {(options?.locations || []).map(l => (
              <option key={l.locationId} value={String(l.locationId)}>{l.name}</option>
            ))}
          </FSelect>
        )
      }

      {lockedField === 'skuFamily'
        ? lockedText(lockedLabel)
        : (
          <FSelect label="Product Group" value={filters.skuFamily} onChange={v => onChange({ ...filters, skuFamily: v })}>
            <option value="">All Groups</option>
            {(options?.skuFamilies || []).map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </FSelect>
        )
      }

      <FSelect label="SKU" value={filters.sku} onChange={v => onChange({ ...filters, sku: v })}>
        <option value="">All SKUs</option>
        {(options?.skus || []).map(s => (
          <option key={s.sku} value={s.sku}>{s.sku.replace(/_/g, ' ')}</option>
        ))}
      </FSelect>

      <FSelect label="ABC" value={filters.abcClass} onChange={v => onChange({ ...filters, abcClass: v })}>
        <option value="">All</option>
        {['A', 'B', 'C'].map(c => <option key={c} value={c}>{c}</option>)}
      </FSelect>

      <FSelect label="XYZ" value={filters.xyzClass} onChange={v => onChange({ ...filters, xyzClass: v })}>
        <option value="">All</option>
        {['X', 'Y', 'Z'].map(c => <option key={c} value={c}>{c}</option>)}
      </FSelect>

      {personaRole === 'category_manager' && (
        <FSelect label="Branch Adj %" value={severityBucket} onChange={onSeverityChange}>
          <option value="all">All branches</option>
          <option value="none">0% — No adjustment</option>
          <option value="minor">1–10% — Minor</option>
          <option value="mod">11–25% — Moderate</option>
          <option value="large">26–50% — Large</option>
          <option value="extreme">51%+ — Extreme</option>
        </FSelect>
      )}
    </div>
  );
}

// ── Model selection bar ───────────────────────────────────────────────────────

function ModelBar({ selectedModel, onModelChange, onRecalculate, loading }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '7px 16px',
      background: '#F0F4FF',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
        textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap',
      }}>
        Forecast Model
      </span>
      <select
        value={selectedModel}
        onChange={e => onModelChange(e.target.value)}
        disabled={loading}
        style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'white',
          color: 'var(--text-1)', cursor: loading ? 'default' : 'pointer',
        }}
      >
        {FORECAST_MODELS.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <button
        onClick={onRecalculate}
        disabled={loading}
        style={{
          padding: '4px 14px', fontSize: 11, borderRadius: 6,
          cursor: loading ? 'default' : 'pointer',
          background: loading ? '#CBD5E1' : '#1E40AF',
          color: loading ? '#64748B' : 'white',
          border: 'none', fontWeight: 600,
        }}
      >
        {loading ? 'Calculating…' : 'Recalculate'}
      </button>
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
        Demand Planner only · preview only until Finalize
      </span>
    </div>
  );
}

// ── Comparison panel ──────────────────────────────────────────────────────────

function ComparisonPanel({ result, onFinalize, finalizing, onDismiss }) {
  const { modelName, isImplemented, fallbackCount, summary, weeklySummary } = result;
  const futureRows = weeklySummary.filter(w => w.week >= 24);
  const diffColor  = summary.diffUnits > 0 ? '#16A34A' : summary.diffUnits < 0 ? '#DC2626' : '#64748B';

  return (
    <div style={{
      background: 'var(--card)',
      borderBottom: '2px solid #1E40AF',
      flexShrink: 0,
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 16px 6px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
          Comparison: System Forecast vs {modelName} (M24–M52)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Current:</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>
            {summary.totalCurrentFuture.toLocaleString('en-IN')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>→ {modelName}:</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: diffColor }}>
            {summary.totalProposedFuture.toLocaleString('en-IN')}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: diffColor }}>
            ({summary.diffUnits > 0 ? '+' : ''}{summary.diffUnits.toLocaleString('en-IN')} / {summary.diffPct > 0 ? '+' : ''}{summary.diffPct}%)
          </span>
          <button
            onClick={onDismiss}
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text-2)', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Non-implemented notice */}
      {!isImplemented && (
        <div style={{ padding: '5px 16px', background: '#FEF9C3', fontSize: 11, color: '#78350F' }}>
          <strong>{modelName}</strong> is not yet differentiated — displaying SARIMAX baseline.
          Finalize would write identical values back (no-op).
        </div>
      )}
      {isImplemented && fallbackCount > 0 && (
        <div style={{ padding: '5px 16px', background: '#EFF6FF', fontSize: 11, color: '#1D4ED8' }}>
          {fallbackCount} SKU-location(s) had &lt;3 months of history and used SARIMAX as fallback.
        </div>
      )}

      {/* Table + Finalize button side by side */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ flex: 1, overflowX: 'auto', maxHeight: 180, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                {['Month', 'Current', modelName, 'Δ Units', 'Δ %'].map(h => (
                  <th key={h} style={{
                    padding: '4px 12px', textAlign: h === 'Week' ? 'left' : 'right',
                    fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.4px',
                    fontSize: 10, textTransform: 'uppercase',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {futureRows.map(w => (
                <tr key={w.week} style={{
                  background: w.diff > 0 ? '#F0FDF4' : w.diff < 0 ? '#FFF7ED' : 'white',
                }}>
                  <td style={{ padding: '3px 12px', color: 'var(--text-2)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    M{w.week}
                  </td>
                  <td style={{ padding: '3px 12px', textAlign: 'right', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    {w.current.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '3px 12px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    {w.proposed.toLocaleString('en-IN')}
                  </td>
                  <td style={{
                    padding: '3px 12px', textAlign: 'right', borderBottom: '1px solid rgba(0,0,0,0.04)',
                    color: w.diff > 0 ? '#16A34A' : w.diff < 0 ? '#DC2626' : 'var(--text-3)',
                  }}>
                    {w.diff > 0 ? '+' : ''}{w.diff.toLocaleString('en-IN')}
                  </td>
                  <td style={{
                    padding: '3px 12px', textAlign: 'right', borderBottom: '1px solid rgba(0,0,0,0.04)',
                    color: w.diffPct > 0 ? '#16A34A' : w.diffPct < 0 ? '#DC2626' : 'var(--text-3)',
                  }}>
                    {w.diffPct > 0 ? '+' : ''}{w.diffPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Finalize */}
        <div style={{
          padding: '12px 16px', flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
          justifyContent: 'center', borderLeft: '1px solid var(--border)',
        }}>
          <button
            onClick={onFinalize}
            disabled={finalizing}
            style={{
              padding: '8px 22px', fontSize: 12, borderRadius: 6,
              cursor: finalizing ? 'default' : 'pointer',
              background: finalizing ? '#CBD5E1' : '#16A34A',
              color: finalizing ? '#64748B' : 'white',
              border: 'none', fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            {finalizing ? 'Finalizing…' : 'Finalize →'}
          </button>
          <span style={{
            fontSize: 10, color: 'var(--text-3)', maxWidth: 160, textAlign: 'right',
          }}>
            Overwrites System Forecast for all rows in current scope
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DemandPlanning() {
  const navigate = useNavigate();
  const { persona, setPersona, activeView, setActiveView } = usePersona();
  const lockedFilter = getLockedFilter(persona?.role, 'demand');

  const [filterOptions, setFilterOptions] = useState(null);
  const [filters, setFilters] = useState(() => ({
    locationId: lockedFilter?.field === 'locationId' ? lockedFilter.value : '',
    skuFamily:  lockedFilter?.field === 'skuFamily'  ? lockedFilter.value : '',
    sku: '', abcClass: '', xyzClass: '',
  }));
  const [kpis,       setKpis]       = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [gridRows,   setGridRows]   = useState([]);
  const [gridWeeks,  setGridWeeks]  = useState([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [editableFrom, setEditableFrom] = useState(24);
  const [showHistory,  setShowHistory]  = useState(false);
  const [error,      setError]      = useState(null);
  const [patternsData,      setPatternsData]      = useState(null);
  const [patternsLoading,   setPatternsLoading]   = useState(false);
  const [recalculating,     setRecalculating]     = useState(false);
  const [exceptionsData,    setExceptionsData]    = useState(null);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [branchAdjBucket,   setBranchAdjBucket]   = useState('all');
  const [selectedModel,    setSelectedModel]    = useState('Auto Selected');
  const [compareResult,    setCompareResult]    = useState(null);
  const [compareLoading,   setCompareLoading]   = useState(false);
  const [finalizeLoading,  setFinalizeLoading]  = useState(false);

  const gridContainerRef = useRef();
  const demandUploadRef  = useRef(null);
  const [gridDims, setGridDims] = useState({ height: 500, width: 900 });

  useLayoutEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.height > 100 && rect.width > 200)
      setGridDims({ height: Math.floor(rect.height), width: Math.floor(rect.width) });
    const ro = new ResizeObserver(entries => {
      const { height, width } = entries[0].contentRect;
      if (height > 100 && width > 200)
        setGridDims({ height: Math.floor(height), width: Math.floor(width) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setActiveView('grid'); }, [setActiveView]);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions()
      .then(data => setFilterOptions(data))
      .catch(() => {});
  }, []);

  // Fetch grid (300ms debounce)
  useEffect(() => {
    let cancelled = false;
    setGridLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      fetchAllGridPages(filters, showHistory ? 1 : 24)
        .then(({ rows, weeks, editableFrom: ef }) => {
          if (!cancelled) {
            setGridRows(rows);
            setGridWeeks(weeks);
            setEditableFrom(ef);
          }
        })
        .catch(err => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setGridLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, showHistory]);

  // Fetch KPIs (350ms debounce — slightly after grid)
  useEffect(() => {
    let cancelled = false;
    setKpiLoading(true);
    const timer = setTimeout(() => {
      fetchKPIs(filters)
        .then(data => { if (!cancelled) setKpis(data.kpis); })
        .catch(() => { if (!cancelled) setKpis(null); })
        .finally(() => { if (!cancelled) setKpiLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters]);

  const refreshKPIs = useCallback(() => {
    setKpiLoading(true);
    fetchKPIs(filters)
      .then(data => setKpis(data.kpis))
      .catch(() => {})
      .finally(() => setKpiLoading(false));
  }, [filters]);

  // Re-fetch grid when user switches back to it — ensures post-apply data is visible.
  // (Grid normally re-fetches only on filter change; tab switch bypasses that.)
  const gridNeedsRefresh = useRef(false);

  const markGridDirty = useCallback(() => { gridNeedsRefresh.current = true; }, []);

  // Category Manager severity-bucket filter: compute branch adjustment % per row and filter
  const displayRows = useMemo(() => {
    if (persona?.role !== 'category_manager' || branchAdjBucket === 'all') return gridRows;
    return gridRows.filter(r => {
      const cells = Object.values(r.cells || {});
      const sumBranch = cells.reduce((s, c) => s + (c.branchAdjustment || 0), 0);
      const sumSys    = cells.reduce((s, c) => s + (c.systemForecast    || 0), 0);
      if (sumSys === 0) return branchAdjBucket === 'none';
      const pct = Math.abs(sumBranch / sumSys) * 100;
      switch (branchAdjBucket) {
        case 'none':    return pct === 0;
        case 'minor':   return pct > 0   && pct <= 10;
        case 'mod':     return pct > 10  && pct <= 25;
        case 'large':   return pct > 25  && pct <= 50;
        case 'extreme': return pct > 50;
        default:        return true;
      }
    });
  }, [gridRows, branchAdjBucket, persona?.role]);

  useEffect(() => {
    if (activeView !== 'grid') return;
    if (!gridNeedsRefresh.current) return;
    gridNeedsRefresh.current = false;
    setGridLoading(true);
    fetchAllGridPages(filters, showHistory ? 1 : 24)
      .then(({ rows, weeks, editableFrom: ef }) => {
        setGridRows(rows);
        setGridWeeks(weeks);
        setEditableFrom(ef);
      })
      .catch(err => setError(err.message))
      .finally(() => setGridLoading(false));
  }, [activeView, filters, showHistory]);

  // Fetch patterns data when Patterns tab is active (or when filters change while on it)
  const loadPatterns = useCallback(() => {
    setPatternsLoading(true);
    fetchPatterns(filters)
      .then(d => setPatternsData(d))
      .catch(() => setPatternsData(null))
      .finally(() => setPatternsLoading(false));
  }, [filters]);

  useEffect(() => {
    if (activeView !== 'patterns') return;
    loadPatterns();
  }, [activeView, loadPatterns]);

  const loadExceptions = useCallback(() => {
    setExceptionsLoading(true);
    fetchExceptions(filters)
      .then(d => setExceptionsData(d))
      .catch(() => setExceptionsData(null))
      .finally(() => setExceptionsLoading(false));
  }, [filters]);

  useEffect(() => {
    if (activeView !== 'exceptions') return;
    loadExceptions();
  }, [activeView, loadExceptions]);

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true);
    try {
      await fetch('/api/demand-planning/patterns/recalculate-classification', { method: 'POST' });
      await new Promise(resolve => {
        fetchPatterns(filters).then(d => { setPatternsData(d); resolve(); }).catch(() => resolve());
      });
    } finally {
      setRecalculating(false);
    }
  }, [filters]);

  // Clear comparison when filters change (scope has shifted)
  useEffect(() => { setCompareResult(null); }, [filters]);

  const handleModelRecalculate = useCallback(async () => {
    setCompareLoading(true);
    setCompareResult(null);
    try {
      const data = await fetchRecalculate(selectedModel, filters);
      setCompareResult(data);
    } catch (err) {
      console.error('Model recalculate failed:', err.message);
    } finally {
      setCompareLoading(false);
    }
  }, [selectedModel, filters]);

  const handleModelFinalize = useCallback(async () => {
    if (!compareResult) return;
    setFinalizeLoading(true);
    try {
      const data = await fetchFinalize(selectedModel, filters);
      if (!data.success) throw new Error(data.error || 'Finalize failed');
      setCompareResult(null);
      setGridLoading(true);
      const { rows, weeks, editableFrom: ef } = await fetchAllGridPages(filters, showHistory ? 1 : 24);
      setGridRows(rows);
      setGridWeeks(weeks);
      setEditableFrom(ef);
      refreshKPIs();
    } catch (err) {
      console.error('Model finalize failed:', err.message);
    } finally {
      setFinalizeLoading(false);
      setGridLoading(false);
    }
  }, [compareResult, selectedModel, filters, showHistory, refreshKPIs]);

  const handleCellEdit = useCallback(async ({ row, week, newValue }) => {
    const { measureKey } = row;
    try {
      const res = await fetch('/api/demand-planning/grid/adjustment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku:        row.sku,
          locationId: row.locationId,
          weekNumber: week,
          year:       2025,
          measureKey,
          value:      newValue,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Adjustment failed');

      const { marketingAdjustment, branchAdjustment, categoryAdjustment, finalConsensus } = data.updated;

      setGridRows(prev => prev.map(r => {
        if (r.sku !== row.sku || r.locationId !== row.locationId) return r;
        return {
          ...r,
          cells: {
            ...r.cells,
            [week]: {
              ...(r.cells[week] || {}),
              marketingAdjustment,
              branchAdjustment,
              categoryAdjustment,
              finalConsensus,
            },
          },
        };
      }));

      refreshKPIs();
    } catch (err) {
      console.error('Demand grid edit failed:', err.message);
    }
  }, [refreshKPIs]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 0,
      background: 'var(--bg)',
    }}>
      {/* Page header */}
      <div style={{
        padding: '14px 20px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
        flexShrink: 0,
      }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
          Demand Planning Workbench
        </h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
          FY 2025 · Consensus demand plan
        </p>
      </div>

      {/* KPI strip */}
      <DemandKPIStrip kpis={kpis} loading={kpiLoading} />

      {/* Filter bar */}
      <DemandFilterBar
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        lockedField={lockedFilter?.field}
        lockedLabel={lockedFilter?.label}
        personaRole={persona?.role}
        severityBucket={branchAdjBucket}
        onSeverityChange={setBranchAdjBucket}
      />


      {/* Model selection bar — Demand Planner only, Grid tab only */}
      {activeView === 'grid' && persona?.role === 'planner' && (
        <ModelBar
          selectedModel={selectedModel}
          onModelChange={v => { setSelectedModel(v); setCompareResult(null); }}
          onRecalculate={handleModelRecalculate}
          loading={compareLoading}
        />
      )}

      {/* Comparison panel — shown after Recalculate, before Finalize */}
      {activeView === 'grid' && compareResult && (
        <ComparisonPanel
          result={compareResult}
          onFinalize={handleModelFinalize}
          finalizing={finalizeLoading}
          onDismiss={() => setCompareResult(null)}
        />
      )}

      {/* Download / Upload toolbar — Forecast Grid only */}
      {activeView === 'grid' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={() => downloadDemandXLSX(displayRows, gridWeeks)}
            disabled={gridLoading || displayRows.length === 0}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ↓ Excel
          </button>
          <button
            onClick={() => downloadDemandCSV(displayRows, gridWeeks)}
            disabled={gridLoading || displayRows.length === 0}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ↓ CSV
          </button>
          <button
            onClick={() => demandUploadRef.current?.click()}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ↑ Upload
          </button>
          <input ref={demandUploadRef} type="file" accept=".xlsx,.csv,.xls" style={{ display: 'none' }} onChange={() => {}} />
        </div>
      )}

      {/* Forecast Grid tab — always mounted; display:none preserves react-window scroll/expand state */}
      <div
        ref={gridContainerRef}
        style={{
          flex: 1, minHeight: 0, padding: '12px',
          boxSizing: 'border-box', overflow: 'hidden',
          display: activeView === 'grid' ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        {error ? (
          <div style={{ color: '#DC2626', fontSize: 13, padding: 16 }}>
            Failed to load grid: {error}
          </div>
        ) : (
          <DemandGrid
            rows={displayRows}
            weeks={gridWeeks}
            editableFrom={editableFrom}
            onCellEdit={handleCellEdit}
            loading={gridLoading}
            height={gridDims.height}
            width={gridDims.width}
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory(h => !h)}
            personaRole={persona?.role ?? null}
          />
        )}
      </div>

      {/* Patterns tab — always mounted; display:none so it doesn't re-fetch on every switch */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: activeView === 'patterns' ? 'flex' : 'none',
        flexDirection: 'column',
      }}>
        <PatternsTab
          data={patternsData}
          loading={patternsLoading}
          onRecalculate={handleRecalculate}
          recalculating={recalculating}
        />
      </div>

      {/* What-If tab — always mounted; display:none preserves SKU/location selection + slider state */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: activeView === 'whatif' ? 'flex' : 'none',
        flexDirection: 'column',
      }}>
        <WhatIfTab
          filterOptions={filterOptions}
          lockedFilter={lockedFilter}
          onApplyComplete={() => { refreshKPIs(); markGridDirty(); }}
        />
      </div>

      {/* Disaggregate tab — always mounted; display:none preserves form + preview state */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: activeView === 'disaggregate' ? 'flex' : 'none',
        flexDirection: 'column',
      }}>
        <DisaggregateTab
          filterOptions={filterOptions}
          lockedFilter={lockedFilter}
          onApplyComplete={() => { refreshKPIs(); markGridDirty(); }}
        />
      </div>

      {/* Exceptions tab — always mounted; display:none preserves category filter + acknowledged state */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: activeView === 'exceptions' ? 'flex' : 'none',
        flexDirection: 'column',
      }}>
        <ExceptionsTab
          data={exceptionsData}
          loading={exceptionsLoading}
        />
      </div>

      {/* NPI Forecasting tab — always mounted; display:none preserves LFL selection + computed state */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: activeView === 'npi' ? 'flex' : 'none',
        flexDirection: 'column',
      }}>
        <NPITab lockedSkuFamily={lockedFilter?.field === 'skuFamily' ? lockedFilter.value : null} />
      </div>

      {/* Demand Sensing tab — always mounted; display:none preserves component state */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: activeView === 'sensing' ? 'flex' : 'none',
        flexDirection: 'column',
      }}>
        <DemandSensing />
      </div>

      {/* Cross-module CTA — only when entering via persona flow */}
      {persona?.role && (
        <button
          onClick={() => {
            setPersona({ module: 'supply' });
            navigate('/supply');
          }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 50,
            background: 'var(--navy)', color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 24, padding: '10px 18px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Switch to Supply Planning →
        </button>
      )}
    </div>
  );
}
