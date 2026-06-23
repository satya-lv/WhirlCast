/**
 * SupplyPlanning — Supply Planning Workbench page.
 *
 * Hosts the time-phased planning grid (the high-risk performance piece).
 * KPI cards, constraint dashboard, pegging view, and scenario comparison
 * will be layered on top in subsequent steps.
 *
 * Data flow:
 *   /api/supply/filters → filter bar options
 *   /api/supply/grid    → planning grid rows (all pages fetched in parallel)
 *   /api/supply/actions → write-back for editable cells
 */
import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import PlanningGrid, { MEASURE_GROUPS } from '../components/supply/PlanningGrid';
import { useToast } from '../context/ToastContext';

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ options, filters, onChange }) {
  if (!options) {
    return (
      <div style={filterBarStyle}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading filters…</span>
      </div>
    );
  }

  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }));

  return (
    <div style={filterBarStyle}>
      <Select label="SKU Family" value={filters.skuFamily} onChange={v => set('skuFamily', v)}>
        <option value="">All Families</option>
        {options.skuFamilies.map(f => <option key={f} value={f}>{f}</option>)}
      </Select>

      <Select label="Region" value={filters.region} onChange={v => set('region', v)}>
        <option value="">All Regions</option>
        {options.regions.map(r => <option key={r} value={r}>{r}</option>)}
      </Select>

      <Select label="Plant" value={filters.plant} onChange={v => set('plant', v)}>
        <option value="">All Plants</option>
        {options.plants.map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}
      </Select>

      <Select label="Scenario" value={filters.scenarioId} onChange={v => set('scenarioId', parseInt(v))}>
        {options.scenarios.map(s => (
          <option key={s.scenario_id} value={s.scenario_id}>
            {s.name}{s.action_type === 'BASELINE' ? ' (Baseline)' : ''}
          </option>
        ))}
      </Select>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={labelStyle}>Weeks</label>
        <input
          type="number" min={1} max={52}
          value={filters.weekStart}
          onChange={e => set('weekStart', Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
          style={{ ...inputStyle, width: 48 }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
        <input
          type="number" min={1} max={52}
          value={filters.weekEnd}
          onChange={e => set('weekEnd', Math.max(filters.weekStart, Math.min(52, parseInt(e.target.value) || 52)))}
          style={{ ...inputStyle, width: 48 }}
        />
      </div>
    </div>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      >
        {children}
      </select>
    </div>
  );
}

// ── Measure group tab bar ─────────────────────────────────────────────────────

function MeasureGroupTabs({ value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '8px 16px',
      background: 'var(--card)', borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center', marginRight: 4 }}>
        Measure group:
      </span>
      {Object.entries(MEASURE_GROUPS).map(([key, grp]) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: '4px 14px', borderRadius: 'var(--radius-xl)', fontSize: 11,
              fontWeight: active ? 700 : 500, cursor: 'pointer',
              border: active ? 'none' : '1px solid var(--border)',
              background: active ? grp.accentColor : 'transparent',
              color: active ? 'white' : 'var(--text-2)',
              transition: 'all 0.12s',
            }}
          >
            {grp.label}
          </button>
        );
      })}
      <div style={{
        marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)',
        alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <AlertTriangle size={11} style={{ color: 'var(--amber)' }} />
        Double-click Supply cells to edit
      </div>
    </div>
  );
}

// ── Fetch all grid pages ──────────────────────────────────────────────────────

async function fetchAllGridPages(filters) {
  const base = {
    weekStart: filters.weekStart,
    weekEnd:   filters.weekEnd,
    scenarioId: filters.scenarioId,
    pageSize:  50,
    ...(filters.region    && { region:    filters.region }),
    ...(filters.plant     && { plant:     filters.plant }),
    ...(filters.sku       && { sku:       filters.sku }),
    ...(filters.skuFamily && { skuFamily: filters.skuFamily }),
  };

  const p1 = await fetch('/api/supply/grid?' + new URLSearchParams({ ...base, page: 1 }));
  if (!p1.ok) throw new Error(`Grid API error ${p1.status}`);
  const d1 = await p1.json();

  const allRows = [...d1.rows];
  const { totalPages } = d1.pagination;

  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetch('/api/supply/grid?' + new URLSearchParams({ ...base, page: i + 2 }))
          .then(r => r.json())
      )
    );
    for (const d of rest) allRows.push(...d.rows);
  }

  return { rows: allRows, weeks: d1.weeks };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupplyPlanning() {
  const { showToast } = useToast();

  const [filterOptions, setFilterOptions] = useState(null);
  const [filters, setFilters] = useState({
    scenarioId: 1,
    weekStart:  1,
    weekEnd:    52,
    region:     '',
    plant:      '',
    skuFamily:  '',
    sku:        '',
  });

  const [rows,    setRows]    = useState([]);
  const [weeks,   setWeeks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [measureGroup, setMeasureGroup] = useState('demand');

  // Measure grid container dimensions
  const gridContainerRef = useRef();
  const [gridDims, setGridDims] = useState({ height: 500, width: 900 });

  useLayoutEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    // Sync initial size
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

  // Fetch filter options once
  useEffect(() => {
    fetch('/api/supply/filters')
      .then(r => r.json())
      .then(data => {
        setFilterOptions(data);
        // Set default scenario to baseline
        const baseline = data.scenarios.find(s => s.action_type === 'BASELINE');
        if (baseline) setFilters(f => ({ ...f, scenarioId: baseline.scenario_id }));
      })
      .catch(() => {});
  }, []);

  // Fetch grid data when filters change (debounced 300ms)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      fetchAllGridPages(filters)
        .then(({ rows: r, weeks: w }) => {
          if (!cancelled) { setRows(r); setWeeks(w); }
        })
        .catch(err => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters]);

  // Cell edit handler
  const handleCellEdit = useCallback(async ({ row, week, newValue, delta }) => {
    try {
      const res = await fetch('/api/supply/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType:  delta > 0 ? 'increase_production' : 'decrease_production',
          sku:         row.sku,
          locationId:  row.locId,
          weekNumber:  week,
          scenarioId:  filters.scenarioId,
          params:      { deltaQty: Math.abs(delta) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      showToast?.(`Production updated: W${week} ${row.sku} → ${Math.round(newValue).toLocaleString('en-IN')} units`, 'success');

      // Refresh grid to reflect DB update
      setLoading(true);
      fetchAllGridPages(filters)
        .then(({ rows: r, weeks: w }) => { setRows(r); setWeeks(w); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch (err) {
      showToast?.(`Edit failed: ${err.message}`, 'error');
    }
  }, [filters, showToast]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 40px)',  // 40px = KPIBar
      overflow: 'hidden',
    }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 20px 8px',
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'var(--navy-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Layers size={16} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>
            Supply Planning Workbench
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Time-phased planning grid · {rows.length} SKU-locations · W{filters.weekStart}–W{filters.weekEnd}
          </div>
        </div>
        {loading && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
            Refreshing…
          </div>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <FilterBar options={filterOptions} filters={filters} onChange={setFilters} />

      {/* ── Measure group tabs ───────────────────────────────────────────── */}
      <MeasureGroupTabs value={measureGroup} onChange={setMeasureGroup} />

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '8px 16px', background: 'var(--danger-bg)',
          borderBottom: '1px solid var(--danger)', fontSize: 12, color: 'var(--danger)',
          flexShrink: 0,
        }}>
          Error loading data: {error}
        </div>
      )}

      {/* ── Grid (fills remaining height) ───────────────────────────────── */}
      <div
        ref={gridContainerRef}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 0 0 0' }}
      >
        <PlanningGrid
          rows={rows}
          weeks={weeks}
          measureGroup={measureGroup}
          loading={loading}
          height={gridDims.height}
          width={gridDims.width}
          onCellEdit={handleCellEdit}
        />
      </div>
    </div>
  );
}

// ── Shared micro-styles ───────────────────────────────────────────────────────

const filterBarStyle = {
  display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
  padding: '8px 16px',
  background: 'var(--card)',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const labelStyle = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
  textTransform: 'uppercase', color: 'var(--text-3)',
  whiteSpace: 'nowrap',
};

const inputStyle = {
  fontSize: 12, padding: '3px 8px',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  background: 'var(--card)', color: 'var(--text-1)', cursor: 'pointer',
};
