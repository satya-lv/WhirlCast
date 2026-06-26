/**
 * ExceptionsTab — Demand Planning Exceptions tab content.
 *
 * Four exception categories per spec Section 5.4:
 *   accuracy_degradation  — forecast consistently missing actuals
 *   large_override        — planner adjustment swings far from system forecast
 *   pattern_shift         — SKU-location classification recently changed
 *   npi_risk              — NPI forecasts with low confidence
 *
 * Severity color-coding via statusConfig.js:
 *   high   → danger  (#DC2626 / #FEE2E2)
 *   medium → warning (#D97706 / #FEF3C7)
 *   low    → info    (#1D4ED8 / #EFF6FF)
 *
 * Financial impact formatted as ₹X.X Cr / ₹X.X L / ₹N,NNN
 * — same fmtINR convention as SupplyPlanning.jsx lines 76–80.
 */
import React, { useState, useMemo } from 'react';
import { getStatusConfig } from '../../utils/statusConfig';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRelWeek(w) {
  if (w < 24)   return `M${w}`;
  if (w === 24) return 'Current Month';
  return `M+${w - 24}`;
}

function fmtINR(v) {
  if (v == null || v === 0) return '—';
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

const SEVERITY_STATUS = { high: 'danger', medium: 'warning', low: 'info' };

const CATEGORY_META = {
  accuracy_degradation: { label: 'Accuracy Degradation',  bg: '#FEF3C7', color: '#B45309' },
  large_override:       { label: 'Large Planner Override', bg: '#F3E8FF', color: '#7C3AED' },
  pattern_shift:        { label: 'Pattern Shift',          bg: '#EFF6FF', color: '#1D4ED8' },
  npi_risk:             { label: 'NPI Risk',               bg: '#F0FDF4', color: '#15803D' },
};

// ── Chip button ───────────────────────────────────────────────────────────────

function CategoryChip({ label, count, isActive, meta, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 10, fontWeight: 700,
        padding: '3px 9px', borderRadius: 6,
        border: `1px solid ${isActive ? (meta?.color || 'var(--navy-accent)') + '50' : 'var(--border)'}`,
        background: isActive ? (meta?.bg || '#EFF3FF') : 'var(--bg)',
        color: isActive ? (meta?.color || 'var(--navy-accent)') : 'var(--text-2)',
        cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
      }}
    >
      {label}{count != null ? ` (${count})` : ''}
    </button>
  );
}

// ── Single exception card ─────────────────────────────────────────────────────

function ExceptionCard({ exception: exc }) {
  const sc      = getStatusConfig(SEVERITY_STATUS[exc.severity] || 'neutral');
  const catMeta = CATEGORY_META[exc.category] || { label: exc.category, bg: '#F3F4F6', color: '#6B7280' };

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md, 10px)',
      borderLeft: `4px solid ${sc.color}`,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>

        {/* Row 1: severity badge + category chip + spacer + week + impact + ack button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Severity */}
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
            background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 6,
          }}>
            {exc.severity}
          </span>

          {/* Category */}
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: catMeta.bg, color: catMeta.color,
            padding: '2px 8px', borderRadius: 6,
          }}>
            {catMeta.label}
          </span>

          <span style={{ flex: 1 }} />

          {/* Week reference */}
          <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            {toRelWeek(exc.weekNumber)}
          </span>

          {/* Financial impact */}
          <span style={{
            fontSize: 12, fontWeight: 700, color: sc.color, whiteSpace: 'nowrap',
          }}>
            {fmtINR(exc.financialImpact)}
          </span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3 }}>
          {exc.title}
        </div>

        {/* SKU · Location */}
        <div style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{exc.sku.replace(/_/g, ' ')}</span>
          <span style={{ color: 'var(--text-3)' }}>·</span>
          <span>{exc.locationName}</span>
        </div>

        {/* Detail */}
        <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55 }}>
          {exc.detail}
        </div>

        {/* Recommendation — left-bordered callout */}
        <div style={{
          fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55,
          borderLeft: `3px solid ${sc.color}50`,
          paddingLeft: 8, marginTop: 1,
        }}>
          <span style={{ fontWeight: 700, color: sc.color }}>Rec: </span>
          {exc.recommendation}
        </div>
      </div>
    </div>
  );
}

// ── ExceptionsTab ─────────────────────────────────────────────────────────────

export default function ExceptionsTab({ data, loading }) {
  const [selectedCategory, setSelectedCategory] = useState('');

  // Compute summary counts from live exceptions array so they auto-update after acknowledge
  const summary = useMemo(() => {
    const excs = data?.exceptions || [];
    const bySeverity = { high: 0, medium: 0, low: 0 };
    const byCategory = { accuracy_degradation: 0, large_override: 0, pattern_shift: 0, npi_risk: 0 };
    for (const e of excs) {
      if (bySeverity[e.severity]  !== undefined) bySeverity[e.severity]++;
      if (byCategory[e.category] !== undefined) byCategory[e.category]++;
    }
    return { total: excs.length, bySeverity, byCategory };
  }, [data?.exceptions]);

  const visibleExceptions = useMemo(() => {
    const excs = data?.exceptions || [];
    if (!selectedCategory) return excs;
    return excs.filter(e => e.category === selectedCategory);
  }, [data?.exceptions, selectedCategory]);

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--text-3)', fontSize: 13,
      }}>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        Loading exceptions…
      </div>
    );
  }

  // ── Empty state (no open exceptions, or all acknowledged) ───────────────────

  if (!data || data.exceptions.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 28, color: '#16A34A', opacity: 0.6 }}>✓</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>
          No open exceptions
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          No active exceptions
        </span>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Summary strip + category filter */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 10px)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
      }}>
        {/* Left: total + severity counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>
            {summary.total} Open
          </span>
          {(['high', 'medium', 'low']).map(sev => {
            const sc = getStatusConfig(SEVERITY_STATUS[sev]);
            return (
              <span key={sev} style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.3px',
                textTransform: 'uppercase',
                background: sc.bg, color: sc.color,
                padding: '2px 8px', borderRadius: 6,
              }}>
                {sev}: {summary.bySeverity[sev]}
              </span>
            );
          })}
        </div>

        {/* Right: category filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.4px',
            textTransform: 'uppercase', color: 'var(--text-3)', marginRight: 2 }}>
            Filter
          </span>
          <CategoryChip
            label="All" count={summary.total}
            isActive={selectedCategory === ''}
            onClick={() => setSelectedCategory('')}
          />
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <CategoryChip
              key={key}
              label={meta.label}
              count={summary.byCategory[key]}
              isActive={selectedCategory === key}
              meta={meta}
              onClick={() => setSelectedCategory(prev => prev === key ? '' : key)}
            />
          ))}
        </div>
      </div>

      {/* Filtered empty state */}
      {visibleExceptions.length === 0 && selectedCategory && (
        <div style={{
          padding: 24, textAlign: 'center',
          color: 'var(--text-3)', fontSize: 12,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md, 10px)',
        }}>
          No open exceptions in this category
        </div>
      )}

      {/* Exception cards — sorted high→medium→low by API, then by financialImpact DESC */}
      {visibleExceptions.map(exc => (
        <ExceptionCard
          key={exc.exceptionId}
          exception={exc}
        />
      ))}
    </div>
  );
}
