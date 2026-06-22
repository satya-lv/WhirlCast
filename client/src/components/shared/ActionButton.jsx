/**
 * ActionButton — 3-state action button per IBP_SOP_SPEC.md §7.4.
 *
 * Every simulated or async action follows: idle → loading → done.
 * The loading state persists until `onAction` resolves (or rejects).
 * For simulated actions (mock API calls), wrap the call in simulatedAction()
 * so the loading phase is never instant-commit.
 *
 * States:
 *   idle    — normal, clickable
 *   loading — spinner + loadingLabel, pointer-events disabled
 *   done    — checkmark + doneLabel, auto-resets to idle after 2.5s
 *
 * Props:
 *   label        {string}   — idle button text
 *   loadingLabel {string}   — in-flight text (e.g. "Submitting…")
 *   doneLabel    {string}   — done text (e.g. "Submitted ✓"), defaults to "Done ✓"
 *   onAction     {() => Promise<void>}  — called on click; if it throws, returns to idle
 *   variant      {'primary'|'danger'|'outline'|'ghost'}
 *   fullWidth    {boolean}
 *   disabled     {boolean}
 *   size         {'sm'|'md'}   — sm = compact (32px), md = default (44px min-height)
 *   icon         {ReactNode}   — icon shown before label in idle state
 *
 * Usage:
 *   <ActionButton
 *     label="Submit Forecast (3)"
 *     loadingLabel="Submitting…"
 *     doneLabel="Submitted ✓"
 *     onAction={() => simulatedAction(() => submitForecast())}
 *   />
 */
import React, { useState, useEffect, useRef } from 'react';

const VARIANT_STYLES = {
  primary: {
    idle:    { background: 'var(--navy-accent)', color: 'white', border: 'none' },
    loading: { background: '#9CA3AF',            color: 'white', border: 'none' },
    done:    { background: '#16A34A',            color: 'white', border: 'none' },
  },
  danger: {
    idle:    { background: 'var(--danger)', color: 'white', border: 'none' },
    loading: { background: '#9CA3AF',       color: 'white', border: 'none' },
    done:    { background: '#16A34A',       color: 'white', border: 'none' },
  },
  outline: {
    idle:    { background: 'transparent', color: 'var(--navy-accent)', border: '1.5px solid var(--navy-accent)' },
    loading: { background: 'transparent', color: '#9CA3AF',            border: '1.5px solid #9CA3AF' },
    done:    { background: '#DCFCE7',     color: '#16A34A',            border: '1.5px solid #16A34A' },
  },
  ghost: {
    idle:    { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' },
    loading: { background: 'transparent', color: '#9CA3AF',       border: '1px solid var(--border)' },
    done:    { background: '#DCFCE7',     color: '#16A34A',       border: '1px solid #16A34A' },
  },
};

export function ActionButton({
  label,
  loadingLabel,
  doneLabel,
  onAction,
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  size = 'md',
  icon,
  style,
  ...rest
}) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'loading' | 'done'
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleClick = async () => {
    if (phase !== 'idle' || disabled) return;
    setPhase('loading');
    try {
      await onAction?.();
      setPhase('done');
      resetTimer.current = setTimeout(() => setPhase('idle'), 2500);
    } catch {
      setPhase('idle');
    }
  };

  const variantMap = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
  const phaseStyle = variantMap[phase];
  const isDisabled = phase !== 'idle' || disabled;

  const sizeStyle = size === 'sm'
    ? { padding: 'var(--sp-6) var(--sp-12)', fontSize: 12, minHeight: 32 }
    : { padding: 'var(--sp-10) var(--sp-18)', fontSize: 14, minHeight: 44 };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-8)',
        borderRadius: 'var(--radius-sm)',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s ease, filter 0.15s ease',
        width: fullWidth ? '100%' : undefined,
        opacity: disabled && phase === 'idle' ? 0.55 : 1,
        ...sizeStyle,
        ...phaseStyle,
        ...style,
      }}
      onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.filter = 'brightness(1.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
      {...rest}
    >
      {phase === 'loading' && (
        <span style={{
          width: 13, height: 13, flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.35)',
          borderTopColor: 'currentColor',
          borderRadius: 'var(--radius-full)',
          animation: 'spin 0.8s linear infinite',
        }} />
      )}
      {phase === 'done' && <span style={{ fontWeight: 700 }}>✓</span>}
      {phase === 'idle' && icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span>
        {phase === 'idle'    ? label :
         phase === 'loading' ? (loadingLabel ?? label) :
                               (doneLabel ?? 'Done ✓')}
      </span>
    </button>
  );
}

/**
 * simulatedAction — wraps a callback with a minimum ~700ms loading phase.
 * Per spec §7.4: "never instant-commit" — every action has a visible loading pause.
 *
 * Usage:
 *   onAction={() => simulatedAction(() => submitForecast(payload))}
 *   onAction={() => simulatedAction()}   // pure UI demo with no real call
 */
export async function simulatedAction(callback, delayMs = 700) {
  await Promise.all([
    new Promise(r => setTimeout(r, delayMs)),
    Promise.resolve(callback?.()),
  ]);
}
