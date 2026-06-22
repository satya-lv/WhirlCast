/**
 * statusConfig.js — single source of truth for status → color mappings.
 *
 * Every badge, status pill, and color-coded cell in the app should derive
 * its colors from here, not inline. Covers four domains:
 *
 *   General     — success / warning / danger / info / neutral / purple / navy / grey
 *   Branch      — pending / submitted_clean / submitted_conflict / submitted_exceeded / exceeded / resolved / approved
 *   Inventory   — healthy / watch / below-rop / excess / critical
 *   KPI badge   — up / down / warn
 *
 * Usage:
 *   import { getStatusConfig } from '../utils/statusConfig';
 *   const { bg, color, label } = getStatusConfig('healthy');
 */

export const STATUS_CONFIG = {
  // ── General ─────────────────────────────────────────────────────────────────
  success:  { bg: '#DCFCE7', color: '#16A34A', label: 'Success' },
  warning:  { bg: '#FEF3C7', color: '#D97706', label: 'Warning' },
  danger:   { bg: '#FEE2E2', color: '#DC2626', label: 'Danger' },
  info:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Info' },
  neutral:  { bg: '#F3F4F6', color: '#6B7280', label: 'Neutral' },
  grey:     { bg: '#F3F4F6', color: '#6B7280', label: 'Grey' },   // alias for neutral
  purple:   { bg: '#F3E8FF', color: '#7C3AED', label: 'Purple' },
  navy:     { bg: '#EFF3FF', color: '#1B3A6B', label: 'Navy' },

  // ── Branch / override submission states ─────────────────────────────────────
  pending:            { bg: '#FEF3C7', color: '#D97706', label: 'Pending' },
  submitted_clean:    { bg: '#DCFCE7', color: '#16A34A', label: 'Submitted' },
  submitted:          { bg: '#DCFCE7', color: '#16A34A', label: 'Submitted' }, // alias
  submitted_conflict: { bg: '#FEF3C7', color: '#D97706', label: 'Conflict' },
  submitted_exceeded: { bg: '#FEE2E2', color: '#DC2626', label: 'Exceeded' },
  exceeded:           { bg: '#FEE2E2', color: '#DC2626', label: 'Exceeded' },
  resolved:           { bg: '#DCFCE7', color: '#16A34A', label: 'Resolved' },
  approved:           { bg: '#EFF3FF', color: '#1B3A6B', label: 'Approved' },

  // ── Inventory / stock statuses ───────────────────────────────────────────────
  // Thresholds: healthy = onHand ≥ ROP×1.4 | watch = onHand ≥ ROP | below-rop = onHand < ROP | excess = DoC > 90
  healthy:     { bg: '#DCFCE7', color: '#16A34A', label: 'Healthy' },
  watch:       { bg: '#FEF3C7', color: '#D97706', label: 'Watch' },
  'below-rop': { bg: '#FEE2E2', color: '#DC2626', label: 'Below ROP' },
  excess:      { bg: '#EFF6FF', color: '#1D4ED8', label: 'Excess' },
  critical:    { bg: '#FEE2E2', color: '#DC2626', label: 'Critical' },

  // ── KPI badge direction (used by KPICard) ────────────────────────────────────
  up:   { bg: '#DCFCE7', color: '#16A34A', label: '' },
  down: { bg: '#FEE2E2', color: '#DC2626', label: '' },
  warn: { bg: '#FEF3C7', color: '#D97706', label: '' },
};

const FALLBACK = { bg: '#F3F4F6', color: '#6B7280', label: '' };

/**
 * Returns { bg, color, label } for the given status key.
 * Falls back to neutral grey if the key is not recognised.
 */
export function getStatusConfig(type) {
  return STATUS_CONFIG[type] ?? FALLBACK;
}

/**
 * Derive inventory status from onHandUnits, rop, and daysOfCover.
 *   excess    → DoC > 90
 *   healthy   → onHand ≥ ROP × 1.4
 *   watch     → onHand ≥ ROP (and < ROP × 1.4)
 *   below-rop → onHand < ROP
 */
export function inventoryStatus(onHandUnits, rop, daysOfCover) {
  if (daysOfCover > 90) return 'excess';
  if (onHandUnits >= rop * 1.4) return 'healthy';
  if (onHandUnits >= rop) return 'watch';
  return 'below-rop';
}

/**
 * Map branch override submission state to a status key.
 * branchOverrides — array of override objects with { override_value, ai_forecast, status }
 */
export function branchSubmissionStatus(branchOverrides) {
  const hasSubmitted = branchOverrides.some(o => o.status === 'submitted' || o.status !== 'pending');
  if (!hasSubmitted) return 'pending';
  const hasExceeded = branchOverrides.some(o => {
    if (!o.override_value || !o.ai_forecast) return false;
    return Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast) > 0.3;
  });
  if (hasExceeded) return 'submitted_exceeded';
  const hasConflict = branchOverrides.some(o => {
    if (!o.override_value || !o.ai_forecast) return false;
    return Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast) > 0.2;
  });
  return hasConflict ? 'submitted_conflict' : 'submitted_clean';
}
