/**
 * SupplyPlanning — Supply Planning Workbench page.
 *
 * Assembly per spec:
 *   §3.1  Filter bar (region, plant, SKU family, scenario, week range)
 *   §3.2  8 KPI cards from /api/supply/kpis
 *   §3.3  Time-phased planning grid (PlanningGrid — built in prior step)
 *   §3.4  Planning actions panel: 7 action types using ActionButton/simulatedAction
 */
import React, {
  useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo,
} from 'react';
import {
  Layers, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, Zap,
  BarChart2, GitBranch, Activity, Inbox as InboxIcon,
  Sliders, Plus, Trophy, ArrowRight, Trash2, CheckCircle, FlaskConical,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import PlanningGrid, { MEASURE_GROUPS } from '../components/supply/PlanningGrid';
import { ActionButton, simulatedAction } from '../components/shared/ActionButton';
import { useToast } from '../context/ToastContext';

// Mirrors server/routes/demand_planning.js EDITABLE_FROM_WEEK (cannot import directly
// from a CommonJS server module — expose via /api/supply/filters if this needs to be
// fully dynamic; for now this is the single frontend point of truth).
const CURRENT_WEEK_BOUNDARY = 24;

// ── Week label helper ─────────────────────────────────────────────────────────

function toRelWeek(w) {
  if (w < 24)   return `W${w}`;
  if (w === 24) return 'Current Week';
  return `Week +${w - 24}`;
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

async function fetchAllGridPages(filters) {
  const base = {
    weekStart:  filters.weekStart,
    weekEnd:    filters.weekEnd,
    scenarioId: filters.scenarioId,
    pageSize:   50,
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

async function fetchKPIs(filters) {
  const params = new URLSearchParams({
    scenarioId: filters.scenarioId,
    weekStart:  filters.weekStart,
    weekEnd:    filters.weekEnd,
    ...(filters.region    && { region:    filters.region }),
    ...(filters.plant     && { plant:     filters.plant }),
    ...(filters.sku       && { sku:       filters.sku }),
    ...(filters.skuFamily && { skuFamily: filters.skuFamily }),
  });
  const r = await fetch('/api/supply/kpis?' + params);
  if (!r.ok) throw new Error('KPI fetch failed');
  return r.json();
}

// ── KPI strip (§3.2) ──────────────────────────────────────────────────────────

function fmtUnits(v) {
  if (v == null) return '—';
  return Math.round(v).toLocaleString('en-IN');
}
function fmtINR(v) {
  if (v == null) return '—';
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

const KPI_DEFS = [
  { key: 'totalDemand',             label: 'Total Demand',       fmt: fmtUnits,
    color: () => 'var(--navy-accent)' },
  { key: 'feasibleSupply',          label: 'Feasible Supply',    fmt: fmtUnits,
    color: () => 'var(--green)' },
  { key: 'unconstrainedVsConstrained', label: 'Supply Gap',      fmt: fmtUnits,
    color: v => v > 0 ? 'var(--danger)' : 'var(--green)' },
  { key: 'serviceLevel',            label: 'Service Level',      fmt: v => `${v.toFixed(1)}%`,
    color: v => v >= 95 ? 'var(--green)' : v >= 85 ? 'var(--amber)' : 'var(--danger)' },
  { key: 'revenueAtRisk',           label: 'Revenue at Risk',    fmt: fmtINR,
    color: v => v > 0 ? 'var(--danger)' : 'var(--green)' },
  { key: 'inventoryDays',           label: 'Inventory Days',     fmt: v => `${v.toFixed(1)}d`,
    color: v => v >= 14 ? 'var(--green)' : v >= 7 ? 'var(--amber)' : 'var(--danger)' },
  { key: 'capacityUtilization',     label: 'Capacity Util',      fmt: v => `${v.toFixed(1)}%`,
    color: v => v <= 85 ? 'var(--green)' : v <= 100 ? 'var(--amber)' : 'var(--danger)' },
  { key: 'materialCoverageDays',    label: 'Mat Coverage',       fmt: v => `${v.toFixed(1)}d`,
    color: v => v >= 14 ? 'var(--green)' : v >= 7 ? 'var(--amber)' : 'var(--danger)' },
];

function SupplyKPIStrip({ kpis, loading }) {
  return (
    <div style={{
      display: 'flex', flexShrink: 0, overflowX: 'auto',
      background: 'var(--card)', borderBottom: '2px solid var(--border)',
    }}>
      {KPI_DEFS.map(def => {
        const raw  = kpis?.[def.key]?.value ?? null;
        const col  = raw != null ? def.color(raw) : 'var(--text-3)';
        const disp = loading ? '…' : raw == null ? '—' : def.fmt(raw);
        return (
          <div key={def.key} style={{
            flex: '1 1 0', minWidth: 110, padding: '8px 14px',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.6px',
              textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap',
            }}>
              {def.label}
            </div>
            <div style={{
              fontSize: 17, fontWeight: 800, color: col,
              lineHeight: 1.1, whiteSpace: 'nowrap',
              opacity: loading ? 0.45 : 1, transition: 'opacity 0.2s',
            }}>
              {disp}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Status-count breakdown row ────────────────────────────────────────────────

const STATUS_CHIPS = [
  { key: 'stockout',   label: 'Projected Stockout',  bg: '#FEE2E2', color: '#DC2626' },
  { key: 'capacity',   label: 'Capacity Constraint', bg: '#FEF3C7', color: '#D97706' },
  { key: 'material',   label: 'Material Shortage',   bg: '#FEF3C7', color: '#B45309' },
  { key: 'lowBuffer',  label: 'Low Buffer',          bg: '#EFF6FF', color: '#1D4ED8' },
  { key: 'excess',     label: 'Excess',              bg: '#F3E8FF', color: '#7C3AED' },
  { key: 'onPlan',     label: 'On Plan',             bg: '#DCFCE7', color: '#16A34A' },
];

function StatusCountRow({ counts, loading }) {
  return (
    <div style={{
      display: 'flex', flexShrink: 0, overflowX: 'auto',
      background: 'var(--card)', borderBottom: '1px solid var(--border)',
      padding: '5px 14px', gap: 8, alignItems: 'center',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.6px',
        textTransform: 'uppercase', color: 'var(--text-3)',
        flexShrink: 0, marginRight: 4,
      }}>
        SKU-Location Status
      </span>
      {STATUS_CHIPS.map(c => (
        <div key={c.key} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 'var(--radius-xl)',
          background: c.bg, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: c.color, lineHeight: 1 }}>
            {loading ? '…' : (counts?.[c.key] ?? 0)}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: c.color, whiteSpace: 'nowrap' }}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Filter bar (§3.1) ─────────────────────────────────────────────────────────

function FilterBar({ options, filters, onChange, showHistory, onToggleHistory }) {
  if (!options) {
    return (
      <div style={s.filterBar}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading filters…</span>
      </div>
    );
  }
  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }));
  return (
    <div style={s.filterBar}>
      <FSelect label="SKU Family" value={filters.skuFamily} onChange={v => set('skuFamily', v)}>
        <option value="">All Families</option>
        {options.skuFamilies.map(f => <option key={f} value={f}>{f}</option>)}
      </FSelect>
      <FSelect label="Region" value={filters.region} onChange={v => set('region', v)}>
        <option value="">All Regions</option>
        {options.regions.map(r => <option key={r} value={r}>{r}</option>)}
      </FSelect>
      <FSelect label="Plant" value={filters.plant} onChange={v => set('plant', v)}>
        <option value="">All Plants</option>
        {options.plants.map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}
      </FSelect>
      <FSelect label="Scenario" value={filters.scenarioId} onChange={v => set('scenarioId', parseInt(v))}>
        {options.scenarios.map(sc => (
          <option key={sc.scenario_id} value={sc.scenario_id}>
            {sc.name}{sc.action_type === 'BASELINE' ? ' (Baseline)' : ''}
          </option>
        ))}
      </FSelect>
      <button
        onClick={onToggleHistory}
        style={{
          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
          border: `1px solid ${showHistory ? 'var(--navy-accent)' : 'var(--border)'}`,
          background: showHistory ? 'var(--navy-accent)' : 'var(--bg)',
          color: showHistory ? 'white' : 'var(--text-2)',
          cursor: 'pointer',
        }}
      >
        {showHistory ? 'Hide History' : 'Show History'}
      </button>
    </div>
  );
}

function FSelect({ label, value, onChange, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={s.label}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={s.input}>
        {children}
      </select>
    </div>
  );
}

// ── Measure group tabs + actions toggle ───────────────────────────────────────

function MeasureGroupTabs({ value, onChange, showActions, onToggleActions }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '8px 16px', alignItems: 'center',
      background: 'var(--card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 4 }}>Measure group:</span>
      {Object.entries(MEASURE_GROUPS).filter(([key]) => key !== 'demand').map(([key, grp]) => {
        const active = value === key;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            padding: '4px 14px', borderRadius: 'var(--radius-xl)', fontSize: 11,
            fontWeight: active ? 700 : 500, cursor: 'pointer',
            border: active ? 'none' : '1px solid var(--border)',
            background: active ? grp.accentColor : 'transparent',
            color: active ? 'white' : 'var(--text-2)',
            transition: 'all 0.12s',
          }}>
            {grp.label}
          </button>
        );
      })}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11, color: 'var(--text-3)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <AlertTriangle size={11} style={{ color: 'var(--amber)' }} />
          Double-click Supply cells to edit
        </span>
        <button onClick={onToggleActions} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.12s',
          background: showActions ? 'var(--navy-accent)' : 'var(--blue-bg)',
          color:      showActions ? 'white' : 'var(--navy-accent)',
          border: `1px solid ${showActions ? 'var(--navy-accent)' : 'var(--blue)'}`,
        }}>
          <Zap size={11} />
          {showActions ? 'Hide Actions' : 'Actions'}
        </button>
      </div>
    </div>
  );
}

// ── Actions panel (§3.4) ──────────────────────────────────────────────────────

function ActionsPanel({ filterOptions, actionsMeta, metaError, filters, onActionComplete, initialCtx }) {
  const [ctx, setCtx] = useState({
    sku: '', locationId: '', weekNumber: String(filters.weekStart || CURRENT_WEEK_BOUNDARY),
    plantId: '', lineId: '', componentId: '', supplierId: '',
  });

  // Pre-fill sku + locationId when triggered from the Take Action button
  useEffect(() => {
    if (!initialCtx) return;
    setCtx(prev => ({ ...prev, sku: initialCtx.sku, locationId: initialCtx.locationId }));
  }, [initialCtx]);
  const [openSection, setOpenSection] = useState('increase');
  const [deltaQty,   setDeltaQty]   = useState(100);
  const [pullFrom,   setPullFrom]   = useState(filters.weekStart);
  const [pullTo,     setPullTo]     = useState(Math.max(CURRENT_WEEK_BOUNDARY, (filters.weekStart || CURRENT_WEEK_BOUNDARY) - 1));
  const [pushFrom,   setPushFrom]   = useState(filters.weekStart);
  const [pushTo,     setPushTo]     = useState(Math.min(52, (filters.weekStart || 22) + 1));
  const [moveQty,    setMoveQty]    = useState(50);
  const [newPlantId, setNewPlantId] = useState('');
  const [extraHours, setExtraHours] = useState(8);
  const [expQty,     setExpQty]     = useState(200);
  const [expWeekDue, setExpWeekDue] = useState(filters.weekStart);

  const setC = (k, v) => setCtx(p => ({ ...p, [k]: v }));

  const postAction = async (actionType, params) => {
    if (!ctx.sku || !ctx.locationId)
      throw new Error('Select a SKU and Location in the context above');
    const res = await fetch('/api/supply/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType,
        sku:        ctx.sku,
        locationId: parseInt(ctx.locationId),
        weekNumber: parseInt(ctx.weekNumber) || filters.weekStart,
        scenarioId: filters.scenarioId,
        params,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Action failed');
    onActionComplete(actionType, data);
  };

  const linesForPlant = (pid) =>
    (actionsMeta?.lines || []).filter(l => String(l.plant_id) === String(pid));

  const skuList   = filterOptions?.skus      || [];
  const locList   = filterOptions?.locations || [];
  const plantList = filterOptions?.plants    || [];
  const compList  = actionsMeta?.components  || [];
  const suppList  = actionsMeta?.suppliers   || [];

  const sections = [
    {
      id: 'increase', label: 'Increase Production', icon: '↑',
      desc: 'Boost planned production units in the selected week.',
      body: (
        <>
          <PField label="Delta Qty">
            <input type="number" min={1} value={deltaQty}
              onChange={e => setDeltaQty(Math.max(1, parseInt(e.target.value) || 0))}
              style={s.fieldInput} />
          </PField>
          <ActionButton size="sm" fullWidth variant="primary"
            label="Increase Production" loadingLabel="Applying…" doneLabel="Applied ✓"
            onAction={() => simulatedAction(() => postAction('increase_production', { deltaQty }))} />
        </>
      ),
    },
    {
      id: 'decrease', label: 'Decrease Production', icon: '↓',
      desc: 'Reduce planned production units in the selected week.',
      body: (
        <>
          <PField label="Delta Qty">
            <input type="number" min={1} value={deltaQty}
              onChange={e => setDeltaQty(Math.max(1, parseInt(e.target.value) || 0))}
              style={s.fieldInput} />
          </PField>
          <ActionButton size="sm" fullWidth variant="outline"
            label="Decrease Production" loadingLabel="Applying…" doneLabel="Applied ✓"
            onAction={() => simulatedAction(() => postAction('decrease_production', { deltaQty }))} />
        </>
      ),
    },
    {
      id: 'pull_ahead', label: 'Pull Ahead', icon: '⇐',
      desc: 'Move production from a later week into an earlier week.',
      body: (
        <>
          <PField label="From Week">
            <input type="number" min={1} max={52} value={pullFrom}
              onChange={e => setPullFrom(parseInt(e.target.value) || 1)} style={s.fieldInput} />
          </PField>
          <PField label="To Week">
            <input type="number" min={1} max={52} value={pullTo}
              onChange={e => setPullTo(parseInt(e.target.value) || 1)} style={s.fieldInput} />
          </PField>
          <PField label="Qty">
            <input type="number" min={1} value={moveQty}
              onChange={e => setMoveQty(parseInt(e.target.value) || 0)} style={s.fieldInput} />
          </PField>
          <ActionButton size="sm" fullWidth variant="primary"
            label="Pull Ahead" loadingLabel="Moving…" doneLabel="Done ✓"
            onAction={() => simulatedAction(() =>
              postAction('pull_ahead', { fromWeek: pullFrom, toWeek: pullTo, qty: moveQty }))} />
        </>
      ),
    },
    {
      id: 'push_out', label: 'Push Out', icon: '⇒',
      desc: 'Defer production from an earlier week to a later week.',
      body: (
        <>
          <PField label="From Week">
            <input type="number" min={1} max={52} value={pushFrom}
              onChange={e => setPushFrom(parseInt(e.target.value) || 1)} style={s.fieldInput} />
          </PField>
          <PField label="To Week">
            <input type="number" min={1} max={52} value={pushTo}
              onChange={e => setPushTo(parseInt(e.target.value) || 1)} style={s.fieldInput} />
          </PField>
          <PField label="Qty">
            <input type="number" min={1} value={moveQty}
              onChange={e => setMoveQty(parseInt(e.target.value) || 0)} style={s.fieldInput} />
          </PField>
          <ActionButton size="sm" fullWidth variant="outline"
            label="Push Out" loadingLabel="Moving…" doneLabel="Done ✓"
            onAction={() => simulatedAction(() =>
              postAction('push_out', { fromWeek: pushFrom, toWeek: pushTo, qty: moveQty }))} />
        </>
      ),
    },
    {
      id: 'change_plant', label: 'Change Plant', icon: '⇌',
      desc: 'Reassign production for this SKU/week to a different plant.',
      body: (
        <>
          <PField label="New Plant">
            <select value={newPlantId} onChange={e => setNewPlantId(e.target.value)} style={s.fieldInput}>
              <option value="">Select plant…</option>
              {plantList.map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}
            </select>
          </PField>
          <ActionButton size="sm" fullWidth variant="primary"
            label="Change Plant" loadingLabel="Reassigning…" doneLabel="Done ✓"
            disabled={!newPlantId}
            onAction={() => simulatedAction(() =>
              postAction('change_plant', { newPlantId: parseInt(newPlantId) }))} />
        </>
      ),
    },
    {
      id: 'overtime', label: 'Add Overtime', icon: '+⏱',
      desc: 'Add extra production hours to a line this week (e.g. Saturday shift = 8 hrs).',
      body: (
        <>
          <PField label="Plant">
            <select value={ctx.plantId}
              onChange={e => { setC('plantId', e.target.value); setC('lineId', ''); }}
              style={s.fieldInput}>
              <option value="">Select plant…</option>
              {plantList.map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}
            </select>
          </PField>
          <PField label="Line">
            <select value={ctx.lineId} onChange={e => setC('lineId', e.target.value)} style={s.fieldInput}>
              <option value="">Select line…</option>
              {linesForPlant(ctx.plantId).map(l => (
                <option key={l.line_id} value={l.line_id}>{l.name}</option>
              ))}
            </select>
          </PField>
          <PField label="Extra Hrs">
            <input type="number" min={1} max={24} value={extraHours}
              onChange={e => setExtraHours(parseInt(e.target.value) || 0)} style={s.fieldInput} />
          </PField>
          <ActionButton size="sm" fullWidth variant="primary"
            label="Add Overtime" loadingLabel="Scheduling…" doneLabel="Done ✓"
            disabled={!ctx.plantId || !ctx.lineId}
            onAction={() => simulatedAction(() =>
              postAction('add_overtime', {
                plantId: parseInt(ctx.plantId),
                lineId:  parseInt(ctx.lineId),
                extraHoursPerWeek: extraHours,
              }))} />
        </>
      ),
    },
    {
      id: 'expedite', label: 'Expedite Supplier', icon: '⚡',
      desc: 'Create an urgent purchase order to accelerate component delivery.',
      body: (
        <>
          <PField label="Component">
            <select value={ctx.componentId} onChange={e => setC('componentId', e.target.value)}
              style={s.fieldInput} disabled={metaError || !actionsMeta}>
              {metaError
                ? <option value="">⚠ Failed to load</option>
                : !actionsMeta
                  ? <option value="">Loading…</option>
                  : <>
                      <option value="">Select component…</option>
                      {compList.map(c => <option key={c.component_id} value={c.component_id}>{c.name}</option>)}
                    </>
              }
            </select>
          </PField>
          <PField label="Supplier">
            <select value={ctx.supplierId} onChange={e => setC('supplierId', e.target.value)}
              style={s.fieldInput} disabled={metaError || !actionsMeta}>
              {metaError
                ? <option value="">⚠ Failed to load</option>
                : !actionsMeta
                  ? <option value="">Loading…</option>
                  : <>
                      <option value="">Select supplier…</option>
                      {suppList.map(sup => <option key={sup.supplier_id} value={sup.supplier_id}>{sup.name}</option>)}
                    </>
              }
            </select>
          </PField>
          <PField label="Qty">
            <input type="number" min={1} value={expQty}
              onChange={e => setExpQty(parseInt(e.target.value) || 0)} style={s.fieldInput} />
          </PField>
          <PField label="Due Week">
            <input type="number" min={1} max={52} value={expWeekDue}
              onChange={e => setExpWeekDue(parseInt(e.target.value) || 1)} style={s.fieldInput} />
          </PField>
          <ActionButton size="sm" fullWidth variant="primary"
            label="Expedite Supplier" loadingLabel="Creating PO…" doneLabel="PO Created ✓"
            disabled={!ctx.componentId || !ctx.supplierId}
            onAction={() => simulatedAction(async () => {
              const res = await fetch('/api/supply/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  actionType:  'expedite_supplier',
                  sku:         ctx.sku || (skuList[0]?.sku || ''),
                  locationId:  parseInt(ctx.locationId) || 0,
                  weekNumber:  parseInt(ctx.weekNumber) || filters.weekStart,
                  scenarioId:  filters.scenarioId,
                  params: {
                    componentId: parseInt(ctx.componentId),
                    supplierId:  parseInt(ctx.supplierId),
                    qty:         expQty,
                    newWeekDue:  expWeekDue,
                  },
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Expedite failed');
              onActionComplete('expedite_supplier', data);
            })} />
        </>
      ),
    },
  ];

  return (
    <div style={{
      width: 276, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--card)', display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Context selector */}
      <div style={{
        padding: '10px 12px 10px', borderBottom: '1px solid var(--border)',
        background: 'var(--blue-bg)', flexShrink: 0,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.5px', color: 'var(--navy-accent)', marginBottom: 8,
        }}>
          Action Context
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <PField label="SKU">
            <select value={ctx.sku} onChange={e => setC('sku', e.target.value)} style={s.fieldInput}>
              <option value="">Select SKU…</option>
              {skuList.map(sk => (
                <option key={sk.sku} value={sk.sku}>{sk.sku.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </PField>
          <PField label="Location">
            <select value={ctx.locationId} onChange={e => setC('locationId', e.target.value)} style={s.fieldInput}>
              <option value="">Select location…</option>
              {locList.map(l => (
                <option key={l.location_id} value={l.location_id}>
                  {l.name} ({l.region})
                </option>
              ))}
            </select>
          </PField>
          <PField label="Week">
            <input type="number" min={1} max={52} value={ctx.weekNumber}
              onChange={e => setC('weekNumber', e.target.value)} style={s.fieldInput} />
          </PField>
        </div>
        {(!ctx.sku || !ctx.locationId) && (
          <p style={{ fontSize: 10, color: 'var(--amber)', margin: '6px 0 0',
            display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={10} /> Select SKU + Location to enable actions
          </p>
        )}
      </div>

      {/* Action accordion */}
      <div style={{ flex: 1 }}>
        {sections.map(sec => (
          <div key={sec.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setOpenSection(o => o === sec.id ? null : sec.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: openSection === sec.id ? 'var(--blue-bg)' : 'transparent',
                transition: 'background 0.12s',
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: openSection === sec.id ? 'var(--navy-accent)' : 'var(--bg)',
                color:      openSection === sec.id ? 'white' : 'var(--text-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, transition: 'all 0.12s',
              }}>
                {sec.icon}
              </span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
                {sec.label}
              </span>
              {openSection === sec.id
                ? <ChevronDown size={12} color="var(--text-3)" />
                : <ChevronRight size={12} color="var(--text-3)" />}
            </button>

            {openSection === sec.id && (
              <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
                  {sec.desc}
                </p>
                {sec.body}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PField({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.4px', color: 'var(--text-3)', flexShrink: 0, width: 62,
      }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupplyPlanning() {
  const { showToast } = useToast();

  const [filterOptions, setFilterOptions] = useState(null);
  const [actionsMeta,   setActionsMeta]   = useState(null);
  const [metaError,     setMetaError]     = useState(false);
  const [filters, setFilters] = useState({
    scenarioId: 1, weekStart: 24, weekEnd: 52,
    region: '', plant: '', skuFamily: '', sku: '',
  });
  const [showHistory, setShowHistory] = useState(false);

  const handleToggleHistory = useCallback(() => {
    setShowHistory(prev => {
      const next = !prev;
      setFilters(f => ({ ...f, weekStart: next ? 1 : 24 }));
      return next;
    });
  }, []);
  const [rows,       setRows]       = useState([]);
  const [weeks,      setWeeks]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [kpis,       setKpis]       = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [measureGroup, setMeasureGroup] = useState('supply');
  const [showActions,  setShowActions]  = useState(false);
  const [mainView,     setMainView]     = useState('grid');
  const [recommendations, setRecommendations] = useState(null);
  const [recsLoading,     setRecsLoading]     = useState(false);
  const [recsKey,         setRecsKey]         = useState(0);
  const [constraintsKey,  setConstraintsKey]  = useState(0);
  const [actionCtx,       setActionCtx]       = useState(null);

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

  // Fetch filter options + actions metadata once on mount
  useEffect(() => {
    fetch('/api/supply/filters')
      .then(r => r.json())
      .then(data => {
        setFilterOptions(data);
        const baseline = data.scenarios.find(sc => sc.action_type === 'BASELINE');
        if (baseline) setFilters(f => ({ ...f, scenarioId: baseline.scenario_id }));
      })
      .catch(() => {});

    fetch('/api/supply/actions-meta')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (!Array.isArray(data.components) || !Array.isArray(data.suppliers))
          throw new Error('Unexpected shape');
        setActionsMeta(data);
      })
      .catch(() => setMetaError(true));
  }, []);

  // Fetch grid (300ms debounce)
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    const timer = setTimeout(() => {
      fetchAllGridPages(filters)
        .then(({ rows: r, weeks: w }) => { if (!cancelled) { setRows(r); setWeeks(w); } })
        .catch(err  => { if (!cancelled) setError(err.message); })
        .finally(()  => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters]);

  // Fetch KPIs (350ms debounce — slightly after grid so they don't race)
  useEffect(() => {
    let cancelled = false;
    setKpiLoading(true);
    const timer = setTimeout(() => {
      fetchKPIs(filters)
        .then(data => { if (!cancelled) setKpis(data.kpis); })
        .catch(()  => { if (!cancelled) setKpis(null); })
        .finally(() => { if (!cancelled) setKpiLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters]);

  // Fetch recommendations (also triggered by recsKey after any data-changing action)
  useEffect(() => {
    let cancelled = false;
    setRecsLoading(true);
    const params = new URLSearchParams({
      scenarioId: filters.scenarioId,
      weekStart:  filters.weekStart,
      weekEnd:    filters.weekEnd,
    });
    fetch(`/api/supply/recommendations?${params}`)
      .then(r => { if (!r.ok) throw new Error('recs'); return r.json(); })
      .then(data => { if (!cancelled) setRecommendations(data); })
      .catch(()  => { if (!cancelled) setRecommendations(null); })
      .finally(() => { if (!cancelled) setRecsLoading(false); });
    return () => { cancelled = true; };
  }, [filters, recsKey]);

  const refreshAll = useCallback(() => {
    setLoading(true); setKpiLoading(true);
    Promise.all([fetchAllGridPages(filters), fetchKPIs(filters)])
      .then(([grid, kpiData]) => {
        setRows(grid.rows); setWeeks(grid.weeks); setKpis(kpiData.kpis);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setKpiLoading(false); });
  }, [filters]);

  // Inline cell edit (double-click on plannedProduction in Supply group)
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
      showToast?.(
        `Production updated: ${row.sku} → ${Math.round(newValue).toLocaleString('en-IN')} units`,
        'success',
      );
      refreshAll();
      setRecsKey(k => k + 1);
      setConstraintsKey(k => k + 1);
    } catch (err) {
      showToast?.(`Edit failed: ${err.message}`, 'error');
    }
  }, [filters, showToast, refreshAll]);

  const handleActionComplete = useCallback((actionType) => {
    showToast?.(
      `${actionType.replace(/_/g, ' ')} applied successfully`,
      'success',
    );
    refreshAll();
    setRecsKey(k => k + 1);
    setConstraintsKey(k => k + 1);
  }, [showToast, refreshAll]);

  const handleSwitchScenario = useCallback((scenarioId) => {
    setFilters(f => ({ ...f, scenarioId }));
    setMainView('grid');
  }, []);

  // Compute SKU-location status counts from raw grid rows (no extra fetch needed)
  const statusCounts = useMemo(() => {
    const counts = { stockout: 0, capacity: 0, material: 0, lowBuffer: 0, excess: 0, onPlan: 0 };
    for (const row of rows) {
      const ssWeeks = row.safetyStockWeeks ?? 0;
      let hasStockout = false, hasCapacity = false, hasMaterial = false;
      let hasLowBuffer = false, hasExcess = false;
      for (const cell of Object.values(row.cells || {})) {
        const fd = cell.forecastDemand ?? 0;
        const ei = cell.endingInventory ?? 0;
        if ((cell.shortageQty ?? 0) > 0)                                   hasStockout = true;
        if ((cell.capacityRequired ?? 0) > (cell.capacityAvailable ?? 0))  hasCapacity = true;
        if ((cell.materialAvailability ?? 999) < 7)                        hasMaterial = true;
        if (ei < ssWeeks * fd)                                             hasLowBuffer = true;
        if (fd > 0 && (ei / fd) * 7 > 90)                                 hasExcess = true;
      }
      if (hasStockout)        counts.stockout++;
      else if (hasCapacity)   counts.capacity++;
      else if (hasMaterial)   counts.material++;
      else if (hasLowBuffer)  counts.lowBuffer++;
      else if (hasExcess)     counts.excess++;
      else                    counts.onPlan++;
    }
    return counts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const handleTakeAction = useCallback((sku, locationId) => {
    setShowActions(true);
    setActionCtx({ sku: String(sku), locationId: String(locationId) });
  }, []);

  const handleResetComplete = useCallback(() => {
    console.log('[RESET] handleResetComplete fired — clearing rows and switching to grid');
    setRows([]);
    setKpis(null);
    setMainView('grid');
    fetch('/api/supply/filters')
      .then(r => r.json())
      .then(data => {
        console.log('[RESET] filters refetched — new baseline scenario_id:', (data.scenarios || []).find(sc => sc.action_type === 'BASELINE')?.scenario_id);
        setFilterOptions(data);
        const baseline = (data.scenarios || []).find(sc => sc.action_type === 'BASELINE');
        if (baseline) setFilters(f => ({ ...f, scenarioId: baseline.scenario_id }));
      })
      .catch(err => console.error('[RESET] filters fetch failed:', err));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', overflow: 'hidden' }}>

      {/* Page header */}
      <div style={{
        padding: '10px 20px 8px', background: 'var(--card)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
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
            Time-phased planning grid · {rows.length} SKU-locations · {showHistory ? 'Including history' : 'Current planning horizon'}
          </div>
        </div>
        {loading && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
            Refreshing…
          </div>
        )}
      </div>

      {/* §3.1 Filter bar */}
      <FilterBar
        options={filterOptions} filters={filters} onChange={setFilters}
        showHistory={showHistory} onToggleHistory={handleToggleHistory}
      />

      {/* §3.2 KPI strip */}
      <SupplyKPIStrip kpis={kpis} loading={kpiLoading} />

      {/* Status-count breakdown row */}
      <StatusCountRow counts={statusCounts} loading={loading} />

      {/* Main view tabs */}
      <ViewTabs
        active={mainView}
        onChange={setMainView}
        recCount={recommendations?.recommendations?.length ?? 0}
      />

      {/* §3.3 Grid view + §3.4 Actions panel */}
      {mainView === 'grid' && (
        <>
          <MeasureGroupTabs
            value={measureGroup} onChange={setMeasureGroup}
            showActions={showActions} onToggleActions={() => setShowActions(v => !v)}
          />
          {error && (
            <div style={{ padding: '8px 16px', background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger)', fontSize: 12, color: 'var(--danger)', flexShrink: 0 }}>
              Error loading data: {error}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            <div ref={gridContainerRef} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <PlanningGrid
                rows={rows} weeks={weeks} measureGroup={measureGroup}
                loading={loading} height={gridDims.height} width={gridDims.width}
                onCellEdit={handleCellEdit}
                onTakeAction={handleTakeAction}
              />
            </div>
            {showActions && (
              <ActionsPanel
                filterOptions={filterOptions}
                actionsMeta={actionsMeta}
                metaError={metaError}
                filters={filters}
                onActionComplete={handleActionComplete}
                initialCtx={actionCtx}
              />
            )}
          </div>
        </>
      )}

      {/* §3.6 Constraint Dashboard */}
      {mainView === 'constraints' && (
        <ConstraintDashboard filters={filters} refreshKey={constraintsKey} />
      )}

      {/* What-If Simulator */}
      {mainView === 'whatif' && (
        <WhatIfTab
          filters={filters}
          filterOptions={filterOptions}
          actionsMeta={actionsMeta}
          onRefreshGrid={() => { refreshAll(); setConstraintsKey(k => k + 1); }}
        />
      )}

      {/* §3.7 Pegging View */}
      {mainView === 'pegging' && (
        <PeggingView filters={filters} filterOptions={filterOptions} />
      )}

      {/* §3.9 Recommendation Engine */}
      {mainView === 'recommendations' && (
        <RecommendationEngine
          recommendations={recommendations}
          loading={recsLoading}
          scenarioId={filters.scenarioId}
          onApply={() => { refreshAll(); setRecsKey(k => k + 1); setConstraintsKey(k => k + 1); }}
        />
      )}

      {/* §4 Planner Exception Inbox */}
      {mainView === 'inbox' && (
        <ExceptionInbox
          filters={filters}
          recommendations={recommendations}
          onNavigate={setMainView}
          showHistory={showHistory}
        />
      )}

      {/* §3.8 Scenario Simulation */}
      {mainView === 'scenarios' && (
        <ScenarioSimulation
          filters={filters}
          onSwitchScenario={handleSwitchScenario}
          onResetComplete={handleResetComplete}
          showHistory={showHistory}
        />
      )}
    </div>
  );
}

// ── Shared micro-styles ───────────────────────────────────────────────────────

// ── §3.6 Constraint Dashboard ─────────────────────────────────────────────────

function UtilBar({ pct, size = 'md' }) {
  const danger  = pct >= 100;
  const warning = pct >= 85;
  const color   = danger ? 'var(--danger)' : warning ? 'var(--amber)' : 'var(--green)';
  const h       = size === 'sm' ? 4 : 6;
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: h, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, width: 40, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

function CapacityView({ rows = [], weekRange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        Production line capacity vs. demand over W{weekRange?.start}–W{weekRange?.end}. Overloaded lines shown in red.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Plant', 'Line', 'Category', 'Hrs/Wk (cap)', 'Hrs Required', 'Utilization', 'Overload Hrs', 'Shortage Units', 'Status'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const overloaded = row.overload_hrs > 0;
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: overloaded ? 'rgba(227,24,55,0.04)' : i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-1)' }}>{row.plant_name}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-1)' }}>{row.line_name}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'var(--blue-bg)', color: 'var(--navy-accent)', fontWeight: 600 }}>{row.line_category}</span>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{(row.hours_per_week ?? 0).toFixed(1)} h</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{(row.total_hrs_required ?? 0).toFixed(1)} h</td>
                  <td style={{ padding: '8px 10px', minWidth: 130 }}><UtilBar pct={row.utilization_pct ?? 0} /></td>
                  <td style={{ padding: '8px 10px', color: overloaded ? 'var(--danger)' : 'var(--text-3)', fontWeight: overloaded ? 700 : 400 }}>
                    {overloaded ? `+${(row.overload_hrs ?? 0).toFixed(1)} h` : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', color: (row.total_shortage ?? 0) > 0 ? 'var(--danger)' : 'var(--text-3)', fontWeight: (row.total_shortage ?? 0) > 0 ? 700 : 400 }}>
                    {(row.total_shortage ?? 0) > 0 ? Math.round(row.total_shortage).toLocaleString('en-IN') : '—'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                      background: overloaded ? 'rgba(227,24,55,0.12)' : 'rgba(34,197,94,0.12)',
                      color: overloaded ? 'var(--danger)' : 'var(--green)' }}>
                      {overloaded ? 'OVERLOADED' : 'OK'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No capacity data for this selection.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaterialView({ rows = [], weekRange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        Component material coverage for W{weekRange?.start}–W{weekRange?.end}. Components below 14 days are flagged.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Component', 'Code', 'Supplier', 'On Hand', 'Required', 'Coverage', 'Open POs', 'OTIF %', 'Status'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const cvg = row.coverage_days ?? 0;
              const cvgColor = cvg >= 14 ? 'var(--green)' : cvg >= 7 ? 'var(--amber)' : 'var(--danger)';
              const isShort = cvg < 14;
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: isShort ? (cvg < 7 ? 'rgba(227,24,55,0.04)' : 'rgba(245,158,11,0.04)') : i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-1)' }}>{row.component_name}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-2)', border: '1px solid var(--border)', fontFamily: 'monospace' }}>{row.code}</span>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{row.supplier_name}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{Math.round(row.on_hand_qty ?? 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{Math.round(row.total_required ?? 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '8px 10px', minWidth: 130 }}>
                    <div style={{ fontWeight: 700, color: cvgColor, fontSize: 12, marginBottom: 3 }}>{cvg.toFixed(1)} d</div>
                    <UtilBar pct={Math.min(100, (cvg / 30) * 100)} size="sm" />
                  </td>
                  <td style={{ padding: '8px 10px', color: (row.open_po_qty ?? 0) > 0 ? 'var(--navy-accent)' : 'var(--text-3)', fontWeight: (row.open_po_qty ?? 0) > 0 ? 700 : 400 }}>
                    {(row.open_po_qty ?? 0) > 0 ? Math.round(row.open_po_qty).toLocaleString('en-IN') : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', color: (row.otif_pct ?? 100) < 85 ? 'var(--amber)' : 'var(--text-2)' }}>
                    {row.otif_pct ?? '—'}%
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                      background: cvg < 7 ? 'rgba(227,24,55,0.12)' : cvg < 14 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                      color: cvg < 7 ? 'var(--danger)' : cvg < 14 ? 'var(--amber)' : 'var(--green)' }}>
                      {cvg < 7 ? 'CRITICAL' : cvg < 14 ? 'LOW' : 'OK'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No material constraints for this selection.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DemandImpactView({ rows = [], summary }) {
  return (
    <div>
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Impacted Rows',    value: summary.impacted_rows },
            { label: 'Impacted SKUs',    value: summary.impacted_skus },
            { label: 'Impacted Locs',   value: summary.impacted_locations },
            { label: 'Total Shortage',   value: Math.round(summary.total_shortage_units || 0).toLocaleString('en-IN') + ' u' },
            { label: 'Revenue at Risk',  value: fmtINR(summary.total_revenue_at_risk) },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', minWidth: 120 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['SKU', 'Location', 'Wk', 'Forecast', 'Cust Orders', 'Shortage', 'Revenue at Risk', 'Tier-3 Impact', 'Tier-1/2 Impact'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{row.sku}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{row.location_name}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{toRelWeek(row.week_number)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{Math.round(row.forecast_demand ?? 0).toLocaleString('en-IN')}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{Math.round(row.customer_orders ?? 0).toLocaleString('en-IN')}</td>
                <td style={{ padding: '8px 10px', color: 'var(--danger)', fontWeight: 700 }}>{Math.round(row.shortage_qty ?? 0).toLocaleString('en-IN')}</td>
                <td style={{ padding: '8px 10px', color: 'var(--danger)', fontWeight: 700 }}>{fmtINR(row.revenue_at_risk)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{Math.round(row.tier3_impact_units ?? 0)}</td>
                <td style={{ padding: '8px 10px', color: (row.tier12_impact_units ?? 0) > 0 ? 'var(--danger)' : 'var(--text-2)', fontWeight: (row.tier12_impact_units ?? 0) > 0 ? 700 : 400 }}>
                  {Math.round(row.tier12_impact_units ?? 0)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No demand impact shortages for this selection.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConstraintDashboard({ filters, refreshKey }) {
  const [view, setView] = useState('capacity');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const p = new URLSearchParams({
      view,
      scenarioId: filters.scenarioId,
      weekStart:  filters.weekStart,
      weekEnd:    filters.weekEnd,
      ...(filters.region && { region: filters.region }),
      ...(filters.plant  && { plant:  String(filters.plant) }),
    });
    fetch(`/api/supply/constraints?${p}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [view, filters, refreshKey]);

  const subTabs = [
    { id: 'capacity',      label: 'Capacity' },
    { id: 'material',      label: 'Material' },
    { id: 'demand_impact', label: 'Demand Impact' },
  ];

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 0, padding: '0 16px', background: 'var(--card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '8px 20px', fontSize: 12, fontWeight: view === t.id ? 700 : 500,
            cursor: 'pointer', border: 'none',
            borderBottom: view === t.id ? '2px solid var(--navy-accent)' : '2px solid transparent',
            background: 'transparent', color: view === t.id ? 'var(--navy-accent)' : 'var(--text-2)',
            transition: 'all 0.12s',
          }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {loading && <div style={{ color: 'var(--text-3)', fontSize: 13, padding: 32, textAlign: 'center' }}>Loading…</div>}
        {!loading && data && view === 'capacity'      && <CapacityView rows={data.rows} weekRange={data.weekRange} />}
        {!loading && data && view === 'material'      && <MaterialView rows={data.rows} weekRange={data.weekRange} />}
        {!loading && data && view === 'demand_impact' && <DemandImpactView rows={data.rows} summary={data.summary} />}
      </div>
    </div>
  );
}

// ── §3.7 Pegging View ─────────────────────────────────────────────────────────

function PeggingNode({ title, color, children, width = 192 }) {
  return (
    <div style={{ width, flexShrink: 0, background: 'var(--card)', border: `1.5px solid ${color}`, borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function PRow({ label, value, danger }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4, alignItems: 'baseline' }}>
      <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: danger ? 'var(--danger)' : 'var(--text-1)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function PeggingArrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 6px', marginTop: 30 }}>
      <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
        <line x1="2" y1="7" x2="22" y2="7" stroke="var(--text-3)" strokeWidth="1.5" strokeDasharray="3 2" />
        <polyline points="17,3 25,7 17,11" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function PeggingChain({ chain, cell }) {
  const { customerDemand, planningOrder, firmProductionOrders, componentRequirements, supplierPurchaseOrders, transferOrders } = chain;
  const navy = 'var(--navy-accent)';
  const green = 'var(--green)';
  const amber = 'var(--amber)';
  const red   = 'var(--danger)';
  const capUtilPct = planningOrder.capacityAvailable > 0
    ? (planningOrder.capacityRequired / planningOrder.capacityAvailable) * 100
    : 0;

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
        {cell.sku} · {cell.locationName} · {toRelWeek(cell.weekNumber)}
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>

          {/* Node 1: Customer Demand */}
          <PeggingNode title="Customer Demand" color={navy} width={188}>
            <PRow label="Forecast Demand"    value={Math.round(customerDemand.totalDemand).toLocaleString('en-IN')} />
            <PRow label="Customer Orders"    value={Math.round(customerDemand.customerOrders).toLocaleString('en-IN')} />
            <PRow label="Priority Demand"    value={Math.round(customerDemand.priorityDemand).toLocaleString('en-IN')} />
            <PRow label="Shortage Impact"
              value={customerDemand.shortageImpact > 0 ? Math.round(customerDemand.shortageImpact).toLocaleString('en-IN') : '—'}
              danger={customerDemand.shortageImpact > 0} />
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-3)' }}>
              T1: {customerDemand.tier1Customers} · T2: {customerDemand.tier2Customers} customers
            </div>
          </PeggingNode>

          <PeggingArrow />

          {/* Node 2: FG / Planning Order */}
          <PeggingNode title="FG Inventory / Planning Order" color={planningOrder.shortageQty > 0 ? red : green} width={204}>
            <PRow label="Beg. Inventory"     value={Math.round(planningOrder.beginningInventory).toLocaleString('en-IN')} />
            <PRow label="Planned Production"  value={Math.round(planningOrder.plannedProduction).toLocaleString('en-IN')} />
            <PRow label="Ending Inventory"    value={Math.round(planningOrder.endingInventory).toLocaleString('en-IN')} />
            <PRow label="Shortage"
              value={planningOrder.shortageQty > 0 ? Math.round(planningOrder.shortageQty).toLocaleString('en-IN') : '—'}
              danger={planningOrder.shortageQty > 0} />
            <PRow label="Supply Gap"
              value={planningOrder.supplyGap > 0 ? Math.round(planningOrder.supplyGap).toLocaleString('en-IN') : '—'}
              danger={planningOrder.supplyGap > 0} />
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-3)' }}>
              {planningOrder.plant} · {planningOrder.line}
            </div>
            <div style={{ marginTop: 4 }}>
              <UtilBar pct={Math.min(200, capUtilPct)} size="sm" />
              <span style={{ fontSize: 9, color: 'var(--text-3)' }}>Capacity utilization</span>
            </div>
          </PeggingNode>

          <PeggingArrow />

          {/* Node 3: Components */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', marginBottom: 2 }}>
              Component Requirements ({componentRequirements.length})
            </div>
            {componentRequirements.slice(0, 5).map(comp => (
              <PeggingNode key={comp.code} title={comp.category} color={comp.coverageOk ? green : red} width={192}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{comp.name}</div>
                <PRow label="Qty/unit"   value={comp.qtyPer} />
                <PRow label="Required"   value={Math.round(comp.qtyRequired).toLocaleString('en-IN')} />
                <PRow label="On Hand"    value={Math.round(comp.onHandQty).toLocaleString('en-IN')} />
                <PRow label="After Draw" value={Math.round(comp.qtyAfterDraw).toLocaleString('en-IN')} danger={!comp.coverageOk} />
                <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: comp.coverageOk ? green : red }}>
                  {comp.coverageOk ? '✓ Covered' : '⚠ Insufficient'}
                </div>
              </PeggingNode>
            ))}
          </div>

          <PeggingArrow />

          {/* Node 4: Suppliers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', marginBottom: 2 }}>
              Supplier Dependency
            </div>
            {componentRequirements.slice(0, 5).map(comp => {
              const openPO = supplierPurchaseOrders.find(p => p.component === comp.name);
              return (
                <PeggingNode key={comp.code + '-s'} title="Supplier" color={comp.otifPct >= 85 ? green : amber} width={180}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{comp.supplier}</div>
                  <PRow label="OTIF %"     value={`${comp.otifPct}%`}     danger={comp.otifPct < 85} />
                  <PRow label="Lead Time"  value={`${comp.leadTimeDays}d`} />
                  {openPO && (
                    <div style={{ marginTop: 4, padding: '3px 7px', borderRadius: 6, background: 'var(--blue-bg)', fontSize: 10, color: 'var(--navy-accent)', fontWeight: 600 }}>
                      Open PO: {Math.round(openPO.qty).toLocaleString('en-IN')} u · W{openPO.weekDue}
                    </div>
                  )}
                </PeggingNode>
              );
            })}
          </div>
        </div>
      </div>

      {/* Firm Production Orders */}
      {firmProductionOrders.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Firm Production Orders ({firmProductionOrders.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {firmProductionOrders.map(fpo => (
              <div key={fpo.fpoId} style={{ padding: '7px 12px', borderRadius: 8, background: 'var(--blue-bg)', border: '1px solid var(--blue)', fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: 'var(--navy-accent)' }}>{fpo.plant} · {fpo.line}</div>
                <div style={{ color: 'var(--text-2)', marginTop: 2 }}>Qty: {Math.round(fpo.qty).toLocaleString('en-IN')} · {fpo.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer Orders */}
      {transferOrders.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Transfer Orders ({transferOrders.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {transferOrders.map(to => (
              <div key={to.toId} style={{ padding: '7px 12px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-1)' }}>{to.from} → {to.to}</div>
                <div style={{ color: 'var(--text-2)', marginTop: 2 }}>Qty: {Math.round(to.qty).toLocaleString('en-IN')} · {to.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PeggingView({ filters, filterOptions }) {
  const [query, setQuery] = useState({ sku: '', locationId: '', weekNumber: String(filters.weekStart || 22) });
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [traceError, setTraceError] = useState(null);
  const setQ = (k, v) => setQuery(p => ({ ...p, [k]: v }));

  const runTrace = () => {
    if (!query.sku || !query.locationId) return;
    setLoading(true); setTraceError(null); setData(null);
    const p = new URLSearchParams({
      sku:        query.sku,
      locationId: query.locationId,
      weekNumber: query.weekNumber,
      scenarioId: filters.scenarioId,
    });
    fetch(`/api/supply/pegging?${p}`)
      .then(r => r.json().then(d => { if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d; }))
      .then(setData)
      .catch(e => setTraceError(e.message))
      .finally(() => setLoading(false));
  };

  const skuList = filterOptions?.skus      || [];
  const locList = filterOptions?.locations  || [];

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', marginBottom: 4 }}>SKU</div>
          <select value={query.sku} onChange={e => setQ('sku', e.target.value)} style={s.input}>
            <option value="">Select SKU…</option>
            {skuList.map(sk => <option key={sk.sku} value={sk.sku}>{sk.sku.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', marginBottom: 4 }}>Location</div>
          <select value={query.locationId} onChange={e => setQ('locationId', e.target.value)} style={s.input}>
            <option value="">Select location…</option>
            {locList.map(l => <option key={l.location_id} value={l.location_id}>{l.name} ({l.region})</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', marginBottom: 4 }}>Week</div>
          <input type="number" min={1} max={52} value={query.weekNumber} onChange={e => setQ('weekNumber', e.target.value)} style={{ ...s.input, width: 60 }} />
        </div>
        <button onClick={runTrace} disabled={!query.sku || !query.locationId || loading}
          style={{ padding: '6px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: !query.sku || !query.locationId ? 'not-allowed' : 'pointer',
            border: 'none', background: 'var(--navy-accent)', color: 'white',
            opacity: !query.sku || !query.locationId ? 0.5 : 1 }}>
          {loading ? 'Tracing…' : '▶ Trace Chain'}
        </button>
      </div>

      {traceError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(227,24,55,0.1)', color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>
          {traceError}
        </div>
      )}

      {!data && !loading && !traceError && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)', fontSize: 13 }}>
          <GitBranch size={32} strokeWidth={1} style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          Select a SKU, Location, and Week, then click Trace Chain to see the end-to-end dependency chain.
        </div>
      )}

      {data && <PeggingChain chain={data.chain} cell={data.cell} />}
    </div>
  );
}

// ── §3.9 Recommendation Engine ────────────────────────────────────────────────

function buildImpactChartData(rec) {
  const { before, after } = rec.impact;
  const rows = [];
  if (before.serviceLevelPct != null) rows.push({ metric: 'Service Level %', Before: +before.serviceLevelPct.toFixed(1), After: +after.serviceLevelPct.toFixed(1) });
  if (before.shortageQty != null)     rows.push({ metric: 'Shortage Units',   Before: +before.shortageQty.toFixed(1),     After: +after.shortageQty.toFixed(1) });
  if (before.utilizationPct != null)  rows.push({ metric: 'Utilization %',    Before: +before.utilizationPct.toFixed(1),  After: +after.utilizationPct.toFixed(1) });
  if (before.coverageDays != null)    rows.push({ metric: 'Coverage Days',    Before: +before.coverageDays.toFixed(1),    After: +after.coverageDays.toFixed(1) });
  return rows;
}

function RecCard({ rec, scenarioId, onApply }) {
  const [applyState, setApplyState] = useState('idle');
  const chartData     = buildImpactChartData(rec);
  const priorityColor = rec.priority === 'HIGH' ? 'var(--danger)' : 'var(--amber)';
  const typeColor     = rec.type === 'CAPACITY' ? 'var(--navy-accent)' : rec.type === 'MATERIAL' ? '#7C3AED' : 'var(--green)';

  const handleApply = async () => {
    if (!rec.actionParams || applyState !== 'idle') return;
    setApplyState('loading');
    try {
      const body = {
        actionType:  rec.actionParams.actionType,
        sku:         rec.actionParams.sku,
        locationId:  rec.actionParams.locationId,
        weekNumber:  rec.actionParams.weekNumber,
        scenarioId,
        params:      rec.actionParams.params,
      };
      const r = await fetch('/api/supply/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Apply failed'); }
      setApplyState('done');
      setTimeout(() => onApply?.(), 1200);
    } catch (err) {
      setApplyState('idle');
      alert(`Apply failed: ${err.message}`);
    }
  };

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, borderLeft: `3px solid ${priorityColor}` }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          background: rec.priority === 'HIGH' ? 'rgba(227,24,55,0.12)' : 'rgba(245,158,11,0.12)', color: priorityColor }}>
          {rec.priority}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--blue-bg)', color: typeColor }}>
          {rec.type}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', flex: 1, minWidth: 220 }}>{rec.issue}</span>
      </div>

      {/* Two columns: ranked actions + before/after chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', marginBottom: 8 }}>Recommended Actions</div>
          {rec.recommendedActions.map((action, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--navy-accent)', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.45 }}>{action}</span>
            </div>
          ))}
          {rec.actionParams && (
            <button onClick={handleApply} disabled={applyState !== 'idle'} style={{
              marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700, cursor: applyState === 'idle' ? 'pointer' : 'default',
              background: applyState === 'done' ? 'var(--green)' : applyState === 'loading' ? '#E5E7EB' : 'var(--navy-accent)',
              color: applyState === 'loading' ? 'var(--text-3)' : 'white',
              transition: 'all 0.2s',
            }}>
              {applyState === 'done' && <CheckCircle size={12} />}
              {applyState === 'done' ? 'Applied ✓' : applyState === 'loading' ? 'Applying…' : 'Apply Action →'}
            </button>
          )}
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)', marginBottom: 8 }}>Before vs. After Impact</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={2} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="metric" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} labelStyle={{ fontWeight: 700, marginBottom: 4 }} />
              <Bar dataKey="Before" fill="var(--navy-accent)" radius={[2, 2, 0, 0]} name="Before" />
              <Bar dataKey="After"  fill="var(--green)"       radius={[2, 2, 0, 0]} name="After" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 10, fontWeight: 700, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--navy-accent)', display: 'inline-block' }} /> Before
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> After
            </span>
            {rec.impact.after.revenueRecoveredINR != null && (
              <span style={{ color: 'var(--green)' }}>+{fmtINR(rec.impact.after.revenueRecoveredINR)} recovered</span>
            )}
            {rec.impact.after.expediteCostINR != null && (
              <span style={{ color: 'var(--amber)' }}>{fmtINR(rec.impact.after.expediteCostINR)} expedite cost</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecommendationEngine({ recommendations, loading, scenarioId, onApply }) {
  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Computing recommendations…
      </div>
    );
  }

  const recs = recommendations?.recommendations || [];
  if (recs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', gap: 10, padding: 48 }}>
        <Activity size={36} strokeWidth={1} />
        <div style={{ fontSize: 14, fontWeight: 700 }}>No active constraints</div>
        <div style={{ fontSize: 12 }}>All capacity and material constraints are within acceptable ranges for this period.</div>
      </div>
    );
  }

  const high = recs.filter(r => r.priority === 'HIGH').length;
  const med  = recs.filter(r => r.priority === 'MEDIUM').length;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>{recs.length} recommendations</span>
        {high > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(227,24,55,0.12)', color: 'var(--danger)' }}>{high} HIGH</span>}
        {med  > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: 'var(--amber)' }}>{med} MEDIUM</span>}
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>W{recommendations.weekRange?.start}–W{recommendations.weekRange?.end} · Scenario {recommendations.scenarioId}</span>
      </div>
      {recs.map(rec => <RecCard key={rec.id} rec={rec} scenarioId={scenarioId} onApply={onApply} />)}
    </div>
  );
}

// ── §4 Planner Exception Inbox ─────────────────────────────────────────────────

function InboxItem({ rec, onNavigate }) {
  const priorityColor = rec.priority === 'HIGH' ? 'var(--danger)' : 'var(--amber)';
  const typeIcon = rec.type === 'CAPACITY' ? '⚙' : rec.type === 'MATERIAL' ? '📦' : '📊';

  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 8, alignItems: 'flex-start', borderLeft: `3px solid ${priorityColor}` }}>
      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{typeIcon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, lineHeight: 1.4 }}>{rec.issue}</div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>{rec.recommendedActions[0]}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8,
            background: rec.priority === 'HIGH' ? 'rgba(227,24,55,0.12)' : 'rgba(245,158,11,0.12)', color: priorityColor }}>
            {rec.priority}
          </span>
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            {rec.type}
          </span>
          {rec.impact.before.serviceLevelPct != null && (
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              SL: {rec.impact.before.serviceLevelPct.toFixed(1)}% → {rec.impact.after.serviceLevelPct.toFixed(1)}%
            </span>
          )}
          {rec.impact.before.shortageQty != null && rec.impact.before.shortageQty > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              Shortage: {rec.impact.before.shortageQty.toFixed(0)} → {rec.impact.after.shortageQty.toFixed(0)} units
            </span>
          )}
        </div>
      </div>
      <button onClick={() => onNavigate('recommendations')}
        style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--navy-accent)', whiteSpace: 'nowrap' }}>
        View Fix →
      </button>
    </div>
  );
}

function ExceptionInbox({ filters, recommendations, onNavigate, showHistory }) {
  const recs = recommendations?.recommendations || [];
  const high = recs.filter(r => r.priority === 'HIGH');
  const med  = recs.filter(r => r.priority === 'MEDIUM');

  if (!recommendations) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>Loading exceptions…</div>;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>Planner Exception Inbox</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        Active constraint issues needing attention · {showHistory ? 'Including history' : 'Current planning horizon'} · Scenario {filters.scenarioId}
      </div>

      {recs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
          <InboxIcon size={32} strokeWidth={1} style={{ display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Inbox is clear</div>
          <div style={{ fontSize: 12 }}>No active constraint issues for the current period.</div>
        </div>
      )}

      {high.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--danger)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
            High Priority ({high.length})
          </div>
          {high.map(rec => <InboxItem key={rec.id} rec={rec} onNavigate={onNavigate} />)}
        </div>
      )}

      {med.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--amber)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} />
            Medium Priority ({med.length})
          </div>
          {med.map(rec => <InboxItem key={rec.id} rec={rec} onNavigate={onNavigate} />)}
        </div>
      )}
    </div>
  );
}

// ── §3.8 Scenario Simulation ──────────────────────────────────────────────────

const SCEN_COLORS = ['#1B3A6B', '#E31837', '#16A34A', '#D97706', '#7C3AED'];

const ACTION_TYPE_LABELS = {
  BASELINE:            'Baseline',
  ADD_OVERTIME:        'Add Overtime',
  SHIFT_PRODUCTION:    'Shift Production',
  EXPEDITE_SUPPLIER:   'Expedite Supplier',
  INCREASE_PRODUCTION: 'Increase Production',
  CUSTOM:              'Custom',
};
const ACTION_TYPE_OPTIONS = [
  { value: 'ADD_OVERTIME',        label: 'Add Overtime' },
  { value: 'SHIFT_PRODUCTION',    label: 'Shift Production Location' },
  { value: 'EXPEDITE_SUPPLIER',   label: 'Expedite Supplier' },
  { value: 'INCREASE_PRODUCTION', label: 'Increase Production' },
  { value: 'CUSTOM',              label: 'Custom' },
];

// §3.8 spec metrics: service improvement · cost impact · inventory impact · revenue recovery
const COMPARE_METRICS = [
  { key: 'service_level_pct',          label: 'Service Level',       higherIsBetter: true,  fmt: v => `${v?.toFixed(1) ?? '—'}%` },
  { key: 'revenue_at_risk',            label: 'Revenue at Risk',     higherIsBetter: false, fmt: v => v != null ? `₹${(v / 100000).toFixed(1)}L` : '—' },
  { key: 'total_shortage',             label: 'Shortage Units',      higherIsBetter: false, fmt: v => v != null ? v.toLocaleString('en-IN') : '—' },
  { key: 'inventory_days',             label: 'Inventory Days',      higherIsBetter: false, fmt: v => `${v?.toFixed(1) ?? '—'}d` },
  { key: 'cap_util_pct',               label: 'Capacity Util.',      higherIsBetter: false, fmt: v => `${v?.toFixed(1) ?? '—'}%` },
  { key: 'avg_material_coverage_days', label: 'Material Coverage',   higherIsBetter: true,  fmt: v => `${v?.toFixed(1) ?? '—'}d` },
];

const scTh = {
  padding: '8px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-2)', textAlign: 'center',
  border: '1px solid var(--border)', whiteSpace: 'nowrap', background: '#F8FAFC',
};
const scTd = {
  padding: '8px 12px', fontSize: 12, color: 'var(--text-1)',
  border: '1px solid var(--border)', textAlign: 'center',
};
const scLabel = {
  display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-3)', marginBottom: 5,
};

function ScenarioSimulation({ filters, onSwitchScenario, onResetComplete, showHistory }) {
  const [scenarios,  setScenarios]  = useState([]);
  const [sceLoading, setSceLoading] = useState(false);
  const [selected,   setSelected]   = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparing,  setComparing]  = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [form,       setForm]       = useState({ name: '', actionType: 'ADD_OVERTIME', description: '' });
  const [refreshKey,     setRefreshKey]     = useState(0);
  const [createdId,      setCreatedId]      = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null);
  const [deleting,       setDeleting]       = useState(false);
  const [resetting,      setResetting]      = useState(false);
  const [confirmReset,   setConfirmReset]   = useState(false);

  useEffect(() => {
    setSceLoading(true);
    const p = new URLSearchParams({ weekStart: filters.weekStart, weekEnd: filters.weekEnd });
    fetch(`/api/supply/scenarios?${p}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setScenarios(d.scenarios || []))
      .catch(() => {})
      .finally(() => setSceLoading(false));
  }, [filters.weekStart, filters.weekEnd, refreshKey]);

  const toggleSelect = id => setSelected(prev =>
    prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 5 ? [...prev, id] : prev
  );

  const handleCompare = async () => {
    if (selected.length < 2) return;
    setComparing(true);
    setComparison(null);
    const p = new URLSearchParams({ ids: selected.join(','), weekStart: filters.weekStart, weekEnd: filters.weekEnd });
    try {
      const r = await fetch(`/api/supply/scenarios/compare?${p}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setComparison(d);
    } catch {}
    finally { setComparing(false); }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const r = await fetch('/api/supply/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), description: form.description, actionType: form.actionType }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.success) {
        setRefreshKey(k => k + 1);
        setSelected(prev => [...prev, d.scenarioId]);
        setCreatedId(d.scenarioId);
        setForm({ name: '', actionType: 'ADD_OVERTIME', description: '' });
        setShowCreate(false);
      }
    } catch {}
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/supply/scenarios/${confirmDelete.scenario_id}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Delete failed'); }
      setConfirmDelete(null);
      setSelected(prev => prev.filter(id => id !== confirmDelete.scenario_id));
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert(err.message);
    } finally { setDeleting(false); }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      console.log('[RESET] handleReset — calling POST /api/supply/reset');
      const r = await fetch('/api/supply/reset', { method: 'POST' });
      console.log('[RESET] reset response status:', r.status, '— onResetComplete defined?', typeof onResetComplete);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setConfirmReset(false);
      setSelected([]);
      setComparison(null);
      setCreatedId(null);
      onResetComplete();
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('[RESET] error in handleReset:', err);
      alert(`Reset failed: ${err.message}`);
    } finally { setResetting(false); }
  };

  const compareRows  = comparison?.comparison || [];
  const baselineRow  = compareRows.find(r => r.action_type === 'BASELINE') || compareRows[0];
  const nonBaseRows  = compareRows.filter(r => r.action_type !== 'BASELINE');
  const allIdentical = compareRows.length > 1 &&
    compareRows.every(r => r.service_level_pct === baselineRow?.service_level_pct &&
      r.total_shortage === baselineRow?.total_shortage);

  const pctDelta = (val, baseVal) => {
    if (baseVal == null || baseVal === 0) return null;
    return +((val - baseVal) / Math.abs(baseVal) * 100).toFixed(1);
  };

  // Chart: % delta vs baseline for the 4 spec-required metrics
  const CHART_METRICS = COMPARE_METRICS.slice(0, 4);
  const chartData = CHART_METRICS.map(m => {
    const row = { metric: m.label };
    nonBaseRows.forEach(sc => { row[sc.name] = pctDelta(sc[m.key], baselineRow?.[m.key]) ?? 0; });
    return row;
  });

  // Winners
  const winners = {
    service: compareRows.reduce((b, sc) => (!b || sc.service_level_pct > b.service_level_pct) ? sc : b, null),
    shortage: compareRows.reduce((b, sc) => (!b || sc.total_shortage < b.total_shortage) ? sc : b, null),
    revenue:  compareRows.reduce((b, sc) => (!b || sc.revenue_at_risk < b.revenue_at_risk)  ? sc : b, null),
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>

      {/* ── Left: Scenario library ── */}
      <div style={{
        width: 282, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Supply Scenarios</span>
              <span style={{ background: 'var(--navy-accent)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                {scenarios.length}
              </span>
            </div>
            <button onClick={() => setShowCreate(true)} style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'var(--navy-accent)', color: 'white',
              border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>
              <Plus size={11} /> New
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
            Select 2–5 · compare side-by-side · {showHistory ? 'Including history' : 'Current planning horizon'}
          </div>
        </div>

        {/* Scenario cards list */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px' }}>
          {sceLoading && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>
          )}
          {!sceLoading && scenarios.map(sc => {
            const isSel = selected.includes(sc.scenario_id);
            const isNew = sc.scenario_id === createdId;
            return (
              <div key={sc.scenario_id} onClick={() => toggleSelect(sc.scenario_id)} style={{
                border: `2px solid ${isSel ? 'var(--navy-accent)' : isNew ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 9, padding: '9px 11px', marginBottom: 6, cursor: 'pointer',
                background: isSel ? 'rgba(27,58,107,0.06)' : isNew ? 'rgba(245,158,11,0.04)' : 'var(--card)',
                transition: 'all 0.12s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <input type="checkbox" checked={isSel} readOnly
                    style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--navy-accent)', cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sc.name}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 7,
                        background: sc.action_type === 'BASELINE' ? 'rgba(27,58,107,0.1)' : 'rgba(245,158,11,0.1)',
                        color: sc.action_type === 'BASELINE' ? 'var(--navy-accent)' : 'var(--amber)',
                      }}>
                        {ACTION_TYPE_LABELS[sc.action_type] || sc.action_type}
                      </span>
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 7,
                        background: sc.status === 'active' ? 'rgba(22,163,74,0.1)' : 'var(--bg)',
                        color: sc.status === 'active' ? 'var(--green)' : 'var(--text-3)',
                      }}>
                        {sc.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 10, color: 'var(--text-3)' }}>
                      <span>SL: <strong style={{ color: 'var(--text-2)' }}>{sc.service_level_pct?.toFixed(1) ?? '—'}%</strong></span>
                      <span>Gap: <strong style={{ color: 'var(--text-2)' }}>{sc.total_shortage?.toLocaleString('en-IN') ?? '—'}</strong></span>
                    </div>
                    {sc.action_type !== 'BASELINE' && (
                      <button onClick={e => { e.stopPropagation(); onSwitchScenario(sc.scenario_id); }} style={{
                        marginTop: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        background: isNew ? 'var(--amber)' : 'var(--navy-accent)', color: 'white', border: 'none',
                        borderRadius: 6, padding: '4px 0', fontSize: 10, fontWeight: 700, cursor: 'pointer', width: '100%',
                      }}>
                        <ArrowRight size={10} /> Activate in Grid →
                      </button>
                    )}
                    {sc.action_type !== 'BASELINE' && (
                      confirmDelete?.scenario_id === sc.scenario_id ? (
                        <div style={{ marginTop: 6, background: 'rgba(227,24,55,0.06)', border: '1px solid rgba(227,24,55,0.2)', borderRadius: 6, padding: '7px 8px' }}>
                          <div style={{ fontSize: 10, color: 'var(--danger)', marginBottom: 5, fontWeight: 600, lineHeight: 1.4 }}>
                            Delete "{sc.name}"? This cannot be undone.
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }} style={{
                              flex: 1, padding: '4px', borderRadius: 5, border: '1px solid var(--border)',
                              background: 'var(--bg)', cursor: 'pointer', fontSize: 10, color: 'var(--text-2)',
                            }}>Cancel</button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting} style={{
                              flex: 1, padding: '4px', borderRadius: 5, border: 'none',
                              background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                            }}>{deleting ? 'Deleting…' : 'Delete'}</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(sc); }} style={{
                          marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)',
                          borderRadius: 5, padding: '3px 0', fontSize: 9, cursor: 'pointer', width: '100%',
                        }}>
                          <Trash2 size={9} /> Delete scenario
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: compare button */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {selected.length === 1 && (
            <div style={{ fontSize: 10, color: 'var(--amber)', marginBottom: 6, textAlign: 'center' }}>
              Select 1 more to compare
            </div>
          )}
          <button onClick={handleCompare} disabled={selected.length < 2 || comparing} style={{
            width: '100%', padding: '9px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
            cursor: selected.length >= 2 ? 'pointer' : 'not-allowed',
            background: selected.length >= 2 ? 'var(--navy-accent)' : '#E5E7EB',
            color: selected.length >= 2 ? 'white' : 'var(--text-3)',
          }}>
            {comparing ? 'Comparing…' : `Compare${selected.length >= 2 ? ` (${selected.length})` : ''} →`}
          </button>
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>
            Select up to 5 (min 2)
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
            {confirmReset ? (
              <div style={{ background: 'rgba(227,24,55,0.06)', border: '1px solid rgba(227,24,55,0.2)', borderRadius: 8, padding: '10px 10px' }}>
                <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700, marginBottom: 4 }}>Reset all supply data?</div>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>
                  Permanently erases all scenarios and grid edits. Restores original seed data.
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setConfirmReset(false)} style={{
                    flex: 1, padding: '5px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'var(--bg)', cursor: 'pointer', fontSize: 10, color: 'var(--text-2)',
                  }}>Cancel</button>
                  <button onClick={handleReset} disabled={resetting} style={{
                    flex: 1, padding: '5px', borderRadius: 6, border: 'none',
                    background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  }}>{resetting ? 'Resetting…' : 'Reset'}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)} style={{
                width: '100%', padding: '6px', borderRadius: 7, border: '1px dashed rgba(227,24,55,0.4)',
                background: 'transparent', cursor: 'pointer', fontSize: 10, color: 'var(--danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                <RefreshCw size={10} /> Reset Supply Data
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Comparison panel ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>

        {/* Empty state */}
        {!comparison && !comparing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-3)', gap: 12, textAlign: 'center' }}>
            <Trophy size={52} strokeWidth={1} style={{ opacity: 0.35 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>Select 2+ scenarios to compare</div>
            <div style={{ fontSize: 12, maxWidth: 380, lineHeight: 1.7 }}>
              Check scenarios in the library, then click <strong>Compare</strong>. Click <strong>+ New</strong> to
              create a what-if scenario, apply changes in the Planning Grid, then re-compare to see real deltas.
            </div>
          </div>
        )}

        {/* Loading */}
        {comparing && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', fontSize: 13 }}>
            Computing comparison…
          </div>
        )}

        {/* Results */}
        {comparison && !comparing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Callout when all scenarios are still identical to baseline */}
            {allIdentical && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--amber)',
                display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>All scenarios show identical baseline numbers.</strong> New scenarios are exact clones
                  of Baseline until you apply planning actions. Select a new scenario in the library,
                  click "Activate in Grid", then use the Actions panel (Add Overtime, Expedite Supplier, etc.)
                  to modify its planning orders. Re-compare to see real deltas.
                </div>
              </div>
            )}

            {/* Winner cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Best Service Level',  winner: winners.service,  fmt: w => `${w.service_level_pct?.toFixed(1)}%` },
                { label: 'Lowest Shortage',     winner: winners.shortage, fmt: w => `${w.total_shortage?.toLocaleString('en-IN')} units` },
                { label: 'Lowest Revenue Risk', winner: winners.revenue,  fmt: w => `₹${(w.revenue_at_risk / 100000).toFixed(1)}L` },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--card)', borderRadius: 10, padding: '14px 16px',
                  border: '1px solid var(--border)', borderTop: '3px solid var(--amber)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Trophy size={12} color="var(--amber)" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>
                    {item.winner?.name ?? '—'}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy-accent)' }}>
                    {item.winner ? item.fmt(item.winner) : '—'}
                  </div>
                </div>
              ))}
            </div>

            {/* Delta chart vs baseline — only when non-baseline scenarios exist */}
            {nonBaseRows.length > 0 && (
              <div style={{ background: 'var(--card)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>
                  % Change vs Baseline
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 14 }}>
                  Positive = improvement for ↑ metrics · Negative = improvement for ↓ metrics
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }} barGap={3} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={40} unit="%" />
                    <Tooltip
                      contentStyle={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
                      formatter={(v, n) => [`${v > 0 ? '+' : ''}${v}%`, n]}
                    />
                    {nonBaseRows.map((sc, i) => (
                      <Bar key={sc.scenario_id} dataKey={sc.name} fill={SCEN_COLORS[(i + 1) % SCEN_COLORS.length]}
                        radius={[3, 3, 0, 0]} name={sc.name} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Full metrics comparison table */}
            <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
                  Detailed Comparison — W{comparison.weekRange?.start}–W{comparison.weekRange?.end}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{compareRows.length} scenarios</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={{ ...scTh, textAlign: 'left', minWidth: 150 }}>Metric</th>
                      {compareRows.map((sc, i) => (
                        <th key={sc.scenario_id} style={{ ...scTh, minWidth: 120, background: sc.action_type === 'BASELINE' ? 'rgba(27,58,107,0.06)' : '#F8FAFC' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: SCEN_COLORS[i % SCEN_COLORS.length], flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{sc.name}</span>
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-3)' }}>
                            {ACTION_TYPE_LABELS[sc.action_type] || sc.action_type}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_METRICS.map((m, mi) => (
                      <tr key={m.key} style={{ background: mi % 2 === 0 ? 'var(--card)' : '#FAFAFA' }}>
                        <td style={{ ...scTd, textAlign: 'left', fontWeight: 600, color: 'var(--text-2)' }}>
                          {m.label}
                          <span style={{ marginLeft: 5, fontSize: 9, color: 'var(--text-3)', fontWeight: 400 }}>
                            {m.higherIsBetter ? '↑ better' : '↓ better'}
                          </span>
                        </td>
                        {compareRows.map(sc => {
                          const val     = sc[m.key];
                          const isBase  = sc.action_type === 'BASELINE';
                          const delta   = isBase ? null : pctDelta(val, baselineRow?.[m.key]);
                          const improved = delta != null && (m.higherIsBetter ? delta > 0 : delta < 0);
                          const worse    = delta != null && (m.higherIsBetter ? delta < 0 : delta > 0);
                          return (
                            <td key={sc.scenario_id} style={{ ...scTd, background: isBase ? 'rgba(27,58,107,0.04)' : undefined }}>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>{m.fmt(val)}</div>
                              {delta != null && delta !== 0 && (
                                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2,
                                  color: improved ? 'var(--green)' : worse ? 'var(--danger)' : 'var(--text-3)' }}>
                                  {delta > 0 ? '+' : ''}{delta}%
                                </div>
                              )}
                              {delta === 0 && (
                                <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>no change</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Create Scenario modal ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowCreate(false)}>
          <div style={{ background: 'var(--card)', borderRadius: 14, padding: '24px 24px 20px',
            width: 420, maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '0.5px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-1)' }}>
              Create Supply Scenario
            </div>

            <div style={{ marginBottom: 13 }}>
              <label style={scLabel}>Scenario Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Add Saturday Overtime — AC Line Pune"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 13, color: 'var(--text-1)', background: 'var(--bg)', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            <div style={{ marginBottom: 13 }}>
              <label style={scLabel}>Action Type</label>
              <select value={form.actionType} onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 13, color: 'var(--text-1)', background: 'var(--bg)', boxSizing: 'border-box' }}>
                {ACTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={scLabel}>Description (optional)</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="Describe the what-if assumption…"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 12, color: 'var(--text-1)', background: 'var(--bg)', resize: 'vertical',
                  boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 8, padding: '9px 12px', marginBottom: 18, fontSize: 11, color: 'var(--amber)', lineHeight: 1.6 }}>
              A full clone of the Baseline is created. Activate it in the Planning Grid and apply actions
              (Add Overtime, Expedite Supplier, etc.) to modify its numbers, then come back to compare.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', cursor: 'pointer', fontSize: 13, color: 'var(--text-2)',
              }}>Cancel</button>
              <button onClick={handleCreate} disabled={!form.name.trim() || creating} style={{
                flex: 2, padding: '9px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
                cursor: form.name.trim() ? 'pointer' : 'not-allowed',
                background: form.name.trim() ? 'var(--navy-accent)' : '#E5E7EB',
                color: form.name.trim() ? 'white' : 'var(--text-3)',
              }}>
                {creating ? 'Creating…' : '+ Create Scenario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── View tabs (main workbench sections) ──────────────────────────────────────

// HIDDEN_TABS: pegging and scenarios are fully functional but not shown in the nav.
// To re-enable, remove their IDs from this set.
const HIDDEN_TABS = new Set(['pegging', 'scenarios']);

function ViewTabs({ active, onChange, recCount }) {
  const tabs = [
    { id: 'grid',            label: 'Planning Grid',    icon: Layers },
    { id: 'constraints',     label: 'Constraints',      icon: Activity },
    { id: 'whatif',          label: 'What-If',          icon: FlaskConical },
    { id: 'pegging',         label: 'Pegging',          icon: GitBranch },
    { id: 'recommendations', label: 'Recommendations',  icon: BarChart2,  badge: recCount },
    { id: 'inbox',           label: 'Inbox',            icon: InboxIcon,  badge: recCount },
    { id: 'scenarios',       label: 'Scenarios',        icon: Sliders },
  ].filter(t => !HIDDEN_TABS.has(t.id));
  return (
    <div style={{ display: 'flex', gap: 2, padding: '6px 16px', background: 'var(--card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 14px', borderRadius: 7, fontSize: 11,
            fontWeight: isActive ? 700 : 500, cursor: 'pointer', border: 'none',
            background: isActive ? 'var(--navy-accent)' : 'transparent',
            color: isActive ? 'white' : 'var(--text-2)', transition: 'all 0.12s',
          }}>
            <Icon size={12} />
            {tab.label}
            {(tab.badge > 0) && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 8, marginLeft: 2,
                background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--danger)', color: 'white' }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const s = {
  filterBar: {
    display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
    padding: '8px 16px', background: 'var(--card)',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  label: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
    textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap',
  },
  input: {
    fontSize: 12, padding: '3px 8px',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    background: 'var(--card)', color: 'var(--text-1)', cursor: 'pointer',
  },
  fieldInput: {
    width: '100%', fontSize: 11, padding: '3px 7px',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    background: 'var(--card)', color: 'var(--text-1)',
  },
};

// ── What-If Simulator (multi-SKU lever simulation) ────────────────────────────

function WhatIfTab({ filters, filterOptions, actionsMeta, onRefreshGrid }) {
  const [lever, setLever]             = useState('add_overtime');
  const [lp, setLp]                   = useState({
    plantId: '', lineId: '', extraHoursPerWeek: 8,
    newPlantId: '',
    componentId: '', supplierId: '', qty: 500, newWeekDue: filters.weekStart,
  });
  const [filterAbc,  setFilterAbc]    = useState('');
  const [filterXyz,  setFilterXyz]    = useState('');
  const [filterSev,  setFilterSev]    = useState('');
  const [candidates, setCandidates]   = useState([]);
  const [candLoading, setCandLoading] = useState(false);
  const [candError,  setCandError]    = useState(null);
  const [selected,   setSelected]     = useState(new Set());
  const [simResult,  setSimResult]    = useState(null);
  const [simLoading, setSimLoading]   = useState(false);
  const [simError,   setSimError]     = useState(null);
  const [approvals,  setApprovals]    = useState({});
  const [apprErrors, setApprErrors]   = useState({});

  const linesForPlant = (pid) => (actionsMeta?.lines || []).filter(l => String(l.plant_id) === String(pid));

  useEffect(() => {
    setCandLoading(true); setCandError(null); setSimResult(null);
    setSelected(new Set()); setApprovals({});
    const qs = new URLSearchParams({
      scenarioId: filters.scenarioId,
      weekStart: filters.weekStart,
      weekEnd: filters.weekEnd,
    });
    if (filterAbc) qs.set('abcClass', filterAbc);
    if (filterXyz) qs.set('xyzClass', filterXyz);
    if (filterSev) qs.set('severity', filterSev);
    fetch(`/api/supply/whatif/candidates?${qs}`)
      .then(r => r.json())
      .then(d => setCandidates(d.candidates || []))
      .catch(e => setCandError(e.message))
      .finally(() => setCandLoading(false));
  }, [filters.scenarioId, filters.weekStart, filters.weekEnd, filterAbc, filterXyz, filterSev]);

  const toggleAll = () => {
    if (selected.size === candidates.length) setSelected(new Set());
    else setSelected(new Set(candidates.map(c => `${c.sku}|${c.location_id}`)));
  };
  const toggleRow = (key) => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const buildSimParams = () => {
    if (lever === 'add_overtime')      return { plantId: parseInt(lp.plantId), lineId: parseInt(lp.lineId), extraHoursPerWeek: lp.extraHoursPerWeek };
    if (lever === 'change_plant')      return { newPlantId: parseInt(lp.newPlantId) };
    if (lever === 'expedite_supplier') return { componentId: parseInt(lp.componentId), supplierId: parseInt(lp.supplierId), qty: lp.qty, newWeekDue: lp.newWeekDue };
    return {};
  };

  const canSimulate = selected.size > 0 && (
    (lever === 'add_overtime'      && lp.plantId && lp.lineId) ||
    (lever === 'change_plant'      && lp.newPlantId) ||
    (lever === 'expedite_supplier' && lp.componentId && lp.supplierId)
  );

  const handleSimulate = async () => {
    if (!canSimulate) return;
    setSimLoading(true); setSimError(null); setSimResult(null); setApprovals({});
    const selections = candidates
      .filter(c => selected.has(`${c.sku}|${c.location_id}`))
      .map(c => ({ sku: c.sku, locationId: c.location_id }));
    try {
      const res = await fetch('/api/supply/whatif/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lever, params: buildSimParams(), selections, scenarioId: filters.scenarioId, weekStart: filters.weekStart, weekEnd: filters.weekEnd }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSimResult(d);
    } catch (e) {
      setSimError(e.message);
    } finally {
      setSimLoading(false);
    }
  };

  const handleApprove = async (row) => {
    const key = `${row.sku}|${row.locationId}`;
    setApprovals(a => ({ ...a, [key]: 'loading' }));
    setApprErrors(e => { const n = { ...e }; delete n[key]; return n; });
    try {
      const res = await fetch('/api/supply/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: lever, sku: row.sku, locationId: row.locationId,
          weekNumber: filters.weekStart, scenarioId: filters.scenarioId,
          params: buildSimParams(),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Action failed');
      setApprovals(a => ({ ...a, [key]: 'approved' }));
      if (onRefreshGrid) onRefreshGrid();
    } catch (e) {
      setApprovals(a => ({ ...a, [key]: 'error' }));
      setApprErrors(er => ({ ...er, [key]: e.message }));
    }
  };

  const SEV_CHIP = {
    critical: { bg: '#FEE2E2', color: '#DC2626' },
    high:     { bg: '#FEF3C7', color: '#D97706' },
    low:      { bg: '#EFF6FF', color: '#1D4ED8' },
  };
  const fmtInt = v => v == null ? '—' : Math.round(v).toLocaleString();
  const fmtPct = v => v == null ? '—' : `${v.toFixed(1)}%`;

  const leverLabel = { add_overtime: 'Add Overtime', change_plant: 'Shift Production Location', expedite_supplier: 'Expedite Supplier' };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Config strip ── */}
      <div style={{ padding: '12px 16px', background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <div style={s.label}>Lever</div>
          <select value={lever} onChange={e => { setLever(e.target.value); setSimResult(null); setApprovals({}); }} style={{ ...s.input, minWidth: 190 }}>
            <option value="add_overtime">Add Overtime</option>
            <option value="change_plant">Shift Production Location</option>
            <option value="expedite_supplier">Expedite Supplier</option>
          </select>
        </div>

        {lever === 'add_overtime' && (<>
          <div>
            <div style={s.label}>Plant</div>
            <select value={lp.plantId} onChange={e => setLp(p => ({ ...p, plantId: e.target.value, lineId: '' }))} style={s.input}>
              <option value="">Select plant…</option>
              {(filterOptions?.plants || []).map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <div style={s.label}>Line</div>
            <select value={lp.lineId} onChange={e => setLp(p => ({ ...p, lineId: e.target.value }))} style={s.input} disabled={!lp.plantId}>
              <option value="">Select line…</option>
              {linesForPlant(lp.plantId).map(l => <option key={l.line_id} value={l.line_id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <div style={s.label}>Extra hrs/week</div>
            <input type="number" min={1} max={24} value={lp.extraHoursPerWeek}
              onChange={e => setLp(p => ({ ...p, extraHoursPerWeek: parseFloat(e.target.value) || 8 }))}
              style={{ ...s.input, width: 72 }} />
          </div>
        </>)}

        {lever === 'change_plant' && (
          <div>
            <div style={s.label}>New Plant</div>
            <select value={lp.newPlantId} onChange={e => setLp(p => ({ ...p, newPlantId: e.target.value }))} style={s.input}>
              <option value="">Select plant…</option>
              {(filterOptions?.plants || []).map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {lever === 'expedite_supplier' && (<>
          <div>
            <div style={s.label}>Component</div>
            <select value={lp.componentId} onChange={e => setLp(p => ({ ...p, componentId: e.target.value }))} style={{ ...s.input, maxWidth: 200 }}>
              <option value="">Select component…</option>
              {(actionsMeta?.components || []).map(c => <option key={c.component_id} value={c.component_id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={s.label}>Supplier</div>
            <select value={lp.supplierId} onChange={e => setLp(p => ({ ...p, supplierId: e.target.value }))} style={s.input}>
              <option value="">Select supplier…</option>
              {(actionsMeta?.suppliers || []).map(sv => <option key={sv.supplier_id} value={sv.supplier_id}>{sv.name}</option>)}
            </select>
          </div>
          <div>
            <div style={s.label}>Qty</div>
            <input type="number" min={1} value={lp.qty}
              onChange={e => setLp(p => ({ ...p, qty: parseInt(e.target.value) || 500 }))}
              style={{ ...s.input, width: 80 }} />
          </div>
          <div>
            <div style={s.label}>Week Due</div>
            <input type="number" min={1} max={52} value={lp.newWeekDue}
              onChange={e => setLp(p => ({ ...p, newWeekDue: parseInt(e.target.value) || filters.weekStart }))}
              style={{ ...s.input, width: 64 }} />
          </div>
        </>)}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', alignSelf: 'flex-end', gap: 4 }}>
          <button
            onClick={handleSimulate}
            disabled={!canSimulate || simLoading}
            style={{
              padding: '6px 18px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 700,
              cursor: canSimulate && !simLoading ? 'pointer' : 'not-allowed',
              background: canSimulate && !simLoading ? 'var(--navy-accent)' : 'var(--border)',
              color: canSimulate && !simLoading ? 'white' : 'var(--text-3)',
            }}>
            {simLoading ? 'Simulating…' : `Simulate (${selected.size} SKU${selected.size !== 1 ? 's' : ''})`}
          </button>
          {!canSimulate && !simLoading && (() => {
            if (selected.size === 0) return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Select SKU-locations below first</span>;
            if (lever === 'add_overtime')      return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{!lp.plantId ? 'Choose a plant and line above' : 'Choose a production line above'}</span>;
            if (lever === 'change_plant')      return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Choose a new plant above</span>;
            if (lever === 'expedite_supplier') return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{!lp.componentId ? 'Choose a component and supplier above' : 'Choose a supplier above'}</span>;
            return null;
          })()}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={s.label}>Filter:</span>
          <select value={filterAbc} onChange={e => setFilterAbc(e.target.value)} style={s.input}>
            <option value="">All ABC</option>
            {['A', 'B', 'C'].map(v => <option key={v} value={v}>ABC: {v}</option>)}
          </select>
          <select value={filterXyz} onChange={e => setFilterXyz(e.target.value)} style={s.input}>
            <option value="">All XYZ</option>
            {['X', 'Y', 'Z'].map(v => <option key={v} value={v}>XYZ: {v}</option>)}
          </select>
          <select value={filterSev} onChange={e => setFilterSev(e.target.value)} style={s.input}>
            <option value="">All Severity</option>
            <option value="critical">Critical (&gt;30%)</option>
            <option value="high">High (10–30%)</option>
            <option value="low">Low (&lt;10%)</option>
          </select>
          {(filterAbc || filterXyz || filterSev) && (
            <button onClick={() => { setFilterAbc(''); setFilterXyz(''); setFilterSev(''); }}
              style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>
              Clear filters
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
            {candLoading ? 'Loading…' : `${candidates.length} SKU-location${candidates.length !== 1 ? 's' : ''} with shortage`}
          </span>
        </div>

        {/* Candidates table */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid var(--border)', gap: 8, background: 'rgba(27,58,107,0.03)' }}>
            <input type="checkbox"
              checked={candidates.length > 0 && selected.size === candidates.length}
              ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < candidates.length; }}
              onChange={toggleAll} style={{ cursor: 'pointer' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
              {selected.size > 0 ? `${selected.size} selected — configure lever above then click Simulate` : 'Select SKU-locations to simulate'}
            </span>
          </div>
          {candError && <div style={{ padding: 12, color: 'var(--danger)', fontSize: 12 }}>{candError}</div>}
          {!candError && !candLoading && candidates.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No shortages found for the current filters and week range
            </div>
          )}
          {candidates.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(27,58,107,0.04)' }}>
                    <th style={{ width: 36, padding: '6px 8px' }} />
                    {['SKU', 'Location', 'Plant / Line', 'ABC', 'XYZ', 'Shortage', 'Severity'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => {
                    const key  = `${c.sku}|${c.location_id}`;
                    const isSel = selected.has(key);
                    const chip  = SEV_CHIP[c.severity] || SEV_CHIP.low;
                    return (
                      <tr key={key} onClick={() => toggleRow(key)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', background: isSel ? 'rgba(27,58,107,0.06)' : i % 2 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleRow(key)} onClick={e => e.stopPropagation()} />
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{c.sku}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{c.location_name}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-2)', fontSize: 11, whiteSpace: 'nowrap' }}>{c.plant_name} / {c.line_name}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(27,58,107,0.1)', color: 'var(--navy-accent)' }}>{c.abc_class}</span>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(124,58,237,0.08)', color: '#7C3AED' }}>{c.xyz_class}</span>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>{fmtInt(c.total_shortage)}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: chip.bg, color: chip.color }}>
                            {c.severity} ({c.severityPct}%)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Simulation error */}
        {simError && (
          <div style={{ padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 12 }}>
            Simulation error: {simError}
          </div>
        )}

        {/* Results panel */}
        {simResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Summary bar */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>
                Simulation Results — {leverLabel[lever]}
                <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}>W{simResult.weekRange.start}–W{simResult.weekRange.end}</span>
              </div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Gap Before',  value: fmtInt(simResult.summary.totalGapBefore),  color: 'var(--danger)' },
                  { label: 'Total Gap After',   value: fmtInt(simResult.summary.totalGapAfter),   color: simResult.summary.gapReduction > 0 ? 'var(--green)' : 'var(--danger)' },
                  { label: 'Gap Reduction',     value: fmtInt(simResult.summary.gapReduction),    color: simResult.summary.gapReduction > 0 ? 'var(--green)' : 'var(--text-3)' },
                  { label: 'SKUs Improved',     value: `${simResult.summary.skusImproved} / ${simResult.rows.length}`, color: 'var(--navy-accent)' },
                  { label: 'Est. Cost Impact',  value: `₹${simResult.summary.totalCostImpact.toLocaleString()}`, color: 'var(--amber)' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-SKU results table */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(27,58,107,0.04)' }}>
                      {['SKU', 'Location', 'Gap Before', 'Gap After', 'Reduction', 'Svc Lvl Before', 'Svc Lvl After', 'Est. Cost', 'Note', 'Action'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {simResult.rows.map((row, i) => {
                      const key     = `${row.sku}|${row.locationId}`;
                      const apState = approvals[key] || 'idle';
                      const apErr   = apprErrors[key];
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid var(--border)', background: row.improved ? 'rgba(22,163,74,0.04)' : i % 2 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                          <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{row.sku}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{row.locationName}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>{fmtInt(row.before.totalShortage)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: row.improved ? 'var(--green)' : 'var(--danger)' }}>{fmtInt(row.after.totalShortage)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: row.gapReduction > 0 ? 'var(--green)' : 'var(--text-3)' }}>
                            {row.gapReduction > 0 ? `-${fmtInt(row.gapReduction)}` : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-2)' }}>{fmtPct(row.before.serviceLevel)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: row.improved ? 'var(--green)' : 'var(--text-2)' }}>{fmtPct(row.after.serviceLevel)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--amber)', whiteSpace: 'nowrap' }}>
                            {row.costImpact > 0 ? `₹${row.costImpact.toLocaleString()}` : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', color: row.note ? (row.improved ? 'var(--text-2)' : 'var(--text-3)') : 'var(--text-3)', fontSize: 11, maxWidth: 220 }}>
                            {row.note || ''}
                          </td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                            {apState === 'approved' ? (
                              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>✓ Approved</span>
                            ) : apState === 'error' ? (
                              <div>
                                <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>Failed</span>
                                {apErr && <div style={{ fontSize: 10, color: 'var(--danger)', maxWidth: 160 }}>{apErr}</div>}
                                <button onClick={() => handleApprove(row)}
                                  style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', marginTop: 3 }}>
                                  Retry
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleApprove(row)}
                                disabled={apState === 'loading' || !row.improved}
                                style={{
                                  fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', fontWeight: 700,
                                  cursor: row.improved && apState !== 'loading' ? 'pointer' : 'not-allowed',
                                  background: row.improved ? 'var(--navy-accent)' : 'var(--border)',
                                  color: row.improved ? 'white' : 'var(--text-3)',
                                }}>
                                {apState === 'loading' ? '…' : row.improved ? 'Approve' : 'No benefit'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
