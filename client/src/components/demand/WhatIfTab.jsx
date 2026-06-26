/**
 * WhatIfTab — What-If scenario planning for Demand Planning workbench.
 *
 * Three sliders applied to the base forecast (final_consensus) for a selected
 * SKU-location over the forward weeks (27–52):
 *
 *   1. Promotion discount (0–50 %)
 *      promoLift_w = baseVol_w × d × 1.7 × m
 *      (1 % discount → 1.7 % volume lift; 10 % off ≈ 17 % lift)
 *
 *   2. Price change (−20 % to +20 %)
 *      priceLift_w = baseVol_w × (−2.0) × p
 *      (own-price elasticity −2.0 for durable appliances, cited range −1.5 to −2.5)
 *
 *   3. Marketing spend multiplier (0.5 ×–2.0 ×, default 1.0 ×)
 *      Scales the promotion lift only. Has NO effect when discount = 0.
 *
 * Apply Scenario writes computed Planner Adjustments to the DB via the same
 * PATCH /api/demand-planning/grid/adjustment endpoint the Forecast Grid uses.
 * Formula: new_planner_adjustment = scenarioVolume − systemForecast (per week)
 * All-or-nothing: on any PATCH failure the already-written weeks are rolled back
 * using the captured "before" values (plannerAdjustment = baseVolume − systemForecast).
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRelWeek(w) {
  if (w < 24)   return `M${w}`;
  if (w === 24) return 'Current Month';
  return `M+${w - 24}`;
}

function fmtINR(v) {
  if (v == null) return '—';
  const abs  = Math.abs(v);
  const sign = v < 0 ? '−' : '+';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function fmtINRPlain(v) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(abs / 1e7).toFixed(1)} Cr`;
  if (abs >= 1e5) return `₹${(abs / 1e5).toFixed(1)} L`;
  return `₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function fmtVol(v) {
  if (v == null) return '—';
  const abs  = Math.abs(v);
  const sign = v < 0 ? '−' : '+';
  return `${sign}${Math.round(abs).toLocaleString('en-IN')}`;
}

// ── ScenarioSlider ─────────────────────────────────────────────────────────────

function ScenarioSlider({ label, value, min, max, step, onChange, displayValue, assumption, note, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>{label}</span>
        <span style={{
          fontSize: 14, fontWeight: 700, color: 'var(--navy-accent)',
          fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right',
        }}>
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => !disabled && onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{ width: '100%', accentColor: 'var(--navy-accent)', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)' }}>
        <span>{min > 0 ? `${min}%` : min === 0 ? '0%' : `${min}%`}</span>
        <span>{max > 1 && Number.isInteger(max) ? `${max}%` : `${max}×`}</span>
      </div>
      {assumption && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.4 }}>
          {assumption}
        </div>
      )}
      {note && (
        <div style={{
          fontSize: 10, color: '#B45309',
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 4, padding: '3px 7px', lineHeight: 1.4, marginTop: 1,
        }}>
          {note}
        </div>
      )}
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const base = payload.find(p => p.dataKey === 'baseVolume');
  const scen = payload.find(p => p.dataKey === 'scenarioVolume');
  return (
    <div style={{
      background: 'white', border: '1px solid #E5E7EB',
      borderRadius: 8, padding: '8px 12px', fontSize: 11,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Month {label}</div>
      {base && (
        <div style={{ color: '#1D4ED8' }}>
          Base: {Math.round(base.value).toLocaleString('en-IN')} units
        </div>
      )}
      {scen && (
        <div style={{ color: '#D97706' }}>
          Scenario: {Math.round(scen.value).toLocaleString('en-IN')} units
        </div>
      )}
      {base && scen && (
        <div style={{
          marginTop: 3, paddingTop: 3, borderTop: '1px solid #F3F4F6',
          color: scen.value >= base.value ? '#16A34A' : '#DC2626', fontWeight: 700,
        }}>
          Δ {fmtVol(scen.value - base.value)}
        </div>
      )}
    </div>
  );
}

// ── Impact KPI chip ───────────────────────────────────────────────────────────

function ImpactKpi({ label, value, valueStr, pct }) {
  const isZero = value === 0;
  const color  = isZero ? '#6B7280' : value > 0 ? '#16A34A' : '#DC2626';
  const bg     = isZero ? '#F3F4F6' : value > 0 ? '#DCFCE7' : '#FEE2E2';
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md, 10px)', padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
        textTransform: 'uppercase', color: 'var(--text-3)' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
        {valueStr}
      </span>
      {pct != null && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: bg, color,
          padding: '1px 7px', borderRadius: 6, alignSelf: 'flex-start',
        }}>
          {pct > 0 ? '+' : ''}{pct}%
        </span>
      )}
    </div>
  );
}

// ── PresetChip ────────────────────────────────────────────────────────────────

function PresetChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
        border: `1px solid ${active ? '#1D4ED8' : 'var(--border)'}`,
        background: active ? '#EFF3FF' : 'var(--bg)',
        color: active ? '#1D4ED8' : 'var(--text-2)',
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  );
}

// ── WeekRangeSelector ─────────────────────────────────────────────────────────

function WeekRangeSelector({ result, preset, onPreset, customFrom, customTo, onCustomFrom, onCustomTo }) {
  const weeks    = result?.weeks || [];
  const firstWk  = weeks[0]?.weekNumber ?? 27;
  const lastWk   = weeks[weeks.length - 1]?.weekNumber ?? 52;
  const wk13end  = weeks[12]?.weekNumber;
  const wk4end   = weeks[3]?.weekNumber;

  const presets = [
    { id: 'all',    label: `All ${weeks.length} months (${firstWk}–${lastWk})` },
    wk13end ? { id: '13', label: `Months ${firstWk}–${wk13end} (13 mo)` } : null,
    wk4end  ? { id: '4',  label: `Months ${firstWk}–${wk4end} (4 mo)`   } : null,
    { id: 'custom', label: 'Custom range' },
  ].filter(Boolean);

  const selectStyle = {
    fontSize: 11, padding: '3px 7px', borderRadius: 5,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text-1)', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
        textTransform: 'uppercase', color: 'var(--text-3)' }}>
        Apply to months
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {presets.map(p => (
          <PresetChip key={p.id} label={p.label} active={preset === p.id} onClick={() => onPreset(p.id)} />
        ))}
      </div>
      {preset === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>From</span>
          <select value={customFrom} onChange={e => onCustomFrom(parseInt(e.target.value))} style={selectStyle}>
            {weeks.map(w => (
              <option key={w.weekNumber} value={w.weekNumber}>{toRelWeek(w.weekNumber)}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>To</span>
          <select value={customTo} onChange={e => onCustomTo(parseInt(e.target.value))} style={selectStyle}>
            {weeks.filter(w => w.weekNumber >= customFrom).map(w => (
              <option key={w.weekNumber} value={w.weekNumber}>{toRelWeek(w.weekNumber)}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({ result, selectedWeeks, selectedImpact, onConfirm, onCancel }) {
  if (!selectedWeeks.length || !result) return null;
  const firstWk = selectedWeeks[0].weekNumber;
  const lastWk  = selectedWeeks[selectedWeeks.length - 1].weekNumber;
  const n       = selectedWeeks.length;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'white', borderRadius: 12, padding: 24,
        maxWidth: 460, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
          Apply Scenario to Forecast Grid
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ConfirmRow label="SKU"             value={result.sku.replace(/_/g, ' ')} />
          <ConfirmRow label="Location"        value={result.locationName} />
          <ConfirmRow label="Months"           value={`${firstWk}–${lastWk}  (${n} month${n !== 1 ? 's' : ''})`} />
          <ConfirmRow
            label="Volume impact"
            value={`${selectedImpact.volumeImpact >= 0 ? '+' : ''}${selectedImpact.volumeImpact.toLocaleString('en-IN')} units (${selectedImpact.volumeImpactPct >= 0 ? '+' : ''}${selectedImpact.volumeImpactPct}%)`}
          />
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6 }}>
          For each selected month, Planner Adjustment will be set to:
          <br /><strong>Scenario Volume − System Forecast</strong>
        </div>

        <div style={{
          fontSize: 11, color: '#92400E', background: '#FFFBEB',
          border: '1px solid #FDE68A', borderRadius: 6, padding: '8px 12px',
          lineHeight: 1.6,
        }}>
          ⚠ This will <strong>OVERWRITE</strong> any existing Planner Adjustment values
          in months {firstWk}–{lastWk}, including manual edits made directly in the Forecast Grid.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text-2)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 6,
              border: 'none',
              background: '#1D4ED8', color: 'white',
              cursor: 'pointer',
            }}
          >
            Apply {n} month{n !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', width: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>{value}</span>
    </div>
  );
}

// ── WhatIfTab ─────────────────────────────────────────────────────────────────

export default function WhatIfTab({ filterOptions, lockedFilter, onApplyComplete }) {
  // Scenario slider state
  const [selectedSku,   setSelectedSku]   = useState('');
  const [selectedLoc,   setSelectedLoc]   = useState(() =>
    lockedFilter?.field === 'locationId' ? lockedFilter.value : ''
  );
  const [discount,      setDiscount]      = useState(0);    // integer 0–50 (%)
  const [priceChange,   setPriceChange]   = useState(0);    // integer −20–+20 (%)
  const [marketingMult, setMarketingMult] = useState(1.0);  // float 0.5–2.0
  const [result,        setResult]        = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const abortRef = useRef(null);

  // Apply Scenario state
  const [weekRangePreset, setWeekRangePreset] = useState('all');
  const [customFrom,      setCustomFrom]      = useState(27);
  const [customTo,        setCustomTo]        = useState(52);
  // applyPhase: 'idle' | 'confirm' | 'applying' | 'rollingback' | 'success' | 'error'
  const [applyPhase,    setApplyPhase]    = useState('idle');
  const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0 });
  const [applyError,    setApplyError]    = useState('');
  const [appliedCount,  setAppliedCount]  = useState(0);

  const hasSelection   = selectedSku !== '' && selectedLoc !== '';
  const willHaveImpact = discount !== 0 || priceChange !== 0;
  const isApplying     = applyPhase === 'applying' || applyPhase === 'rollingback';
  // Lock selectors during confirm dialog AND during the write/rollback — prevents
  // SKU/location from changing after the user has reviewed and clicked "Apply N weeks"
  const isLocked       = isApplying || applyPhase === 'confirm';

  // ── Derived: selected weeks from result + range preset ──

  const selectedWeeks = useMemo(() => {
    if (!result?.weeks) return [];
    const ws = result.weeks;
    if (weekRangePreset === '4')  return ws.slice(0, 4);
    if (weekRangePreset === '13') return ws.slice(0, 13);
    if (weekRangePreset === 'all') return ws;
    return ws.filter(w => w.weekNumber >= customFrom && w.weekNumber <= customTo);
  }, [result, weekRangePreset, customFrom, customTo]);

  const selectedImpact = useMemo(() => {
    if (!selectedWeeks.length) return { volumeImpact: 0, revenueImpact: 0, volumeImpactPct: 0 };
    const baseVol = selectedWeeks.reduce((s, w) => s + w.baseVolume,      0);
    const scenVol = selectedWeeks.reduce((s, w) => s + w.scenarioVolume,  0);
    const baseRev = selectedWeeks.reduce((s, w) => s + w.baseRevenue,     0);
    const scenRev = selectedWeeks.reduce((s, w) => s + w.scenarioRevenue, 0);
    return {
      volumeImpact:    scenVol - baseVol,
      revenueImpact:   scenRev - baseRev,
      volumeImpactPct: baseVol > 0 ? +((scenVol - baseVol) / baseVol * 100).toFixed(1) : 0,
    };
  }, [selectedWeeks]);

  // ── Effects ──

  // Simulate API call with debounce + AbortController
  useEffect(() => {
    if (!hasSelection || !willHaveImpact) {
      setResult(null);
      setLoading(false);
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/demand-planning/whatif', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku:                 selectedSku,
            locationId:          parseInt(selectedLoc),
            promotionDiscount:   discount / 100,
            priceChange:         priceChange / 100,
            marketingMultiplier: marketingMult,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.status); }
        const data = await res.json();
        if (!ctrl.signal.aborted) { setResult(data); setError(null); }
      } catch (err) {
        if (err.name !== 'AbortError' && !ctrl.signal.aborted) setError(err.message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [selectedSku, selectedLoc, discount, priceChange, marketingMult]); // eslint-disable-line

  // Reset apply state when SKU/location changes
  useEffect(() => {
    setWeekRangePreset('all');
    setApplyPhase(p => (p === 'applying' || p === 'rollingback') ? p : 'idle');
    setApplyError('');
  }, [selectedSku, selectedLoc]);

  // Sync custom range endpoints when result week list changes
  useEffect(() => {
    if (result?.weeks?.length) {
      setCustomFrom(result.weeks[0].weekNumber);
      setCustomTo(result.weeks[result.weeks.length - 1].weekNumber);
    }
  }, [result]);

  // Close confirm dialog if scenario inputs change while it's open
  useEffect(() => {
    if (applyPhase === 'confirm') setApplyPhase('idle');
  }, [discount, priceChange, marketingMult, selectedSku, selectedLoc]); // eslint-disable-line

  // ── Handlers ──

  const handleReset = () => {
    setDiscount(0);
    setPriceChange(0);
    setMarketingMult(1.0);
    setResult(null);
    setError(null);
    setWeekRangePreset('all');
    if (applyPhase !== 'applying' && applyPhase !== 'rollingback') {
      setApplyPhase('idle');
      setApplyError('');
    }
  };

  const openConfirm  = () => setApplyPhase('confirm');
  const closeConfirm = () => setApplyPhase('idle');

  const handleApply = async () => {
    if (!result || !selectedWeeks.length) return;

    // Snapshot "before" values: current planner_adjustment = final_consensus − system_forecast
    const before = selectedWeeks.map(w => ({
      weekNumber:        w.weekNumber,
      plannerAdjustment: w.baseVolume - (w.systemForecast ?? w.baseVolume),
    }));

    setApplyPhase('applying');
    setApplyProgress({ done: 0, total: selectedWeeks.length });

    const written = []; // entries from `before[]` for weeks already successfully written

    for (let i = 0; i < selectedWeeks.length; i++) {
      const w      = selectedWeeks[i];
      const newAdj = w.scenarioVolume - (w.systemForecast ?? 0);

      try {
        const res = await fetch('/api/demand-planning/grid/adjustment', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku:               result.sku,
            locationId:        parseInt(selectedLoc),
            weekNumber:        w.weekNumber,
            plannerAdjustment: newAdj,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const body = await res.json();
        // Verify the DB actually reflects what we sent — catches any silent mismatch
        if (!body.success || body.updated?.marketingAdjustment !== newAdj) {
          throw new Error(
            `Month ${w.weekNumber}: server confirmed marketingAdjustment=${body.updated?.marketingAdjustment}, expected ${newAdj}`
          );
        }
        written.push(before[i]);
        setApplyProgress({ done: i + 1, total: selectedWeeks.length });
      } catch (err) {
        // Apply failed — roll back every week already written
        setApplyPhase('rollingback');
        setApplyProgress({ done: 0, total: written.length });
        let rollbackFailed = false;

        for (let ri = 0; ri < written.length; ri++) {
          const wb = written[ri];
          try {
            const rb = await fetch('/api/demand-planning/grid/adjustment', {
              method:  'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sku:               result.sku,
                locationId:        parseInt(selectedLoc),
                weekNumber:        wb.weekNumber,
                plannerAdjustment: wb.plannerAdjustment,
              }),
            });
            if (!rb.ok) throw new Error('rollback failed');
            setApplyProgress({ done: ri + 1, total: written.length });
          } catch {
            rollbackFailed = true;
          }
        }

        setApplyPhase('error');
        if (rollbackFailed && written.length > 0) {
          const rbEnd = written[written.length - 1].weekNumber;
          setApplyError(
            `Apply failed at month ${w.weekNumber} and rollback could not complete. ` +
            `Months ${selectedWeeks[0].weekNumber}–${rbEnd} may be inconsistent — ` +
            `please refresh the Forecast Grid to check.`
          );
        } else {
          setApplyError(
            written.length > 0
              ? `Apply failed at month ${w.weekNumber} — all changes were rolled back. Please try again.`
              : `Apply failed at month ${w.weekNumber} — no changes were made. Please try again.`
          );
        }
        return;
      }
    }

    // All weeks written successfully
    setAppliedCount(selectedWeeks.length);
    setApplyPhase('success');
    onApplyComplete?.();

    // Reset sliders after 3s (clears result via useEffect when willHaveImpact → false)
    setTimeout(() => {
      setDiscount(0);
      setPriceChange(0);
      setMarketingMult(1.0);
      setWeekRangePreset('all');
      setApplyPhase('idle');
      setApplyError('');
    }, 3000);
  };

  const locations = filterOptions?.locations || [];
  const skus = useMemo(() => {
    const all = filterOptions?.skus || [];
    if (lockedFilter?.field === 'skuFamily')
      return all.filter(s => s.category === lockedFilter.value);
    return all;
  }, [filterOptions, lockedFilter]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Selector row + Reset */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 10px)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <SelectorField
          label="SKU"
          value={selectedSku}
          onChange={v => { setSelectedSku(v); setResult(null); }}
          disabled={isLocked}
        >
          <option value="">— Select SKU —</option>
          {skus.map(s => (
            <option key={s.sku} value={s.sku}>{s.sku.replace(/_/g, ' ')}</option>
          ))}
        </SelectorField>

        {lockedFilter?.field === 'locationId' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Branch</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{lockedFilter.label}</span>
          </div>
        ) : (
          <SelectorField
            label="Branch"
            value={selectedLoc}
            onChange={v => { setSelectedLoc(v); setResult(null); }}
            disabled={isLocked}
          >
            <option value="">— Select Branch —</option>
            {locations.map(l => (
              <option key={l.locationId} value={l.locationId}>{l.name}</option>
            ))}
          </SelectorField>
        )}

        <span style={{ flex: 1 }} />

        <button
          onClick={handleReset}
          disabled={isApplying}
          style={{
            fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text-2)', cursor: isApplying ? 'not-allowed' : 'pointer',
            opacity: isApplying ? 0.4 : (!willHaveImpact && marketingMult === 1.0) ? 0.4 : 1,
          }}
        >
          Reset to Base Forecast
        </button>
      </div>

      {/* Main two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left panel: sliders ── */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md, 10px)', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: -6 }}>
            Scenario Inputs
          </div>

          <ScenarioSlider
            label="Promotion Discount"
            value={discount}
            min={0} max={50} step={1}
            onChange={setDiscount}
            displayValue={`${discount}%`}
            assumption="Each 1% discount → 1.7% volume lift (10% off ≈ 17% lift; durable-goods empirical range 15–20%)"
            disabled={isApplying}
          />

          <ScenarioSlider
            label="Price Change"
            value={priceChange}
            min={-20} max={20} step={1}
            onChange={setPriceChange}
            displayValue={`${priceChange > 0 ? '+' : ''}${priceChange}%`}
            assumption="Price elasticity −2.0 (1% price drop → ~2% volume increase; own-price, durable appliances; cited range −1.5 to −2.5)"
            disabled={isApplying}
          />

          <ScenarioSlider
            label="Marketing Spend Multiplier"
            value={marketingMult}
            min={0.5} max={2.0} step={0.1}
            onChange={v => setMarketingMult(+v.toFixed(1))}
            displayValue={`${marketingMult.toFixed(1)}×`}
            assumption={null}
            note={
              discount === 0
                ? 'Marketing spend scales promotion impact — has no effect without an active discount'
                : null
            }
            disabled={isApplying}
          />
        </div>

        {/* ── Right panel: results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Results or empty/loading/error states */}
          {!hasSelection ? (
            <EmptyState
              icon="📊"
              headline="Select a SKU and Branch to begin"
              sub="Choose a SKU-location above, then adjust the scenario sliders."
            />
          ) : !willHaveImpact ? (
            <EmptyState
              icon="⟳"
              headline="No scenario applied"
              sub="Adjust the Promotion Discount or Price Change slider to see the forecast diverge from base."
            />
          ) : loading ? (
            <EmptyState icon="⟳" headline="Calculating…" sub="" spin />
          ) : error ? (
            <EmptyState icon="!" headline="Simulation failed" sub={error} isError />
          ) : result ? (
            <ResultsPanel result={result} />
          ) : null}

          {/* ── Apply Scenario section ── visible when scenario active + not in-flight */}
          {result && !isApplying && applyPhase !== 'success' && (
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md, 10px)', padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <WeekRangeSelector
                result={result}
                preset={weekRangePreset}
                onPreset={setWeekRangePreset}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFrom={setCustomFrom}
                onCustomTo={setCustomTo}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                {applyPhase === 'error' && (
                  <span style={{ fontSize: 11, color: '#DC2626', flex: 1 }}>
                    {applyError}
                    <button
                      onClick={() => setApplyError('') || setApplyPhase('idle')}
                      style={{
                        marginLeft: 8, fontSize: 10, color: '#DC2626', background: 'none',
                        border: 'none', cursor: 'pointer', textDecoration: 'underline',
                      }}
                    >
                      Dismiss
                    </button>
                  </span>
                )}
                <button
                  onClick={openConfirm}
                  disabled={selectedWeeks.length === 0}
                  style={{
                    fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 6,
                    border: 'none',
                    background: selectedWeeks.length ? '#1D4ED8' : '#E5E7EB',
                    color: selectedWeeks.length ? 'white' : '#9CA3AF',
                    cursor: selectedWeeks.length ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                >
                  Apply Scenario…
                </button>
              </div>
            </div>
          )}

          {/* Progress banner — shown during apply + rollback */}
          {isApplying && (
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md, 10px)', padding: '16px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 22, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
                  {applyPhase === 'applying'
                    ? `Applying… (${applyProgress.done} / ${applyProgress.total} months)`
                    : `Rolling back… (${applyProgress.done} / ${applyProgress.total} months)`}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {applyPhase === 'applying'
                    ? 'Do not close this tab.'
                    : 'Restoring previous Planner Adjustment values.'}
                </span>
              </div>
            </div>
          )}

          {/* Success banner */}
          {applyPhase === 'success' && (
            <div style={{
              background: '#DCFCE7', border: '1px solid #86EFAC',
              borderRadius: 'var(--radius-md, 10px)', padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20, color: '#16A34A' }}>✓</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>
                  Scenario applied to {appliedCount} month{appliedCount !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: 10, color: '#166534' }}>
                  Planner Adjustments updated · Forecast Grid shows new values on next tab visit · Resetting in 3 s…
                </span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Confirmation modal — fixed overlay */}
      {applyPhase === 'confirm' && (
        <ConfirmDialog
          result={result}
          selectedWeeks={selectedWeeks}
          selectedImpact={selectedImpact}
          onConfirm={handleApply}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SelectorField({ label, value, onChange, children, disabled }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
        textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--bg)',
          color: value ? 'var(--text-1)' : 'var(--text-3)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {children}
      </select>
    </label>
  );
}

function EmptyState({ icon, headline, sub, spin, isError }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md, 10px)', padding: '40px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, minHeight: 200,
    }}>
      <span style={{
        fontSize: 28, opacity: 0.5,
        ...(spin && { animation: 'spin 1.2s linear infinite', display: 'inline-block' }),
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: isError ? '#DC2626' : 'var(--text-2)' }}>
        {headline}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', maxWidth: 360 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function ResultsPanel({ result }) {
  const { summary, weeks, locationName, sku, unitPrice } = result;

  return (
    <>
      {/* Header: SKU · Location · unit price */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 10px)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
          {sku.replace(/_/g, ' ')}
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{locationName}</span>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Unit price: {fmtINRPlain(unitPrice)}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
          Current horizon
        </span>
      </div>

      {/* Impact KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ImpactKpi
          label="Volume Impact (26 mo)"
          value={summary.volumeImpact}
          valueStr={fmtVol(summary.volumeImpact)}
          pct={summary.volumeImpactPct}
        />
        <ImpactKpi
          label="Revenue Impact (26 mo)"
          value={summary.revenueImpact}
          valueStr={fmtINR(summary.revenueImpact)}
          pct={summary.baseRevenue > 0
            ? +((summary.revenueImpact / summary.baseRevenue) * 100).toFixed(1)
            : 0}
        />
      </div>

      {/* Chart: Base vs Scenario */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 10px)', padding: '12px 14px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
          Base Forecast vs Scenario — Monthly Volume
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weeks} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="weekNumber"
              tick={{ fontSize: 10 }}
              tickFormatter={v => v < 24 ? `W${v}` : v === 24 ? 'Now' : `+${v - 24}w`}
              interval={3}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              width={48}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              verticalAlign="top"
              wrapperStyle={{ fontSize: 11, paddingBottom: 6 }}
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="baseVolume"
              name="Base Forecast"
              stroke="#1D4ED8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="scenarioVolume"
              name="Scenario"
              stroke="#D97706"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Base totals footnote */}
      <div style={{ fontSize: 10, color: 'var(--text-3)', paddingLeft: 2 }}>
        Base total (current horizon):&nbsp;
        {summary.baseVolume.toLocaleString('en-IN')} units ·&nbsp;
        {fmtINRPlain(summary.baseRevenue)} revenue
      </div>
    </>
  );
}
