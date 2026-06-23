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
  useState, useEffect, useRef, useLayoutEffect, useCallback,
} from 'react';
import {
  Layers, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import PlanningGrid, { MEASURE_GROUPS } from '../components/supply/PlanningGrid';
import { ActionButton, simulatedAction } from '../components/shared/ActionButton';
import { useToast } from '../context/ToastContext';

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

// ── Filter bar (§3.1) ─────────────────────────────────────────────────────────

function FilterBar({ options, filters, onChange }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={s.label}>Weeks</label>
        <input type="number" min={1} max={52} value={filters.weekStart}
          onChange={e => set('weekStart', Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
          style={{ ...s.input, width: 48 }} />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
        <input type="number" min={1} max={52} value={filters.weekEnd}
          onChange={e => set('weekEnd', Math.max(filters.weekStart, Math.min(52, parseInt(e.target.value) || 52)))}
          style={{ ...s.input, width: 48 }} />
      </div>
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
      {Object.entries(MEASURE_GROUPS).map(([key, grp]) => {
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

function ActionsPanel({ filterOptions, actionsMeta, metaError, filters, onActionComplete }) {
  const [ctx, setCtx] = useState({
    sku: '', locationId: '', weekNumber: String(filters.weekStart || 22),
    plantId: '', lineId: '', componentId: '', supplierId: '',
  });
  const [openSection, setOpenSection] = useState('increase');
  const [deltaQty,   setDeltaQty]   = useState(100);
  const [pullFrom,   setPullFrom]   = useState(filters.weekStart);
  const [pullTo,     setPullTo]     = useState(Math.max(1, (filters.weekStart || 22) - 1));
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
    scenarioId: 1, weekStart: 1, weekEnd: 52,
    region: '', plant: '', skuFamily: '', sku: '',
  });
  const [rows,       setRows]       = useState([]);
  const [weeks,      setWeeks]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [kpis,       setKpis]       = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [measureGroup, setMeasureGroup] = useState('demand');
  const [showActions,  setShowActions]  = useState(false);

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
        `Production updated: W${week} ${row.sku} → ${Math.round(newValue).toLocaleString('en-IN')} units`,
        'success',
      );
      refreshAll();
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
  }, [showToast, refreshAll]);

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

      {/* §3.1 Filter bar */}
      <FilterBar options={filterOptions} filters={filters} onChange={setFilters} />

      {/* §3.2 KPI strip */}
      <SupplyKPIStrip kpis={kpis} loading={kpiLoading} />

      {/* Measure tabs + Actions toggle */}
      <MeasureGroupTabs
        value={measureGroup} onChange={setMeasureGroup}
        showActions={showActions} onToggleActions={() => setShowActions(v => !v)}
      />

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '8px 16px', background: 'var(--danger-bg)',
          borderBottom: '1px solid var(--danger)', fontSize: 12,
          color: 'var(--danger)', flexShrink: 0,
        }}>
          Error loading data: {error}
        </div>
      )}

      {/* §3.3 Grid + §3.4 Actions panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div ref={gridContainerRef} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <PlanningGrid
            rows={rows} weeks={weeks} measureGroup={measureGroup}
            loading={loading} height={gridDims.height} width={gridDims.width}
            onCellEdit={handleCellEdit}
          />
        </div>
        {showActions && (
          <ActionsPanel
            filterOptions={filterOptions}
            actionsMeta={actionsMeta}
            metaError={metaError}
            filters={filters}
            onActionComplete={handleActionComplete}
          />
        )}
      </div>
    </div>
  );
}

// ── Shared micro-styles ───────────────────────────────────────────────────────

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
