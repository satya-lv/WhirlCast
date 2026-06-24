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
  useState, useEffect, useRef, useLayoutEffect, useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { usePersona, getLockedFilter } from '../context/PersonaContext';
import DemandGrid from '../components/demand/DemandGrid';
import PatternsTab from '../components/demand/PatternsTab';
import ExceptionsTab from '../components/demand/ExceptionsTab';
import WhatIfTab from '../components/demand/WhatIfTab';
import NPITab from '../components/demand/NPITab';

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

function DemandFilterBar({ filters, onChange, options, lockedField, lockedLabel }) {
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
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'grid',       label: 'Forecast Grid',    active: true  },
  { id: 'patterns',   label: 'Patterns',         active: true  },
  { id: 'whatif',     label: 'What-If',          active: true  },
  { id: 'exceptions', label: 'Exceptions',       active: true  },
  { id: 'npi',        label: 'NPI Forecasting',  active: true  },
];

function TabBar({ activeTab, onSelect }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '2px solid var(--border)',
      background: 'var(--card)', flexShrink: 0,
      paddingLeft: 16,
    }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={tab.active ? () => onSelect(tab.id) : undefined}
            style={{
              padding: '10px 18px',
              fontSize: 12, fontWeight: isActive ? 700 : 400,
              color: isActive ? 'var(--navy-accent)' : tab.active ? 'var(--text-2)' : 'var(--text-3)',
              background: 'transparent', border: 'none',
              borderBottom: isActive ? '2px solid var(--navy-accent)' : '2px solid transparent',
              marginBottom: -2,
              cursor: tab.active ? 'pointer' : 'not-allowed',
              transition: 'color 0.12s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.label}
            {!tab.active && (
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: '0.4px',
                padding: '1px 5px', borderRadius: 8,
                background: 'rgba(0,0,0,0.06)', color: 'var(--text-3)',
              }}>
                SOON
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function DemandPlanning() {
  const navigate = useNavigate();
  const { persona, setPersona } = usePersona();
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
  const [activeTab,  setActiveTab]  = useState('grid');
  const [error,      setError]      = useState(null);
  const [patternsData,      setPatternsData]      = useState(null);
  const [patternsLoading,   setPatternsLoading]   = useState(false);
  const [recalculating,     setRecalculating]     = useState(false);
  const [exceptionsData,    setExceptionsData]    = useState(null);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);

  const gridContainerRef = useRef();
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

  useEffect(() => {
    if (activeTab !== 'grid') return;
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
  }, [activeTab, filters, showHistory]);

  // Fetch patterns data when Patterns tab is active (or when filters change while on it)
  const loadPatterns = useCallback(() => {
    setPatternsLoading(true);
    fetchPatterns(filters)
      .then(d => setPatternsData(d))
      .catch(() => setPatternsData(null))
      .finally(() => setPatternsLoading(false));
  }, [filters]);

  useEffect(() => {
    if (activeTab !== 'patterns') return;
    loadPatterns();
  }, [activeTab, loadPatterns]);

  const loadExceptions = useCallback(() => {
    setExceptionsLoading(true);
    fetchExceptions(filters)
      .then(d => setExceptionsData(d))
      .catch(() => setExceptionsData(null))
      .finally(() => setExceptionsLoading(false));
  }, [filters]);

  useEffect(() => {
    if (activeTab !== 'exceptions') return;
    loadExceptions();
  }, [activeTab, loadExceptions]);

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

  const handleCellEdit = useCallback(async ({ row, week, newValue }) => {
    try {
      const res = await fetch('/api/demand-planning/grid/adjustment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku:               row.sku,
          locationId:        row.locationId,
          weekNumber:        week,
          year:              2025,
          plannerAdjustment: newValue,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Adjustment failed');

      const { finalConsensus } = data.updated;

      // Update the in-memory grid rows so the grid re-renders immediately
      setGridRows(prev => prev.map(r => {
        if (r.sku !== row.sku || r.locationId !== row.locationId) return r;
        return {
          ...r,
          cells: {
            ...r.cells,
            [week]: {
              ...(r.cells[week] || {}),
              plannerAdjustment: newValue,
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
      />

      {/* Tab navigation */}
      <TabBar activeTab={activeTab} onSelect={setActiveTab} />

      {/* Forecast Grid tab — always mounted; display:none preserves react-window scroll/expand state */}
      <div
        ref={gridContainerRef}
        style={{
          flex: 1, minHeight: 0, padding: '12px',
          boxSizing: 'border-box', overflow: 'hidden',
          display: activeTab === 'grid' ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        {error ? (
          <div style={{ color: '#DC2626', fontSize: 13, padding: 16 }}>
            Failed to load grid: {error}
          </div>
        ) : (
          <DemandGrid
            rows={gridRows}
            weeks={gridWeeks}
            editableFrom={editableFrom}
            onCellEdit={handleCellEdit}
            loading={gridLoading}
            height={gridDims.height}
            width={gridDims.width}
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory(h => !h)}
          />
        )}
      </div>

      {/* Patterns tab — always mounted; display:none so it doesn't re-fetch on every switch */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: activeTab === 'patterns' ? 'flex' : 'none',
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
        display: activeTab === 'whatif' ? 'flex' : 'none',
        flexDirection: 'column',
      }}>
        <WhatIfTab
          filterOptions={filterOptions}
          lockedFilter={lockedFilter}
          onApplyComplete={() => { refreshKPIs(); markGridDirty(); }}
        />
      </div>

      {/* Exceptions tab — always mounted; display:none preserves category filter + acknowledged state */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: activeTab === 'exceptions' ? 'flex' : 'none',
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
        display: activeTab === 'npi' ? 'flex' : 'none',
        flexDirection: 'column',
      }}>
        <NPITab lockedSkuFamily={lockedFilter?.field === 'skuFamily' ? lockedFilter.value : null} />
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
