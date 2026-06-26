/**
 * DisaggregateTab — category-level demand disaggregation.
 *
 * A planner enters a total adjustment and selects target months.
 * The tool distributes the total down to SKU × branch × month using
 * real historical sales patterns as weights (3-stage proportional split):
 *   Stage 1: category → SKUs  (by actual_sales history, weeks 1–23)
 *   Stage 2: SKU → branches   (by SKU-branch history, weeks 1–23)
 *   Stage 3: branch → months  (by system_forecast for target weeks)
 *
 * Preview is read-only. Apply adds to planner_adjustment and
 * recalculates final_consensus for every affected row.
 *
 * Persona access:
 *   Category Manager — tab visible, category locked (no picker)
 *   Demand Planner   — tab visible, category dropdown
 *   Branch Manager   — tab NOT shown (filtered in Sidebar)
 */
import React, { useState, useCallback, useMemo } from 'react';
import { usePersona } from '../../context/PersonaContext';

// 1 chip = 1 planning period = 1 week_number, matching the grid/WhatIf +NM convention.
// +NM chip sends offset N; server maps to week EDITABLE_FROM_WEEK + N (24 + N).
// +1M = wk 25, +2M = wk 26, …, +12M = wk 36.
const PLANNING_MONTHS = Array.from({ length: 12 }, (_, i) => ({ num: i + 1, label: `+${i + 1}M` }));

function fmtSplit(n) {
  if (n === 0) return '0';
  return `${n > 0 ? '+' : ''}${n.toLocaleString('en-IN')}`;
}

const TH = ({ children, align = 'left', minWidth }) => (
  <th style={{
    padding: '7px 12px',
    textAlign: align,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    color: 'var(--text-3)',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    background: '#F8FAFC',
    ...(minWidth ? { minWidth } : {}),
  }}>
    {children}
  </th>
);

export default function DisaggregateTab({ filterOptions, lockedFilter, onApplyComplete }) {
  const { persona } = usePersona();
  const role = persona?.role ?? 'planner';
  const isCatMgr = role === 'category_manager';

  const categoryLocked = lockedFilter?.field === 'skuFamily';
  const [category, setCategory]         = useState(categoryLocked ? lockedFilter.value : '');
  const [totalAdj, setTotalAdj]         = useState('');
  const [targetMonths, setTargetMonths] = useState(new Set([2]));
  const [preview, setPreview]           = useState(null);
  const [loading, setLoading]           = useState(null); // 'preview' | 'apply'
  const [applied, setApplied]           = useState(false);
  const [error, setError]               = useState(null);
  const [expandedSkus, setExpandedSkus] = useState(new Set());

  const categories = filterOptions?.skuFamilies ?? [];
  const totalAdjNum = parseInt(totalAdj, 10);
  const canPreview  = category && !isNaN(totalAdjNum) && totalAdjNum !== 0 && targetMonths.size > 0;
  const sortedMonths = useMemo(() => [...targetMonths].sort((a, b) => a - b), [targetMonths]);
  const selectedMonthDefs = PLANNING_MONTHS.filter(m => targetMonths.has(m.num));

  const resetPreview = () => { setPreview(null); setApplied(false); setError(null); };

  const toggleMonth = (m) => {
    setTargetMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) {
        if (next.size === 1) return prev; // keep at least one selected
        next.delete(m);
      } else {
        next.add(m);
      }
      return next;
    });
    resetPreview();
  };

  // Group preview rows by SKU for the collapsible table
  const skuGroups = useMemo(() => {
    if (!preview) return [];
    const map = new Map();
    for (const row of preview.rows) {
      if (!map.has(row.sku)) map.set(row.sku, []);
      map.get(row.sku).push(row);
    }
    return [...map.entries()].map(([sku, rows]) => {
      const skuMonthlyTotals = {};
      for (const r of rows) {
        for (const m of sortedMonths) {
          skuMonthlyTotals[m] = (skuMonthlyTotals[m] || 0) + (r.monthlyAmounts[m] || 0);
        }
      }
      return { sku, rows, skuMonthlyTotals };
    });
  }, [preview, sortedMonths]);

  const handlePreview = useCallback(async () => {
    setLoading('preview');
    setError(null);
    setPreview(null);
    setApplied(false);
    setExpandedSkus(new Set());
    try {
      const res = await fetch('/api/demand-planning/disaggregate/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, totalAdjustment: totalAdjNum, targetMonths: sortedMonths }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Preview failed (${res.status})`);
      setPreview(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }, [category, totalAdjNum, sortedMonths]);

  const handleApply = useCallback(async () => {
    if (!preview) return;
    setLoading('apply');
    setError(null);
    try {
      const res = await fetch('/api/demand-planning/disaggregate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, totalAdjustment: totalAdjNum, targetMonths: sortedMonths, role }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Apply failed');
      setApplied(true);
      setPreview(null);
      onApplyComplete?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }, [preview, category, totalAdjNum, sortedMonths, role, onApplyComplete]);

  const toggleSku = (sku) => {
    setExpandedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
  };

  const inputStyle = {
    fontSize: 12, padding: '5px 9px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text-1)',
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
    textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1040, minHeight: 0 }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
          Demand Disaggregation
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55 }}>
          Enter a category-level adjustment and select target months. The split is calculated
          automatically — SKUs weighted by their historical share, branches weighted by their
          SKU-specific history, and months weighted by the current seasonal forecast pattern.
        </p>
      </div>

      {/* Input card */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18,
      }}>

        {/* Row 1: Category · Adjustment · Preview */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={labelStyle}>Category</span>
            {categoryLocked
              ? (
                <div style={{
                  ...inputStyle,
                  fontWeight: 600, minWidth: 170,
                  background: 'var(--blue-bg)',
                }}>
                  {lockedFilter.label}
                </div>
              )
              : (
                <select
                  value={category}
                  onChange={e => { setCategory(e.target.value); resetPreview(); }}
                  style={{ ...inputStyle, minWidth: 210, cursor: 'pointer' }}
                >
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )
            }
          </div>

          {/* Adjustment */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={labelStyle}>Adjustment (units)</span>
            <input
              type="number"
              value={totalAdj}
              onChange={e => { setTotalAdj(e.target.value); resetPreview(); }}
              placeholder="+500 or −200"
              style={{ ...inputStyle, width: 150, fontVariantNumeric: 'tabular-nums' }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>Negative values reduce forecast</span>
          </div>

          {/* Preview button */}
          <button
            onClick={handlePreview}
            disabled={!canPreview || loading !== null}
            style={{
              padding: '7px 22px', fontSize: 12, fontWeight: 700, borderRadius: 7,
              border: 'none', alignSelf: 'flex-end', marginBottom: 0,
              cursor: canPreview && !loading ? 'pointer' : 'default',
              background: canPreview && !loading ? 'var(--navy-accent)' : '#CBD5E1',
              color: canPreview && !loading ? 'white' : '#64748B',
            }}
          >
            {loading === 'preview' ? 'Calculating…' : 'Preview Split'}
          </button>
        </div>

        {/* Row 2: Month chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>Target Months</span>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {PLANNING_MONTHS.map(m => {
              const sel = targetMonths.has(m.num);
              return (
                <button
                  key={m.num}
                  onClick={() => toggleMonth(m.num)}
                  style={{
                    padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${sel ? 'var(--navy-accent)' : 'var(--border)'}`,
                    background: sel ? 'var(--navy-accent)' : 'var(--bg)',
                    color: sel ? 'white' : 'var(--text-2)',
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
            Select one or more planning periods · +1M = next period, +2M = two ahead, etc. · Matches grid column labels exactly
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 12,
          background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)',
        }}>
          {error}
        </div>
      )}

      {/* Apply success */}
      {applied && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: '#F0FDF4', border: '1px solid #86EFAC', color: '#15803D',
        }}>
          Adjustment applied — {isCatMgr ? 'Category Adj' : 'Planner Adj'} and Final Consensus updated for all affected rows.
          Switch to the Forecast Grid to see the updated values.
        </div>
      )}

      {/* Preview table */}
      {preview && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>

          {/* Preview header bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 16px', background: '#F0F4FF', borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                Split Preview
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Total entered: <strong>{fmtSplit(preview.totalEntered)}</strong> units ·
                Allocated: <strong>{fmtSplit(preview.totalAllocated)}</strong> units
              </span>
              {preview.totalAllocated !== preview.totalEntered && (
                <span style={{ fontSize: 11, color: '#B45309' }}>
                  (±{Math.abs(preview.totalAllocated - preview.totalEntered)} rounding residual)
                </span>
              )}
            </div>
            <button
              onClick={handleApply}
              disabled={loading === 'apply'}
              style={{
                padding: '7px 22px', fontSize: 12, fontWeight: 700, borderRadius: 7,
                border: 'none', cursor: loading === 'apply' ? 'default' : 'pointer',
                background: loading === 'apply' ? '#CBD5E1' : '#16A34A',
                color: loading === 'apply' ? '#64748B' : 'white',
              }}
            >
              {loading === 'apply' ? 'Applying…' : 'Apply Disaggregation'}
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <TH minWidth={240}>SKU / Branch</TH>
                  {selectedMonthDefs.map(m => <TH key={m.num} align="right">{m.label}</TH>)}
                  <TH align="right">Total</TH>
                </tr>
              </thead>
              <tbody>
                {skuGroups.map(({ sku, rows, skuMonthlyTotals }) => {
                  const expanded = expandedSkus.has(sku);
                  const skuTotal = Object.values(skuMonthlyTotals).reduce((s, v) => s + v, 0);
                  return (
                    <React.Fragment key={sku}>
                      {/* SKU aggregate row — click to expand branches */}
                      <tr
                        onClick={() => toggleSku(sku)}
                        style={{ background: '#EFF2F7', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#E4E9F2'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#EFF2F7'; }}
                      >
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-1)' }}>
                          <span style={{ fontSize: 10, marginRight: 7, opacity: 0.6 }}>
                            {expanded ? '▼' : '▶'}
                          </span>
                          {sku.replace(/_/g, ' ')}
                          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, marginLeft: 8 }}>
                            {rows.length} {rows.length === 1 ? 'branch' : 'branches'}
                          </span>
                        </td>
                        {selectedMonthDefs.map(m => {
                          const v = skuMonthlyTotals[m.num] || 0;
                          return (
                            <td key={m.num} style={{
                              padding: '8px 12px', textAlign: 'right', fontWeight: 700,
                              color: v > 0 ? '#16A34A' : v < 0 ? '#DC2626' : 'var(--text-3)',
                            }}>
                              {fmtSplit(v)}
                            </td>
                          );
                        })}
                        <td style={{
                          padding: '8px 12px', textAlign: 'right', fontWeight: 700,
                          color: skuTotal > 0 ? '#16A34A' : skuTotal < 0 ? '#DC2626' : 'var(--text-3)',
                        }}>
                          {fmtSplit(skuTotal)}
                        </td>
                      </tr>

                      {/* Branch rows — shown when SKU is expanded */}
                      {expanded && rows.map(row => {
                        const rowTotal = Object.values(row.monthlyAmounts).reduce((s, v) => s + v, 0);
                        return (
                          <tr key={row.locationId} style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                            <td style={{ padding: '6px 12px 6px 30px', color: 'var(--text-2)' }}>
                              {row.locationName}
                            </td>
                            {selectedMonthDefs.map(m => {
                              const split = row.monthlyAmounts[m.num] || 0;
                              const cur   = row.currentMonthlyAdj[m.num] || 0;
                              return (
                                <td key={m.num} style={{ padding: '6px 12px', textAlign: 'right' }}>
                                  <span style={{
                                    fontWeight: 600,
                                    color: split > 0 ? '#16A34A' : split < 0 ? '#DC2626' : 'var(--text-3)',
                                  }}>
                                    {fmtSplit(split)}
                                  </span>
                                  {cur !== 0 && (
                                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                                      was {cur > 0 ? '+' : ''}{cur} → {cur + split > 0 ? '+' : ''}{cur + split}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                              {fmtSplit(rowTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* Grand total row */}
                <tr style={{ background: '#EBF0FF', borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-1)' }}>
                    Grand Total
                  </td>
                  {selectedMonthDefs.map(m => {
                    const colTotal = preview.rows.reduce((s, r) => s + (r.monthlyAmounts[m.num] || 0), 0);
                    return (
                      <td key={m.num} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>
                        {fmtSplit(colTotal)}
                      </td>
                    );
                  })}
                  <td style={{
                    padding: '9px 12px', textAlign: 'right', fontWeight: 800, fontSize: 13,
                    color: preview.totalEntered > 0 ? '#16A34A' : '#DC2626',
                  }}>
                    {fmtSplit(preview.totalAllocated)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Methodology footnote */}
          <div style={{ padding: '7px 14px', borderTop: '1px solid var(--border)', background: '#FAFBFC' }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              SKU and branch weights from historical sales Jan–May (weeks 1–23) ·
              Monthly weights from current System Forecast seasonal shape ·
              Rounded to whole units (largest-remainder method, sum guaranteed to equal total entered)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
